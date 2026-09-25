-- Refuse the downgrade once any lesson holds an image: dropping the column
-- would leave its image blocks pointing at nothing.
CREATE TEMP TABLE "_lesson_assets_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_lesson_assets_down_guard" SELECT false FROM "lessons" WHERE "assets" <> '[]'::jsonb LIMIT 1;

ALTER TABLE "lessons" DROP COLUMN "assets";
