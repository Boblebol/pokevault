# Kanto Nostalgia Badges Design

Date: 2026-05-03
Status: Approved for implementation planning

## Goal

Add a first nostalgic badge family for Pokemon Red/Blue Kanto teams. A user
earns one badge when their local Pokedex has captured every unique Pokemon used
by a specific Kanto trainer group:

- each Kanto Gym Leader;
- each Elite Four member;
- the League Champion / rival final fight.

This first version intentionally covers Kanto Red/Blue only. Later regions can
reuse the same pattern once the data model is proven.

## Product Rules

Badges are collection achievements, not battle simulations:

- A required Pokemon counts only when its progress status is `caught`.
- `seen`, TCG cards and trainer contacts do not count.
- Duplicate Pokemon in a trainer team count once. For example, Koga's two
  Koffing entries require only `0109-koffing` once.
- Only base Red/Blue species slugs count. Mega, Gigantamax and later regional
  forms do not satisfy these Kanto badges.
- Unlocks remain monotonic, matching the existing badge behavior: once a badge
  is unlocked, it stays unlocked even if the user later changes progress.

## Badge Set

The first catalog adds these badges under a "Souvenirs de Kanto" concept:

| Badge | Required unique slugs |
| --- | --- |
| Pierre - Roche de Kanto | `0074-geodude`, `0095-onix` |
| Ondine - Cascade | `0120-staryu`, `0121-starmie` |
| Major Bob - Foudre | `0100-voltorb`, `0025-pikachu`, `0026-raichu` |
| Erika - Prisme | `0071-victreebel`, `0114-tangela`, `0045-vileplume` |
| Koga - Ame | `0109-koffing`, `0089-muk`, `0110-weezing` |
| Morgane - Marais | `0064-kadabra`, `0122-mr-mime`, `0049-venomoth`, `0065-alakazam` |
| Auguste - Volcan | `0058-growlithe`, `0077-ponyta`, `0078-rapidash`, `0059-arcanine` |
| Giovanni - Terre | `0111-rhyhorn`, `0051-dugtrio`, `0031-nidoqueen`, `0034-nidoking`, `0112-rhydon` |
| Conseil 4 - Olga | `0087-dewgong`, `0091-cloyster`, `0080-slowbro`, `0124-jynx`, `0131-lapras` |
| Conseil 4 - Aldo | `0095-onix`, `0107-hitmonchan`, `0106-hitmonlee`, `0068-machamp` |
| Conseil 4 - Agatha | `0094-gengar`, `0042-golbat`, `0093-haunter`, `0024-arbok` |
| Conseil 4 - Peter | `0130-gyarados`, `0148-dragonair`, `0142-aerodactyl`, `0149-dragonite` |
| Maitre de la Ligue - Rival | best of the three Red/Blue Champion variants below |

The rival badge accepts any one complete Red/Blue final team:

- Player chose Bulbasaur: `0018-pidgeot`, `0065-alakazam`, `0112-rhydon`,
  `0130-gyarados`, `0103-exeggutor`, `0006-charizard`.
- Player chose Charmander: `0018-pidgeot`, `0065-alakazam`, `0112-rhydon`,
  `0059-arcanine`, `0103-exeggutor`, `0009-blastoise`.
- Player chose Squirtle: `0018-pidgeot`, `0065-alakazam`, `0112-rhydon`,
  `0130-gyarados`, `0059-arcanine`, `0003-venusaur`.

## Data Model

Keep the implementation lightweight and data-driven inside the existing badge
service:

- Continue exposing the same `BadgeDefinition` API shape.
- Extend internal badge definitions so a badge can use either the existing
  numeric metrics or a captured-team requirement.
- A captured-team badge stores one or more slug sets. Standard trainers have
  one set; the rival has three alternatives.
- Progress is computed against the closest alternative:
  `current = max(captured required slugs)`, `target = len(best alternative)`.
- Completion is true when at least one required slug set is fully captured.

No new persisted file is required for this first Kanto pass. Future regions may
move trainer teams into versioned reference JSON if the catalog grows large.

## UI Behavior

Reuse the current stats badge grid and toast unlock flow:

- No new page.
- New badges appear alongside the existing badge catalog.
- Locked trainer badges show the same progress meter and hint as current
  badges, for example `3 / 5 · Encore 2 Pokemon de l'equipe à capturer.`
- Unlocked trainer badges use the existing "Obtenu" state.

The UI does not need trainer sprites, battle levels or moves in this iteration.

## Tests

Add coverage before implementation:

- service catalog includes Kanto nostalgia badge ids;
- a Gym Leader badge unlocks only when every unique team slug is caught;
- duplicate team members count once;
- the rival badge unlocks when any one final-team variant is complete;
- rival progress chooses the closest variant;
- monotonic unlocked behavior still works for trainer badges;
- `/api/badges` exposes trainer badge progress through the existing response
  shape.

Run `make check` before completion.

## Sources

Team membership is based on Pokemon Red/Blue Kanto Gym Leader, Elite Four and
Champion teams as documented by Bulbapedia:

- https://bulbapedia.bulbagarden.net/wiki/User%3AJake200493/Red%2C_Green_and_Blue_Gym_Leaders_%26_Elite_Four
- https://bulbapedia.bulbagarden.net/wiki/Misty_%28Gym_leader%29
