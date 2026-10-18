-- How the final key scores a question (owner, 2026-10-18: deleted questions stay in the bank, labelled).
CREATE TYPE "QuestionKeyState" AS ENUM ('NORMAL', 'DELETED', 'POSITIVE_EFFECT');

ALTER TABLE "questions" ADD COLUMN "keyState" "QuestionKeyState" NOT NULL DEFAULT 'NORMAL';
