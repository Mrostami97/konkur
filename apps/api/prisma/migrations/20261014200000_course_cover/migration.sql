-- A cover image per course, uploaded by the admin (owner, 2026-10-14).
ALTER TABLE "courses" ADD COLUMN "coverArtifactId" TEXT;

CREATE INDEX "courses_coverArtifactId_idx" ON "courses"("coverArtifactId");

ALTER TABLE "courses" ADD CONSTRAINT "courses_coverArtifactId_fkey" FOREIGN KEY ("coverArtifactId") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
