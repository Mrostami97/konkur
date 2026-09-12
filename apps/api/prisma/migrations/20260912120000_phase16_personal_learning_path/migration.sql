-- Phase 16: preserve the student's stated starting level and every plan's
-- original goal context, while linking planned actions to real learning
-- content and allowing resources to be saved for later.

CREATE TYPE "SelfReportedLevel" AS ENUM ('UNKNOWN', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "StudySessionSource" AS ENUM ('UNCLASSIFIED_LEGACY', 'MANUAL', 'TASK_ACTUAL');

ALTER TABLE "goals"
  ADD COLUMN "selfReportedLevel" "SelfReportedLevel" NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "study_sessions"
  ADD COLUMN "source" "StudySessionSource";

UPDATE "study_sessions" SET "source" = 'UNCLASSIFIED_LEGACY';

ALTER TABLE "study_sessions"
  ALTER COLUMN "source" SET DEFAULT 'MANUAL',
  ALTER COLUMN "source" SET NOT NULL;

-- Snapshot fields are introduced as nullable so existing rows can be copied
-- from their required Goal before the non-null constraints are applied.
ALTER TABLE "plans"
  ADD COLUMN "goalDegree" "Degree",
  ADD COLUMN "goalField" TEXT,
  ADD COLUMN "goalWeeklyHours" INTEGER,
  ADD COLUMN "goalTargetExamDate" TIMESTAMP(3),
  ADD COLUMN "goalSelfReportedLevel" "SelfReportedLevel";

UPDATE "plans" AS p
SET
  "goalDegree" = g."degree",
  "goalField" = g."field",
  "goalWeeklyHours" = g."weeklyHours",
  "goalTargetExamDate" = g."targetExamDate",
  "goalSelfReportedLevel" = g."selfReportedLevel"
FROM "goals" AS g
WHERE p."goalId" = g."id";

ALTER TABLE "plans"
  ALTER COLUMN "goalDegree" SET NOT NULL,
  ALTER COLUMN "goalField" SET NOT NULL,
  ALTER COLUMN "goalWeeklyHours" SET NOT NULL,
  ALTER COLUMN "goalSelfReportedLevel" SET NOT NULL;

ALTER TABLE "tasks"
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "resourceId" TEXT;

CREATE TABLE "saved_resources" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "plannedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "saved_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_lessonId_idx" ON "tasks"("lessonId");
CREATE INDEX "tasks_resourceId_idx" ON "tasks"("resourceId");
CREATE UNIQUE INDEX "tasks_planId_lessonId_key" ON "tasks"("planId", "lessonId");
CREATE UNIQUE INDEX "tasks_planId_resourceId_key" ON "tasks"("planId", "resourceId");
CREATE UNIQUE INDEX "saved_resources_userId_resourceId_key"
  ON "saved_resources"("userId", "resourceId");
CREATE INDEX "saved_resources_resourceId_idx" ON "saved_resources"("resourceId");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saved_resources"
  ADD CONSTRAINT "saved_resources_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_resources"
  ADD CONSTRAINT "saved_resources_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resources"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
