-- Refuse a destructive downgrade once Phase 9-only records exist. The
-- migrate-down command runs this file in one transaction, so every guard and
-- schema reversal is atomic.
CREATE TEMP TABLE "_phase9_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;
INSERT INTO "_phase9_down_guard" SELECT false FROM "resources" LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "products" WHERE "kind" IN ('RESOURCE', 'BUNDLE') LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "content_versions" WHERE "entityType" = 'RESOURCE' LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "content_versions" WHERE "schemaVersion" = 'article.v2' LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "content_sources" LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "contributor_profiles" LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "article_sources" LIMIT 1;
INSERT INTO "_phase9_down_guard"
SELECT false FROM "articles"
WHERE "contentType" <> 'ARTICLE'
   OR "quickAnswer" IS NOT NULL
   OR "seoTitle" IS NOT NULL
   OR "seoDescription" IS NOT NULL
   OR cardinality("taxonomyDegrees") > 0
   OR cardinality("taxonomyFields") > 0
   OR cardinality("subjectCodes") > 0
   OR cardinality("topicCodes") > 0
   OR "validForYear" IS NOT NULL
   OR "authorProfileId" IS NOT NULL
   OR "reviewerProfileId" IS NOT NULL
   OR "reviewedAt" IS NOT NULL
   OR "sourceValidatedAt" IS NOT NULL
   OR "reviewDueAt" IS NOT NULL
LIMIT 1;
INSERT INTO "_phase9_down_guard"
SELECT false FROM "courses"
WHERE "accessMode" <> 'ENTITLEMENT'
   OR "subjectId" IS NOT NULL
   OR cardinality("degreeTargets") > 0
   OR cardinality("fieldTargets") > 0
LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "lessons" WHERE "isPreview" = true LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "report_cards" WHERE "publicConsent" = true LIMIT 1;
INSERT INTO "_phase9_down_guard"
SELECT false FROM "subjects"
WHERE "slug" <> "code" OR "description" IS NOT NULL OR "order" <> 0 OR "metadata" <> '{}'::jsonb
LIMIT 1;
INSERT INTO "_phase9_down_guard"
SELECT false FROM "topics"
WHERE "slug" <> "code" OR "description" IS NOT NULL OR "order" <> 0 OR "metadata" <> '{}'::jsonb
LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "subject_prerequisites" LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "topic_prerequisites" LIMIT 1;
INSERT INTO "_phase9_down_guard" SELECT false FROM "lesson_topics" LIMIT 1;

ALTER TABLE "products" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
DROP TYPE "ProductKind";
CREATE TYPE "ProductKind" AS ENUM ('COURSE');
ALTER TABLE "products" ALTER COLUMN "kind" TYPE "ProductKind" USING "kind"::"ProductKind";

ALTER TABLE "content_versions" ALTER COLUMN "entityType" TYPE TEXT USING "entityType"::text;
DROP TYPE "VersionedEntityType";
CREATE TYPE "VersionedEntityType" AS ENUM ('ARTICLE', 'QUESTION', 'REPORT_CARD');
ALTER TABLE "content_versions" ALTER COLUMN "entityType" TYPE "VersionedEntityType" USING "entityType"::"VersionedEntityType";

