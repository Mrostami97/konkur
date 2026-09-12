import { PrismaClient } from "@prisma/client";

const FIXTURE = {
  userId: "phase16-migration-user",
  goalId: "phase16-migration-goal",
  planId: "phase16-migration-plan",
  studySessionId: "phase16-migration-session",
  phone: "phase16-migration-fixture",
  degree: "MASTER",
  field: "COMPUTER_ENGINEERING",
  weeklyHours: 21,
  targetExamDate: new Date("2027-03-04T00:00:00.000Z"),
} as const;

type Command = "seed-legacy" | "verify-backfill" | "cleanup";

type BackfillRow = {
  selfReportedLevel: string;
  goalSelfReportedLevel: string;
  degree: string;
  goalDegree: string;
  field: string;
  goalField: string;
  weeklyHours: number;
  goalWeeklyHours: number;
  targetExamDateMatches: boolean;
  targetExamDatePresent: boolean;
  studySessionSource: string;
};

function readCommand(): Command {
  const value = process.argv.slice(2).find((argument) => argument !== "--");
  if (value === "seed-legacy" || value === "verify-backfill" || value === "cleanup") {
    return value;
  }
  throw new Error(
    "usage: pnpm run migration:verify:phase16 -- <seed-legacy|verify-backfill|cleanup>",
  );
}

async function seedLegacyRows(prisma: PrismaClient) {
  // This deliberately uses only columns that existed before Phase 16. Running
  // it after the Phase 16 down migration proves the forward migration can
  // upgrade populated production-shaped rows, rather than only an empty DB.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "users" ("id", "phone", "createdAt", "updatedAt")
      VALUES (${FIXTURE.userId}, ${FIXTURE.phone}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE
      SET "phone" = EXCLUDED."phone", "updatedAt" = CURRENT_TIMESTAMP
    `;
    await tx.$executeRaw`
      INSERT INTO "goals" (
        "id", "userId", "degree", "field", "targetExamDate", "weeklyHours", "createdAt", "updatedAt"
      )
      VALUES (
        ${FIXTURE.goalId}, ${FIXTURE.userId},
        ${FIXTURE.degree}::"Degree", ${FIXTURE.field}, ${FIXTURE.targetExamDate},
        ${FIXTURE.weeklyHours}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("id") DO UPDATE
      SET
        "degree" = EXCLUDED."degree",
        "field" = EXCLUDED."field",
        "targetExamDate" = EXCLUDED."targetExamDate",
        "weeklyHours" = EXCLUDED."weeklyHours",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    await tx.$executeRaw`
      INSERT INTO "plans" ("id", "goalId", "userId")
      VALUES (${FIXTURE.planId}, ${FIXTURE.goalId}, ${FIXTURE.userId})
      ON CONFLICT ("id") DO UPDATE
      SET "goalId" = EXCLUDED."goalId", "userId" = EXCLUDED."userId"
    `;
    await tx.$executeRaw`
      INSERT INTO "study_sessions" ("id", "userId", "subjectCode", "minutes", "loggedAt")
      VALUES (${FIXTURE.studySessionId}, ${FIXTURE.userId}, 'legacy-subject', 35, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "minutes" = EXCLUDED."minutes"
    `;
  });
}

async function verifyBackfill(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<BackfillRow[]>`
    SELECT
      g."selfReportedLevel"::text AS "selfReportedLevel",
      p."goalSelfReportedLevel"::text AS "goalSelfReportedLevel",
      g."degree"::text AS "degree",
      p."goalDegree"::text AS "goalDegree",
      g."field" AS "field",
      p."goalField" AS "goalField",
      g."weeklyHours" AS "weeklyHours",
      p."goalWeeklyHours" AS "goalWeeklyHours",
      p."goalTargetExamDate" IS NOT DISTINCT FROM g."targetExamDate" AS "targetExamDateMatches",
      p."goalTargetExamDate" IS NOT NULL AS "targetExamDatePresent",
      (SELECT s."source"::text FROM "study_sessions" AS s WHERE s."id" = ${FIXTURE.studySessionId}) AS "studySessionSource"
    FROM "goals" AS g
    JOIN "plans" AS p ON p."goalId" = g."id"
    WHERE g."id" = ${FIXTURE.goalId} AND p."id" = ${FIXTURE.planId}
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Phase 16 migration verification failed: the legacy Goal/Plan fixture is missing");
  }

  const failures: string[] = [];
  if (row.selfReportedLevel !== "UNKNOWN") failures.push("Goal.selfReportedLevel was not backfilled to UNKNOWN");
  if (row.goalSelfReportedLevel !== "UNKNOWN") failures.push("Plan.goalSelfReportedLevel was not backfilled to UNKNOWN");
  if (row.degree !== FIXTURE.degree || row.goalDegree !== row.degree) failures.push("Plan.goalDegree does not match Goal.degree");
  if (row.field !== FIXTURE.field || row.goalField !== row.field) failures.push("Plan.goalField does not match Goal.field");
  if (row.weeklyHours !== FIXTURE.weeklyHours || row.goalWeeklyHours !== row.weeklyHours) {
    failures.push("Plan.goalWeeklyHours does not match Goal.weeklyHours");
  }
  if (!row.targetExamDatePresent || !row.targetExamDateMatches) {
    failures.push("Plan.goalTargetExamDate does not match Goal.targetExamDate");
  }
  if (row.studySessionSource !== "UNCLASSIFIED_LEGACY") {
    failures.push("legacy StudySession.source was not backfilled to UNCLASSIFIED_LEGACY");
  }

  if (failures.length > 0) {
    throw new Error(`Phase 16 migration verification failed:\n- ${failures.join("\n- ")}`);
  }
}

async function cleanup(prisma: PrismaClient) {
  // Goal and Plan are removed by their cascading foreign keys.
  await prisma.$executeRaw`DELETE FROM "users" WHERE "id" = ${FIXTURE.userId}`;
}

async function main() {
  const command = readCommand();
  const prisma = new PrismaClient();
  try {
    if (command === "seed-legacy") await seedLegacyRows(prisma);
    if (command === "verify-backfill") await verifyBackfill(prisma);
    if (command === "cleanup") await cleanup(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
