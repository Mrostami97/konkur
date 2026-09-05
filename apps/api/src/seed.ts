import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export const SEED_ADMIN_PHONE = "+989120000001";
export const SEED_STUDENT_PHONE = "+989120000002";

async function upsertUserWithRole(phone: string, role: Role) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    update: {},
    create: { userId: user.id, role },
  });
  return user;
}

export async function seed() {
  await upsertUserWithRole(SEED_ADMIN_PHONE, Role.ADMIN);
  await upsertUserWithRole(SEED_STUDENT_PHONE, Role.STUDENT);
}

if (require.main === module) {
  seed()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Seed complete: admin=%s student=%s", SEED_ADMIN_PHONE, SEED_STUDENT_PHONE);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
