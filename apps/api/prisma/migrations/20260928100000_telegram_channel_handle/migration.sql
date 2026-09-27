-- The official Telegram channel is now @kunkurcomputer (it was @konkurcom).
-- Rewrite links to it and mentions of it in live content and source records.
-- A channel keeps its post numbers when its username changes, so
-- t.me/konkurcom/138 becomes t.me/kunkurcomputer/138. Only the handle is
-- matched, as a whole word: ids, slugs and content_versions history stay.

CREATE FUNCTION pg_temp.channel(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(value, 't\.me/konkurcom(?![A-Za-z0-9_])', 't.me/kunkurcomputer', 'g'),
    '@konkurcom(?![A-Za-z0-9_/])', '@kunkurcomputer', 'g')
$$;

UPDATE "content_sources" SET
  "title" = pg_temp.channel("title"),
  "publisher" = pg_temp.channel("publisher"),
  "creator" = pg_temp.channel("creator"),
  "rightsHolder" = pg_temp.channel("rightsHolder"),
  "canonicalUrl" = pg_temp.channel("canonicalUrl"),
  "deepUrl" = pg_temp.channel("deepUrl"),
  "attributionText" = pg_temp.channel("attributionText"),
  "metadata" = pg_temp.channel("metadata"::text)::jsonb
WHERE "content_sources"::text ~ 'konkurcom';

UPDATE "article_sources" SET
  "locator" = pg_temp.channel("locator"),
  "claim" = pg_temp.channel("claim")
WHERE "article_sources"::text ~ 'konkurcom';

UPDATE "articles" SET
  "title" = pg_temp.channel("title"),
  "summary" = pg_temp.channel("summary"),
  "quickAnswer" = pg_temp.channel("quickAnswer"),
  "seoTitle" = pg_temp.channel("seoTitle"),
  "seoDescription" = pg_temp.channel("seoDescription"),
  "contentBlocks" = pg_temp.channel("contentBlocks"::text)::jsonb,
  "provenance" = pg_temp.channel("provenance"::text)::jsonb
WHERE "articles"::text ~ 'konkurcom';

UPDATE "resources" SET
  "title" = pg_temp.channel("title"),
  "summary" = pg_temp.channel("summary"),
  "description" = pg_temp.channel("description"),
  "externalUrl" = pg_temp.channel("externalUrl"),
  "contentBlocks" = pg_temp.channel("contentBlocks"::text)::jsonb,
  "provenance" = pg_temp.channel("provenance"::text)::jsonb,
  "metadata" = pg_temp.channel("metadata"::text)::jsonb
WHERE "resources"::text ~ 'konkurcom';

UPDATE "contributor_profiles" SET
  "shortBio" = pg_temp.channel("shortBio"),
  "bioBlocks" = pg_temp.channel("bioBlocks"::text)::jsonb,
  "sameAs" = ARRAY(SELECT pg_temp.channel(link) FROM unnest("sameAs") AS link)
WHERE "contributor_profiles"::text ~ 'konkurcom';

UPDATE "lessons" SET "contentBlocks" = pg_temp.channel("contentBlocks"::text)::jsonb
WHERE "lessons"::text ~ 'konkurcom';

UPDATE "courses" SET "description" = pg_temp.channel("description")
WHERE "courses"::text ~ 'konkurcom';

UPDATE "content_versions" SET "payload" = pg_temp.channel("payload"::text)::jsonb
WHERE "reviewStatus" <> 'PUBLISHED' AND "payload"::text ~ 'konkurcom';
