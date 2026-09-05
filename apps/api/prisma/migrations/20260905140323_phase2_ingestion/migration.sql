-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('RECEIVED', 'STAGED', 'REVIEWED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "DedupeStatus" AS ENUM ('NEW', 'MATCH', 'CONFLICT');

-- CreateEnum
CREATE TYPE "VersionedEntityType" AS ENUM ('ARTICLE', 'QUESTION', 'REPORT_CARD');

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "examDegree" "Degree" NOT NULL,
    "examMajor" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "topicCodes" TEXT[],
    "stemBlocks" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "solutionBlocks" JSONB NOT NULL,
    "assets" JSONB NOT NULL DEFAULT '[]',
    "source" JSONB,
    "provenance" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_cards" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "degree" "Degree" NOT NULL,
    "field" TEXT NOT NULL,
    "quota" TEXT NOT NULL,
    "subjectScores" JSONB NOT NULL,
    "rank" JSONB NOT NULL,
    "admissions" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'RECEIVED',
    "submittedBy" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "validationErrors" JSONB NOT NULL DEFAULT '[]',
    "dedupeStatus" "DedupeStatus",
    "publishedEntityId" TEXT,
    "publishedVersion" INTEGER,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_artifacts" (
    "id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "entityType" "VersionedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedByImportItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questions_externalId_key" ON "questions"("externalId");

-- CreateIndex
CREATE INDEX "questions_subjectCode_idx" ON "questions"("subjectCode");

-- CreateIndex
CREATE UNIQUE INDEX "report_cards_externalId_key" ON "report_cards"("externalId");

-- CreateIndex
CREATE INDEX "report_cards_examYear_degree_field_idx" ON "report_cards"("examYear", "degree", "field");

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_idempotencyKey_key" ON "import_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "import_items_importJobId_idx" ON "import_items"("importJobId");

-- CreateIndex
CREATE INDEX "import_items_status_idx" ON "import_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "source_artifacts_checksum_key" ON "source_artifacts"("checksum");

-- CreateIndex
CREATE INDEX "content_versions_entityType_entityId_idx" ON "content_versions"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_entityType_entityId_version_key" ON "content_versions"("entityType", "entityId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "articles_externalId_key" ON "articles"("externalId");

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

