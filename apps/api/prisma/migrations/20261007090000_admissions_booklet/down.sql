-- Booklet facts only; programs and capacities entered by hand keep their rows.
DROP INDEX IF EXISTS "capacities_examYear_selectionCode_idx";
ALTER TABLE "capacities" DROP COLUMN "bookletPage", DROP COLUMN "notes", DROP COLUMN "selectionCode";
DROP INDEX IF EXISTS "programs_examSetCode_period_idx";
ALTER TABLE "programs" DROP COLUMN "gender", DROP COLUMN "city", DROP COLUMN "location", DROP COLUMN "period", DROP COLUMN "orientation", DROP COLUMN "coefficientGroup", DROP COLUMN "examSetCode";
DROP TYPE "ProgramGender";
DROP TYPE "StudyPeriod";
