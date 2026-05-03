# Trainer Card Badge Sharing Design

Date: 2026-05-03

## Context

Trainer Cards are portable JSON files exported manually from the `Dresseurs`
tab and imported into a local contact book. Badge progress is already available
client-side through `window.PokevaultBadges.state`, with each badge exposing its
catalog id, title, description, progress and unlocked state.

## Goal

Export all currently unlocked badges automatically in the public Trainer Card
and show those shared badges on imported trainer contact cards.

## Non-Goals

- No account, cloud sync, public profile URL, or server-hosted sharing.
- No manual badge picker in this increment.
- No import-time recomputation of another trainer's badge progress.
- No private notes or local-only metadata included in exported cards.

## Design

`TrainerCard` gains a public `badges` list. Each item keeps only the badge id and
title so exported cards stay compact and do not leak progress toward locked
badges.

The web client injects badges at export time from the current badge state. If
the badge state is not loaded yet, the export triggers a badge poll first. The
saved local trainer card can also keep the latest shared badges, but the export
path is the source of truth for freshness.

Imported cards without `badges` remain valid. Imported cards with badges render
a compact `Badges` section in the received trainer card.

## Data Flow

1. `Dresseurs` starts and loads the contact book.
2. Badge state is already started globally by `web/badges-view.js`.
3. On save/export, `trainer-contacts.js` reads unlocked badges from
   `window.PokevaultBadges.state`.
4. The exported JSON includes `badges: [{ id, title }]`.
5. Import normalizes the list and the backend trims duplicate/invalid badges.
6. Contact rendering displays the shared badge titles.

## Testing

- Backend service test: saving a trainer card trims badge entries and removes
  duplicate ids.
- API test: `PUT /api/trainers/me` accepts the new `badges` field.
- Web tests:
  - `cardFromForm` injects unlocked badges from badge state.
  - locked badges are not exported.
  - received contact cards render shared badges.

