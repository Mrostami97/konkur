-- Refuse the downgrade once anything has been booked. A booking is the record
-- of a session a student paid for; dropping the table would destroy that with
-- nothing to reconstruct it from, and the money would still have been taken.
CREATE TEMP TABLE "_consultations_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_consultations_down_guard" SELECT false FROM "consultation_bookings" LIMIT 1;
INSERT INTO "_consultations_down_guard" SELECT false FROM "consultation_offerings" LIMIT 1;
INSERT INTO "_consultations_down_guard" SELECT false FROM "products" WHERE "kind"::text = 'CONSULTATION' LIMIT 1;

DROP TABLE "consultation_bookings";
DROP TABLE "consultation_offerings";

DROP TYPE "ConsultationBookingStatus";
DROP TYPE "ConsultationKind";

-- Postgres cannot drop a single enum value, so ProductKind is recreated
-- without CONSULTATION (the guard above proved no product uses it), the same
-- way the phase9 and phase17 down files do. Leaving the value behind made
-- this migration impossible to re-apply on its own: its ADD VALUE fails on a
-- label that already exists.
ALTER TABLE "products" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
DROP TYPE "ProductKind";
CREATE TYPE "ProductKind" AS ENUM ('COURSE', 'RESOURCE', 'BUNDLE', 'QUESTION_BANK');
ALTER TABLE "products" ALTER COLUMN "kind" TYPE "ProductKind" USING "kind"::"ProductKind";
