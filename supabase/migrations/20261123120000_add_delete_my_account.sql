-- Lets a signed-in player permanently delete their own account and data.
-- Required by the App Store (Guideline 5.1.1(v)) and Google Play for apps
-- that allow account creation. Called from the My Account page.
--
-- Several tables store a user_id without a foreign key to auth.users
-- (daily_challenge_states, daily_login_streaks, player_goals,
-- standard_game_results, security_audit_log), so deleting the auth user alone
-- would leave their rows behind. The function deletes the caller's rows from
-- every public table with a uuid user_id column, so a table added later is
-- covered too. goal_progress cascades from player_goals and
-- standard_game_results.
--
-- user_roles.granted_by references auth.users without ON DELETE, so it would
-- block deleting an admin who granted a role. Those references are cleared.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
  owned_table regclass;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_roles SET granted_by = NULL WHERE granted_by = caller;

  FOR owned_table IN
    SELECT c.oid::regclass
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND a.attname = 'user_id'
      AND a.atttypid = 'uuid'::regtype
      AND NOT a.attisdropped
  LOOP
    EXECUTE format('DELETE FROM %s WHERE user_id = $1', owned_table) USING caller;
  END LOOP;

  -- Also removes the sign-in identities and sessions.
  DELETE FROM auth.users WHERE id = caller;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
