import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { createHash, randomBytes, randomInt } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsoleOtpProvider, OTP_PROVIDER, OtpProvider } from "./otp-provider";
import { verifyPassword } from "./password-hasher";
import { phoneVariants } from "./phone";

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 5);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 720);

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface SessionUser {
  id: string;
  phone: string;
  roles: Role[];
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
  ) {}

  private assertOtpAvailable() {
    if (process.env.NODE_ENV === "production" && this.otpProvider instanceof ConsoleOtpProvider) {
      throw new ServiceUnavailableException("OTP login is not configured");
    }
  }

  async requestOtp(phone: string, attribution?: { source?: string; campaignCode?: string }): Promise<void> {
    this.assertOtpAvailable();
    const code = generateOtpCode();
    await this.prisma.$transaction(async (tx) => {
      // Issuance and verification use the same lock, including first registration.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
      let user = await tx.user.findUnique({ where: { phone } });
      if (!user) {
        user = await tx.user.create({ data: { phone } });
        await tx.userRole.create({ data: { userId: user.id, role: Role.STUDENT } });
        await tx.outboxEvent.create({
          data: {
            eventType: "UserOnboarded",
            payload: {
              userId: user.id,
              phone: user.phone,
              source: attribution?.source,
              campaignCode: attribution?.campaignCode,
            },
          },
        });
        await this.audit.log({
          actorUserId: user.id,
          action: "user.registered",
          targetType: "User",
          targetId: user.id,
        }, tx);
      }
      // A new challenge replaces every older pending challenge, including expired ones.
      await tx.otpCode.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.otpCode.create({
        data: {
          userId: user.id,
          phone,
          codeHash: hash(code),
          expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
        },
      });
    });
    await this.otpProvider.send(phone, code);
  }

  async verifyOtp(phone: string, code: string, ctx: AuthContext): Promise<{ token: string; user: SessionUser }> {
    this.assertOtpAvailable();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
      const user = await tx.user.findUnique({ where: { phone }, include: { roles: true } });
      if (!user) return { ok: false as const, reason: "invalid phone or code" };
      const otp = await tx.otpCode.findFirst({
        where: { userId: user.id, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (!otp) return { ok: false as const, reason: "invalid phone or code" };
      const now = new Date();
      if (otp.expiresAt <= now) return { ok: false as const, reason: "code expired" };
      if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false as const, reason: "too many attempts" };
      const activeChallenge = {
        id: otp.id,
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: OTP_MAX_ATTEMPTS },
        codeHash: otp.codeHash,
      };
      if (otp.codeHash !== hash(code)) {
        await tx.otpCode.updateMany({
          where: activeChallenge,
          data: { attempts: { increment: 1 } },
        });
        // Throw only after commit: throwing here would roll back the failed attempt.
        return { ok: false as const, reason: "invalid phone or code" };
      }
      const claimed = await tx.otpCode.updateMany({
        where: activeChallenge,
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return { ok: false as const, reason: "invalid phone or code" };
      return { ok: true as const, session: await this.issueSession(user, ctx, "otp", tx) };
    });
    if (!result.ok) throw new UnauthorizedException(result.reason);
    return result.session;
  }

  async loginWithPassword(
    phone: string,
    password: string,
    ctx: AuthContext,
  ): Promise<{ token: string; user: SessionUser }> {
    // The same mobile number may be stored as 0935..., +98935... or 98935...
    const candidates = await this.prisma.user.findMany({
      where: { phone: { in: phoneVariants(phone) } },
      include: { roles: true },
    });
    for (const user of candidates) {
      if (user.passwordHash && (await verifyPassword(password, user.passwordHash))) {
        return this.issueSession(user, ctx, "password");
      }
    }
    throw new UnauthorizedException("invalid phone or password");
  }

  private async issueSession(
    user: { id: string; phone: string; roles: { role: Role }[] },
    ctx: AuthContext,
    method: "otp" | "password",
    tx?: Prisma.TransactionClient,
  ): Promise<{ token: string; user: SessionUser }> {
    const rawToken = randomBytes(32).toString("hex");
    const db = tx ?? this.prisma;
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hash(rawToken),
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000),
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: "auth.login",
      targetType: "User",
      targetId: user.id,
      metadata: { method },
    }, tx);

    return {
      token: rawToken,
      user: { id: user.id, phone: user.phone, roles: user.roles.map((r) => r.role) },
    };
  }

  async logout(rawToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hash(rawToken) },
    });
    if (!session || session.revokedAt) return;
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorUserId: session.userId,
      action: "auth.logout",
      targetType: "User",
      targetId: session.userId,
    });
  }

  async validateSession(rawToken: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hash(rawToken) },
      include: { user: { include: { roles: true } } },
    });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    return {
      id: session.user.id,
      phone: session.user.phone,
      roles: session.user.roles.map((r) => r.role),
    };
  }
}
