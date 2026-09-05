-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" "ExamMode" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "subjectCode" TEXT,
    "questionCount" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_forms" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_items" (
    "id" TEXT NOT NULL,
    "examFormId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "exam_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "examFormId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "scoreVersion" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "unansweredCount" INTEGER NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "percentCorrect" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_slug_key" ON "exams"("slug");

-- CreateIndex
CREATE INDEX "exam_forms_examId_idx" ON "exam_forms"("examId");

-- CreateIndex
CREATE INDEX "exam_items_examFormId_idx" ON "exam_items"("examFormId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_items_examFormId_questionId_key" ON "exam_items"("examFormId", "questionId");

-- CreateIndex
CREATE INDEX "attempts_userId_idx" ON "attempts"("userId");

-- CreateIndex
CREATE INDEX "attempts_examId_idx" ON "attempts"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attemptId_questionId_key" ON "answers"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "scores_attemptId_key" ON "scores"("attemptId");

-- AddForeignKey
ALTER TABLE "exam_forms" ADD CONSTRAINT "exam_forms_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "exam_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "exam_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

