# Pokemon Trade States Design

Date: 2026-04-30

## Context

Pokevault already has the pieces needed for a simple local trading product:

- Pokedex progress stores per-Pokemon state as `not_met`, `seen`, or `caught`.
- The hunt list stores active searches and already feeds focus sessions.
- Trainer Cards store public `wants` and `for_trade` lists.
- The same Pokemon card renderer is used by the global list and binder pages.
- Imported Trainer Cards already create a local address book.

The next increment should harmonize these pieces instead of adding a second
tracking system.

## Product Rule

The user-facing Pokemon states become:

- `Cherche`: I want this Pokemon.
- `J'ai`: I own this Pokemon.
- `Double`: I own this Pokemon and can trade one.

No selected chip means `Je n'ai pas`.

`Vu chez` is not manually set. It is derived from imported trainer cards when a
contact has the Pokemon in `for_trade`.

## Mapping To Existing Data

The implementation keeps the current backend shape:

- `J'ai` maps to progress `state = "caught"`.
- `Je n'ai pas` maps to no progress status for the slug.
- `Cherche` maps to the existing hunt list and to `TrainerCard.wants`.
- `Double` maps to progress `state = "caught"` and to `TrainerCard.for_trade`.
- Existing `seen` values may still load for backward compatibility, but the
main UI no longer exposes `Vu` as a primary manual action.

This avoids a progress-data migration while changing the visible product model.

## User Experience

Pokemon cards in the global list and binders show three compact chips:

- `Cherche`
- `J'ai`
- `Double`

The chips are small and action-oriented. They must not expand the card height
unpredictably or make binders hard to scan.

The drawer and full Pokemon page use the same three actions in the status
section, with slightly more room for labels.

Network context is displayed separately:

- `Chez 1` / `Chez N` when imported contacts have the Pokemon in `for_trade`.
- `Match` when the current user is searching for the Pokemon and a contact has
  it available.
- A short contact list in the Pokemon fiche when space allows.

Clicking a Pokemon card no longer needs to cycle through `Vu`; the explicit
chips are the intended state controls. The existing details action still opens
the Pokemon fiche.

## State Transitions

For a given Pokemon slug:

- Clicking `Cherche` when inactive:
  - removes `caught`;
  - removes `for_trade`;
  - adds the slug to hunts and `TrainerCard.wants`.
- Clicking active `Cherche`:
  - removes the slug from hunts and `TrainerCard.wants`;
  - leaves the Pokemon as not owned.
- Clicking `J'ai` when inactive:
  - sets progress to `caught`;
  - removes the slug from hunts, `TrainerCard.wants`, and `TrainerCard.for_trade`.
- Clicking active `J'ai`:
  - removes the progress status;
  - leaves the Pokemon as not owned.
- Clicking `Double` when inactive:
  - sets progress to `caught`;
  - removes the slug from hunts and `TrainerCard.wants`;
  - adds the slug to `TrainerCard.for_trade`.
- Clicking active `Double`:
  - keeps progress as `caught`;
  - removes the slug from `TrainerCard.for_trade`, so it becomes `J'ai`.

If the user has not created a Trainer Card yet, the first `Cherche` or `Double`
action creates a minimal local card with a generated stable id and a generic
display name. The user can edit the display name later from `Dresseurs`.

## Focus And Matching

Focus sessions continue to use the existing hunt list. Since `Cherche` writes
to hunts, searched Pokemon remain first-class focus targets.

Local matching uses only voluntary lists:

- `Ils peuvent m'aider`: my `wants` intersect their `for_trade`.
- `Je peux les aider`: my `for_trade` intersects their `wants`.

Owning a Pokemon or a card never automatically means it is available for trade.
Only `Double` adds the slug to `for_trade` in this increment.

## Documentation

Update user-facing docs and product tour text to explain the simplified model:

- three chips: `Cherche`, `J'ai`, `Double`;
- `Double` means tradeable in the exported Trainer Card;
- imported contacts can create `Vu chez`/`Match` badges;
- no account, server, or automatic sync.

## Testing

Tests should cover:

- ownership action model labels and active states;
- Trainer Card list membership helpers for `wants` and `for_trade`;
- contact availability/match summaries;
- card UI/style guard tokens for compact chips and network badges;
- docs/product-tour wording.
