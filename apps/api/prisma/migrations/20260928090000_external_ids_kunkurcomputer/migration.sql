-- The owner asked on 2026-09-28 for external ids to carry the new name:
-- "kunkur01-..." becomes "kunkurcomputer-...". Import packages now use the new
-- prefix, so the live rows are renamed to match; otherwise the next import of
-- an already-published article would look like a new article on the same slug.
-- A row is skipped if an id with the new prefix already exists, so the
-- migration never breaks a unique index. import_items and content_versions
-- are history and keep what was written at the time.

UPDATE "articles" AS a SET "externalId" = 'kunkurcomputer-' || substr(a."externalId", 10)
WHERE a."externalId" LIKE 'kunkur01-%'
  AND NOT EXISTS (SELECT 1 FROM "articles" b WHERE b."externalId" = 'kunkurcomputer-' || substr(a."externalId", 10));

UPDATE "content_sources" AS a SET "externalId" = 'kunkurcomputer-' || substr(a."externalId", 10)
WHERE a."externalId" LIKE 'kunkur01-%'
  AND NOT EXISTS (SELECT 1 FROM "content_sources" b WHERE b."externalId" = 'kunkurcomputer-' || substr(a."externalId", 10));

UPDATE "resources" AS a SET "externalId" = 'kunkurcomputer-' || substr(a."externalId", 10)
WHERE a."externalId" LIKE 'kunkur01-%'
  AND NOT EXISTS (SELECT 1 FROM "resources" b WHERE b."externalId" = 'kunkurcomputer-' || substr(a."externalId", 10));

UPDATE "questions" AS a SET "externalId" = 'kunkurcomputer-' || substr(a."externalId", 10)
WHERE a."externalId" LIKE 'kunkur01-%'
  AND NOT EXISTS (SELECT 1 FROM "questions" b WHERE b."externalId" = 'kunkurcomputer-' || substr(a."externalId", 10));

UPDATE "report_cards" AS a SET "externalId" = 'kunkurcomputer-' || substr(a."externalId", 10)
WHERE a."externalId" LIKE 'kunkur01-%'
  AND NOT EXISTS (SELECT 1 FROM "report_cards" b WHERE b."externalId" = 'kunkurcomputer-' || substr(a."externalId", 10));
