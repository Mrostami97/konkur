-- A student's own practice exam, built from the bank by topic.
ALTER TABLE "exams" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "exams_ownerUserId_idx" ON "exams"("ownerUserId");
