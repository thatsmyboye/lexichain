# Notes for Claude on Lexichain

## Art that still needs a home

These files are finished and committed, but nothing in the app draws them yet.
They are not imported anywhere, so they add nothing to the build.

- **Detailed boss emblems** (8 files): `src/assets/survival/boss-*-detailed.svg`,
  128 x 128, one per Survival boss type. The boss panel uses the small
  `boss-*-simple.svg` versions. The detailed ones need a screen that shows a
  boss large: a boss-wave intro, a boss-defeated moment, or a results summary.
  To use one, import it in `src/components/game/SurvivalIcon.tsx` and add a
  "detailed" option to `BossIcon`, the way `PowerUpIcon` handles its two forms.
- **Life-lost icon**: `src/assets/survival/vital-life-lost.svg`. A lost life is
  only announced in a toast today, and toasts are plain text.

## Art not drawn yet

- **Survival unlock icons** (G7 in `docs/art-asset-list.md`): the six unlocks
  in `SURVIVAL_UNLOCKS` (`src/lib/survivalMode.ts`) are defined but never shown
  to the player. The icons were deferred until an unlocks screen exists.
