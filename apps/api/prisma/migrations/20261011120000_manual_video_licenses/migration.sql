-- SpotPlayer licences issued by hand: one key per student, and a request per
-- student and course for the owner to act on.
-- CreateEnum
CREATE TYPE "VideoLicenseRequestStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "student_video_licenses" (
    "userId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_video_licenses_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "video_license_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "VideoLicenseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,

    CONSTRAINT "video_license_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_license_requests_status_requestedAt_idx" ON "video_license_requests"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_license_requests_userId_courseId_key" ON "video_license_requests"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "student_video_licenses" ADD CONSTRAINT "student_video_licenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_license_requests" ADD CONSTRAINT "video_license_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_license_requests" ADD CONSTRAINT "video_license_requests_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

