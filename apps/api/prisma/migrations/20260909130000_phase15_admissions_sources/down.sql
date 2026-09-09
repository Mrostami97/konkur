-- migrate-down executes semicolon-separated statements, so a temporary
-- checked table supplies an atomic and parser-safe destructive-data guard.
CREATE TEMP TABLE "_phase15_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;
INSERT INTO "_phase15_down_guard" SELECT false FROM "universities" WHERE "sourceId" IS NOT NULL LIMIT 1;
INSERT INTO "_phase15_down_guard" SELECT false FROM "programs" WHERE "sourceId" IS NOT NULL LIMIT 1;
INSERT INTO "_phase15_down_guard" SELECT false FROM "capacities" WHERE "sourceId" IS NOT NULL LIMIT 1;

ALTER TABLE "capacities" DROP CONSTRAINT "capacities_sourceId_fkey";
ALTER TABLE "programs" DROP CONSTRAINT "programs_sourceId_fkey";
ALTER TABLE "universities" DROP CONSTRAINT "universities_sourceId_fkey";
DROP INDEX "programs_sourceId_idx";
DROP INDEX "capacities_sourceId_idx";
DROP INDEX "universities_sourceId_idx";
ALTER TABLE "programs" DROP COLUMN "sourceId";
ALTER TABLE "capacities" DROP COLUMN "sourceId";
ALTER TABLE "universities" DROP COLUMN "sourceId";
