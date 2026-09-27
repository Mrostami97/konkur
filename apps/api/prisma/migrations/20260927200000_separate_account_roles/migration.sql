-- Accounts are kept apart by role (owner decision 2026-09-27; rules in
-- apps/api/src/modules/identity/account-roles.ts):
--  1. The main administrator holds ADMIN alone. ADMIN already reaches every
--     staff route, so dropping the rest removes nothing -- and it keeps an
--     admin who first signed up as a student from being locked out by the
--     new rule that STUDENT accounts are refused staff routes.
--  2. An account linked to an instructor profile is not a student.
-- Accounts holding STUDENT next to another staff role are left as they are:
-- only the administrator can say which they really are. Until then the API
-- refuses them staff routes and the users page lists them.

DELETE FROM "user_roles"
WHERE "role" <> 'ADMIN'
  AND "userId" IN (SELECT "userId" FROM "user_roles" WHERE "role" = 'ADMIN');

DELETE FROM "user_roles"
WHERE "role" = 'STUDENT'
  AND "userId" IN (SELECT "userId" FROM "contributor_profiles" WHERE "userId" IS NOT NULL);