ALTER TABLE "lesson_topics" DROP CONSTRAINT "lesson_topics_lessonId_fkey";
ALTER TABLE "lesson_topics" DROP CONSTRAINT "lesson_topics_topicId_fkey";
ALTER TABLE "topic_prerequisites" DROP CONSTRAINT "topic_prerequisites_topicId_fkey";
ALTER TABLE "topic_prerequisites" DROP CONSTRAINT "topic_prerequisites_prerequisiteId_fkey";
ALTER TABLE "subject_prerequisites" DROP CONSTRAINT "subject_prerequisites_subjectId_fkey";
ALTER TABLE "subject_prerequisites" DROP CONSTRAINT "subject_prerequisites_prerequisiteId_fkey";
ALTER TABLE "product_resource_grants" DROP CONSTRAINT "product_resource_grants_productId_fkey";
ALTER TABLE "product_resource_grants" DROP CONSTRAINT "product_resource_grants_resourceId_fkey";
ALTER TABLE "product_course_grants" DROP CONSTRAINT "product_course_grants_productId_fkey";
ALTER TABLE "product_course_grants" DROP CONSTRAINT "product_course_grants_courseId_fkey";
ALTER TABLE "courses" DROP CONSTRAINT "courses_subjectId_fkey";
ALTER TABLE "resource_sources" DROP CONSTRAINT "resource_sources_resourceId_fkey";
ALTER TABLE "resource_sources" DROP CONSTRAINT "resource_sources_sourceId_fkey";
ALTER TABLE "resources" DROP CONSTRAINT "resources_sourceArtifactId_fkey";
ALTER TABLE "resources" DROP CONSTRAINT "resources_authorProfileId_fkey";
ALTER TABLE "resources" DROP CONSTRAINT "resources_reviewerProfileId_fkey";
ALTER TABLE "article_sources" DROP CONSTRAINT "article_sources_articleId_fkey";
ALTER TABLE "article_sources" DROP CONSTRAINT "article_sources_sourceId_fkey";
ALTER TABLE "articles" DROP CONSTRAINT "articles_authorProfileId_fkey";
ALTER TABLE "articles" DROP CONSTRAINT "articles_reviewerProfileId_fkey";
ALTER TABLE "contributor_profiles" DROP CONSTRAINT "contributor_profiles_userId_fkey";

DROP TABLE "lesson_topics";
DROP TABLE "topic_prerequisites";
DROP TABLE "subject_prerequisites";
DROP TABLE "product_resource_grants";
DROP TABLE "product_course_grants";
DROP TABLE "resource_sources";
DROP TABLE "resources";
DROP TABLE "article_sources";
DROP TABLE "content_sources";
DROP TABLE "contributor_profiles";

DROP INDEX "articles_contentType_idx";
DROP INDEX "articles_authorProfileId_idx";
DROP INDEX "articles_reviewerProfileId_idx";
DROP INDEX "subjects_slug_key";
DROP INDEX "topics_slug_key";

ALTER TABLE "articles"
  DROP COLUMN "authorProfileId",
  DROP COLUMN "contentType",
  DROP COLUMN "quickAnswer",
  DROP COLUMN "reviewedAt",
  DROP COLUMN "reviewerProfileId",
  DROP COLUMN "seoDescription",
  DROP COLUMN "seoTitle",
  DROP COLUMN "sourceValidatedAt",
  DROP COLUMN "reviewDueAt",
  DROP COLUMN "subjectCodes",
  DROP COLUMN "taxonomyDegrees",
  DROP COLUMN "taxonomyFields",
  DROP COLUMN "topicCodes",
  DROP COLUMN "validForYear";

ALTER TABLE "courses"
  DROP COLUMN "accessMode",
  DROP COLUMN "degreeTargets",
  DROP COLUMN "fieldTargets",
  DROP COLUMN "subjectId";

ALTER TABLE "lessons" DROP COLUMN "isPreview";
ALTER TABLE "report_cards" DROP COLUMN "publicConsent";

ALTER TABLE "content_versions"
  DROP COLUMN "createdByUserId",
  DROP COLUMN "publishedAt",
  DROP COLUMN "reviewNote",
  DROP COLUMN "reviewStatus",
  DROP COLUMN "reviewedAt",
  DROP COLUMN "reviewedByUserId",
  DROP COLUMN "schemaVersion",
  DROP COLUMN "submittedAt",
  DROP COLUMN "updatedAt";

ALTER TABLE "subjects"
  DROP COLUMN "description",
  DROP COLUMN "metadata",
  DROP COLUMN "order",
  DROP COLUMN "slug";

ALTER TABLE "topics"
  DROP COLUMN "description",
  DROP COLUMN "metadata",
  DROP COLUMN "order",
  DROP COLUMN "slug";

DROP TYPE "ResourceHostingMode";
DROP TYPE "ResourceKind";
DROP TYPE "AccessMode";
DROP TYPE "ContributorKind";
DROP TYPE "ArticleContentType";
