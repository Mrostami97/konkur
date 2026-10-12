import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { createHash, randomBytes, randomInt } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsoleOtpProvider, OTP_PROVIDER, OtpProvider } from "./otp-provider";
import { verifyPassword } from "./password-hasher";
import { canonicalPhone, phoneVariants } from "./phone";
import { verifyTelegramInitData } from "./telegram-init-data";

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

/**
 * The account a mobile number signs in to. Older sign-ins stored the number
 * as typed, so one person may have several rows; the staff account wins, then
 * the oldest, so nobody is quietly moved to a fresh empty student account.
 */
async function accountFor(tx: Prisma.TransactionClient, phone: string) {
  const users = await tx.user.findMany({ where: { phone: { in: phoneVariants(phone) } }, include: { roles: true }, orderBy: { createdAt: "asc" } });
  return users.find((user) => user.roles.some((role) => role.role !== Role.STUDENT)) ?? users[0] ?? null;
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

  async requestOtp(typed: string, attribution?: { source?: string; campaignCode?: string }): Promise<void> {
    this.assertOtpAvailable();
    // 0935..., 935... and +98935... are one person: one account, stored as 0935...
    const phone = canonicalPhone(typed);
    const code = generateOtpCode();
    await this.prisma.$transaction(async (tx) => {
      // Issuance and verification use the same lock, including first registration.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
      let user = await accountFor(tx, phone);
      if (!user) {
        user = await tx.user.create({ data: { phone }, include: { roles: true } });
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

  async verifyOtp(typed: string, code: string, ctx: AuthContext): Promise<{ token: string; user: SessionUser }> {
    this.assertOtpAvailable();
    const phone = canonicalPhone(typed);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
      const user = await accountFor(tx, phone);
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
        // Keep password hashing outside the lock. A rotation updates this same
        // user row before revoking sessions, so recheck the verified credential
        // under the lock and issue the session before releasing it.
        return this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;
          const current = await tx.user.findUnique({ where: { id: user.id }, include: { roles: true } });
          if (!current || current.passwordHash !== user.passwordHash) {
            throw new UnauthorizedException("invalid phone or password");
          }
          return this.issueSession(current, ctx, "password", tx);
        });
      }
    }
    throw new UnauthorizedException("invalid phone or password");
  }

  private async issueSession(
    user: { id: string; phone: string; roles: { role: Role }[] },
    ctx: AuthContext,
    method: "otp" | "password" | "telegram",
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

  /** Whether the Telegram mini app sign-in is switched on (the bot token is set). */
  get telegramConfigured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  private telegramUser(initData: string) {
    const user = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN ?? "");
    if (!user) throw new UnauthorizedException("invalid telegram data");
    return user;
  }

  /**
   * Signs in the site account linked to this Telegram account, or returns
   * null when none is linked yet (the mini app then asks for a normal
   * sign-in once, and links it).
   */
  async loginWithTelegram(initData: string, ctx: AuthContext): Promise<{ token: string; user: SessionUser } | null> {
    const telegram = this.telegramUser(initData);
    const link = await this.prisma.telegramAccount.findUnique({
      where: { telegramId: telegram.id },
      include: { user: { include: { roles: true } } },
    });
    if (!link) return null;
    await this.prisma.telegramAccount.update({
      where: { telegramId: telegram.id },
      data: { lastSeenAt: new Date(), username: telegram.username, firstName: telegram.firstName },
    });
    return this.issueSession(link.user, ctx, "telegram");
  }

  /**
   * Links the signed-in person's account to the Telegram account the mini app
   * runs in. Both sides are proven: the session for the site, the signature
   * for Telegram. A Telegram account moves to the latest account it signed in
   * to; an account keeps one Telegram account.
   */
  async linkTelegram(userId: string, initData: string) {
    const telegram = this.telegramUser(initData);
    await this.prisma.$transaction(async (tx) => {
      await tx.telegramAccount.deleteMany({ where: { OR: [{ telegramId: telegram.id }, { userId }] } });
      await tx.telegramAccount.create({
        data: { telegramId: telegram.id, userId, username: telegram.username, firstName: telegram.firstName },
      });
      await this.audit.log({ actorUserId: userId, action: "auth.telegram_linked", targetType: "User", targetId: userId }, tx);
    });
    return { linked: true };
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
