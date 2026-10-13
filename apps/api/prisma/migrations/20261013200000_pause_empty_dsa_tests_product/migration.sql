-- Owner request, 2026-10-13: take the course «حل تست ساختمان داده و الگوریتم»
-- off sale while it has no lessons, so nobody pays for an empty course.
-- The product is only switched off (not deleted): turn it back on from the
-- admin panel once the course has lessons. A no-op on a database without this
-- product, or where the course already has a lesson.
UPDATE "products" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'data-structures-algorithms-tests'
  AND NOT EXISTS (
    SELECT 1 FROM "lessons" l
    JOIN "course_modules" m ON m."id" = l."courseModuleId"
    JOIN "courses" c ON c."id" = m."courseId"
    WHERE c."slug" = 'data-structures-algorithms-tests'
  );
