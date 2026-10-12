-- Owner request, 2026-10-12: one account and one profile for the owner.
--
-- 1. The account 9352223970 was created by a sign-in that stored the number
--    without its leading zero (fixed since: numbers are stored as 09...). Its
--    rows move to the owner's account 09352223970 and it is removed.
-- 2. The contributor profile "mohammad" duplicates "mohammad-rostami" (the
--    owner's public profile); its rows move there, it is removed, and the
--    remaining profile is linked to the owner's account.
--
-- Rows are moved through every foreign key that points at the duplicate, so
-- nothing is left behind; where the owner already has the same kind of
-- one-per-person row, the duplicate's copy is dropped. Each merge is all or
-- nothing and is skipped (with a warning) on a database where the rows do not
-- exist or cannot be merged, so it never blocks a deploy.

DO $$
DECLARE
  main_user CONSTANT text := '68bb706c-4edf-4d61-a7f8-b8c570597464';
  dup_user CONSTANT text := '3602b750-6ffb-4cd7-96fd-11cd25e36b33';
  main_profile CONSTANT text := 'e7a742a5-601c-41ad-90a4-5c7c3b9b162f';
  dup_profile CONSTANT text := '46385e47-6ff2-46e6-a300-453293d719c9';
  ref record;
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "id" = main_user) AND EXISTS (SELECT 1 FROM "users" WHERE "id" = dup_user) THEN
    BEGIN
      FOR ref IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = '"users"'::regclass
      LOOP
        BEGIN
          EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', ref.tbl, ref.col, ref.col) USING main_user, dup_user;
        EXCEPTION WHEN unique_violation THEN
          EXECUTE format('DELETE FROM %s WHERE %I = $1', ref.tbl, ref.col) USING dup_user;
        END;
      END LOOP;
      DELETE FROM "users" WHERE "id" = dup_user;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'owner account merge skipped: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM "contributor_profiles" WHERE "id" = main_profile) AND EXISTS (SELECT 1 FROM "contributor_profiles" WHERE "id" = dup_profile) THEN
    BEGIN
      FOR ref IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = '"contributor_profiles"'::regclass
      LOOP
        BEGIN
          EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', ref.tbl, ref.col, ref.col) USING main_profile, dup_profile;
        EXCEPTION WHEN unique_violation THEN
          EXECUTE format('DELETE FROM %s WHERE %I = $1', ref.tbl, ref.col) USING dup_profile;
        END;
      END LOOP;
      DELETE FROM "contributor_profiles" WHERE "id" = dup_profile;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'owner profile merge skipped: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM "users" WHERE "id" = main_user)
     AND NOT EXISTS (SELECT 1 FROM "contributor_profiles" WHERE "userId" = main_user) THEN
    UPDATE "contributor_profiles" SET "userId" = main_user WHERE "id" = main_profile AND "userId" IS NULL;
  END IF;
END $$;
