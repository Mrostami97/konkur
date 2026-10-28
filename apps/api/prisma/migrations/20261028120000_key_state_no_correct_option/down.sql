-- Refuse the downgrade once any question uses the new state. The migrate-down
-- command runs this file in one transaction, so the guard and the reversal are atomic.
CREATE TEMP TABLE "_no_correct_option_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;
INSERT INTO "_no_correct_option_down_guard" SELECT false FROM "questions" WHERE "keyState" = 'NO_CORRECT_OPTION' LIMIT 1;

-- Postgres cannot drop a single enum value, so the type is recreated without it.
ALTER TABLE "questions" ALTER COLUMN "keyState" DROP DEFAULT;
ALTER TABLE "questions" ALTER COLUMN "keyState" TYPE TEXT USING "keyState"::text;
DROP TYPE "QuestionKeyState";
CREATE TYPE "QuestionKeyState" AS ENUM ('NORMAL', 'DELETED', 'POSITIVE_EFFECT');
ALTER TABLE "questions" ALTER COLUMN "keyState" TYPE "QuestionKeyState" USING "keyState"::"QuestionKeyState";
ALTER TABLE "questions" ALTER COLUMN "keyState" SET DEFAULT 'NORMAL';
