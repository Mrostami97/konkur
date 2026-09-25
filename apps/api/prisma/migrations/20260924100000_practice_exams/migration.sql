-- Practice exams a student builds for themselves in the test builder. They
-- reuse the exam/form/attempt machinery but are never listed in the catalog;
-- only the owner may start one.

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "isPractice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerUserId" TEXT;

-- A practice exam is born with an owner; only account removal may null it.
-- An official exam never has one.
ALTER TABLE "exams" ADD CONSTRAINT "exams_owner_only_on_practice" CHECK ("isPractice" OR "ownerUserId" IS NULL);

-- CreateIndex
CREATE INDEX "exams_ownerUserId_createdAt_idx" ON "exams"("ownerUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
