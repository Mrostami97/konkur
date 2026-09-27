-- Refuse the downgrade once any course lists a handout: dropping the table
-- would silently take those handouts away from the course's buyers.
CREATE TEMP TABLE "_course_materials_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_course_materials_down_guard" SELECT false FROM "course_materials" LIMIT 1;

DROP TABLE "course_materials";
