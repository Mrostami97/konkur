-- Refuse a destructive downgrade whenever Phase 16 contains information that
-- cannot be represented by the previous schema. Derived snapshots that still
-- exactly match their Goal are safe to remove.
CREATE TEMP TABLE "_phase16_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_phase16_down_guard"
SELECT false FROM "goals"
WHERE "selfReportedLevel" <> 'UNKNOWN'
LIMIT 1;

INSERT INTO "_phase16_down_guard"
SELECT false
FROM "plans" AS p
JOIN "goals" AS g ON g."id" = p."goalId"
WHERE p."goalDegree" IS DISTINCT FROM g."degree"
   OR p."goalField" IS DISTINCT FROM g."field"
   OR p."goalWeeklyHours" IS DISTINCT FROM g."weeklyHours"
   OR p."goalTargetExamDate" IS DISTINCT FROM g."targetExamDate"
   OR p."goalSelfReportedLevel" IS DISTINCT FROM g."selfReportedLevel"
LIMIT 1;

INSERT INTO "_phase16_down_guard"
SELECT false FROM "tasks"
WHERE "lessonId" IS NOT NULL OR "resourceId" IS NOT NULL
LIMIT 1;

INSERT INTO "_phase16_down_guard"
SELECT false FROM "saved_resources"
LIMIT 1;

INSERT INTO "_phase16_down_guard"
SELECT false FROM "study_sessions"
WHERE "source" <> 'UNCLASSIFIED_LEGACY'
LIMIT 1;

ALTER TABLE "saved_resources" DROP CONSTRAINT "saved_resources_resourceId_fkey";
ALTER TABLE "saved_resources" DROP CONSTRAINT "saved_resources_userId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_resourceId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_lessonId_fkey";

DROP INDEX "saved_resources_resourceId_idx";
DROP INDEX "saved_resources_userId_resourceId_key";
DROP INDEX "tasks_planId_resourceId_key";
DROP INDEX "tasks_planId_lessonId_key";
DROP INDEX "tasks_resourceId_idx";
DROP INDEX "tasks_lessonId_idx";

DROP TABLE "saved_resources";

ALTER TABLE "tasks"
  DROP COLUMN "resourceId",
  DROP COLUMN "lessonId";

ALTER TABLE "plans"
  DROP COLUMN "goalSelfReportedLevel",
  DROP COLUMN "goalTargetExamDate",
  DROP COLUMN "goalWeeklyHours",
  DROP COLUMN "goalField",
  DROP COLUMN "goalDegree";

ALTER TABLE "goals" DROP COLUMN "selfReportedLevel";

ALTER TABLE "study_sessions" DROP COLUMN "source";

DROP TYPE "SelfReportedLevel";
DROP TYPE "StudySessionSource";
