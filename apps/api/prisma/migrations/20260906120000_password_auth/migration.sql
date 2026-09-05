-- Add password authentication without changing or backfilling existing users.
-- OTP-only accounts remain valid because this column is nullable.
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
