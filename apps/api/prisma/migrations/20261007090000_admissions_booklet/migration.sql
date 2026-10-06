-- Field-selection booklet facts for programs and their yearly capacities, so
-- a whole booklet (کد رشته‌محل, period, coefficient code, notes) can be imported.
CREATE TYPE "StudyPeriod" AS ENUM ('DAILY', 'EVENING', 'SELF_FUNDED_CAMPUS', 'VIRTUAL', 'NON_PROFIT', 'VIRTUAL_NON_PROFIT', 'PAYAM_NOOR', 'VIRTUAL_PAYAM_NOOR');
CREATE TYPE "ProgramGender" AS ENUM ('ANY', 'FEMALE', 'MALE');

ALTER TABLE "programs"
  ADD COLUMN "examSetCode" TEXT,
  ADD COLUMN "coefficientGroup" INTEGER,
  ADD COLUMN "orientation" TEXT,
  ADD COLUMN "period" "StudyPeriod",
  ADD COLUMN "location" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "gender" "ProgramGender" NOT NULL DEFAULT 'ANY';
CREATE INDEX "programs_examSetCode_period_idx" ON "programs"("examSetCode", "period");

ALTER TABLE "capacities"
  ADD COLUMN "selectionCode" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "bookletPage" INTEGER;
CREATE INDEX "capacities_examYear_selectionCode_idx" ON "capacities"("examYear", "selectionCode");
