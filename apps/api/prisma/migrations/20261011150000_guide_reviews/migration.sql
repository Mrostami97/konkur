-- Sign-offs for guides whose text lives in the site code.
-- CreateTable
CREATE TABLE "guide_reviews" (
    "slug" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_reviews_pkey" PRIMARY KEY ("slug")
);

