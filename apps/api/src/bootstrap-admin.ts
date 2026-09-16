import { PrismaClient } from "@prisma/client";
import { ensureSeedAdmin, SEED_ADMIN_PHONE } from "./seed-admin";

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const { passwordInitialized } = await ensureSeedAdmin(prisma);
  // Do not log the password or its hash. This message is intentionally safe
  // for production deployment logs.
  // eslint-disable-next-line no-console
  console.log(
    "Administrator bootstrap complete: phone=%s password=%s",
    SEED_ADMIN_PHONE,
    passwordInitialized ? "initialized" : "preserved",
  );
}

bootstrapAdmin()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Administrator bootstrap failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
