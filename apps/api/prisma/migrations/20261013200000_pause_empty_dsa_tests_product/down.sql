-- Puts the course «حل تست ساختمان داده و الگوریتم» back on sale. The schema
-- is unchanged.
UPDATE "products" SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'data-structures-algorithms-tests';
