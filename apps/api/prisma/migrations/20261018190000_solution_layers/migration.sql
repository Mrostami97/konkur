-- The two lighter layers of a worked solution: a hint and the quick way.
ALTER TABLE "questions" ADD COLUMN "solutionHint" TEXT;
ALTER TABLE "questions" ADD COLUMN "solutionShortcut" TEXT;
