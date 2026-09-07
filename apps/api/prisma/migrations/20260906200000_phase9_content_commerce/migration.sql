-- Phase 9: additive content, editorial, resource and entitlement foundations.

CREATE TYPE "ArticleContentType" AS ENUM ('ARTICLE', 'GUIDE', 'NEWS', 'CASE_STUDY');
CREATE TYPE "ContributorKind" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "AccessMode" AS ENUM ('PUBLIC', 'ACCOUNT', 'ENTITLEMENT');
CREATE TYPE "ResourceKind" AS ENUM ('NOTE', 'VIDEO', 'PDF', 'EXTERNAL_LINK', 'OFFICIAL_NOTICE', 'EXAM_PROGRAM', 'REGISTRATION_BOOKLET', 'QUESTION_BOOKLET', 'ANSWER_KEY', 'CORRECTION', 'ACADEMIC_SYLLABUS', 'OPEN_TEXTBOOK', 'OLYMPIAD_PROBLEM_SET', 'OLYMPIAD_SOLUTION', 'TELEGRAM_POST', 'TRANSCRIPT');
CREATE TYPE "ResourceHostingMode" AS ENUM ('METADATA_ONLY', 'EXTERNAL_LINK', 'OFFICIAL_EMBED', 'USER_UPLOAD', 'MIRRORED_WITH_PERMISSION');

ALTER TYPE "ProductKind" ADD VALUE 'RESOURCE';
ALTER TYPE "ProductKind" ADD VALUE 'BUNDLE';
ALTER TYPE "VersionedEntityType" ADD VALUE 'RESOURCE';

ALTER TABLE "articles"
  ADD COLUMN "authorProfileId" TEXT,
  ADD COLUMN "contentType" "ArticleContentType" NOT NULL DEFAULT 'ARTICLE',
  ADD COLUMN "quickAnswer" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewerProfileId" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "sourceValidatedAt" TIMESTAMP(3),
  ADD COLUMN "reviewDueAt" TIMESTAMP(3),
  ADD COLUMN "subjectCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "taxonomyDegrees" "Degree"[] NOT NULL DEFAULT ARRAY[]::"Degree"[],
  ADD COLUMN "taxonomyFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "topicCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "validForYear" INTEGER;

ALTER TABLE "courses"
  ADD COLUMN "accessMode" "AccessMode" NOT NULL DEFAULT 'ENTITLEMENT',
  ADD COLUMN "degreeTargets" "Degree"[] NOT NULL DEFAULT ARRAY[]::"Degree"[],
  ADD COLUMN "fieldTargets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "subjectId" TEXT;

ALTER TABLE "lessons" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "report_cards" ADD COLUMN "publicConsent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "content_versions"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "schemaVersion" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "content_versions"
SET "schemaVersion" = CASE "entityType"
  WHEN 'ARTICLE' THEN 'article.v1'
  WHEN 'QUESTION' THEN 'question.v1'
  WHEN 'REPORT_CARD' THEN 'report-card.v1'
  ELSE 'article.v1'
END,
"publishedAt" = "createdAt",
"updatedAt" = "createdAt";

ALTER TABLE "content_versions" ALTER COLUMN "schemaVersion" SET NOT NULL;
ALTER TABLE "content_versions" ALTER COLUMN "schemaVersion" SET DEFAULT 'article.v1';
ALTER TABLE "content_versions" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "subjects"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "slug" TEXT;
UPDATE "subjects" SET "slug" = "code";
ALTER TABLE "subjects" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "topics"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "slug" TEXT;
UPDATE "topics" SET "slug" = "code";
ALTER TABLE "topics" ALTER COLUMN "slug" SET NOT NULL;

