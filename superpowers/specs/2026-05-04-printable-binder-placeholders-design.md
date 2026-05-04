# Printable Binder Placeholders Design

Date: 2026-05-04

## Context

Pokevault already has the main pieces needed for printable binder placeholders:

- `web/binder-v2.js` can order Pokemon by national order, by region, or by
  evolution family.
- `data/evolution-families.json` and
  `data/evolution-family-overrides.json` already describe intentional family
  rows and empty holes.
- `web/print-view.js` already renders printable checklist and pocket formats.
- `web/artwork-switcher.js` already centralizes official artwork, shiny artwork
  and first-owned TCG card art.
- Web tests use Node's built-in test runner with DOM stubs, while full browser
  coverage can be added through Lightpanda over CDP.

## Sources

- Lightpanda browser repository:
  `https://github.com/lightpanda-io/browser`
- Lightpanda CDP documentation:
  `https://lightpanda.io/docs/cloud-offer/tools/cdp`
- Lightpanda quickstart test documentation:
  `https://lightpanda.io/docs/quickstart/your-first-test`

The approved implementation order is:

1. Shared binder layout engine.
2. Printable card placeholders.
3. Page-aware family placement.
4. Generation sprite modes visible in the app.
5. Lightpanda end-to-end coverage.

## Goal

Add a reliable, previewable and printable placeholder workflow for physical
binders. Users can organize binders by family, see the same sprite or artwork
mode in the Pokedex and binder screens, then print card-sized placeholders for
missing or tracked cards without cutting evolution families in awkward places.

## Approach

Use a shared frontend layout engine instead of duplicating binder calculations
inside print rendering.

The new engine lives in `web/binder-layout-engine.js` and exposes pure
functions that accept binder config, Pokemon, region definitions and optional
family data. It returns an explicit slot model that every consumer can reuse.
The existing screens stay responsible for their own UI, but they no longer
invent placement math locally.

## Slot Contract

Each computed slot has this shape:

```js
{
  binderId: "kanto",
  binderName: "Kanto",
  page: 1,
  sheet: 1,
  face: "R",
  slot: 1,
  row: 1,
  col: 1,
  pokemon: { slug: "0001-bulbasaur" },
  emptyKind: null,
  familyId: "0001-bulbasaur"
}
```

Intentional empty family slots use:

```js
{
  pokemon: null,
  emptyKind: "family_reserved",
  familyId: "0133-eevee"
}
```

Capacity slots with no Pokemon and no family reservation use
`emptyKind: "capacity_empty"`. Print placeholders render family reservations
and skip ordinary capacity empties.

## Layout Rules

- National and regional ordering keep the behavior already exposed by
  `web/binder-v2.js`.
- Family ordering keeps the existing `layout_rows` model and its intentional
  null holes.
- A family row stays on one physical row when it fits the binder column count.
- If the next family block does not fit in the remaining rows of the current
  page, it starts on the next page.
- If a family block is larger than one page, it can split between family rows,
  but not inside one family row.
- If a configured binder is too small, the existing numbered binder split
  behavior remains the source of truth.
- Pokemon not covered by family data are appended in national order.
- Missing family data is non-fatal: the engine falls back to national order and
  does not render reserved family holes.

## Printable Placeholder Mode

`#/print` gains a new grouping mode named `Placeholders cartes`.

The mode renders A4 print pages by default. Each page uses the selected binder's
physical grid, typically 3 by 3. Each placeholder includes:

- Pokemon number.
- French display name.
- English display name in smaller text when available.
- Image resolved through `PokevaultArtwork`.
- Binder name.
- Page, sheet face and slot.
- Caught or missing state.

Existing filters remain available:

- all;
- caught;
- missing;
- search by number, slug or localized name;
- selected binder or all binders.

Family-reserved holes render as quiet cards with a label such as
`Reserve famille`. Ordinary capacity empties are skipped from the print output.

No custom template persistence is included in this increment. The first version
uses one production-quality placeholder template that matches the current design
system and prints cleanly in black and white.

## App Display And Sprites

`web/artwork-switcher.js` remains the single source for Pokemon image
resolution.

Existing modes remain:

- `default`: current official artwork.
- `shiny`: current shiny fallback chain.
- `card`: first owned TCG card image.

New modes are added:

- `sprite_gen1`;
- `sprite_gen2`;
- `sprite_gen3`;
- `sprite_gen4`;
- `sprite_gen5`.

The app exposes these modes in Settings. The Pokedex collection view, binder
view, badges that show Pokemon art, drawer and printable placeholder mode all
resolve images through `PokevaultArtwork`.

Print can have its own image selector so the user can print retro sprites
without changing the rest of the app. If no print-specific value is selected,
print uses the global artwork mode.

Image fallback order for sprite modes is:

1. Requested generation sprite.
2. Official artwork.
3. Text-only placeholder inside the card.

## Lightpanda E2E Strategy

Lightpanda is used as a fast JavaScript-capable headless browser through CDP.
The browser can be started locally with `lightpanda serve` and connected with
Playwright via `chromium.connectOverCDP`. Lightpanda is beta and does not
replace rendering-sensitive screenshot or PDF checks, so DOM and workflow E2E
tests use Lightpanda while final visual print checks can still use headless
Chrome when needed.

Target E2E scenarios:

- Open the app, navigate to Settings, change artwork mode to `sprite_gen2`,
  and verify Pokedex cards use sprite sources.
- Create or load a family-organized binder and verify the binder view exposes
  family-reserved slots.
- Navigate to Print, choose `Placeholders cartes`, select missing-only, and
  verify placeholder cards include page and slot metadata.
- Switch print image mode without changing the global mode.
- Verify a small custom grid starts a family block on the next page when the
  current page has insufficient remaining rows.
- Verify missing family data does not crash the print view.

## Error Handling

- Binder config fetch failure keeps the print view in its existing empty state.
- Family data fetch failure falls back to national layout.
- Bad or unknown artwork mode falls back to `default`.
- Missing sprite files fall back to official artwork.
- A Pokemon with no image after fallback renders a text-only placeholder.
- Invalid custom grid values continue to be clamped by the binder wizard before
  layout is computed.

## Testing

Unit tests:

- `web/binder-layout-engine.js` national, regional and family order.
- Page-aware family block placement for 3 by 3 and 2 by 2 grids.
- Family reservations and capacity empties are distinguishable.
- Layout slot metadata computes page, sheet, face, row, column and slot.
- Missing family data falls back to national order.

Web module tests:

- `web/print-view.js` exposes the placeholder group mode.
- Placeholder cards render Pokemon, metadata and family reservations.
- Print filters apply before rendering placeholders.
- `web/artwork-switcher.js` resolves generation sprite modes and fallbacks.
- Settings exposes the new artwork choices.

E2E tests:

- Lightpanda covers navigation and DOM behavior for Settings, Pokedex, binder
  and print placeholder flows.
- Rendering-sensitive print layout remains eligible for Chrome-based checks if
  Lightpanda cannot provide the necessary visual evidence.

## Non-Goals

- No backend persistence change for custom print templates.
- No server-generated PDF.
- No drag-and-drop manual placement editor in this increment.
- No sprite generation beyond Gen 5 in the first batch.
- No automatic download of new sprite assets unless an existing source path is
  already available or the implementation plan explicitly adds it.
