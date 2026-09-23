-- Refuse the downgrade once any consultant plan exists: the tasks, what the
-- student ticked off and the time they reported exist nowhere else.
CREATE TEMP TABLE "_coach_plans_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_coach_plans_down_guard" SELECT false FROM "coach_plans" LIMIT 1;

DROP TABLE "coach_plan_items";
DROP TABLE "coach_plans";

DROP TYPE "CoachTaskKind";
DROP TYPE "CoachPlanStatus";
