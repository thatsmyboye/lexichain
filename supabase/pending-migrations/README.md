# Pending migrations

These two migrations were written for the app but were **never applied to the
production database**. They are parked here, outside `supabase/migrations/`,
so the Supabase GitHub integration does not apply them on a merge to `main`.

`supabase/migrations/` now lists exactly the 40 migrations recorded in
production's history (`supabase_migrations.schema_migrations`).

| File | What it adds | State |
|---|---|---|
| `20251207000000_add_advanced_game_modes.sql` | Tables for Mini Marathon, Prestige Endless, and Weekly Gauntlet | Not applied. The app's hooks for these modes query tables that do not exist in production. Its version also predates the newest applied migration, so it needs a new timestamp before it can be applied in order. |
| `20260217120000_add_game_mode_to_daily_challenges.sql` | A `game_mode` column on the daily challenge tables, a unique key that includes it, and leaderboard functions that take a mode | Not applied. The app has saved daily results with `game_mode` since 2026-02-17, and production rejects those saves. |

## Do not apply the second file as written

Checked against production on 2026-11-20:

- **Duplicate functions.** It uses `CREATE OR REPLACE FUNCTION` with an added
  `p_game_mode` argument. Postgres treats that as a new function and keeps the
  old one, so calls that pass only the original arguments become ambiguous.
  Each old signature needs a `DROP FUNCTION` first.
- **A second unique constraint.** Production has two identical constraints on
  `daily_challenge_results (user_id, challenge_date)`:
  `daily_challenge_results_user_id_challenge_date_key` and
  `unique_user_challenge_date`. The file drops only the first, so a second
  result on the same day would still be rejected.

To apply either one, move a corrected copy into `supabase/migrations/` under a
new timestamp later than the newest file there.
