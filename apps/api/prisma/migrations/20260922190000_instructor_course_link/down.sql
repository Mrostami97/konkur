-- Refuse the downgrade once any instructor has been attached to a course.
-- The revenue share lives only here, so dropping the table would destroy the
-- basis on which instructors are paid, with nothing to reconstruct it from.
CREATE TEMP TABLE "_instructor_link_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_instructor_link_down_guard" SELECT false FROM "course_instructors" LIMIT 1;

DROP TABLE "course_instructors";
