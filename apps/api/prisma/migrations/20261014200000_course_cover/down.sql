ALTER TABLE "courses" DROP CONSTRAINT "courses_coverArtifactId_fkey";
DROP INDEX IF EXISTS "courses_coverArtifactId_idx";
ALTER TABLE "courses" DROP COLUMN "coverArtifactId";
