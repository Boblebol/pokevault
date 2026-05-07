# Badge Battle Detail Design

Date: 2026-05-07

## Goal

Turn unlocked badge details into a battle-oriented dossier while preserving the current sealed mystery behavior for locked badges.

When a badge is unlocked, its detail modal should help the user understand the original trainer battle behind the badge: who the trainer is, where the fight happens, what team is required, each Pokemon's level, attacks, types, weaknesses, and resistances.

## Decisions

- Scope covers every generation already present in the badge catalog.
- Battle data must be exact per game.
- Multiple battle sets are included only for version or starter variants.
- Move names are stored in French and English, and the UI displays the active locale.
- Locked badges keep the strict sealed behavior: no trainer history, location, exact team, levels, or moves are revealed before unlock.
- The unlocked layout uses a battle dossier layout:
  - left/context column for trainer, city, arena or battle place, game, and short history;
  - right/team column for Pokemon combat cards;
  - a variant selector appears only when the badge has multiple version or starter sets.
- Battle metadata lives outside `badge_service.py` in a dedicated JSON catalog.

## Data Model

Add `data/badge-battles.json`.

Top-level shape:

```json
{
  "version": 1,
  "badges": {
    "kanto_brock": {
      "trainer": {
        "name": { "fr": "Pierre", "en": "Brock" },
        "role": { "fr": "Champion d'Arène", "en": "Gym Leader" },
        "history": {
          "fr": "Champion d'Argenta, spécialiste des Pokémon Roche.",
          "en": "Pewter City's Gym Leader, specializing in Rock-type Pokemon."
        }
      },
      "location": {
        "region": "kanto",
        "city": { "fr": "Argenta", "en": "Pewter City" },
        "place": { "fr": "Arène d'Argenta", "en": "Pewter Gym" }
      },
      "encounters": [
        {
          "id": "red-blue",
          "label": { "fr": "Rouge / Bleu", "en": "Red / Blue" },
          "games": ["red", "blue"],
          "variant": { "kind": "version" },
          "team": [
            {
              "slug": "0074-geodude",
              "level": 12,
              "moves": [
                { "fr": "Charge", "en": "Tackle" },
                { "fr": "Boul'Armure", "en": "Defense Curl" }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

Each `badge_id` maps to the existing badge catalog ID. A badge may be absent from `badge-battles.json`; the API and UI must fall back to the current detail experience without crashing.

The JSON stores team composition, levels, and moves. It does not duplicate Pokemon type chart results. Weaknesses and resistances are computed in the frontend from existing Pokemon types and `PokevaultTypeChart`.

## Backend

Add Pydantic models for the battle catalog:

- localized text object with `fr` and `en`;
- trainer metadata;
- location metadata;
- battle encounter metadata;
- team Pokemon entry with `slug`, `level`, and localized moves.

Add a loader service for `data/badge-battles.json`. The badge API should enrich each `BadgeDefinition` with an optional `battle` field when matching data exists.

Backend behavior:

- invalid battle catalog shape should fail tests clearly;
- missing file should degrade to no battle data;
- missing badge entry should expose `battle: null`; `BadgeDefinition` gains an optional `battle` field defaulting to `None`;
- existing badge unlock logic remains unchanged.

## Frontend

Update `web/badges-view.js`.

Locked badge detail:

- keep current mystery title, mystery hint, progress, and sealed visual treatment;
- do not render battle trainer details, location, teams, levels, or moves.

Unlocked badge detail:

- render header and progress as today;
- add a context column with trainer name, role, city, arena/place, game label, and history;
- add a team column with combat cards;
- each combat card shows:
  - Pokemon sprite or fallback number;
  - localized Pokemon name;
  - level;
  - type chips;
  - weaknesses, resistances, and immunities from `PokevaultTypeChart`;
  - localized move list.
- if `battle.encounters.length > 1`, render a compact segmented selector above the team column;
- changing variant updates the team cards without closing the detail.

Responsive behavior:

- desktop: two-column dossier layout;
- tablet/mobile: context first, variant selector, then stacked Pokemon combat cards;
- cards keep stable dimensions and do not resize when switching variants.

## Internationalization

Add i18n keys for static UI labels:

- trainer;
- location;
- arena/place;
- battle history;
- team;
- level;
- attacks;
- weaknesses;
- resistances;
- immunities;
- version/starter variant label fallback;
- unavailable battle data fallback.

Battle catalog content itself carries localized FR/EN strings.

## Testing

Backend tests:

- `GET /api/badges` includes battle data for a badge with `badge-battles.json` metadata.
- Missing battle data keeps current badge response valid.
- Invalid battle catalog data is rejected by model tests.
- Existing unlock/progress tests continue to pass.

Frontend tests:

- locked badge detail does not reveal battle metadata.
- unlocked badge detail renders trainer, city, arena/place, history, levels, and moves.
- variant selector appears only for multiple encounters.
- switching variants changes team rows.
- move labels follow active locale.
- type chips and matchup sections render from Pokemon types.

CSS tests:

- badge detail overlay remains responsive.
- battle dossier classes exist for context, variants, team cards, and matchup chips.

## Out Of Scope

- Remake-specific teams unless the badge catalog already explicitly covers those games.
- Rematches and post-game teams.
- Damage calculations, AI behavior, held items, abilities, natures, or EVs.
- Editing battle data from the UI.
- Revealing battle details for locked badges.

## Risks

- Exact move data is large. Keeping it in JSON avoids growing `badge_service.py`, but data entry must be reviewed carefully.
- Some trainers have version-specific or starter-specific branches. The encounter model must make variant labels clear enough for users.
- Pokemon slug mismatches would create empty cards. Tests should include at least one known team with real slugs.
- Full all-generation coverage is a large data-entry task. The work can be split across commits, but the feature is not complete until every badge generation already present in the catalog has exact battle data.
