-- Study plans a consultant writes for a student they advise: a dated list of
-- tasks the student ticks off, with the time it actually took. Only an
-- instructor with a consultation booking from that student may write one.

-- CreateEnum
CREATE TYPE "CoachPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CoachTaskKind" AS ENUM ('STUDY', 'TEST', 'REVIEW', 'VIDEO', 'EXAM', 'OTHER');

-- CreateTable
CREATE TABLE "coach_plans" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "coachProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "note" TEXT,
    "status" "CoachPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coach_plans_dates_ordered" CHECK ("endsOn" >= "startsOn"),
    CONSTRAINT "coach_plans_span_bounded" CHECK ("endsOn" - "startsOn" <= 31),
    CONSTRAINT "coach_plans_published_has_date" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL)
);

-- CreateTable
CREATE TABLE "coach_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "CoachTaskKind" NOT NULL DEFAULT 'STUDY',
    "title" TEXT NOT NULL,
    "subjectSlug" TEXT,
    "targetMinutes" INTEGER,
    "targetCount" INTEGER,
    "href" TEXT,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "studentNote" TEXT,

    CONSTRAINT "coach_plan_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coach_plan_items_target_minutes_range" CHECK ("targetMinutes" IS NULL OR ("targetMinutes" BETWEEN 1 AND 900)),
    CONSTRAINT "coach_plan_items_target_count_range" CHECK ("targetCount" IS NULL OR ("targetCount" BETWEEN 1 AND 1000)),
    CONSTRAINT "coach_plan_items_actual_minutes_range" CHECK ("actualMinutes" IS NULL OR ("actualMinutes" BETWEEN 0 AND 1440)),
    CONSTRAINT "coach_plan_items_internal_href" CHECK ("href" IS NULL OR ("href" LIKE '/%' AND "href" NOT LIKE '//%'))
);

-- CreateIndex
CREATE INDEX "coach_plans_studentUserId_status_idx" ON "coach_plans"("studentUserId", "status");

-- CreateIndex
CREATE INDEX "coach_plans_coachProfileId_idx" ON "coach_plans"("coachProfileId");

-- CreateIndex
CREATE INDEX "coach_plan_items_planId_day_idx" ON "coach_plan_items"("planId", "day");

-- AddForeignKey
ALTER TABLE "coach_plans" ADD CONSTRAINT "coach_plans_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_plans" ADD CONSTRAINT "coach_plans_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "contributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_plan_items" ADD CONSTRAINT "coach_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "coach_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
