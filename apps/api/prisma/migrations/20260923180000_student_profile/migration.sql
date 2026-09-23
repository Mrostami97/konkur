-- A student's name and education on their own profile. Starting an exam
-- requires them, so every attempt and report card belongs to a named
-- person with a known background; they are never shown on a public page.

-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('BACHELOR_STUDENT', 'BACHELOR_GRADUATE', 'MASTER_STUDENT', 'MASTER_GRADUATE', 'OTHER');

-- AlterTable
ALTER TABLE "profiles"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "educationStatus" "EducationStatus",
  ADD COLUMN "universityName" TEXT,
  ADD COLUMN "fieldOfStudy" TEXT,
  ADD COLUMN "entryYear" INTEGER,
  ADD COLUMN "graduationYear" INTEGER,
  ADD COLUMN "gpa" DOUBLE PRECISION,
  ADD COLUMN "targetExamYear" INTEGER,
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Years are solar (Hijri Shamsi); the grade average is on Iran's 0-20 scale.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_gpa_range" CHECK ("gpa" IS NULL OR ("gpa" >= 0 AND "gpa" <= 20));
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_entry_year_range" CHECK ("entryYear" IS NULL OR ("entryYear" BETWEEN 1350 AND 1450));
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_graduation_year_range" CHECK ("graduationYear" IS NULL OR ("graduationYear" BETWEEN 1350 AND 1460));
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_target_exam_year_range" CHECK ("targetExamYear" IS NULL OR ("targetExamYear" BETWEEN 1400 AND 1460));
