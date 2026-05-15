# Pokevault Product Roadmap

This roadmap is the public direction for the active app. Older exploratory
ideas live in [POSTPONED.md](POSTPONED.md); active work stays Pokédex-first,
local-first and file-based.

The next detailed backlog is [V1.1 Pokédex-First Backlog](V1_1_POKEDEX_FIRST.md).

## Positioning

Pokevault is a private Pokédex tracker for collectors who prefer real exchanges
to hosted accounts. The core loop is deliberately small:

- `Capturé` records local progress.
- `Double` records what can be offered to another Dresseur.
- `Relâcher` removes the last local copy.
- Everything not captured is implicitly still missing.
- Imported Trainer Cards share only duplicate lists and can add `Vu chez`
  context without changing local progress.

Trainer Cards, binders, stats and badges support that loop; they do
not add missions, focus lists or automatic sharing.

## Shipped Tracks

### Wave 1 - Collection Polish

- Narrative empty states.
- Regional chips and National scope.
- Multi-level progress for the Pokédex itself.
- Fuzzy search and keyboard shortcuts.

### Wave 2 - Activation

- First-run onboarding that explains capture, duplicates, releases, Dresseurs
  and local files.
- Simplified status model with legacy fields cleaned or ignored on import.
- Narrative filters for starter, legendary and other tags.

### Wave 3 - Pokémon Fiches

- One reusable Pokemon modal from the list, keyboard shortcuts and legacy
  `#/pokemon/:slug` links.
- Identity, artwork, capture actions, linked forms, personal notes and type
  matchups in one place.
- Game Pokédex appearance metadata sourced from `data/game-pokedexes.json`.

### Wave 4 - Binders and Badges

- Physical binder planning with 3×3 · 10-sheet defaults.
- Compact evolution-family ordering with strict row alignment for multi-row families.
- Generation sprite modes for app.
- Badge gallery with sealed badges until unlock.

## Active Next Track

The active track is richer Pokédex metadata that stays useful without adding
more user state:

- expand `data/game-pokedexes.json` with more complete regional Pokédex
  definitions;
- expose those appearances consistently in the Pokemon modal;
- keep reference data versioned and testable;
- keep old local files tolerated during imports but absent from new backups.

## Explicit Non-Goals

- Hosted accounts or public profiles.
- Automatic Trainer sync.
- Public wishlists.
- Badge missions or focus workflows.
- Marketplace pricing.
- Card collection management inside the active app.

## Contributor Rule

Every new product surface must answer three questions before implementation:

1. Does it make capture, duplicates, releases or binder organization clearer?
2. Can it work from local JSON without accounts or hidden services?
3. Can old local data be ignored or migrated without corrupting progress?
