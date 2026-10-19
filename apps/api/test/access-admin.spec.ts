import { Role } from "@prisma/client";
import { AccessService } from "../src/modules/access/access.service";
import { PrismaService } from "../src/prisma/prisma.service";

function service(roles: Role[]) {
  const prisma = {
    userRole: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { role: Role } }) => (roles.includes(where.role) ? { id: "role" } : null)),
    },
    entitlement: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  };
  return { access: new AccessService(prisma as unknown as PrismaService), prisma };
}

describe("AccessService: the admin sees everything", () => {
  it("opens the bank, every course and every resource to an admin without an entitlement", async () => {
    const { access, prisma } = service([Role.ADMIN]);
    await expect(access.hasActiveQuestionBankAccess("owner", "automata")).resolves.toBe(true);
    await expect(access.hasActiveCourseAccess("owner", "course")).resolves.toBe(true);
    await expect(access.hasActiveResourceAccess("owner", "resource")).resolves.toBe(true);
    await expect(access.accessibleQuestionBankSubjects("owner", ["automata", "databases", "automata"])).resolves.toEqual(new Set(["automata", "databases"]));
    expect(prisma.entitlement.findFirst).not.toHaveBeenCalled();
  });

  it("does not treat an admin as having bought a resource, so nothing is stamped with their name", async () => {
    const { access } = service([Role.ADMIN]);
    await expect(access.hasDirectResourceGrant("owner", "resource")).resolves.toBe(false);
  });

  it("keeps everything locked for a student without an entitlement", async () => {
    const { access } = service([Role.STUDENT]);
    await expect(access.hasActiveQuestionBankAccess("student", "automata")).resolves.toBe(false);
    await expect(access.hasActiveCourseAccess("student", "course")).resolves.toBe(false);
    await expect(access.hasActiveResourceAccess("student", "resource")).resolves.toBe(false);
    await expect(access.accessibleQuestionBankSubjects("student", ["automata"])).resolves.toEqual(new Set());
  });

  it("does not open anything to other staff roles", async () => {
    const { access } = service([Role.REVIEWER, Role.AUTHOR]);
    await expect(access.hasActiveQuestionBankAccess("reviewer", "automata")).resolves.toBe(false);
  });
});
