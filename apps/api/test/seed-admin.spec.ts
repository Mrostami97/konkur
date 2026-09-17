import { PrismaClient, Role } from "@prisma/client";
import { verifyPassword } from "../src/modules/identity/password-hasher";
import {
  ensureSeedAdmin,
  getBootstrapAdminCredentials,
} from "../src/seed-admin";

describe("getBootstrapAdminCredentials", () => {
  it("disables administrator bootstrap when neither credential is configured", () => {
    expect(getBootstrapAdminCredentials({})).toBeNull();
  });

  it("returns configured administrator credentials when both values are present", () => {
    expect(
      getBootstrapAdminCredentials({
        BOOTSTRAP_ADMIN_PHONE: "+989120000001",
        BOOTSTRAP_ADMIN_PASSWORD: "a-strong-secret",
      }),
    ).toEqual({
      phone: "+989120000001",
      password: "a-strong-secret",
    });
  });

  it("rejects partial administrator bootstrap configuration", () => {
    expect(() =>
      getBootstrapAdminCredentials({ BOOTSTRAP_ADMIN_PHONE: "+989120000001" }),
    ).toThrow("BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PASSWORD must be set together");
  });
});

describe("ensureSeedAdmin", () => {
  const credentials = {
    phone: "+989120000001",
    password: "a-strong-secret",
  };

  const baseUser = {
    id: "admin-user-id",
    phone: credentials.phone,
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

  it("creates the administrator role and initializes a missing password from explicit credentials", async () => {
    const { prisma, userUpdate } = createPrismaMock(null);

    const result = await ensureSeedAdmin(prisma, credentials);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { phone: credentials.phone },
      update: {},
      create: { phone: credentials.phone },
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_role: { userId: baseUser.id, role: Role.ADMIN } },
      update: {},
      create: { userId: baseUser.id, role: Role.ADMIN },
    });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(result.passwordInitialized).toBe(true);
    expect(await verifyPassword(credentials.password, result.user.passwordHash!)).toBe(true);
  });

  it("preserves an existing password on repeated container starts", async () => {
    const existingPasswordHash = "existing-password-hash";
    const { prisma, userUpdate } = createPrismaMock(existingPasswordHash);

    const result = await ensureSeedAdmin(prisma, credentials);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(result.passwordInitialized).toBe(false);
    expect(result.user.passwordHash).toBe(existingPasswordHash);
  });
});
