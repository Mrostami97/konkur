-- Refuse the downgrade once any student has filled in their name or
-- education: those answers exist nowhere else, and exam attempts were
-- started on the strength of them.
CREATE TEMP TABLE "_student_profile_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_student_profile_down_guard" SELECT false FROM "profiles" WHERE "firstName" IS NOT NULL OR "lastName" IS NOT NULL OR "educationStatus" IS NOT NULL OR "universityName" IS NOT NULL OR "fieldOfStudy" IS NOT NULL OR "entryYear" IS NOT NULL OR "graduationYear" IS NOT NULL OR "gpa" IS NOT NULL OR "targetExamYear" IS NOT NULL LIMIT 1;

ALTER TABLE "profiles" DROP CONSTRAINT "profiles_target_exam_year_range";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_graduation_year_range";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_entry_year_range";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_gpa_range";

ALTER TABLE "profiles"
  DROP COLUMN "completedAt",
  DROP COLUMN "targetExamYear",
  DROP COLUMN "gpa",
  DROP COLUMN "graduationYear",
  DROP COLUMN "entryYear",
  DROP COLUMN "fieldOfStudy",
  DROP COLUMN "universityName",
  DROP COLUMN "educationStatus",
  DROP COLUMN "lastName",
  DROP COLUMN "firstName";

DROP TYPE "EducationStatus";
