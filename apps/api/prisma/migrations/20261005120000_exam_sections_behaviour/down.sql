-- Refuse the downgrade once sections or graded breakdowns exist: dropping
-- them would change issued report cards and lose how students worked.
CREATE TEMP TABLE "_exam_sections_behaviour_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_exam_sections_behaviour_down_guard" SELECT false FROM "exam_sections" LIMIT 1;

INSERT INTO "_exam_sections_behaviour_down_guard" SELECT false FROM "scores" WHERE "breakdown" IS NOT NULL LIMIT 1;

INSERT INTO "_exam_sections_behaviour_down_guard" SELECT false FROM "answers" WHERE "timeSpentMs" > 0 OR "flagged" OR "changeCount" > 0 LIMIT 1;

ALTER TABLE "scores" DROP COLUMN "breakdown";

ALTER TABLE "answers" DROP COLUMN "changeCount",
DROP COLUMN "flagged",
DROP COLUMN "timeSpentMs";

ALTER TABLE "exam_items" DROP CONSTRAINT "exam_items_sectionId_fkey";

ALTER TABLE "exam_items" DROP COLUMN "sectionId";

DROP TABLE "exam_sections";

ALTER TABLE "exams" DROP COLUMN "simulatesExamCode",
DROP COLUMN "simulatesYear";
