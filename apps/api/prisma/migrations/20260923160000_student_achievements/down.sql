-- Refuse the downgrade once any result has been recorded. Consent dates and
-- notes live only here; dropping them loses the record of who agreed to be
-- shown, which is the one thing that must survive.
CREATE TEMP TABLE "_achievements_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_achievements_down_guard" SELECT false FROM "student_achievements" LIMIT 1;

DROP TABLE "student_achievements";
