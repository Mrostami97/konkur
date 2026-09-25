-- Refuse the downgrade once any practice exam exists: without the flag it
-- would turn into an unpublished admin exam, and its attempts would lose the
-- only record of who built it.
CREATE TEMP TABLE "_practice_exams_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_practice_exams_down_guard" SELECT false FROM "exams" WHERE "isPractice" LIMIT 1;

ALTER TABLE "exams" DROP CONSTRAINT "exams_ownerUserId_fkey";
DROP INDEX "exams_ownerUserId_createdAt_idx";
ALTER TABLE "exams" DROP CONSTRAINT "exams_owner_only_on_practice";
ALTER TABLE "exams" DROP COLUMN "ownerUserId",
DROP COLUMN "isPractice";
