-- A student's practice answers on bank questions, and their star and note (owner, 2026-10-18).
-- CreateEnum
CREATE TYPE "AnswerConfidence" AS ENUM ('SURE', 'TWO_WAY', 'GUESS');

-- CreateEnum
CREATE TYPE "PracticeErrorReason" AS ENUM ('DID_NOT_KNOW', 'CARELESS', 'CALCULATION', 'OUT_OF_TIME', 'TRAP_OPTION');

-- CreateEnum
CREATE TYPE "PracticeOutcome" AS ENUM ('CORRECT', 'WRONG', 'VOID');

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" INTEGER NOT NULL,
    "outcome" "PracticeOutcome" NOT NULL,
    "confidence" "AnswerConfidence",
    "errorReason" "PracticeErrorReason",
    "timeSpentMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_marks" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_marks_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateIndex
CREATE INDEX "practice_answers_userId_questionId_createdAt_idx" ON "practice_answers"("userId", "questionId", "createdAt");

-- CreateIndex
CREATE INDEX "practice_answers_userId_createdAt_idx" ON "practice_answers"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "question_marks_userId_starred_idx" ON "question_marks"("userId", "starred");

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_marks" ADD CONSTRAINT "question_marks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_marks" ADD CONSTRAINT "question_marks_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

