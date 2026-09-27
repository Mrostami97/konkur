-- The annual consultation plan: a product that opens every service on the
-- site (grantsAllAccess), and the weekly report students fill in before each
-- weekly session.

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "grantsAllAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "testsSolved" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER,
    "wentWell" TEXT,
    "obstacles" TEXT,
    "questions" TEXT,
    "submittedAt" TIMESTAMP(3),
    "coachNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_studentUserId_weekStart_key" ON "weekly_reports"("studentUserId", "weekStart");

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_reviewedByProfileId_fkey" FOREIGN KEY ("reviewedByProfileId") REFERENCES "contributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

