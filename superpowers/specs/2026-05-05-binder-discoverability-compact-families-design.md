# Binder Discoverability And Compact Families Design

Date: 2026-05-05

## Context

The app already contains most of the requested capabilities:

- Generation sprite modes exist in `web/artwork-switcher.js` and are exposed
  through `Réglages > Artwork`.
- Binder size changes exist in the binder wizard behind `Classeurs > Réglages`.
- Printable card placeholders exist in `Impression > Regrouper par >
  Placeholders cartes`.
- Family binder layout is shared by `web/binder-layout-engine.js`, binder view
  and print view.

The current problem is partly discoverability and partly layout behavior. The
existing labels do not make the sprite, binder format and placeholder workflows
obvious enough. The family algorithm also wastes physical binder slots because
it gives every family or solo Pokemon its own complete row.

## Goal

Make the existing workflows easy to find and update the family binder algorithm
so 3 by 3 pages use space efficiently without breaking family readability.

The user should be able to find:

- sprites by generation;
- binder format and size changes;
- printable small binder placeholder cards.

The family layout should allow compact rows such as:

```text
Spoink   Groret   Spinda
```

but should avoid starting a family when the whole family row cannot fit:

```text
Ptitard  Têtarte  Tartard
Tarpaud  [vide]   [vide]
Abra     Kadabra  Alakazam
```

The empty cells after Tarpaud are discrete alignment empties. They are visible
only as quiet binder-grid empties and are not printed as placeholder cards.

## Recommended Approach

Use a focused product polish pass instead of a large binder redesign:

1. Keep the existing app structure.
2. Rename and clarify the labels users actually see.
3. Update docs to show exact navigation paths.
4. Change the shared family layout engine so every consumer gets the same
   compact placement behavior.

This keeps the blast radius small while fixing the user's concrete blockers.

## App Discoverability

### Settings

Rename the global image selector from `Artwork` to `Images / sprites`.

The select continues to use the existing `PokevaultArtwork.modes` values:

- Sugimori;
- shiny;
- first TCG card;
- Sprite Gen 1;
- Sprite Gen 2;
- Sprite Gen 3;
- Sprite Gen 4;
- Sprite Gen 5.

The implementation does not add new sprite sources. Existing generation sprite
fallback behavior remains unchanged.

### Binders

Keep `Classeurs > Réglages`, but make the button and surrounding copy more
explicit:

- Button intent: modify binder format.
- Wizard step title: choose organization, tracked forms and physical grid.
- Format step remains 3 by 3, 2 by 2 or custom rows, columns and sheet count.

No new backend schema is required. The existing `rows`, `cols`, `sheet_count`,
`organization` and `form_rule_id` fields remain the source of truth.

### Print

Rename `Placeholders cartes` to `Petites fiches classeur`.

The print workflow remains:

```text
Impression > Regrouper par > Petites fiches classeur
```

The print image selector stays available next to the grouping control and still
allows printing retro sprites without changing the global app image mode.

## Compact Family Layout

### Terminology

A family row is one row from `layout_rows` after resolving slugs to Pokemon
entries. For a 3 by 3 binder, one family row has up to 3 cells.

A family block is all rows belonging to the same evolution family.

A compact row is a physical binder row that can contain one complete short
family followed by one or more complete later families only when they fit in
the remaining cells.

### Placement Rules

The shared engine should follow these rules for `organization: "family"`:

1. Keep family order by current `sort_key` / family file order.
2. Keep Pokemon order inside each family row.
3. Never split one family row across physical rows unless the family row is
   wider than the binder columns, in which case the existing chunking behavior
   still applies.
4. A later family may fill remaining cells on the current physical row only if
   its first pending layout row fits entirely in the remaining cells.
5. If a later family has more rows after that first row, those later rows
   continue on following physical rows before another family is packed.
6. If the next family row does not fit entirely, close the current physical row
   with discrete alignment empties and start the next family on a new row.
7. Page-aware behavior remains: if a family block can fit on the next page but
   not in the remaining rows of the current page, start it on the next page.
8. Families larger than one page may split between family rows, but not inside
   a normal-width family row.
9. Pokemon missing from family data are appended in national order and behave
   as solo families, so they can fill compatible trailing cells.

### Empty Slot Types

The engine should distinguish three empty cases:

- `family_reserved`: an intentional family hole from `layout_rows`, such as a
  branching slot that should remain visually reserved.
- `alignment_empty`: a discrete filler used only to close a compact row when the
  next family cannot fit.
- `capacity_empty`: unused physical capacity beyond the computed layout.

Only `family_reserved` is printable as a placeholder. `alignment_empty` and
`capacity_empty` are skipped by placeholder print mode.

Binder view should render `alignment_empty` as a quieter empty cell than
`family_reserved`, without family-reserved copy.

## Examples

For a 3-column binder:

```text
Spoink   Groret   Spinda
```

Spoink/Groret has 2 cells and Spinda has 1 cell, so Spinda fits entirely.

```text
Ptitard  Têtarte  Tartard
Tarpaud  [align]  [align]
Abra     Kadabra  Alakazam
```

Abra/Kadabra/Alakazam needs 3 cells, so it cannot start in the 2 cells after
Tarpaud.

```text
Debugant Kicklee Tygnon
Kapoera  [align] [align]
Lippouti Lippoutou [solo-if-fits]
```

Branching families keep their provided row shape. Later solo or two-stage
families may fill only when the complete next pending row fits.

## Documentation Updates

Update the public and in-app docs to explicitly mention:

- `Réglages > Images / sprites` for generation sprites;
- `Classeurs > Réglages` for binder size, rows, columns and sheets;
- `Impression > Regrouper par > Petites fiches classeur` for printable small
  cards while waiting for real cards;
- the compact family layout rule and the difference between printable reserved
  family slots and non-printable alignment empties.

Docs to update:

- `README.md`;
- `docs/features.html`;
- `docs/assets/i18n.js`;
- in-app docs copy in `web/index.html`;
- app i18n strings in `web/i18n.js`.

## Testing

Add or update focused tests:

- `tests/web/binder-layout-engine.test.mjs`:
  - Spoink/Groret followed by Spinda fits on one 3-cell row.
  - Ptitard/Têtarte/Tartard plus Tarpaud does not allow Abra/Kadabra/Alakazam
    to start in the remaining 2 cells.
  - `alignment_empty` is emitted separately from `family_reserved`.
  - Page-aware family behavior still starts a block on the next page when
    needed.
- `tests/web/print-view.test.mjs`:
  - placeholder sections skip `alignment_empty`.
  - `family_reserved` remains printable on pages with visible Pokemon.
- `tests/web/i18n.test.mjs` or existing app tests:
  - updated labels exist in FR and EN.
- `tests/test_docs_site.py`:
  - docs mention generation sprites, binder settings and small binder fiches.

Run `make web-test` and the relevant Python doc tests before completion.

## Non-Goals

- No drag-and-drop manual binder placement editor.
- No backend schema migration.
- No new sprite download pipeline.
- No generated PDF service.
- No redesign of the full navigation or settings page.
