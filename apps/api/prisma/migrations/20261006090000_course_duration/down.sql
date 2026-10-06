-- Only an admin-entered display figure: nothing else depends on it.
ALTER TABLE "courses" DROP COLUMN "durationMinutes";
