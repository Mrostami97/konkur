-- Reversible counterpart for operators that explicitly roll back this change.
ALTER TABLE "users" DROP COLUMN "passwordHash";
