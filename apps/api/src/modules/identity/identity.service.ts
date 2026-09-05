import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { createHash, randomBytes, randomInt } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "./otp-provider";

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

  async requestOtp(phone: string, attribution?: { source?: string; campaignCode?: string }): Promise<void> {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;
    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
      isNewUser = true;
    }

    if (isNewUser) {
      await this.prisma.userRole.create({
        data: { userId: user.id, role: Role.STUDENT },
      });
      await this.prisma.outboxEvent.create({
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
      });
    }

    const code = generateOtpCode();
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        phone,
        codeHash: hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    await this.otpProvider.send(phone, code);
  }

  async verifyOtp(phone: string, code: string, ctx: AuthContext): Promise<{ token: string; user: SessionUser }> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { roles: true },
    });
    if (!user) throw new UnauthorizedException("invalid phone or code");

    const otp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) throw new UnauthorizedException("invalid phone or code");
    if (otp.expiresAt < new Date()) throw new UnauthorizedException("code expired");
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new UnauthorizedException("too many attempts");

    if (otp.codeHash !== hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("invalid phone or code");
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString("hex");
    await this.prisma.session.create({
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
    });

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
