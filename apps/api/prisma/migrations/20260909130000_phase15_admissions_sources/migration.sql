-- Phase 15 keeps legacy catalog rows intact while making official-source
-- attribution available for every publicly discoverable university/program.
ALTER TABLE "universities" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "programs" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "capacities" ADD COLUMN "sourceId" TEXT;

CREATE INDEX "universities_sourceId_idx" ON "universities"("sourceId");
CREATE INDEX "programs_sourceId_idx" ON "programs"("sourceId");
CREATE INDEX "capacities_sourceId_idx" ON "capacities"("sourceId");

ALTER TABLE "universities"
  ADD CONSTRAINT "universities_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "content_sources"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "programs"
  ADD CONSTRAINT "programs_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "content_sources"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "capacities"
  ADD CONSTRAINT "capacities_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "content_sources"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
