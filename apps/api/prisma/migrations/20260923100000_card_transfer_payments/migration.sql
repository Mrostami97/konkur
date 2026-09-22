-- Card-to-card payment.
--
-- The sandbox provider charged synchronously and the order became PAID inside
-- the same transaction as checkout, which is how an online gateway behaves.
-- A card transfer does not: the money arrives out of band, into a bank account
-- nobody here can query, and a human confirms it afterwards. So checkout now
-- only opens an order, and nothing grants access until an operator says the
-- money arrived.

-- AWAITING_REVIEW  the buyer says they have transferred and given a tracking
--                  code; nobody has checked the bank statement yet
-- REJECTED         checked and the transfer was not found, or did not match
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';

-- The destination cards, managed from the admin panel. These are the seller's
-- own published card numbers -- they are meant to be shown to buyers -- but
-- only an active one is ever offered, so a closed account cannot keep taking
-- money.
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    -- Stored as digits without separators; formatting is a display concern.
    "cardNumber" TEXT NOT NULL,
    "iban" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_accounts_cardNumber_digits" CHECK ("cardNumber" ~ '^[0-9]{16}$')
);

CREATE UNIQUE INDEX "bank_accounts_cardNumber_key" ON "bank_accounts"("cardNumber");
CREATE INDEX "bank_accounts_isActive_idx" ON "bank_accounts"("isActive");

-- What the buyer was told to pay into, what they say they did, and who checked.
ALTER TABLE "payments" ADD COLUMN "bankAccountId" TEXT;

-- The short code the buyer is asked to put in the transfer description, and
-- which the operator matches against the statement. Unique so one code never
-- stands for two orders.
ALTER TABLE "payments" ADD COLUMN "referenceCode" TEXT;

-- The buyer's own claim about the transfer. All of it is unverified until an
-- operator confirms, which is why none of it grants anything by itself.
ALTER TABLE "payments" ADD COLUMN "receiptTrackingCode" TEXT;
ALTER TABLE "payments" ADD COLUMN "receiptPaidAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "receiptFromCardLast4" TEXT;
ALTER TABLE "payments" ADD COLUMN "receiptNote" TEXT;
ALTER TABLE "payments" ADD COLUMN "receiptSubmittedAt" TIMESTAMP(3);

ALTER TABLE "payments" ADD COLUMN "reviewedByUserId" TEXT;
ALTER TABLE "payments" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "rejectionReason" TEXT;

CREATE UNIQUE INDEX "payments_referenceCode_key" ON "payments"("referenceCode");
-- The operator's queue reads by status; the buyer's order page reads by order.
CREATE INDEX "payments_status_idx" ON "payments"("status");

ALTER TABLE "payments" ADD CONSTRAINT "payments_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
