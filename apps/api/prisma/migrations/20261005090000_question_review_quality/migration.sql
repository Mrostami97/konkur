-- Questions from the past-exam archive: where they sit in the real booklet,
-- every option the final key accepts, a reading passage shared by several
-- questions, and how far their text and key have been checked. Questions
-- already in the bank were typed or imported by staff with a solution, so
-- they stay visible: SILVER by default, GOLD when they carry a solution.

-- CreateEnum
CREATE TYPE "QuestionQuality" AS ENUM ('GOLD', 'SILVER', 'DRAFT');

-- CreateTable
CREATE TABLE "question_passages" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_passages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_passages_externalId_key" ON "question_passages"("externalId");

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "acceptedOptions" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "bookletNumber" INTEGER,
ADD COLUMN     "examCode" TEXT,
ADD COLUMN     "keyVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passageId" TEXT,
ADD COLUMN     "qualityTier" "QuestionQuality" NOT NULL DEFAULT 'SILVER',
ADD COLUMN     "questionNumber" INTEGER,
ADD COLUMN     "sectionTitle" TEXT,
ADD COLUMN     "textVerified" BOOLEAN NOT NULL DEFAULT true;

UPDATE "questions" SET "qualityTier" = 'GOLD'
WHERE jsonb_typeof("solutionBlocks") = 'array' AND jsonb_array_length("solutionBlocks") > 0;

-- CreateIndex
CREATE INDEX "questions_qualityTier_idx" ON "questions"("qualityTier");

-- CreateIndex
CREATE INDEX "questions_examYear_examCode_idx" ON "questions"("examYear", "examCode");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "question_passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
