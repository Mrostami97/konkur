import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma intentionally exposes forward-only `migrate deploy`. This small
 * operator command gives each additive migration's `down.sql` an explicit,
 * auditable counterpart without rewriting migration history.
 *
 * Usage: pnpm run migrate:down -- 20260906120000_password_auth
 */
async function main() {
  const migrationName = process.argv[2];
  if (!migrationName || !/^\d{14}_[a-z0-9-]+$/.test(migrationName)) {
    throw new Error("usage: pnpm run migrate:down -- <timestamp_name>");
  }

  const downPath = path.resolve(__dirname, "../prisma/migrations", migrationName, "down.sql");
  const sql = await readFile(downPath, "utf8");
  const prisma = new PrismaClient();

  try {
    const latest = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    if (latest[0]?.migration_name !== migrationName) {
      throw new Error("only the latest applied migration may be rolled back");
    }

    // The checked-in down files contain independent SQL statements. Execute
    // them separately so the command remains compatible with Prisma's raw SQL
    // driver and fails before the migration ledger is changed.
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations" WHERE migration_name = ${migrationName}`;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
