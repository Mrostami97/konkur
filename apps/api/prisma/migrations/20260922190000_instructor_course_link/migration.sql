-- Attaches instructors to the courses they teach.
--
-- ContributorProfile already carries everything an instructor page needs
-- (slug, display name, role title, bio blocks, avatar, thesis url, sameAs,
-- publication gating) and is already rendered at /authors/[slug]. It related
-- only to Article and Resource, though, so there was no way to say who
-- teaches a course -- and therefore no way to attribute a single sale to an
-- instructor. This is that missing edge.
CREATE TABLE "course_instructors" (
    "courseId" TEXT NOT NULL,
    "contributorProfileId" TEXT NOT NULL,

    -- Revenue share in basis points (10000 = 100%), not a percent float.
    -- Money is computed from this, and a binary float cannot hold 32.5% (or
    -- any other tenth) exactly; basis points keep the arithmetic in integers
    -- all the way to the rial. The service also checks that the shares on one
    -- course never exceed 10000, which no single-row CHECK can express.
    "revenueShareBp" INTEGER NOT NULL DEFAULT 0,

    -- Display order on the course and instructor pages. A course usually has
    -- one instructor; this exists so a co-taught course has a stable order
    -- rather than whatever the database returns.
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("courseId", "contributorProfileId"),
    CONSTRAINT "course_instructors_revenueShareBp_range" CHECK ("revenueShareBp" >= 0 AND "revenueShareBp" <= 10000)
);

-- Sales reporting reads by instructor ("what did I earn"), the course page
-- reads by course ("who teaches this"). The primary key serves the second;
-- this index serves the first.
CREATE INDEX "course_instructors_contributorProfileId_idx" ON "course_instructors"("contributorProfileId");

-- Cascade on both sides: the row is a pure edge and means nothing once either
-- end is gone. Deleting the edge never touches the course or the profile.
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_contributorProfileId_fkey"
    FOREIGN KEY ("contributorProfileId") REFERENCES "contributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
