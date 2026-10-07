-- Sales and discount codes: a price can carry the amount before its sale, and
-- an order can carry a discount code and the money it took off.
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountCodeId" TEXT,
ADD COLUMN     "discountRial" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "prices" ADD COLUMN     "compareAtRial" INTEGER;

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "percentOff" INTEGER,
    "amountOffRial" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_code_products" (
    "discountCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "discount_code_products_pkey" PRIMARY KEY ("discountCodeId","productId")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_code_products_productId_idx" ON "discount_code_products"("productId");

-- CreateIndex
CREATE INDEX "orders_discountCodeId_idx" ON "orders"("discountCodeId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code_products" ADD CONSTRAINT "discount_code_products_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code_products" ADD CONSTRAINT "discount_code_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

