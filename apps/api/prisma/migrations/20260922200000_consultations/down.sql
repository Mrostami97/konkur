-- Refuse the downgrade once anything has been booked. A booking is the record
-- of a session a student paid for; dropping the table would destroy that with
-- nothing to reconstruct it from, and the money would still have been taken.
CREATE TEMP TABLE "_consultations_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_consultations_down_guard" SELECT false FROM "consultation_bookings" LIMIT 1;
INSERT INTO "_consultations_down_guard" SELECT false FROM "consultation_offerings" LIMIT 1;

DROP TABLE "consultation_bookings";
DROP TABLE "consultation_offerings";

DROP TYPE "ConsultationBookingStatus";
DROP TYPE "ConsultationKind";

-- Postgres cannot drop a value from an enum. CONSULTATION stays on
-- ProductKind; it is inert once nothing references it, and leaving it is
-- better than rewriting the type under a live products table.
