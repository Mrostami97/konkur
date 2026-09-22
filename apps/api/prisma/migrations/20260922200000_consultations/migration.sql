-- Paid consultation booking.
--
-- Sold through the existing commerce path -- Product/Price/Order/Entitlement --
-- rather than a parallel payment flow, so consultations appear in the same
-- orders, the same library and the same revocation machinery as everything
-- else. An offering is the instructor-specific thing on sale; a booking is one
-- session drawn against what the student bought.
ALTER TYPE "ProductKind" ADD VALUE 'CONSULTATION';

-- A single session, or a package used up over time (the "annual until konkur"
-- product: a fixed number of sessions with a deadline).
CREATE TYPE "ConsultationKind" AS ENUM ('SINGLE_SESSION', 'PACKAGE');

-- REQUESTED   student has paid and proposed times; waiting on the instructor
-- CONFIRMED   instructor has fixed a time
-- COMPLETED   the session happened
-- CANCELLED   called off by either side; returns the session to the quota
-- NO_SHOW     booked time passed unused; consumes the quota
CREATE TYPE "ConsultationBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "consultation_offerings" (
    "id" TEXT NOT NULL,
    "instructorProfileId" TEXT NOT NULL,

    -- One product per offering: the price, the order and the entitlement all
    -- come from the existing commerce tables rather than being duplicated here.
    "productId" TEXT NOT NULL,

    "kind" "ConsultationKind" NOT NULL,

    -- Sessions included. 1 for a single session; for the annual package this
    -- is the agreed count, which the booking service counts down against.
    "sessionQuota" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,

    -- The deadline the package runs to -- the konkur date for the annual
    -- product. Copied onto the entitlement's endAt at checkout so access
    -- expiry stays evaluated in the one place that already evaluates it.
    "validUntil" TIMESTAMP(3),

    "headline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_offerings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consultation_offerings_sessionQuota_positive" CHECK ("sessionQuota" >= 1),
    CONSTRAINT "consultation_offerings_duration_positive" CHECK ("durationMinutes" >= 1)
);

CREATE UNIQUE INDEX "consultation_offerings_productId_key" ON "consultation_offerings"("productId");
CREATE INDEX "consultation_offerings_instructorProfileId_idx" ON "consultation_offerings"("instructorProfileId");

CREATE TABLE "consultation_bookings" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,

    -- What paid for this session. Quota is counted per entitlement, so a
    -- student who buys the package twice gets two independent quotas.
    "entitlementId" TEXT NOT NULL,

    "studentUserId" TEXT NOT NULL,

    -- Denormalized from the offering so the instructor's own queries never
    -- have to join through it, and so a booking keeps pointing at the person
    -- who actually took it if an offering is ever reassigned.
    "instructorProfileId" TEXT NOT NULL,

    "status" "ConsultationBookingStatus" NOT NULL DEFAULT 'REQUESTED',

    -- Times the student proposed, as ISO strings. There is no availability
    -- calendar by design: the instructor confirms one of these, or any other
    -- time, and the student can cancel if it does not suit.
    "requestedSlots" JSONB NOT NULL DEFAULT '[]',
    "studentNote" TEXT,

    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL,

    -- Where the session happens: a meeting link, or a note for a phone call
    -- or an in-person meeting. Only ever shown to the two participants.
    "meetingUrl" TEXT,
    "instructorNote" TEXT,

    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consultation_bookings_duration_positive" CHECK ("durationMinutes" >= 1)
);

-- The instructor's queue, the student's list, and the quota count per
-- entitlement are the three reads this table exists to serve.
CREATE INDEX "consultation_bookings_instructorProfileId_status_idx"
    ON "consultation_bookings"("instructorProfileId", "status");
CREATE INDEX "consultation_bookings_studentUserId_idx" ON "consultation_bookings"("studentUserId");
CREATE INDEX "consultation_bookings_entitlementId_idx" ON "consultation_bookings"("entitlementId");

ALTER TABLE "consultation_offerings" ADD CONSTRAINT "consultation_offerings_instructorProfileId_fkey"
    FOREIGN KEY ("instructorProfileId") REFERENCES "contributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_offerings" ADD CONSTRAINT "consultation_offerings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RESTRICT throughout: a booking is a record of a paid commitment between two
-- people. Nothing upstream may be deleted in a way that silently erases it.
ALTER TABLE "consultation_bookings" ADD CONSTRAINT "consultation_bookings_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "consultation_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_bookings" ADD CONSTRAINT "consultation_bookings_entitlementId_fkey"
    FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_bookings" ADD CONSTRAINT "consultation_bookings_studentUserId_fkey"
    FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_bookings" ADD CONSTRAINT "consultation_bookings_instructorProfileId_fkey"
    FOREIGN KEY ("instructorProfileId") REFERENCES "contributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
