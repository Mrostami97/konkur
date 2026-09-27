-- Refuse the downgrade while any handout still points to its free sample:
-- dropping the column would silently unlink them.
CREATE TEMP TABLE "_resource_free_sample_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_resource_free_sample_down_guard" SELECT false FROM "resources" WHERE "sampleResourceId" IS NOT NULL LIMIT 1;

ALTER TABLE "resources" DROP CONSTRAINT "resources_sampleResourceId_fkey";

ALTER TABLE "resources" DROP COLUMN "sampleResourceId";
