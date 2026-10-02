import { createHash } from "crypto";
import { UserAdminService } from "../src/modules/identity/user-admin.service";
import { AdminController } from "../src/modules/identity/admin.controller";
import { RequestWithUser } from "../src/modules/identity/guards/session-auth.guard";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuditService } from "../src/modules/audit/audit.service";

describe("administrator password session rotation", () => {
  const currentToken = "synthetic-current-session";
  const currentHash = createHash("sha256").update(currentToken).digest("hex");
  function build() {
    const sessions = [
      { userId: "admin", tokenHash: currentHash, revokedAt: null as Date | null },
      { userId: "admin", tokenHash: "synthetic-other-session-hash", revokedAt: null as Date | null },
      { userId: "other", tokenHash: "synthetic-other-user-session-hash", revokedAt: null as Date | null },
    ];
    const updateMany = jest.fn(async ({ where, data }: {
      where: { userId: string; revokedAt: null; tokenHash?: { not: string } };
      data: { revokedAt: Date };
    }) => {
      const matched = sessions.filter((session) => session.userId === where.userId && session.revokedAt === null && session.tokenHash !== where.tokenHash?.not);
      matched.forEach((session) => { session.revokedAt = data.revokedAt; });
      return { count: matched.length };
    });
    const tx = { user: { update: jest.fn() }, session: { updateMany } };
    const prisma = {
      user: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })) },
      $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    };
    const audit = { log: jest.fn() };
    return { service: new UserAdminService(prisma as unknown as PrismaService, audit as unknown as AuditService), sessions, updateMany };
  }

  it("preserves exactly the authenticated current session and revokes other admin sessions", async () => {
    const { service, sessions, updateMany } = build();
    expect(await service.setPassword("admin", "admin", "synthetic-strong-password", currentToken)).toEqual({ passwordSet: true, sessionsRevoked: 1 });
    expect(sessions[0].revokedAt).toBeNull();
    expect(sessions[1].revokedAt).toBeInstanceOf(Date);
    expect(sessions[2].revokedAt).toBeNull();
    expect(updateMany.mock.calls[0][0].where.tokenHash).toEqual({ not: currentHash });
  });

  it("revokes all target sessions if current request context is missing", async () => {
    const { service, sessions } = build();
    expect((await service.setPassword("admin", "admin", "synthetic-strong-password")).sessionsRevoked).toBe(2);
    expect(sessions.slice(0, 2).every((session) => session.revokedAt !== null)).toBe(true);
    expect(sessions[2].revokedAt).toBeNull();
  });

  it("does not preserve a session when setting another account's password", async () => {
    const { service, sessions } = build();
    expect((await service.setPassword("admin", "other", "synthetic-strong-password", currentToken)).sessionsRevoked).toBe(1);
    expect(sessions[2].revokedAt).toBeInstanceOf(Date);
    expect(sessions[0].revokedAt).toBeNull();
  });

  it("takes the retained session only from the guarded request cookie", () => {
    const setPassword = jest.fn();
    const controller = new AdminController({ setPassword } as unknown as UserAdminService);
    controller.setPassword({ user: { id: "admin" }, cookies: { session: currentToken } } as unknown as RequestWithUser, "admin", { password: "synthetic-strong-password" });
    expect(setPassword).toHaveBeenCalledWith("admin", "admin", "synthetic-strong-password", currentToken);
  });
});
