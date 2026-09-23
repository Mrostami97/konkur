-- Named, consented results of the owner's own students.
--
-- ReportCard is the anonymous dataset behind rank estimation and deliberately
-- carries no name or photo. The homepage's results wall is a different thing:
-- a real person, their photo, their rank and where they got in, shown because
-- they agreed to be shown. That needs its own table with consent as a
-- first-class column rather than a flag bolted onto the anonymous one.
CREATE TABLE "student_achievements" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoArtifactId" TEXT,
    "examYear" INTEGER NOT NULL,
    "degree" "Degree" NOT NULL,
    "field" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    -- What the rank is a rank of: national, within a quota, within a region.
    -- A rank without its scope overstates or understates what it means.
    "rankLabel" TEXT,
    "acceptedUniversity" TEXT,
    "acceptedProgram" TEXT,
    "quote" TEXT,
    -- The subjects this student took with the owner, by subject slug, so a
    -- subject page can show the results that subject produced.
    "subjectSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "courseId" TEXT,
    "videoUrl" TEXT,
    -- Where the result was first announced (e.g. the owner's channel post).
    "sourceUrl" TEXT,
    -- When written consent to be shown publicly was obtained. Internal; the
    -- note says how (message, form, in person) and never leaves the admin.
    "consentConfirmedAt" TIMESTAMP(3),
    "consentNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_achievements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_achievements_rank_positive" CHECK ("rank" >= 1),
    -- The rule that matters most, held by the database rather than by every
    -- code path remembering it: nothing is public without recorded consent.
    CONSTRAINT "student_achievements_published_requires_consent"
        CHECK (NOT "isPublished" OR "consentConfirmedAt" IS NOT NULL)
);

CREATE INDEX "student_achievements_isPublished_examYear_idx" ON "student_achievements"("isPublished", "examYear");
CREATE INDEX "student_achievements_photoArtifactId_idx" ON "student_achievements"("photoArtifactId");

ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_photoArtifactId_fkey"
    FOREIGN KEY ("photoArtifactId") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
