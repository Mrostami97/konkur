-- Refuse the downgrade once archive questions are in: dropping these columns
-- would lose their booklet position, accepted keys, passages and review
-- state, and would make unreviewed questions visible to students.
CREATE TEMP TABLE "_question_review_quality_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_question_review_quality_down_guard" SELECT false FROM "questions"
WHERE "qualityTier" = 'DRAFT' OR "passageId" IS NOT NULL OR "examCode" IS NOT NULL
   OR cardinality("acceptedOptions") > 0 OR NOT "textVerified" OR NOT "keyVerified"
LIMIT 1;

INSERT INTO "_question_review_quality_down_guard" SELECT false FROM "question_passages" LIMIT 1;

ALTER TABLE "questions" DROP CONSTRAINT "questions_passageId_fkey";

DROP INDEX "questions_examYear_examCode_idx";

DROP INDEX "questions_qualityTier_idx";

ALTER TABLE "questions" DROP COLUMN "acceptedOptions",
DROP COLUMN "bookletNumber",
DROP COLUMN "examCode",
DROP COLUMN "keyVerified",
DROP COLUMN "passageId",
DROP COLUMN "qualityTier",
DROP COLUMN "questionNumber",
DROP COLUMN "sectionTitle",
DROP COLUMN "textVerified";

DROP TABLE "question_passages";

DROP TYPE "QuestionQuality";
