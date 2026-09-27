-- The owner decided (2026-09-28) that the annual consultation plan is the
-- consultation alone: courses, handouts and the question bank are bought
-- separately. The flag that let a product open the whole site goes, so it
-- can never be switched on by mistake. No product had it set.
ALTER TABLE "products" DROP COLUMN "grantsAllAccess";
