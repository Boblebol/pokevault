# Simplified Capture And Trade Model Design

## Context

Pokevault currently exposes three manual collection actions: `Cherche`,
`Capturé`, and `Double`. `Cherche` is persisted in `data/hunts.json`, mirrored
into Trainer Card `wants`, used by filters, recommendations, drawer/full-view
priority controls, and match calculations.

The desired product model is simpler:

- every uncaptured Pokemon is implicitly wanted;
- the user only records whether they have a Pokemon, whether they have a
  duplicate, or whether they release one/all copies;
- Trainer Cards share only duplicates;
- badges still unlock progressively and remain visible in Stats;
- badge missions, focus workflows, explicit hunt lists, and `Match` disappear.

This is an intentional breaking product/data change. Legacy data must be
cleaned or migrated instead of hidden behind compatibility behavior.

## Goals

- Replace the visible collection actions with `Capturé`, `Double`,
  `Relâcher 1`, and `Relâcher`.
- Remove the explicit `Cherche` status/list from the active product.
- Keep the text search box for finding Pokemon by name, number, type, or slug.
- Keep badge unlocks, badge catalog display, and badge stats.
- Remove badge mission/focus/recommendation flows.
- Make Trainer Cards share duplicates only.
- Accept legacy backups and Trainer Cards where practical, but rewrite new
  exports to the simplified schema.
- Keep local-first JSON files readable and deterministic.

## Non-Goals

- Do not remove the normal collection search input.
- Do not remove the badge backend, badge catalog, badge unlock persistence, or
  Stats badge display.
- Do not add accounts, server sync, automatic trade matching, or live social
  features.
- Do not attempt to preserve explicit wishlist semantics after migration.

## Collection State Model

The canonical capture state remains `CollectionProgress.statuses`.

- Missing: no status entry for the slug.
- Captured once: `statuses[slug].state = "caught"`.
- Duplicate: captured plus the slug exists in the local Trainer Card
  `for_trade` list.

`seen` remains accepted for legacy progress loading/imports but is no longer a
visible action in the simplified UI. Existing `seen` statuses are displayed as
not captured unless migrated by the user action or card creation.

The actions behave as follows:

- `Capturé`: from a missing state, writes `caught`.
- `Double`: writes `caught` and adds the slug to `for_trade`.
- `Relâcher 1`: removes the slug from `for_trade` and keeps `caught`.
- `Relâcher`: removes `caught` and removes the slug from `for_trade`.

Keyboard shortcuts must keep the same simplified semantics:

- `c`: toggles missing/captured.
- `Shift+C`: toggles captured/duplicate.

## Trainer Cards

Trainer Cards move to a new simplified schema version.

New exported card fields:

- trainer identity and optional contact links;
- favorite region and favorite Pokemon;
- public note;
- `for_trade`: duplicate Pokemon slugs;
- updated timestamp.

Removed from new exports:

- `wants`;
- shared unlocked badges.

Legacy Trainer Card imports are tolerated:

- `wants` is ignored;
- `badges` is ignored;
- `for_trade` is preserved and normalized.

The contact book still stores received Trainer Cards locally. Contact search can
continue to search trainer metadata, notes, contact values, and `for_trade`.

## Trade Context

`Match` is removed.

The only collection-level network hint is `Vu chez`: show it when all of these
are true:

- the local user does not have the Pokemon captured;
- at least one imported Trainer Card lists the slug in `for_trade`.

If the local user already has the Pokemon, the contact duplicate can remain
visible in the Dresseurs contact detail, but it must not be promoted on the
collection card as an opportunity.

## Hunts And Recommendations

`Cherche`/hunts are removed from the active app.

Frontend removals:

- `hunt-list.js` script loading;
- `PokevaultHunts` subscriptions;
- `Cherche` status filter;
- drawer/full-view hunt priority sections;
- hunt-driven recommendation ranking.

Backend/data removals:

- `/api/hunts`;
- `HuntEntry`, `HuntList`, and `HuntPatch` from the active export schema;
- `data/hunts.json` from new backups and profile data responsibilities.

