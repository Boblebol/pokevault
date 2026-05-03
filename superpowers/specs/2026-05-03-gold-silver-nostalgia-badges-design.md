# Gold/Silver Nostalgia Badges Design

Date: 2026-05-03

## Context

The badge service already supports team-completion badges through
`BadgeDef.required_slug_sets`. Kanto Rouge/Bleu badges use that mechanism for
Gym Leaders, Elite Four members and rival variants without changing the public
`GET /api/badges` response shape.

## Goal

Add full Pokemon Or/Argent nostalgia badges for:

- the 8 Johto Gym Leaders;
- the 8 Kanto post-game Gym Leaders as they appear in Gold/Silver;
- the Gold/Silver Elite Four;
- Champion Lance;
- Rival Silver's final/rematch team variants.

## Sources

- Pokemon Database Gold/Silver Gym Leaders and Elite Four:
  `https://pokemondb.net/gold-silver/gymleaders-elitefour`
- StrategyWiki Gold/Silver Mt. Moon and Rival rematch summary:
  `https://strategywiki.org/wiki/Pok%C3%A9mon_Gold_and_Silver/Mt._Moon`
- Bulbapedia Silver Gold/Silver/Crystal teams:
  `https://bulbapedia.bulbagarden.net/wiki/Silver_(game)/Gold,_Silver,_and_Crystal`

## Design

Use the existing `_team_badge` helper. Badge ids are prefixed with `gs_` so they
do not collide with Rouge/Bleu Kanto badges:

- `gs_falkner` through `gs_clair` for Johto gyms;
- `gs_brock` through `gs_blue` for Kanto post-game gyms;
- `gs_will`, `gs_koga`, `gs_bruno`, `gs_karen`;
- `gs_lance`;
- `gs_rival_silver`.

Duplicate species still count once because the current implementation stores
requirements as `frozenset[str]`. This is correct for collection progress: the
user tracks species ownership, not battle-slot counts.

Rival Silver accepts any one of three rematch variants: Meganium, Typhlosion or
Feraligatr. The shared core team is Sneasel, Crobat, Magneton, Gengar and
Alakazam.

## Non-Goals

- No HeartGold/SoulSilver or Crystal-specific teams in this increment.
- No visual frontend change beyond the existing badge catalog rendering.
- No new API shape.
- No per-version toggle between Gold and Silver.

## Testing

- Service catalog includes all `gs_` ids.
- Johto gym badges require the full team.
- Gold/Silver Kanto badges do not reuse Rouge/Bleu teams.
- Duplicate species count once for Lance's Dragonite slots.
- Rival Silver unlocks from any final starter variant and reports nearest
  progress.
- `/api/badges` exposes a Gold/Silver trainer badge through the existing shape.
- README and public docs mention Or/Argent badges.

