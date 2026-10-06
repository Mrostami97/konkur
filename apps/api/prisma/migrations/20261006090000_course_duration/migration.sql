-- A course's total length in minutes, set by the admin; null when not stated.
ALTER TABLE "courses" ADD COLUMN "durationMinutes" INTEGER;
