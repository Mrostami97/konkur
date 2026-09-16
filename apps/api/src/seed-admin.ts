import { PrismaClient, Role, User } from "@prisma/client";
import { hashPassword } from "./modules/identity/password-hasher";

export const SEED_ADMIN_PHONE = "+989120000001";
export const SEED_ADMIN_PASSWORD = "123";

export interface SeedAdminResult {
  user: User;
  passwordInitialized: boolean;
}

/**
 * Ensures the production administrator fixture exists without loading any of
 * the demo courses, products, articles, or student accounts from the full
 * development seed.
 *
 * The password is initialized only when it is missing. This makes the
 * bootstrap safe to run on every container start without undoing a password
 * that the administrator has deliberately changed.
 */
export async function ensureSeedAdmin(prisma: PrismaClient): Promise<SeedAdminResult> {
  const user = await prisma.user.upsert({
    where: { phone: SEED_ADMIN_PHONE },
    update: {},
    create: { phone: SEED_ADMIN_PHONE },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.ADMIN } },
    update: {},
    create: { userId: user.id, role: Role.ADMIN },
  });

  if (user.passwordHash) {
    return { user, passwordInitialized: false };
  }

  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { user: updatedUser, passwordInitialized: true };
}