CREATE TABLE "contributor_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "kind" "ContributorKind" NOT NULL DEFAULT 'PERSON',
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "roleTitle" TEXT,
  "shortBio" TEXT,
  "bioBlocks" JSONB NOT NULL DEFAULT '[]',
  "avatarUrl" TEXT,
  "thesisUrl" TEXT,
  "sameAs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contributor_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_sources" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "publisher" TEXT NOT NULL,
  "creator" TEXT,
  "canonicalUrl" TEXT NOT NULL,
  "deepUrl" TEXT,
  "sourceTier" TEXT NOT NULL,
  "authorityScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "publishedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "rightsHolder" TEXT,
  "rightsBasis" TEXT NOT NULL DEFAULT 'LINK_ONLY',
  "licenseName" TEXT,
  "licenseUrl" TEXT,
  "attributionText" TEXT,
  "mayLink" BOOLEAN NOT NULL DEFAULT true,
  "mayEmbed" BOOLEAN NOT NULL DEFAULT false,
  "mayQuote" BOOLEAN NOT NULL DEFAULT false,
  "mayReproduce" BOOLEAN NOT NULL DEFAULT false,
  "mayAdapt" BOOLEAN NOT NULL DEFAULT false,
  "mayTranslate" BOOLEAN NOT NULL DEFAULT false,
  "mayHost" BOOLEAN NOT NULL DEFAULT false,
  "commercialUseAllowed" BOOLEAN NOT NULL DEFAULT false,
  "checksum" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_sources" (
  "articleId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'SUPPORTS',
  "locator" TEXT,
  "claim" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "article_sources_pkey" PRIMARY KEY ("articleId", "sourceId")
);

CREATE TABLE "resources" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT,
  "kind" "ResourceKind" NOT NULL,
  "accessMode" "AccessMode" NOT NULL DEFAULT 'PUBLIC',
  "hostingMode" "ResourceHostingMode" NOT NULL DEFAULT 'METADATA_ONLY',
  "contentBlocks" JSONB NOT NULL DEFAULT '[]',
  "externalUrl" TEXT,
  "sourceArtifactId" TEXT,
  "taxonomyDegrees" "Degree"[] NOT NULL DEFAULT ARRAY[]::"Degree"[],
  "taxonomyFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subjectCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topicCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "provenance" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "authorProfileId" TEXT,
  "reviewerProfileId" TEXT,
  "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_sources" (
  "resourceId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'SUPPORTS',
  "locator" TEXT,
  "claim" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "resource_sources_pkey" PRIMARY KEY ("resourceId", "sourceId")
);

CREATE TABLE "product_course_grants" (
  "productId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "product_course_grants_pkey" PRIMARY KEY ("productId", "courseId")
);

CREATE TABLE "product_resource_grants" (
  "productId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  CONSTRAINT "product_resource_grants_pkey" PRIMARY KEY ("productId", "resourceId")
);

CREATE TABLE "subject_prerequisites" (
  "subjectId" TEXT NOT NULL,
  "prerequisiteId" TEXT NOT NULL,
  CONSTRAINT "subject_prerequisites_pkey" PRIMARY KEY ("subjectId", "prerequisiteId")
);

CREATE TABLE "topic_prerequisites" (
  "topicId" TEXT NOT NULL,
  "prerequisiteId" TEXT NOT NULL,
  CONSTRAINT "topic_prerequisites_pkey" PRIMARY KEY ("topicId", "prerequisiteId")
);

CREATE TABLE "lesson_topics" (
  "lessonId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  CONSTRAINT "lesson_topics_pkey" PRIMARY KEY ("lessonId", "topicId")
);