Legacy backup imports may accept a `hunts` object for old files, but it is
ignored and omitted from the next export.

The Collection home must not show a "next actions" or focus panel. Remaining
recommendation code can be deleted if it no longer has a consumer.

## Badges

Badges stay as a passive progression layer.

Kept:

- `/api/badges`;
- badge catalog and unlock evaluation;
- persisted `badges_unlocked`;
- badge gallery/Stats display;
- badge unlock toasts if already supported by the catalog view.

Removed:

- active badge mission storage;
- "follow this badge" actions;
- Collection badge mission panel;
- badge mission target highlighting;
- badge-driven next action recommendations.

Badge unlocks continue to use capture/card predicates. Since `seen` is no
longer visible, first-encounter style badges are migrated to capture semantics
or renamed so they no longer require a visible `seen` state. Capture and card
based badges remain active.

## UI Surfaces

Collection:

- visible action row becomes capture/duplicate/release oriented;
- remove `Cherche`, `Vus`, and `Shiny` quick filters from the simplified UI;
- keep `Tous`, `Manquants`, `Capturés`, region, form, type, and text search;
- remove next-actions panel and badge mission panel.

Pokemon drawer/full page:

- keep identity, forms, notes, cards, and capture/duplicate controls;
- remove explicit hunt/priority section;
- keep card CRUD and TCG search.

Dresseurs:

- own card editor removes the wishlist textarea;
- contact cards show duplicates only;
- no badge group in Trainer Cards;
- no `Match` wording.

Stats:

- keep global, regional, type, card, and badge sections;
- remove objective-session/recommendation block;
- keep badge gallery.

Docs:

- remove `Cherche`, hunts, `Match`, active badge missions, and badge sharing
  from README, in-app docs, public features, and Trainer Card docs;
- document the new model: capture, duplicate, release, and Trainer Card
  duplicate sharing.

## Data Migration

This is a breaking schema cleanup.

On import of old full backups:

- accept schema versions that include `hunts`;
- ignore `hunts`;
- preserve `statuses`, `notes`, cards, binders, profiles, and
  `badges_unlocked`;
- sanitize any Trainer Card `wants` out of stored contact data.

On load/save of trainer contacts:

- normalize away `wants` and `badges`;
- keep `for_trade`;
- stamp the rewritten local card/contact with the current simplified schema on
  the next save/export.

On export:

- emit a new full backup schema without `hunts`;
- emit Trainer Cards without `wants` or `badges`.

Existing `data/hunts.json` can remain on disk as an orphaned user file, but the
application must no longer read or write it. Documentation must state that
the file is legacy and no longer used.

## API Shape

Progress API stays.

Trainer API accepts old card payloads leniently but responds with simplified
cards.

Hunts API is removed from the active app. The final state has no mounted
`/api/hunts` route and no documented endpoint.

Export/import moves to the new schema version. Import must be permissive for
legacy backups; export must always write the new schema.

## Testing

Add or update tests for:

- capture/duplicate/release state transitions;
- release-one keeps captured while removing duplicate;
- release-all removes captured and duplicate;
- Trainer Card export omits `wants` and `badges`;
- legacy Trainer Card import ignores `wants` and `badges`;
- `Vu chez` appears only for missing Pokemon available from a contact duplicate;
- `Match` no longer appears;
- full backup export omits `hunts`;
- legacy backup import with `hunts` succeeds but drops them on re-export;
- badge unlock/status tests still pass;
- badge mission/focus UI references are removed;
- docs no longer advertise removed features.

## Acceptance Criteria

- The collection can be used with only capture, duplicate, and release actions.
- No active UI says `Cherche`, `Wanted`, `Match`, `Mission badge`, or focus.
- The text search input still works.
- Badges still unlock over time and remain visible in Stats.
- New Trainer Card exports contain duplicates only.
- Old Trainer Card imports do not break, but old wishlist/badge fields are
  discarded.
- New full backups do not include `hunts`.
- Old full backups with `hunts` import successfully and are rewritten without
  `hunts` on export.
- The test suite covers migration, UI semantics, and badge retention.
