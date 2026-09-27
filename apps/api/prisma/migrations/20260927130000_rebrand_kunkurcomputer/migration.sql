-- The owner renamed the project on 2026-09-27:
--   کنکورصفریک / kunkur01 / kunkur01.ir  ->  کنکور کامپیوتر / kunkurcomputer / kunkurcomputer.ir
-- Live content carries the old name in its prose and source records, so it
-- is rewritten here. Identifiers are never touched: slugs, ids, external ids
-- and checksums are left out of every UPDATE, and the name is only replaced
-- as a whole word, so an id such as "kunkur01-lesson-x" keeps its prefix.
-- content_versions is history and is left as it was written.

CREATE FUNCTION pg_temp.rebrand(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    replace(replace(value, 'kunkur01.ir', 'kunkurcomputer.ir'), 'کنکورصفریک', 'کنکور کامپیوتر'),
    '(?<![A-Za-z0-9_.-])kunkur01(?![A-Za-z0-9_-])', 'کنکور کامپیوتر', 'g')
$$;

-- Links: only the domain changes.
CREATE FUNCTION pg_temp.rebrand_url(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(value, 'kunkur01.ir', 'kunkurcomputer.ir')
$$;

-- A party named by its Latin handle keeps a Latin handle.
CREATE FUNCTION pg_temp.rebrand_party(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value = 'kunkur01' THEN 'kunkurcomputer' ELSE pg_temp.rebrand(value) END
$$;

UPDATE "articles" SET
  "title" = pg_temp.rebrand("title"),
  "summary" = pg_temp.rebrand("summary"),
  "quickAnswer" = pg_temp.rebrand("quickAnswer"),
  "seoTitle" = pg_temp.rebrand("seoTitle"),
  "seoDescription" = pg_temp.rebrand("seoDescription"),
  "contentBlocks" = pg_temp.rebrand("contentBlocks"::text)::jsonb,
  "provenance" = pg_temp.rebrand("provenance"::text)::jsonb
WHERE "articles"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "article_sources" SET
  "locator" = pg_temp.rebrand("locator"),
  "claim" = pg_temp.rebrand("claim")
WHERE "article_sources"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "content_sources" SET
  "title" = pg_temp.rebrand("title"),
  "publisher" = pg_temp.rebrand_party("publisher"),
  "creator" = pg_temp.rebrand_party("creator"),
  "rightsHolder" = pg_temp.rebrand_party("rightsHolder"),
  "attributionText" = pg_temp.rebrand("attributionText"),
  "canonicalUrl" = pg_temp.rebrand_url("canonicalUrl"),
  "deepUrl" = pg_temp.rebrand_url("deepUrl"),
  "licenseUrl" = pg_temp.rebrand_url("licenseUrl"),
  "metadata" = pg_temp.rebrand("metadata"::text)::jsonb
WHERE "content_sources"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "resources" SET
  "title" = pg_temp.rebrand("title"),
  "summary" = pg_temp.rebrand("summary"),
  "description" = pg_temp.rebrand("description"),
  "contentBlocks" = pg_temp.rebrand("contentBlocks"::text)::jsonb,
  "externalUrl" = pg_temp.rebrand_url("externalUrl"),
  "provenance" = pg_temp.rebrand("provenance"::text)::jsonb,
  "metadata" = pg_temp.rebrand("metadata"::text)::jsonb
WHERE "resources"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "contributor_profiles" SET
  "displayName" = pg_temp.rebrand("displayName"),
  "roleTitle" = pg_temp.rebrand("roleTitle"),
  "shortBio" = pg_temp.rebrand("shortBio"),
  "bioBlocks" = pg_temp.rebrand("bioBlocks"::text)::jsonb,
  "avatarUrl" = pg_temp.rebrand_url("avatarUrl"),
  "thesisUrl" = pg_temp.rebrand_url("thesisUrl")
WHERE "contributor_profiles"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "courses" SET "title" = pg_temp.rebrand("title"), "description" = pg_temp.rebrand("description")
WHERE "courses"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "course_modules" SET "title" = pg_temp.rebrand("title")
WHERE "course_modules"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "lessons" SET "title" = pg_temp.rebrand("title"), "contentBlocks" = pg_temp.rebrand("contentBlocks"::text)::jsonb
WHERE "lessons"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "exams" SET "title" = pg_temp.rebrand("title"), "description" = pg_temp.rebrand("description")
WHERE "exams"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "products" SET "title" = pg_temp.rebrand("title"), "description" = pg_temp.rebrand("description")
WHERE "products"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "subjects" SET
  "title" = pg_temp.rebrand("title"),
  "description" = pg_temp.rebrand("description"),
  "metadata" = pg_temp.rebrand("metadata"::text)::jsonb
WHERE "subjects"::text ~ '(kunkur01|کنکورصفریک)';

UPDATE "topics" SET
  "title" = pg_temp.rebrand("title"),
  "description" = pg_temp.rebrand("description"),
  "metadata" = pg_temp.rebrand("metadata"::text)::jsonb
WHERE "topics"::text ~ '(kunkur01|کنکورصفریک)';
