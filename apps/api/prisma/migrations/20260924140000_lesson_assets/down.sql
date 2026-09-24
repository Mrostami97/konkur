-- Refuse the downgrade once any lesson carries an image: dropping the column
-- would leave image blocks pointing at media nothing can resolve.
CREATE TEMP TABLE "_lesson_assets_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_lesson_assets_down_guard" SELECT false FROM "lessons" WHERE "assets" <> '[]'::jsonb LIMIT 1;

ALTER TABLE "lessons" DROP COLUMN "assets";
