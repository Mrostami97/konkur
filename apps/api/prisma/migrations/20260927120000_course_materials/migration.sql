-- Handouts that come with a course: access to the course opens them too.
CREATE TABLE "course_materials" (
    "courseId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("courseId","resourceId")
);

CREATE INDEX "course_materials_resourceId_idx" ON "course_materials"("resourceId");

ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
