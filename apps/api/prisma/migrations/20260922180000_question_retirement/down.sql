-- Refuse the downgrade once a question has actually been retired: dropping
-- the column would silently return it to the live bank. The migrate-down
-- command runs this file in one transaction, so the guard and the reversal
-- are atomic.
CREATE TEMP TABLE "_retirement_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_retirement_down_guard" SELECT false FROM "questions" WHERE "retiredAt" IS NOT NULL LIMIT 1;

DROP INDEX "questions_subjectCode_retiredAt_idx";
DROP INDEX "questions_retiredAt_idx";

ALTER TABLE "questions" DROP COLUMN "retiredReason";
ALTER TABLE "questions" DROP COLUMN "retiredAt";
