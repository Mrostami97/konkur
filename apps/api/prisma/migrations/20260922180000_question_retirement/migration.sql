-- Retiring a question instead of deleting it.
--
-- Question is referenced by ExamItem and Answer without onDelete: Cascade, so
-- a hard delete of anything that has ever been sat is refused by the database
-- anyway. Even where a delete would succeed, it would destroy the record a
-- past attempt's report is rendered from. Retirement takes the question out
-- of the bank and out of new exams while leaving history intact.
ALTER TABLE "questions" ADD COLUMN "retiredAt" TIMESTAMP(3);
ALTER TABLE "questions" ADD COLUMN "retiredReason" TEXT;

-- Every public and admin read filters on this, so it is worth an index of its
-- own alongside the existing subject lookups.
CREATE INDEX "questions_retiredAt_idx" ON "questions"("retiredAt");
CREATE INDEX "questions_subjectCode_retiredAt_idx" ON "questions"("subjectCode", "retiredAt");
