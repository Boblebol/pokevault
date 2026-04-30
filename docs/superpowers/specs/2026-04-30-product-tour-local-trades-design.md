# Product Tour And Local Trade Docs Design

Date: 2026-04-30

## Goal

Make the first-run product tour explain the current product model clearly:
Pokevault stays a local Pokedex first, with optional Trainer Cards that reveal
trade opportunities without accounts, cloud sync, or automatic mutation of the
user collection.

## Product Shape

Use a compact five-step onboarding instead of a heavy guided tour:

1. Pokedex tracking: explain `Cherche`, `J'ai`, and `Double`.
2. Trade opportunities: explain `Vu chez` and `Match` from imported Dresseurs.
3. Starting region: keep the current favorite region selector.
4. Tracking density: keep the current simple/advanced selector.
5. Local-first files: explain export/import, manual updates, and no account.

The flow remains optional. Skipping and replaying the tour keep the existing
behavior. Completing it still writes the same profile data shape; the new steps
only improve explanation.

## Documentation Scope

Improve the docs around the same vocabulary:

- `docs/TRAINER_CONTACTS.md` becomes the full local exchange guide.
- `README.md` gets the short workflow for local Trainer Card exchange.
- Public docs pages mention the compact tour and local matching model.
- Tests lock the important words so future edits keep the product coherent.

## Non-Goals

- No server sync, accounts, QR exchange, or cloud storage.
- No new collection states beyond the existing `Cherche`, `J'ai`, `Double`,
  `Vu chez`, and `Match` model.
- No intrusive hotspot tour across the application for this pass.

## Test Plan

- Add or update static tests that assert the onboarding covers all five steps
  and includes the key trade vocabulary.
- Add or update docs tests for the local exchange guide.
- Run focused web and docs tests, then the existing web unit test suite.
