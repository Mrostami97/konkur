import { PrismaClient, Role, User } from "@prisma/client";
import { hashPassword } from "./modules/identity/password-hasher";

export interface SeedAdminCredentials {
  phone: string;
  password: string;
}

export interface SeedAdminResult {
  user: User;
  passwordInitialized: boolean;
}

type BootstrapEnvironment = Record<string, string | undefined>;

/**
 * Reads optional production administrator bootstrap credentials.
 *
 * Public source code must never contain a usable default administrator
 * credential. Bootstrap is therefore disabled unless both values are supplied
 * explicitly by the runtime environment. A partial configuration is treated as
 * an error so a deployment cannot silently start in an unexpected state.
 */
export function getBootstrapAdminCredentials(
  env: BootstrapEnvironment = process.env,
): SeedAdminCredentials | null {
  const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!phone && !password) {
    return null;
  }

  if (!phone || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PASSWORD must be set together",
    );
  }

  return { phone, password };
}

/**
 * Ensures the explicitly configured administrator exists without loading any
 * demo courses, products, articles, or student accounts from the full
 * development seed.
 *
 * The password is initialized only when it is missing. This makes the
 * bootstrap safe to run on every container start without undoing a password
 * that the administrator has deliberately changed.
 */
export async function ensureSeedAdmin(
  prisma: PrismaClient,
  credentials: SeedAdminCredentials,
): Promise<SeedAdminResult> {
  const user = await prisma.user.upsert({
    where: { phone: credentials.phone },
    update: {},
    create: { phone: credentials.phone },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.ADMIN } },
    update: {},
    create: { userId: user.id, role: Role.ADMIN },
  });

  if (user.passwordHash) {
    return { user, passwordInitialized: false };
  }

  const passwordHash = await hashPassword(credentials.password);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { user: updatedUser, passwordInitialized: true };
}
