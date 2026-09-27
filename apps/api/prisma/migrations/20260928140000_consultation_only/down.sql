-- Brings the column back, off for every product.
ALTER TABLE "products" ADD COLUMN "grantsAllAccess" BOOLEAN NOT NULL DEFAULT false;
