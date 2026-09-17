import { randomBytes } from "node:crypto";
import { getBootstrapAdminCredentials } from "./seed-admin";
import { SEED_ADMIN_PHONE, seed } from "./seed";

function isIsolatedGitHubActionsDatabase() {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return false;
  }

  try {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    return databaseUrl.hostname === "localhost" || databaseUrl.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function runSeed() {
  const configuredCredentials = getBootstrapAdminCredentials();

  if (configuredCredentials) {
    await seed(configuredCredentials);
    return;
  }

  if (isIsolatedGitHubActionsDatabase()) {
    await seed({
      phone: SEED_ADMIN_PHONE,
      password: randomBytes(32).toString("base64url"),
    });
    return;
  }

  throw new Error(
    "Seed requires explicit administrator credentials outside the isolated GitHub Actions database",
  );
}

runSeed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Seed complete");
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
