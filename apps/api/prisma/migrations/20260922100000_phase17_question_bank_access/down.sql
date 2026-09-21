-- Refuse a destructive downgrade once Phase 17 data exists (a bank grant, a
-- QUESTION_BANK product, or any question actually flagged as a sample). The
-- migrate-down command runs this file in one transaction, so every guard and
-- schema reversal is atomic.
CREATE TEMP TABLE "_phase17_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_phase17_down_guard" SELECT false FROM "questions" WHERE "isSample" = true LIMIT 1;
INSERT INTO "_phase17_down_guard" SELECT false FROM "product_question_bank_grants" LIMIT 1;
INSERT INTO "_phase17_down_guard" SELECT false FROM "products" WHERE "kind" = 'QUESTION_BANK' LIMIT 1;

ALTER TABLE "product_question_bank_grants" DROP CONSTRAINT "product_question_bank_grants_productId_fkey";

DROP INDEX "product_question_bank_grants_subjectCode_idx";

DROP TABLE "product_question_bank_grants";

DROP INDEX "questions_subjectCode_isSample_idx";

ALTER TABLE "questions" DROP COLUMN "isSample";

-- Postgres cannot drop a single enum value, so the type is recreated without
-- it (same pattern as the phase9 down.sql for this same column).
ALTER TABLE "products" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
DROP TYPE "ProductKind";
CREATE TYPE "ProductKind" AS ENUM ('COURSE', 'RESOURCE', 'BUNDLE');
ALTER TABLE "products" ALTER COLUMN "kind" TYPE "ProductKind" USING "kind"::"ProductKind";
