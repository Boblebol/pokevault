# Base Generations Nostalgia Badges Design

Date: 2026-05-03

## Context

The badge service already supports trainer-team badges through
`BadgeDef.required_slug_sets`. Rouge/Bleu and Or/Argent badges reuse that shape,
so new game catalogs can be added as data without changing `GET /api/badges`,
the stats view or Trainer Card badge sharing.

## Goal

Add nostalgia badges for non-remake base versions after Or/Argent:

- Rubis/Saphir;
- Diamant/Perle;
- Noir/Blanc, including N;
- Noir 2/Blanc 2, explicitly approved as an exception;
- X/Y;
- Soleil/Lune;
- Epee/Bouclier;
- Ecarlate/Violet.

Each generation covers Gym Leaders or local equivalents, Elite Four or local
equivalents when the game has them, the champion/final champion, and meaningful
final rival teams.

## Sources

- Pokemon Database Ruby/Sapphire Gym Leaders and Elite Four:
  `https://pokemondb.net/ruby-sapphire/gymleaders-elitefour`
- Pokemon Database Diamond/Pearl Gym Leaders and Elite Four:
  `https://pokemondb.net/diamond-pearl/gymleaders-elitefour`
- Pokemon Database Black/White Gym Leaders and Elite Four:
  `https://pokemondb.net/black-white/gymleaders-elitefour`
- Pokemon Database Black 2/White 2 Gym Leaders and Elite Four:
  `https://pokemondb.net/black-white-2/gymleaders-elitefour`
- Pokemon Database X/Y Gym Leaders and Elite Four:
  `https://pokemondb.net/x-y/gymleaders-elitefour`
- Pokemon Database Sun/Moon Kahunas and Elite Four:
  `https://pokemondb.net/sun-moon/kahunas-elitefour`
- Pokemon Database Sword/Shield Gym Leaders:
  `https://pokemondb.net/sword-shield/gymleaders`
- Pokemon Database Scarlet/Violet Gym Leaders and Elite Four:
  `https://pokemondb.net/scarlet-violet/gymleaders-elitefour`

## Design

Keep badge definitions data-driven and append new `_team_badge(...)` entries to
`tracker/services/badge_service.py`. Public ids use generation prefixes:
`rs_`, `dp_`, `bw_`, `b2w2_`, `xy_`, `sm_`, `swsh_` and `sv_`.

Version-dependent or starter-dependent teams use multiple `required_slug_sets`
under one badge. This keeps progress useful while allowing any valid final team
variant to unlock the souvenir.

Duplicate battle slots continue to count once because the service converts each
team to a `frozenset`. This matches Pokevault's collection model: the user owns
species/forms, not repeated battle slots.

## Non-Goals

- No remakes: FireRed/LeafGreen, HeartGold/SoulSilver, Omega Ruby/Alpha
  Sapphire, Brilliant Diamond/Shining Pearl are excluded.
- No third/enhanced versions: Yellow, Crystal, Emerald, Platinum and Ultra
  Sun/Ultra Moon are excluded in this increment.
- No API or frontend contract change.
- No per-version toggle between paired games.

## Testing

- Service catalog exposes representative ids from every new prefix.
- A Rubis/Saphir gym badge requires the full team and keeps duplicate handling.
- A Noir/Blanc badge unlocks with a starter-dependent variant.
- N is included and unlocks from either final legendary variant.
- Noir 2/Blanc 2 badges are exposed and Hugh accepts starter variants.
- Epee/Bouclier and Ecarlate/Violet representative badges flow through
  `/api/badges`.
- Public docs mention all newly covered version groups and the no-remake scope.
