import { PrismaClient, Role } from "@prisma/client";
import { verifyPassword } from "../src/modules/identity/password-hasher";
import {
  ensureSeedAdmin,
  SEED_ADMIN_PASSWORD,
  SEED_ADMIN_PHONE,
} from "../src/seed-admin";

describe("ensureSeedAdmin", () => {
  const baseUser = {
    id: "admin-user-id",
    phone: SEED_ADMIN_PHONE,
    fullName: null,
    email: null,
    passwordHash: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  function createPrismaMock(passwordHash: string | null) {
    const user = { ...baseUser, passwordHash };
    const userUpdate = jest.fn(async ({ data }: { data: { passwordHash: string } }) => ({
      ...user,
      passwordHash: data.passwordHash,
    }));
    const prisma = {
      user: {
        upsert: jest.fn(async () => user),
        update: userUpdate,
      },
      userRole: {
        upsert: jest.fn(async () => ({ userId: user.id, role: Role.ADMIN })),
      },
    } as unknown as PrismaClient;

    return { prisma, userUpdate };
  }

  it("creates the administrator role and initializes a missing password", async () => {
    const { prisma, userUpdate } = createPrismaMock(null);

    const result = await ensureSeedAdmin(prisma);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { phone: SEED_ADMIN_PHONE },
      update: {},
      create: { phone: SEED_ADMIN_PHONE },
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_role: { userId: baseUser.id, role: Role.ADMIN } },
      update: {},
      create: { userId: baseUser.id, role: Role.ADMIN },
    });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(result.passwordInitialized).toBe(true);
    expect(await verifyPassword(SEED_ADMIN_PASSWORD, result.user.passwordHash!)).toBe(true);
  });

  it("preserves an existing password on repeated container starts", async () => {
    const existingPasswordHash = "existing-password-hash";
    const { prisma, userUpdate } = createPrismaMock(existingPasswordHash);

    const result = await ensureSeedAdmin(prisma);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(result.passwordInitialized).toBe(false);
    expect(result.user.passwordHash).toBe(existingPasswordHash);
  });
});
