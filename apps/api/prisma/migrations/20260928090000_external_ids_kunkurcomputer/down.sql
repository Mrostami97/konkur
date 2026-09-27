-- Puts the old prefix back on rows this migration renamed. Rows that already
-- had a "kunkurcomputer-" id before it ran cannot be told apart and would be
-- renamed too, so run it only right after the forward step.
UPDATE "articles" SET "externalId" = 'kunkur01-' || substr("externalId", 16) WHERE "externalId" LIKE 'kunkurcomputer-%';
UPDATE "content_sources" SET "externalId" = 'kunkur01-' || substr("externalId", 16) WHERE "externalId" LIKE 'kunkurcomputer-%';
UPDATE "resources" SET "externalId" = 'kunkur01-' || substr("externalId", 16) WHERE "externalId" LIKE 'kunkurcomputer-%';
UPDATE "questions" SET "externalId" = 'kunkur01-' || substr("externalId", 16) WHERE "externalId" LIKE 'kunkurcomputer-%';
UPDATE "report_cards" SET "externalId" = 'kunkur01-' || substr("externalId", 16) WHERE "externalId" LIKE 'kunkurcomputer-%';
