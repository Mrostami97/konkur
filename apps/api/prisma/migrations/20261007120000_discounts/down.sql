-- Orders keep their totals (what was actually charged); only the link to the code and its amount go.
ALTER TABLE "discount_code_products" DROP CONSTRAINT "discount_code_products_productId_fkey";
ALTER TABLE "discount_code_products" DROP CONSTRAINT "discount_code_products_discountCodeId_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_discountCodeId_fkey";
DROP INDEX IF EXISTS "orders_discountCodeId_idx";
DROP TABLE "discount_code_products";
DROP TABLE "discount_codes";
ALTER TABLE "orders" DROP COLUMN "discountRial", DROP COLUMN "discountCodeId";
ALTER TABLE "prices" DROP COLUMN "compareAtRial";
