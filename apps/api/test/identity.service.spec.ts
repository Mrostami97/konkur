import { canonicalPhone } from "../src/modules/identity/phone";
import { Role } from "@prisma/client";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { IdentityService } from "../src/modules/identity/identity.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ConsoleOtpProvider, OtpProvider } from "../src/modules/identity/otp-provider";
import { hashPassword } from "../src/modules/identity/password-hasher";
import { UserAdminService } from "../src/modules/identity/user-admin.service";

function buildFakePrisma() {
  const users = new Map<string, any>();
  const userRoles: any[] = [];
  const otpCodes: any[] = [];
  const sessions: any[] = [];
  const outboxEvents: any[] = [];
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  const db = {
    $executeRaw: jest.fn(async () => 1),
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(),
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
      findMany: jest.fn(async ({ where, include }: any) => {
        const phones: string[] = where.phone.in;
        return [...users.values()]
          .filter((u) => phones.includes(u.phone))
          .map((u) => (include?.roles ? { ...u, roles: userRoles.filter((r) => r.userId === u.id) } : u));
      }),
      create: jest.fn(async ({ data, include }: any) => {
        const user = { id: nextId(), ...data };
        users.set(user.id, user);
        return include?.roles ? { ...user, roles: userRoles.filter((r) => r.userId === user.id) } : user;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        Object.assign(user, data);
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
        const found = (
          otpCodes
            .filter((o) => o.userId === where.userId && o.consumedAt === where.consumedAt)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
        );
        return found ? { ...found } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = otpCodes.find((o) => o.id === where.id);
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = otpCodes.filter((row) =>
          (!where.id || row.id === where.id) &&
          (!where.userId || row.userId === where.userId) &&
          (where.consumedAt === undefined || row.consumedAt === where.consumedAt) &&
          (!where.expiresAt?.gt || row.expiresAt > where.expiresAt.gt) &&
          (where.attempts?.lt === undefined || row.attempts < where.attempts.lt) &&
          (!where.codeHash || row.codeHash === where.codeHash),
        );
        for (const row of rows) {
          if (data.attempts?.increment) row.attempts += data.attempts.increment;
          if (data.consumedAt) row.consumedAt = data.consumedAt;
        }
        return { count: rows.length };
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
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = sessions.filter((row) => row.userId === where.userId &&
          row.revokedAt === where.revokedAt && row.tokenHash !== where.tokenHash?.not);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      }),
    },
    _debug: { users, userRoles, otpCodes, sessions, outboxEvents },
  };
  // This double does not simulate database locks or transactional rollback.
  // updateMany above evaluates the actual predicates against current records;
  // the dedicated isolated-Postgres suite verifies the database behavior.
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
  return db as unknown as PrismaService & { _debug: any };
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
    // Stored in one form, 0912..., whatever was typed.
    expect(user.phone).toBe(canonicalPhone(phone));
    expect(user.roles).toContain(Role.STUDENT);
    expect(prisma._debug.sessions).toHaveLength(1);
  });

  it("rejects a wrong code", async () => {
    await service.requestOtp(phone);
    const wrong = sentCodes[0] === "000000" ? "111111" : "000000";
    await expect(service.verifyOtp(phone, wrong, {})).rejects.toBeInstanceOf(
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

  it("verifies a password and issues a session alongside OTP", async () => {
    await service.requestOtp(phone);
    const user = [...prisma._debug.users.values()][0];
    user.passwordHash = await hashPassword("123");

    const { user: sessionUser } = await service.loginWithPassword(phone, "123", {});
    expect(sessionUser.phone).toBe(canonicalPhone(phone));
    expect(prisma._debug.sessions).toHaveLength(1);
    expect((audit.log as jest.Mock).mock.calls.at(-1)?.[0].metadata).toEqual({ method: "password" });
  });

  it("rejects an invalid password", async () => {
    await service.requestOtp(phone);
    const user = [...prisma._debug.users.values()][0];
    user.passwordHash = await hashPassword("123");

    await expect(service.loginWithPassword(phone, "wrong", {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an old-password login whose user snapshot predates a completed rotation", async () => {
    await service.requestOtp(phone);
    const user = [...prisma._debug.users.values()][0];
    user.passwordHash = await hashPassword("synthetic-old-password");
    const admin = new UserAdminService(prisma, audit);
    const originalRead = prisma.user.findMany.bind(prisma.user);
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readFinished = new Promise<void>((resolve) => { entered = resolve; });
    const spy = jest.spyOn(prisma.user, "findMany").mockImplementationOnce((...args) =>
      originalRead(...args).then(async (snapshot) => {
        entered();
        await gate;
        return snapshot;
      }) as never);
    const pendingLogin = service.loginWithPassword(phone, "synthetic-old-password", {});
    // Attach the rejection observer before releasing the controlled read.
    const denied = expect(pendingLogin).rejects.toBeInstanceOf(UnauthorizedException);
    try {
      await readFinished;
      await admin.setPassword("operator", user.id, "synthetic-new-password");
      release();
      await denied;
      expect(prisma._debug.sessions).toHaveLength(0);
      expect((await service.loginWithPassword(phone, "synthetic-new-password", {})).user.id).toBe(user.id);
    } finally {
      release();
      spy.mockRestore();
    }
  });

  it("revokes a password session when login completes before rotation", async () => {
    await service.requestOtp(phone);
    const user = [...prisma._debug.users.values()][0];
    user.passwordHash = await hashPassword("synthetic-old-password");
    const admin = new UserAdminService(prisma, audit);
    const { token } = await service.loginWithPassword(phone, "synthetic-old-password", {});
    expect((await service.validateSession(token))?.id).toBe(user.id);
    expect((await admin.setPassword("operator", user.id, "synthetic-new-password")).sessionsRevoked).toBe(1);
    expect(await service.validateSession(token)).toBeNull();
  });

  it("claims a code once when two verifications read the same pending snapshot", async () => {
    await service.requestOtp(phone);
    const results = await Promise.allSettled([
      service.verifyOtp(phone, sentCodes[0], {}),
      service.verifyOtp(phone, sentCodes[0], {}),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(prisma._debug.sessions).toHaveLength(1);
    expect(prisma._debug.otpCodes[0].consumedAt).not.toBeNull();
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it("commits failed attempts and caps concurrent comparisons at the challenge budget", async () => {
    await service.requestOtp(phone);
    const wrong = sentCodes[0] === "000000" ? "111111" : "000000";
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.verifyOtp(phone, wrong, {})));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(prisma._debug.otpCodes[0].attempts).toBe(5);
    await expect(service.verifyOtp(phone, sentCodes[0], {})).rejects.toThrow("too many attempts");
    expect(prisma._debug.sessions).toHaveLength(0);
  });

  it("retires prior challenges so consuming the newest cannot reactivate an older code", async () => {
    await service.requestOtp(phone);
    const oldCode = sentCodes[0];
    await service.requestOtp(phone);
    expect(prisma._debug.otpCodes[0].consumedAt).not.toBeNull();
    await service.verifyOtp(phone, sentCodes[1], {});
    await expect(service.verifyOtp(phone, oldCode, {})).rejects.toThrow("invalid phone or code");
    expect(prisma._debug.sessions).toHaveLength(1);
  });

  it("refuses the console OTP method in production before database work", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const consoleService = new IdentityService(prisma, audit, new ConsoleOtpProvider());
      await expect(consoleService.requestOtp(phone)).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(consoleService.verifyOtp(phone, "123456", {})).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma._debug.users.size).toBe(0);
      expect(prisma._debug.sessions).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
