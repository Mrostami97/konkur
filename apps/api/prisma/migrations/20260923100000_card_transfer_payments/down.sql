-- Refuse the downgrade once any card transfer has been recorded. The tracking
-- code and the reviewer are the only record that a given order was paid for
-- with money that arrived outside this system; dropping them would leave paid
-- orders with no evidence of payment.
CREATE TEMP TABLE "_card_transfer_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_card_transfer_down_guard" SELECT false FROM "payments" WHERE "referenceCode" IS NOT NULL LIMIT 1;
INSERT INTO "_card_transfer_down_guard" SELECT false FROM "bank_accounts" LIMIT 1;

ALTER TABLE "payments" DROP CONSTRAINT "payments_bankAccountId_fkey";
DROP INDEX "payments_status_idx";
DROP INDEX "payments_referenceCode_key";

ALTER TABLE "payments" DROP COLUMN "rejectionReason";
ALTER TABLE "payments" DROP COLUMN "reviewedAt";
ALTER TABLE "payments" DROP COLUMN "reviewedByUserId";
ALTER TABLE "payments" DROP COLUMN "receiptSubmittedAt";
ALTER TABLE "payments" DROP COLUMN "receiptNote";
ALTER TABLE "payments" DROP COLUMN "receiptFromCardLast4";
ALTER TABLE "payments" DROP COLUMN "receiptPaidAt";
ALTER TABLE "payments" DROP COLUMN "receiptTrackingCode";
ALTER TABLE "payments" DROP COLUMN "referenceCode";
ALTER TABLE "payments" DROP COLUMN "bankAccountId";

DROP TABLE "bank_accounts";

-- Postgres cannot drop a value from an enum. AWAITING_REVIEW and REJECTED
-- stay on PaymentStatus; they are inert once nothing uses them.
