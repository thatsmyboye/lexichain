# Pending migrations

The migration in this folder was written for the app but was **never applied
to the production database**. It is parked here, outside
`supabase/migrations/`, so the Supabase GitHub integration does not apply it
on a merge to `main`.

| File | What it adds | State |
|---|---|---|
| `20251207000000_add_advanced_game_modes.sql` | Tables for Mini Marathon, Prestige Endless, and Weekly Gauntlet | Not applied. The app's hooks for these modes query tables that do not exist in production. |

To apply it, review it against the current production schema, then move a
copy into `supabase/migrations/` under a new timestamp later than the newest
file there. Its current version predates migrations that are already applied,
so it cannot be applied in order as it is named.

## History

A second file was parked here: `20260217120000_add_game_mode_to_daily_challenges.sql`.
It was replaced by `supabase/migrations/20261121120000_add_game_mode_to_daily_challenges.sql`,
which fixes four defects found when the original was checked against
production (see the comment at the top of that file).
