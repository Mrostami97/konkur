import { Role } from "@prisma/client";
import { UnauthorizedException } from "@nestjs/common";
import { IdentityService } from "../src/modules/identity/identity.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { OtpProvider } from "../src/modules/identity/otp-provider";

function buildFakePrisma() {
  const users = new Map<string, any>();
  const userRoles: any[] = [];
  const otpCodes: any[] = [];
  const sessions: any[] = [];
  const outboxEvents: any[] = [];
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  return {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = where.phone
          ? ([...users.values()].find((u) => u.phone === where.phone) ?? null)
          : (users.get(where.id) ?? null);
        if (!user) return null;
        if (include?.roles) {
          return { ...user, roles: userRoles.filter((r) => r.userId === user.id) };
        }
        return user;
      }),
      create: jest.fn(async ({ data }: any) => {
        const user = { id: nextId(), ...data };
        users.set(user.id, user);
        return user;
      }),
    },
    userRole: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId(), ...data };
        userRoles.push(row);
        return row;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId(), ...data };
        outboxEvents.push(row);
        return row;
      }),
    },
    otpCode: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId(), attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
        otpCodes.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          otpCodes
            .filter((o) => o.userId === where.userId && o.consumedAt === where.consumedAt)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
        );
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = otpCodes.find((o) => o.id === where.id);
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      }),
    },
    session: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId(), revokedAt: null, ...data };
        sessions.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const session = sessions.find((s) => s.tokenHash === where.tokenHash);
        if (!session) return null;
        const user = users.get(session.userId);
        return { ...session, user: { ...user, roles: userRoles.filter((r) => r.userId === user.id) } };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = sessions.find((s) => s.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    _debug: { users, userRoles, otpCodes, sessions, outboxEvents },
  } as unknown as PrismaService & { _debug: any };
}

describe("IdentityService", () => {
  const phone = "+989120000009";
  let prisma: ReturnType<typeof buildFakePrisma>;
  let audit: AuditService;
  let sentCodes: string[];
  let otpProvider: OtpProvider;
  let service: IdentityService;

  beforeEach(() => {
    prisma = buildFakePrisma();
    audit = { log: jest.fn() } as unknown as AuditService;
    sentCodes = [];
    otpProvider = {
      send: jest.fn(async (_phone: string, code: string) => {
        sentCodes.push(code);
      }),
    };
    service = new IdentityService(prisma, audit, otpProvider);
  });

  it("creates a new user with STUDENT role and emits UserOnboarded on first OTP request", async () => {
    await service.requestOtp(phone);
    expect(prisma._debug.users.size).toBe(1);
    expect(prisma._debug.userRoles[0].role).toBe(Role.STUDENT);
    expect(prisma._debug.outboxEvents[0].eventType).toBe("UserOnboarded");
    expect(sentCodes).toHaveLength(1);
  });

  it("verifies the correct code and issues a session", async () => {
    await service.requestOtp(phone);
    const code = sentCodes[0];
    const { user } = await service.verifyOtp(phone, code, {});
    expect(user.phone).toBe(phone);
    expect(user.roles).toContain(Role.STUDENT);
    expect(prisma._debug.sessions).toHaveLength(1);
  });

  it("rejects a wrong code", async () => {
    await service.requestOtp(phone);
    await expect(service.verifyOtp(phone, "000000", {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects verification for a phone that never requested an OTP", async () => {
    await expect(service.verifyOtp("+989129999999", "123456", {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("invalidates the session after logout", async () => {
    await service.requestOtp(phone);
    const code = sentCodes[0];
    const { token } = await service.verifyOtp(phone, code, {});
    expect(await service.validateSession(token)).not.toBeNull();
    await service.logout(token);
    expect(await service.validateSession(token)).toBeNull();
  });
});
