-- Refuse the downgrade once any licence has been issued. The key lives only
-- here; SpotPlayer has its own copy but nothing would connect it back to a
-- student, and re-issuing would spend a second seat per person.
CREATE TEMP TABLE "_spotplayer_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_spotplayer_down_guard" SELECT false FROM "spot_player_licenses" LIMIT 1;

DROP TABLE "spot_player_licenses";
ALTER TABLE "courses" DROP COLUMN "spotPlayerCourseId";
