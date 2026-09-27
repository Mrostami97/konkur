-- Refuse the downgrade once it would take something away: a product that
-- opens the whole site for its buyers, or any weekly report a student wrote.
CREATE TEMP TABLE "_annual_consultation_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_annual_consultation_down_guard" SELECT false FROM "products" WHERE "grantsAllAccess" LIMIT 1;

INSERT INTO "_annual_consultation_down_guard" SELECT false FROM "weekly_reports" LIMIT 1;

DROP TABLE "weekly_reports";

ALTER TABLE "products" DROP COLUMN "grantsAllAccess";
