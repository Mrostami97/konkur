-- SpotPlayer licences for video courses.
--
-- Course videos are hosted in SpotPlayer, an offline DRM player: the student
-- installs the app and enters a licence key that is issued per person. So a
-- course needs to know its id on their side, and every issued key has to be
-- stored -- SpotPlayer will happily issue a second licence for the same
-- student, and each one is a separate seat.
ALTER TABLE "courses" ADD COLUMN "spotPlayerCourseId" TEXT;

CREATE TABLE "spot_player_licenses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    -- SpotPlayer's own id for the licence, kept so it can be edited or
    -- revoked on their side later.
    "spotPlayerLicenseId" TEXT NOT NULL,
    -- The key the student types into the player, and the download link
    -- SpotPlayer returns with it.
    "licenseKey" TEXT NOT NULL,
    "licenseUrl" TEXT NOT NULL,

    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_player_licenses_pkey" PRIMARY KEY ("id")
);

-- One licence per person per course. This is the constraint that stops a
-- refresh, a double click or a retry after a timeout from burning a second
-- seat: issuance reads this first and only calls SpotPlayer on a miss.
CREATE UNIQUE INDEX "spot_player_licenses_userId_courseId_key"
    ON "spot_player_licenses"("userId", "courseId");
CREATE INDEX "spot_player_licenses_courseId_idx" ON "spot_player_licenses"("courseId");

ALTER TABLE "spot_player_licenses" ADD CONSTRAINT "spot_player_licenses_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spot_player_licenses" ADD CONSTRAINT "spot_player_licenses_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