CREATE UNIQUE INDEX "contributor_profiles_userId_key" ON "contributor_profiles"("userId");
CREATE UNIQUE INDEX "contributor_profiles_slug_key" ON "contributor_profiles"("slug");
CREATE UNIQUE INDEX "content_sources_externalId_key" ON "content_sources"("externalId");
CREATE INDEX "content_sources_canonicalUrl_idx" ON "content_sources"("canonicalUrl");
CREATE INDEX "content_sources_sourceStatus_idx" ON "content_sources"("sourceStatus");
CREATE INDEX "article_sources_sourceId_idx" ON "article_sources"("sourceId");
CREATE UNIQUE INDEX "resources_externalId_key" ON "resources"("externalId");
CREATE UNIQUE INDEX "resources_slug_key" ON "resources"("slug");
CREATE INDEX "resources_reviewStatus_accessMode_idx" ON "resources"("reviewStatus", "accessMode");
CREATE INDEX "resources_sourceArtifactId_idx" ON "resources"("sourceArtifactId");
CREATE INDEX "resources_authorProfileId_idx" ON "resources"("authorProfileId");
CREATE INDEX "resources_reviewerProfileId_idx" ON "resources"("reviewerProfileId");
CREATE INDEX "resource_sources_sourceId_idx" ON "resource_sources"("sourceId");
CREATE INDEX "product_course_grants_courseId_idx" ON "product_course_grants"("courseId");
CREATE INDEX "product_resource_grants_resourceId_idx" ON "product_resource_grants"("resourceId");
CREATE INDEX "subject_prerequisites_prerequisiteId_idx" ON "subject_prerequisites"("prerequisiteId");
CREATE INDEX "topic_prerequisites_prerequisiteId_idx" ON "topic_prerequisites"("prerequisiteId");
CREATE INDEX "lesson_topics_topicId_idx" ON "lesson_topics"("topicId");
CREATE INDEX "articles_contentType_idx" ON "articles"("contentType");
CREATE INDEX "articles_authorProfileId_idx" ON "articles"("authorProfileId");
CREATE INDEX "articles_reviewerProfileId_idx" ON "articles"("reviewerProfileId");
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

ALTER TABLE "articles" ADD CONSTRAINT "articles_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "contributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "articles" ADD CONSTRAINT "articles_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "contributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contributor_profiles" ADD CONSTRAINT "contributor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "contributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "contributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_sources" ADD CONSTRAINT "resource_sources_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_sources" ADD CONSTRAINT "resource_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_course_grants" ADD CONSTRAINT "product_course_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_course_grants" ADD CONSTRAINT "product_course_grants_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_resource_grants" ADD CONSTRAINT "product_resource_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_resource_grants" ADD CONSTRAINT "product_resource_grants_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_prerequisites" ADD CONSTRAINT "subject_prerequisites_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_prerequisites" ADD CONSTRAINT "subject_prerequisites_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_topics" ADD CONSTRAINT "lesson_topics_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_topics" ADD CONSTRAINT "lesson_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "product_course_grants" ("productId", "courseId")
SELECT "id", "courseId" FROM "products" WHERE "courseId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "content_versions" (
  "id", "entityType", "entityId", "version", "payload", "schemaVersion",
  "reviewStatus", "createdByUserId", "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'phase9-article-version-' || a."id" || '-' || a."version"::text,
  'ARTICLE'::"VersionedEntityType",
  a."id",
  a."version",
  jsonb_build_object(
    'schema_version', 'article.v1',
    'external_id', COALESCE(a."externalId", 'legacy-article-' || a."id"),
    'title', a."title",
    'slug', a."slug",
    'summary', a."summary",
    'content_blocks', a."contentBlocks",
    'taxonomy', jsonb_build_object('major', a."taxonomyMajor", 'tags', a."taxonomyTags"),
    'assets', a."assets",
    'provenance', COALESCE(a."provenance", jsonb_build_object('producer_type', 'human', 'source_artifact', 'phase9-legacy-backfill')),
    'review_status', CASE a."reviewStatus"
      WHEN 'PUBLISHED' THEN 'approved'
      WHEN 'IN_REVIEW' THEN 'in_review'
      WHEN 'REJECTED' THEN 'rejected'
      ELSE 'draft'
    END
  ),
  'article.v1',
  a."reviewStatus",
  a."authorId",
  a."publishedAt",
  a."createdAt",
  a."updatedAt"
FROM "articles" a
WHERE NOT EXISTS (
  SELECT 1 FROM "content_versions" cv
  WHERE cv."entityType" = 'ARTICLE' AND cv."entityId" = a."id" AND cv."version" = a."version"
);
