import { PrismaClient } from "@prisma/client";
import {
  ensureSeedAdmin,
  getBootstrapAdminCredentials,
} from "./seed-admin";

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const credentials = getBootstrapAdminCredentials();

  if (!credentials) {
    // eslint-disable-next-line no-console
    console.log(
      "Administrator bootstrap skipped: BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PASSWORD are not configured",
    );
    return;
  }

  const { passwordInitialized } = await ensureSeedAdmin(prisma, credentials);

  // Do not log the administrator phone, password, or password hash.
  // eslint-disable-next-line no-console
  console.log(
    "Administrator bootstrap complete: password=%s",
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
