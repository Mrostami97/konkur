-- Exams in scored sections (the konkur's «درس امتحانی»), simulators of a real
-- exam year, how each question was worked (time, flag, changes), and a
-- per-section breakdown frozen into the score at grading.

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "simulatesExamCode" TEXT,
ADD COLUMN     "simulatesYear" INTEGER;

-- CreateTable
CREATE TABLE "exam_sections" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rankBox" TEXT,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_sections_examId_idx" ON "exam_sections"("examId");

-- AddForeignKey
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "exam_items" ADD COLUMN     "sectionId" TEXT;

-- AddForeignKey
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "exam_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "changeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeSpentMs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "scores" ADD COLUMN     "breakdown" JSONB;
