-- A paid handout can point to a free sample of itself (e.g. its first two
-- chapters), a separate resource any signed-in student can read.

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "sampleResourceId" TEXT;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_sampleResourceId_fkey" FOREIGN KEY ("sampleResourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

