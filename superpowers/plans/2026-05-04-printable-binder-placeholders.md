# Printable Binder Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared binder layout engine, printable card placeholders, generation sprite display modes, and Lightpanda workflow coverage.

**Architecture:** Add a pure frontend layout engine consumed by binder and print views. Keep image resolution centralized in `web/artwork-switcher.js`, then let Pokedex, binder, drawer, full view and print consume the same artwork contract.

**Tech Stack:** Vanilla browser JavaScript, existing FastAPI static app, Node built-in test runner, existing `make web-test`, optional Lightpanda CDP E2E runner.

---

## File Structure

- Create: `web/binder-layout-engine.js`
  Pure layout functions: sort Pokemon, build family-aware blocks, compute slot metadata, paginate rows, expose `window.PokevaultBinderLayout`.
- Modify: `web/index.html`
  Load the layout engine before `binder-v2.js`; add print artwork selector and placeholder print option.
- Modify: `web/binder-v2.js`
  Delegate ordering and family block helpers to the shared engine while keeping public `window.PokedexBinder` API stable.
- Modify: `web/binder-collection-view.js`
  Render binder pages from computed slots, including visible family-reserved cards.
- Modify: `web/print-view.js`
  Add `Placeholders cartes` mode, print artwork override, placeholder page rendering and test hooks.
- Modify: `web/artwork-switcher.js`
  Add generation sprite modes and `resolveForMode`/override support.
- Modify: `web/pokemon-drawer.js`
  Resolve drawer header image through `PokevaultArtwork`.
- Modify: `web/pokemon-full-view.js`
  Resolve hero and form images through `PokevaultArtwork`.
- Modify: `web/i18n.js`
  Add FR/EN labels for placeholder mode, print artwork select, reserved family slots and sprite modes.
- Modify: `web/styles.css`
  Add placeholder print grid/card styles and reserved family card styles.
- Create: `tests/web/binder-layout-engine.test.mjs`
  Unit coverage for pure layout engine.
- Modify: `tests/web/binder-layouts.test.mjs`
  Ensure legacy binder API still behaves after delegation.
- Modify: `tests/web/binder-collection-view.test.mjs`
  Test reserved slot rendering helpers.
- Modify: `tests/web/print-view.test.mjs`
  Test placeholder data shaping and print labels.
- Create: `tests/web/artwork-switcher.test.mjs`
  Test generation sprite URL resolution and fallbacks.
- Modify: `tests/web/pokemon-full-view.test.mjs`
  Assert full view uses `PokevaultArtwork`.
- Create: `tests/e2e/lightpanda-print-placeholders.mjs`
  Optional local Lightpanda CDP workflow script.
- Modify: `Makefile`
  Add an opt-in `lightpanda-e2e` target, not part of `make check`.

---

### Task 1: Add Shared Layout Engine Skeleton

**Files:**
- Create: `web/binder-layout-engine.js`
- Create: `tests/web/binder-layout-engine.test.mjs`
- Modify: `web/index.html:907`

- [ ] **Step 1: Write failing engine tests**

Create `tests/web/binder-layout-engine.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

async function loadEngine() {
  globalThis.window = globalThis;
  importCase += 1;
  await import(`../../web/binder-layout-engine.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokevaultBinderLayout._test;
}

function makePokemon(count, region = "kanto") {
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const number = String(n).padStart(4, "0");
    return {
      slug: `${number}-pokemon-${n}`,
      number,
      names: { fr: `Pokemon ${n}`, en: `Pokemon ${n}` },
      region,
    };
  });
}

test("computeBinderSlots emits page, sheet, face, row and column metadata", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "kanto", name: "Kanto", rows: 2, cols: 2, sheet_count: 2 },
    pokemon: makePokemon(5),
    defs: [{ id: "kanto", low: 1, high: 151 }],
    includeCapacity: true,
  });

  assert.equal(slots.length, 16);
  assert.deepEqual(
    slots.slice(0, 5).map((slot) => ({
      page: slot.page,
      sheet: slot.sheet,
      face: slot.face,
      slot: slot.slot,
      row: slot.row,
      col: slot.col,
      slug: slot.pokemon?.slug || null,
      emptyKind: slot.emptyKind,
    })),
    [
      { page: 1, sheet: 1, face: "R", slot: 1, row: 1, col: 1, slug: "0001-pokemon-1", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 2, row: 1, col: 2, slug: "0002-pokemon-2", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 3, row: 2, col: 1, slug: "0003-pokemon-3", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 4, row: 2, col: 2, slug: "0004-pokemon-4", emptyKind: null },
      { page: 2, sheet: 1, face: "V", slot: 1, row: 1, col: 1, slug: "0005-pokemon-5", emptyKind: null },
    ],
  );
  assert.equal(slots.at(-1).emptyKind, "capacity_empty");
});

test("orderPokemonForBinder preserves regional range behavior", async () => {
  const api = await loadEngine();
  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "kanto-2",
      organization: "national",
      region_scope: "kanto",
      range_start: 8,
      range_limit: 8,
    },
    pokemon: makePokemon(10),
    defs: [{ id: "kanto", low: 1, high: 151 }],
  });

  assert.deepEqual(
    ordered.map((p) => p.slug),
    ["0009-pokemon-9", "0010-pokemon-10"],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/binder-layout-engine.test.mjs`

Expected: FAIL with module-not-found for `web/binder-layout-engine.js`.

- [ ] **Step 3: Create the layout engine**

Create `web/binder-layout-engine.js` with this public API and base implementation:

```js
(function initBinderLayoutEngine() {
  "use strict";

  function positiveInt(value, fallback) {
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function normalizedLayout(binder = {}) {
    const rows = positiveInt(binder.rows, 3);
    const cols = positiveInt(binder.cols, 3);
    const sheets = positiveInt(binder.sheet_count ?? binder.sheetCount, 10);
    const perPage = rows * cols;
    const pageCount = sheets * 2;
    const capacity = perPage * pageCount;
    return { rows, cols, sheets, perPage, pageCount, capacity };
  }

  function nationalIntFromPokemon(p) {
    const s = String(p?.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function inferRegionFromDefs(n, defs = []) {
    for (const r of defs) {
      if (r && r.low <= n && n <= r.high) return r.id;
    }
    return "unknown";
  }

  function effectiveRegionId(p, defs = []) {
    if (p?.region) return p.region;
    return inferRegionFromDefs(nationalIntFromPokemon(p), defs);
  }

  function sortNational(pokemon = []) {
    return [...pokemon].sort((a, b) => {
      const na = nationalIntFromPokemon(a);
      const nb = nationalIntFromPokemon(b);
      if (na !== nb) return na - nb;
      return String(a?.slug || "").localeCompare(String(b?.slug || ""));
    });
  }

  function sortRegional(pokemon = [], defs = []) {
    const orderIdx = Object.fromEntries(defs.map((r, i) => [r.id, i]));
    return [...pokemon].sort((a, b) => {
      const ra = effectiveRegionId(a, defs);
      const rb = effectiveRegionId(b, defs);
      const ia = orderIdx[ra] ?? 999;
      const ib = orderIdx[rb] ?? 999;
      if (ia !== ib) return ia - ib;
      const fa = a?.region_native === false ? 1 : 0;
      const fb = b?.region_native === false ? 1 : 0;
      if (fa !== fb) return fa - fb;
      const na = nationalIntFromPokemon(a);
      const nb = nationalIntFromPokemon(b);
      if (na !== nb) return na - nb;
      return String(a?.slug || "").localeCompare(String(b?.slug || ""));
    });
  }

  function applyBinderScope(pokemon = [], binder = {}, defs = []) {
    const scope = String(binder.region_scope || binder.region_id || "").trim();
    return scope ? pokemon.filter((p) => effectiveRegionId(p, defs) === scope) : pokemon;
  }

  function applyBinderRange(items = [], binder = {}) {
    const startRaw = Number(binder.range_start);
    const limitRaw = Number(binder.range_limit);
    const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.floor(startRaw) : 0;
    const hasLimit = Number.isFinite(limitRaw) && limitRaw > 0;
    if (start === 0 && !hasLimit) return items;
    const limit = hasLimit ? Math.floor(limitRaw) : items.length;
    return items.slice(start, start + limit);
  }

  function slotMeta(index, layout) {
    const pageIndex = Math.floor(index / layout.perPage);
    const slotInPage = index % layout.perPage;
    return {
      page: pageIndex + 1,
      sheet: Math.floor(pageIndex / 2) + 1,
      face: pageIndex % 2 === 0 ? "R" : "V",
      slot: slotInPage + 1,
      row: Math.floor(slotInPage / layout.cols) + 1,
      col: (slotInPage % layout.cols) + 1,
    };
  }

  function pokemonItem(pokemon, familyId = null) {
    return { pokemon, emptyKind: null, familyId };
  }

  function capacityItem() {
    return { pokemon: null, emptyKind: "capacity_empty", familyId: null };
  }

  function basicItemsForBinder(binder = {}, pokemon = [], defs = []) {
    const scoped = applyBinderScope(pokemon, binder, defs);
    const org = binder.organization === "by_region" ? "by_region" : "national";
    const sorted = org === "by_region" && defs.length ? sortRegional(scoped, defs) : sortNational(scoped);
    return sorted.map((p) => pokemonItem(p));
  }

  function computeBinderSlots({ binder = {}, pokemon = [], defs = [], includeCapacity = false } = {}) {
    const layout = normalizedLayout(binder);
    const ranged = applyBinderRange(basicItemsForBinder(binder, pokemon, defs), binder);
    const items = includeCapacity ? [...ranged] : ranged.slice();
    if (includeCapacity) {
      while (items.length < layout.capacity) items.push(capacityItem());
    }
    return items.map((item, idx) => ({
      binderId: String(binder.id || ""),
      binderName: String(binder.name || binder.id || ""),
      ...slotMeta(idx, layout),
      pokemon: item.pokemon,
      emptyKind: item.emptyKind,
      familyId: item.familyId,
    }));
  }

  function orderPokemonForBinder({ binder = {}, pokemon = [], defs = [], familyData = null } = {}) {
    void familyData;
    return computeBinderSlots({ binder, pokemon, defs, includeCapacity: false })
      .filter((slot) => slot.emptyKind !== "capacity_empty")
      .map((slot) => slot.pokemon || null);
  }

  window.PokevaultBinderLayout = {
    computeBinderSlots,
    orderPokemonForBinder,
    _test: {
      applyBinderRange,
      computeBinderSlots,
      effectiveRegionId,
      normalizedLayout,
      orderPokemonForBinder,
      slotMeta,
      sortNational,
      sortRegional,
    },
  };
})();
```

- [ ] **Step 4: Load engine in the app**

In `web/index.html`, insert before `binder-v2.js`:

```html
    <script src="/binder-layout-engine.js" defer></script>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/web/binder-layout-engine.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/binder-layout-engine.js web/index.html tests/web/binder-layout-engine.test.mjs
git commit -m "feat(web): add shared binder layout engine"
```

---

### Task 2: Add Page-Aware Family Blocks To Engine

**Files:**
- Modify: `web/binder-layout-engine.js`
- Modify: `tests/web/binder-layout-engine.test.mjs`

- [ ] **Step 1: Write failing family layout tests**

Append to `tests/web/binder-layout-engine.test.mjs`:

```js
test("family slots preserve intentional holes and expose reserved metadata", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0133-eevee", number: "0133" },
      { slug: "0134-vaporeon", number: "0134" },
      { slug: "0135-jolteon", number: "0135" },
    ],
    familyData: {
      families: [
        {
          id: "0133-eevee",
          layout_rows: [
            ["0133-eevee", "0134-vaporeon"],
            [null, "0135-jolteon"],
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0133-eevee", null, "0133-eevee"],
      ["0134-vaporeon", null, "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
      ["0135-jolteon", null, "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
    ],
  );
});

test("family block starts on next page when remaining rows cannot fit it", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
      { slug: "0004-d", number: "0004" },
      { slug: "0005-e", number: "0005" },
      { slug: "0006-f", number: "0006" },
      { slug: "0007-g", number: "0007" },
      { slug: "0008-h", number: "0008" },
      { slug: "0009-i", number: "0009" },
    ],
    familyData: {
      families: [
        { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
        { id: "f2", layout_rows: [["0004-d", "0005-e", "0006-f"], ["0007-g", "0008-h", "0009-i"]] },
      ],
    },
    includeCapacity: true,
  });

  const f2First = slots.find((slot) => slot.pokemon?.slug === "0004-d");
  assert.equal(f2First.page, 2);
  assert.equal(slots[3].emptyKind, "capacity_empty");
  assert.equal(slots[4].emptyKind, "capacity_empty");
  assert.equal(slots[5].emptyKind, "capacity_empty");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/binder-layout-engine.test.mjs`

Expected: FAIL because family ordering is not implemented.

- [ ] **Step 3: Implement family block helpers**

In `web/binder-layout-engine.js`, add these helpers before `basicItemsForBinder`:

```js
  function familyReservedItem(familyId) {
    return { pokemon: null, emptyKind: "family_reserved", familyId };
  }

  function padRowToColumns(row, cols, familyId, emptyKind = "family_reserved") {
    const out = row.slice(0, cols);
    while (out.length < cols) {
      out.push(emptyKind === "capacity_empty" ? capacityItem() : familyReservedItem(familyId));
    }
    return out;
  }

  function familyLayoutBlocks(pokemon = [], familyData = null, cols = 3) {
    const bySlug = new Map();
    for (const p of pokemon) {
      const slug = String(p?.slug || "");
      if (slug) bySlug.set(slug, p);
    }

    const emitted = new Set();
    const families = Array.isArray(familyData?.families) ? familyData.families : [];
    const blocks = [];

    for (const family of families) {
      const familyId = String(family?.id || "");
      const rows = Array.isArray(family?.layout_rows) ? family.layout_rows : [];
      const blockRows = [];

      for (const rawRow of rows) {
        if (!Array.isArray(rawRow)) continue;
        const row = [];
        let hasPokemon = false;
        for (const slugRaw of rawRow) {
          if (!slugRaw) {
            row.push(familyReservedItem(familyId));
            continue;
          }
          const slug = String(slugRaw);
          const p = bySlug.get(slug);
          if (!p || emitted.has(slug)) {
            row.push(familyReservedItem(familyId));
            continue;
          }
          row.push(pokemonItem(p, familyId));
          emitted.add(slug);
          hasPokemon = true;
        }
        if (hasPokemon) blockRows.push(padRowToColumns(row, cols, familyId));
      }

      if (blockRows.length) blocks.push({ familyId, rows: blockRows });
    }

    const leftovers = sortNational(
      pokemon.filter((p) => p?.slug && !emitted.has(String(p.slug))),
    );
    for (const p of leftovers) {
      blocks.push({
        familyId: String(p.slug || ""),
        rows: [padRowToColumns([pokemonItem(p, String(p.slug || ""))], cols, String(p.slug || ""))],
      });
    }
    return blocks;
  }

  function flattenFamilyBlocksPageAware(blocks = [], layout) {
    const out = [];
    let rowInPage = 0;

    for (const block of blocks) {
      const blockRows = block.rows || [];
      if (
        rowInPage > 0 &&
        blockRows.length <= layout.rows &&
        rowInPage + blockRows.length > layout.rows
      ) {
        while (rowInPage < layout.rows) {
          out.push(...padRowToColumns([], layout.cols, null, "capacity_empty"));
          rowInPage += 1;
        }
        rowInPage = 0;
      }

      for (const row of blockRows) {
        out.push(...padRowToColumns(row, layout.cols, block.familyId));
        rowInPage = (rowInPage + 1) % layout.rows;
      }
    }
    return out;
  }
```

Replace `basicItemsForBinder` with:

```js
  function basicItemsForBinder(binder = {}, pokemon = [], defs = [], familyData = null) {
    const layout = normalizedLayout(binder);
    const scoped = applyBinderScope(pokemon, binder, defs);
    const org =
      binder.organization === "by_region" || binder.organization === "family"
        ? binder.organization
        : "national";

    if (org === "family" && familyData && Array.isArray(familyData.families)) {
      return flattenFamilyBlocksPageAware(
        familyLayoutBlocks(scoped, familyData, layout.cols),
        layout,
      );
    }

    const sorted = org === "by_region" && defs.length ? sortRegional(scoped, defs) : sortNational(scoped);
    return sorted.map((p) => pokemonItem(p));
  }
```

Update `computeBinderSlots` and `orderPokemonForBinder` signatures to pass `familyData`:

```js
  function computeBinderSlots({ binder = {}, pokemon = [], defs = [], familyData = null, includeCapacity = false } = {}) {
    const layout = normalizedLayout(binder);
    const ranged = applyBinderRange(basicItemsForBinder(binder, pokemon, defs, familyData), binder);
    const items = includeCapacity ? [...ranged] : ranged.slice();
    if (includeCapacity) {
      while (items.length < layout.capacity) items.push(capacityItem());
    }
    return items.map((item, idx) => ({
      binderId: String(binder.id || ""),
      binderName: String(binder.name || binder.id || ""),
      ...slotMeta(idx, layout),
      pokemon: item.pokemon,
      emptyKind: item.emptyKind,
      familyId: item.familyId,
    }));
  }

  function orderPokemonForBinder({ binder = {}, pokemon = [], defs = [], familyData = null } = {}) {
    return computeBinderSlots({ binder, pokemon, defs, familyData, includeCapacity: false })
      .filter((slot) => slot.emptyKind !== "capacity_empty")
      .map((slot) => slot.pokemon || null);
  }
```

Expose helpers in `_test`:

```js
      familyLayoutBlocks,
      flattenFamilyBlocksPageAware,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/web/binder-layout-engine.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/binder-layout-engine.js tests/web/binder-layout-engine.test.mjs
git commit -m "feat(web): compute page-aware family binder slots"
```

---

### Task 3: Delegate Binder V2 Ordering To The Engine

**Files:**
- Modify: `web/binder-v2.js`
- Modify: `tests/web/binder-layouts.test.mjs`

- [ ] **Step 1: Write compatibility assertion**

In `tests/web/binder-layouts.test.mjs`, add this assertion inside
`family binder ordering pads evolution rows with intentional holes` after `ordered`:

```js
  assert.equal(Boolean(globalThis.window.PokevaultBinderLayout), true);
```

Also update `loadModule()` to import the engine before `binder-v2.js`:

```js
    await import(`../../web/binder-layout-engine.js?case=${Date.now()}-${importCase}-engine`);
    await import(`../../web/binder-v2.js?case=${Date.now()}-${importCase}`);
```

- [ ] **Step 2: Run test to verify baseline still passes**

Run: `node --test tests/web/binder-layouts.test.mjs`

Expected before code changes: PASS after adding engine import; this protects legacy API behavior.

- [ ] **Step 3: Replace ordering body with engine delegation**

In `web/binder-v2.js`, replace `orderPokemonForBinder` body with:

```js
function orderPokemonForBinder(binder, pokemon, defs) {
  const engine = window.PokevaultBinderLayout;
  if (engine?.orderPokemonForBinder) {
    return engine.orderPokemonForBinder({
      binder,
      pokemon,
      defs,
      familyData: binderEvolutionFamilies,
    });
  }
  if (!binder) return sortBinderNationalOrder(pokemon);
  const scope = String(binder.region_scope || binder.region_id || "").trim();
  const pool = scope
    ? pokemon.filter((p) => effectiveRegionId(p, defs) === scope)
    : pokemon;
  const org =
    binder.organization === "by_region" || binder.organization === "family"
      ? binder.organization
      : "national";
  const sorted =
    org === "family"
      ? sortBinderFamilyOrder(pool, binder)
      : org === "by_region" && defs.length
        ? sortBinderRegionOrder(pool, defs)
        : sortBinderNationalOrder(pool);
  return applyBinderRange(sorted, binder);
}
```

Keep the old helper functions for one increment so workspace builder behavior
does not change in the same commit.

- [ ] **Step 4: Run compatibility tests**

Run: `node --test tests/web/binder-layouts.test.mjs tests/web/binder-layout-engine.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/binder-v2.js tests/web/binder-layouts.test.mjs
git commit -m "refactor(web): delegate binder ordering to layout engine"
```

---

### Task 4: Render Reserved Family Slots In Binder View

**Files:**
- Modify: `web/binder-collection-view.js`
- Modify: `tests/web/binder-collection-view.test.mjs`
- Modify: `web/i18n.js`
- Modify: `web/styles.css`

- [ ] **Step 1: Add failing reserved-card test**

Update `tests/web/binder-collection-view.test.mjs` `loadModule()` to keep its
current stubs and import the module. Append:

```js
test("binder shell creates a visible family reserved card", async () => {
  const api = await loadModule();
  const card = api.createReservedSlotCard({
    emptyKind: "family_reserved",
    familyId: "0133-eevee",
    slot: 4,
  });

  assert.equal(card.className, "card card--reserved-slot binder-card");
  assert.equal(card.dataset.emptyKind, "family_reserved");
  assert.equal(card.textContent.includes("Reserve famille"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/binder-collection-view.test.mjs`

Expected: FAIL because `createReservedSlotCard` is not exported.

- [ ] **Step 3: Add i18n labels**

In French block of `web/i18n.js`, add:

```js
      "binder_shell.reserved_family": "Reserve famille",
      "binder_shell.empty_slot": "Emplacement vide",
```

In English block:

```js
      "binder_shell.reserved_family": "Family reserve",
      "binder_shell.empty_slot": "Empty slot",
```

- [ ] **Step 4: Add binder reserved card helper**

In `web/binder-collection-view.js`, add before `renderBinderPageGrid()`:

```js
function createReservedSlotCard(slot) {
  const card = document.createElement("div");
  card.className = "card card--reserved-slot binder-card";
  card.dataset.emptyKind = String(slot?.emptyKind || "");
  card.dataset.familyId = String(slot?.familyId || "");
  const label = document.createElement("span");
  label.className = "card-empty-label";
  label.textContent =
    slot?.emptyKind === "family_reserved"
      ? tBinderShell("binder_shell.reserved_family")
      : tBinderShell("binder_shell.empty_slot");
  const meta = document.createElement("span");
  meta.className = "card-empty-meta";
  meta.textContent = `#${slot?.slot || ""}`;
  card.append(label, meta);
  return card;
}
```

In `_test`, expose:

```js
    createReservedSlotCard,
```

- [ ] **Step 5: Render slots from engine**

In `renderBinderPageGrid()`, after `const pokemon = ...`, replace
`shellState.ordered = window.PokedexBinder.orderPokemonForBinder(...)` with:

```js
  const engine = window.PokevaultBinderLayout;
  const familyData = window.PokedexBinder?.cachedFamilyData || null;
  const slots = engine?.computeBinderSlots
    ? engine.computeBinderSlots({
        binder,
        pokemon,
        defs,
        familyData,
        includeCapacity: true,
      })
    : [];
  shellState.ordered = slots.length
    ? slots.filter((slot) => slot.emptyKind !== "capacity_empty").map((slot) => slot.pokemon || null)
    : window.PokedexBinder.orderPokemonForBinder(binder, pokemon, defs);
  shellState.slots = slots;
```

Add `slots: []` to `shellState`.

Inside page grid loop, replace `const p = shellState.ordered[idx];` with:

```js
      const slot = shellState.slots?.[idx] || null;
      const p = slot ? slot.pokemon : shellState.ordered[idx];
```

Then replace empty card creation with:

```js
        const card = p
          ? makeCard(p)
          : slot?.emptyKind === "family_reserved"
            ? createReservedSlotCard(slot)
            : makeCard(null, { empty: true });
```

- [ ] **Step 6: Expose cached family data from binder-v2**

In `web/binder-v2.js`, add to `window.PokedexBinder`:

```js
  get cachedFamilyData() {
    return binderEvolutionFamilies;
  },
```

- [ ] **Step 7: Add CSS**

In `web/styles.css`, near binder card styles, add:

```css
.card--reserved-slot {
  min-height: 100%;
  display: grid;
  place-items: center;
  gap: 6px;
  border: 1px dashed var(--outline-soft);
  background: color-mix(in srgb, var(--surface-low) 82%, transparent);
  color: var(--muted);
  text-align: center;
}

.card-empty-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.card-empty-meta {
  font-size: 0.68rem;
  color: var(--muted);
}
```

- [ ] **Step 8: Run tests**

Run: `node --test tests/web/binder-collection-view.test.mjs tests/web/binder-layout-engine.test.mjs tests/web/binder-layouts.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/binder-collection-view.js web/binder-v2.js web/i18n.js web/styles.css tests/web/binder-collection-view.test.mjs
git commit -m "feat(web): show family reserved binder slots"
```

---

### Task 5: Add Printable Placeholder Mode

**Files:**
- Modify: `web/index.html`
- Modify: `web/print-view.js`
- Modify: `web/i18n.js`
- Modify: `web/styles.css`
- Modify: `tests/web/print-view.test.mjs`

- [ ] **Step 1: Add failing print data tests**

In `tests/web/print-view.test.mjs`, append:

```js
test("print view builds placeholder cards from layout slots", async () => {
  const api = await loadModule();
  const section = api.buildPlaceholderSection(
    {
      id: "kanto",
      name: "Kanto",
      rows: 2,
      cols: 2,
      sheet_count: 1,
    },
    [
      {
        binderId: "kanto",
        binderName: "Kanto",
        page: 1,
        sheet: 1,
        face: "R",
        slot: 1,
        row: 1,
        col: 1,
        pokemon: {
          slug: "0001-bulbasaur",
          number: "0001",
          names: { fr: "Bulbizarre", en: "Bulbasaur" },
        },
        emptyKind: null,
        familyId: "0001-bulbasaur",
      },
      {
        binderId: "kanto",
        binderName: "Kanto",
        page: 1,
        sheet: 1,
        face: "R",
        slot: 2,
        row: 1,
        col: 2,
        pokemon: null,
        emptyKind: "family_reserved",
        familyId: "0001-bulbasaur",
      },
    ],
    {},
    "all",
  );

  assert.equal(section.pages.length, 1);
  assert.equal(section.pages[0].slots[0].title, "Bulbizarre");
  assert.equal(section.pages[0].slots[0].subtitle, "Bulbasaur");
  assert.equal(section.pages[0].slots[1].emptyKind, "family_reserved");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/print-view.test.mjs`

Expected: FAIL because `buildPlaceholderSection` is not exported.

- [ ] **Step 3: Add HTML option**

In `web/index.html`, inside `printGroupSelect`, add:

```html
                        <option value="placeholders" data-i18n="app.print.placeholders">Placeholders cartes</option>
```

In print controls, after group select, add:

```html
                    <div class="print-control-group" id="printArtworkGroup">
                      <label for="printArtworkSelect" data-i18n="app.print.artwork">Image impression</label>
                      <select id="printArtworkSelect" class="region-filter"></select>
                    </div>
```

- [ ] **Step 4: Add i18n labels**

In French block:

```js
      "app.print.placeholders": "Placeholders cartes",
      "app.print.artwork": "Image impression",
      "print.artwork.global": "Comme l'app",
      "print.placeholder.reserve": "Reserve famille",
      "print.placeholder.missing": "Manquant",
      "print.placeholder.caught": "Capture",
```

In English block:

```js
      "app.print.placeholders": "Card placeholders",
      "app.print.artwork": "Print image",
      "print.artwork.global": "Same as app",
      "print.placeholder.reserve": "Family reserve",
      "print.placeholder.missing": "Missing",
      "print.placeholder.caught": "Caught",
```

- [ ] **Step 5: Add placeholder data builder**

In `web/print-view.js`, add state near existing print state:

```js
let printArtworkMode = "global";
```

Add helpers before `renderPrintView()`:

```js
function pageKeyForSlot(slot) {
  return `${slot.binderId || ""}:${slot.page || 1}`;
}

function displayEnglishNamePrint(p) {
  const n = p?.names || {};
  return n.en || "";
}

function placeholderStatusLabel(caught) {
  return caught ? tPrint("print.placeholder.caught") : tPrint("print.placeholder.missing");
}

function buildPlaceholderSection(binder, slots, caughtMap, filterMode) {
  const pagesByKey = new Map();
  for (const slot of slots || []) {
    if (!slot) continue;
    if (slot.emptyKind === "capacity_empty") continue;
    const p = slot.pokemon;
    const caught = p ? Boolean(caughtMap[String(p.slug || "")]) : false;
    if (p && filterMode === "caught" && !caught) continue;
    if (p && filterMode === "missing" && caught) continue;
    if (p && !matchesPrintSearch(p, printSearchQuery)) continue;

    const key = pageKeyForSlot(slot);
    if (!pagesByKey.has(key)) {
      pagesByKey.set(key, {
        page: slot.page,
        sheet: slot.sheet,
        face: slot.face,
        rows: Math.max(1, Number(binder.rows) || 3),
        cols: Math.max(1, Number(binder.cols) || 3),
        slots: [],
      });
    }

    pagesByKey.get(key).slots.push({
      ...slot,
      title: p ? displayNamePrint(p) : tPrint("print.placeholder.reserve"),
      subtitle: p ? displayEnglishNamePrint(p) : "",
      number: p ? displayNumPrint(p.number) : "",
      caught,
      status: p ? placeholderStatusLabel(caught) : "",
    });
  }

  return {
    binderId: String(binder.id || ""),
    title: String(binder.name || binder.id || ""),
    pages: [...pagesByKey.values()].sort((a, b) => a.page - b.page),
  };
}
```

Expose in `_test`:

```js
    buildPlaceholderSection,
```

- [ ] **Step 6: Wire print artwork control**

In `wirePrintControls()`, add:

```js
  const art = document.getElementById("printArtworkSelect");
  if (art && !art.dataset.printWired) {
    art.dataset.printWired = "1";
    fillPrintArtworkOptions(art);
    art.addEventListener("change", () => {
      printArtworkMode = art.value || "global";
      renderPrintView();
    });
  }
```

Add helper:

```js
function fillPrintArtworkOptions(sel) {
  if (!sel) return;
  const A = window.PokevaultArtwork;
  sel.replaceChildren();
  const globalOpt = document.createElement("option");
  globalOpt.value = "global";
  globalOpt.textContent = tPrint("print.artwork.global");
  sel.append(globalOpt);
  for (const mode of A?.modes || []) {
    const opt = document.createElement("option");
    opt.value = mode.id;
    opt.textContent = mode.label;
    sel.append(opt);
  }
  sel.value = printArtworkMode;
}
```

- [ ] **Step 7: Render placeholder pages**

In `renderPrintView()`, add branch before `pocket`:

```js
  if (groupMode === "placeholders") {
    const targetBinders = selectedBinder === "all"
      ? binders
      : binders.filter((b) => String(b.id) === selectedBinder);
    for (const binder of targetBinders) {
      const section = buildPlaceholderSectionForBinder(binder, listScopedPokemon, caughtMap, defs, cfg, filterMode);
      totalEntries += section.pages.reduce((n, page) => n + page.slots.filter((slot) => slot.pokemon).length, 0);
      output.append(buildPlaceholderSectionElement(section, date, sectionIdx++ > 0));
    }
  } else if (groupMode === "pocket") {
```

Add `buildPlaceholderSectionForBinder`:

```js
function buildPlaceholderSectionForBinder(binder, allPokemon, caughtMap, defs, cfg, filterMode) {
  const B = window.PokedexBinder;
  const L = window.PokevaultBinderLayout;
  const rule = B?.getFormRuleForBinder?.(cfg, binder) || null;
  const pool = rule && B?.selectBinderPokemonPool
    ? B.selectBinderPokemonPool(allPokemon, rule)
    : allPokemon;
  const slots = L?.computeBinderSlots
    ? L.computeBinderSlots({
        binder,
        pokemon: pool,
        defs,
        familyData: B?.cachedFamilyData || null,
        includeCapacity: true,
      })
    : [];
  return buildPlaceholderSection(binder, slots, caughtMap, filterMode);
}
```

Add `buildPlaceholderSectionElement(section, date, pageBreakBefore)` that creates:

```js
function buildPlaceholderSectionElement(section, date, pageBreakBefore) {
  const frag = document.createDocumentFragment();
  for (const page of section.pages) {
    const wrapper = document.createElement("div");
    wrapper.className = "print-placeholder-page";
    if (pageBreakBefore) wrapper.classList.add("print-page-break");
    pageBreakBefore = true;

    const title = document.createElement("h2");
    title.className = "print-section-title";
    title.textContent = `${section.title} — P${page.page} f.${page.sheet}${page.face}`;
    wrapper.append(title);

    const grid = document.createElement("div");
    grid.className = "print-placeholder-grid";
    grid.style.setProperty("--placeholder-cols", String(page.cols));
    grid.style.gridTemplateColumns = `repeat(${page.cols}, minmax(0, 1fr))`;

    for (const slot of page.slots) {
      grid.append(buildPlaceholderCardElement(slot));
    }

    wrapper.append(grid);
    const footer = document.createElement("div");
    footer.className = "print-footer";
    footer.textContent = formatPrintFooter(date, false);
    wrapper.append(footer);
    frag.append(wrapper);
  }
  return frag;
}
```

Add `buildPlaceholderCardElement(slot)`:

```js
function buildPlaceholderCardElement(slot) {
  const card = document.createElement("article");
  card.className = slot.emptyKind === "family_reserved"
    ? "print-placeholder-card print-placeholder-card--reserved"
    : "print-placeholder-card";
  card.style.gridColumn = String(slot.col || "auto");
  card.style.gridRow = String(slot.row || "auto");

  if (slot.emptyKind === "family_reserved") {
    card.textContent = tPrint("print.placeholder.reserve");
    return card;
  }

  const p = slot.pokemon;
  const A = window.PokevaultArtwork;
  const resolved = A?.resolveForMode
    ? A.resolveForMode(p, printArtworkMode === "global" ? undefined : printArtworkMode)
    : A?.resolve
      ? A.resolve(p)
      : { src: "", fallbacks: [] };

  const top = document.createElement("div");
  top.className = "print-placeholder-card__top";
  const num = document.createElement("span");
  num.textContent = slot.number;
  const status = document.createElement("span");
  status.textContent = slot.status;
  top.append(num, status);

  const image = document.createElement("div");
  image.className = "print-placeholder-card__image";
  if (resolved?.src) {
    const img = document.createElement("img");
    img.alt = "";
    if (A?.attach) A.attach(img, resolved);
    else img.src = resolved.src;
    image.append(img);
  }

  const title = document.createElement("strong");
  title.textContent = slot.title;
  const subtitle = document.createElement("span");
  subtitle.textContent = slot.subtitle || `P${slot.page} · ${slot.face}${slot.slot}`;
  const meta = document.createElement("small");
  meta.textContent = `${slot.binderName} · P${slot.page} f.${slot.sheet}${slot.face} · case ${slot.slot}`;

  card.append(top, image, title, subtitle, meta);
  return card;
}
```

- [ ] **Step 8: Add CSS**

In `web/styles.css`, near print styles, add:

```css
.print-placeholder-page {
  break-after: page;
  margin-bottom: 16px;
}

.print-placeholder-grid {
  display: grid;
  gap: 6px;
  align-items: stretch;
}

.print-placeholder-card {
  min-height: 82mm;
  border: 1px solid var(--outline-soft);
  border-radius: 8px;
  padding: 8px;
  background: var(--surface-low);
  color: var(--text);
  display: grid;
  grid-template-rows: auto 1fr auto auto auto;
  gap: 6px;
  overflow: hidden;
}

.print-placeholder-card--reserved {
  place-items: center;
  border-style: dashed;
  color: var(--muted);
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
}

.print-placeholder-card__top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.72rem;
  color: var(--muted);
}

.print-placeholder-card__image {
  min-height: 38mm;
  display: grid;
  place-items: center;
}

.print-placeholder-card__image img {
  max-width: 100%;
  max-height: 40mm;
  object-fit: contain;
}

.print-placeholder-card strong {
  color: var(--text);
  font-size: 0.9rem;
}

.print-placeholder-card span,
.print-placeholder-card small {
  color: var(--muted);
  font-size: 0.7rem;
}

@media print {
  .print-placeholder-grid {
    gap: 4mm;
  }

  .print-placeholder-card {
    min-height: 82mm;
    border-color: #999;
    color: #111;
    background: #fff;
  }

  .print-placeholder-card strong {
    color: #111;
  }
}
```

- [ ] **Step 9: Run tests**

Run: `node --test tests/web/print-view.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add web/index.html web/print-view.js web/i18n.js web/styles.css tests/web/print-view.test.mjs
git commit -m "feat(web): add printable card placeholders"
```

---

### Task 6: Add Generation Sprite Modes

**Files:**
- Modify: `web/artwork-switcher.js`
- Create: `tests/web/artwork-switcher.test.mjs`
- Modify: `web/i18n.js`

- [ ] **Step 1: Write failing artwork tests**

Create `tests/web/artwork-switcher.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

async function loadArtwork() {
  globalThis.window = globalThis;
  globalThis.document = { addEventListener() {} };
  globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
  globalThis.fetch = async () => ({ ok: true, async json() { return { cards: [] }; } });
  importCase += 1;
  await import(`../../web/artwork-switcher.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokevaultArtwork;
}

test("artwork switcher exposes generation sprite modes", async () => {
  const api = await loadArtwork();
  assert.deepEqual(
    api.modes.filter((mode) => mode.id.startsWith("sprite_gen")).map((mode) => mode.id),
    ["sprite_gen1", "sprite_gen2", "sprite_gen3", "sprite_gen4", "sprite_gen5"],
  );
});

test("resolveForMode uses generation sprite before official artwork fallback", async () => {
  const api = await loadArtwork();
  const resolved = api.resolveForMode(
    { slug: "0001-bulbasaur", image: "data/images/0001-bulbasaur.png" },
    "sprite_gen2",
  );

  assert.equal(
    resolved.src,
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ii/crystal/1.png",
  );
  assert.deepEqual(resolved.fallbacks, ["/data/images/0001-bulbasaur.png"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/artwork-switcher.test.mjs`

Expected: FAIL because sprite modes and `resolveForMode` do not exist.

- [ ] **Step 3: Implement sprite modes**

In `web/artwork-switcher.js`, replace `MODES` with:

```js
  const MODES = [
    { id: "default", label: "Sugimori" },
    { id: "shiny", label: "Shiny (fallback si absent)" },
    { id: "card", label: "Première carte TCG" },
    { id: "sprite_gen1", label: "Sprite Gen 1" },
    { id: "sprite_gen2", label: "Sprite Gen 2" },
    { id: "sprite_gen3", label: "Sprite Gen 3" },
    { id: "sprite_gen4", label: "Sprite Gen 4" },
    { id: "sprite_gen5", label: "Sprite Gen 5" },
  ];
```

Add helpers near `shinyCdnPath`:

```js
  const SPRITE_VERSION_PATHS = {
    sprite_gen1: "versions/generation-i/red-blue",
    sprite_gen2: "versions/generation-ii/crystal",
    sprite_gen3: "versions/generation-iii/emerald",
    sprite_gen4: "versions/generation-iv/platinum",
    sprite_gen5: "versions/generation-v/black-white",
  };

  function nationalIdFromSlug(p) {
    const slug = String(p?.slug || "");
    const m = slug.match(/^(\d{1,4})/);
    if (!m) return 0;
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function generationSpritePath(p, mode) {
    const version = SPRITE_VERSION_PATHS[mode];
    const id = nationalIdFromSlug(p);
    if (!version || !id) return "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${version}/${id}.png`;
  }
```

Replace `resolve(p)` with:

```js
  function resolveForMode(p, mode = currentMode) {
    const activeMode = isValid(mode) ? mode : DEFAULT_MODE;
    const def = normalizeDefault(p);
    if (activeMode === "shiny") {
      const local = shinyPath(p);
      const cdn = shinyCdnPath(p);
      const chain = [local, cdn, def].filter(
        (url, idx, arr) => url && arr.indexOf(url) === idx,
      );
      return { src: chain[0] || def, fallbacks: chain.slice(1) };
    }
    if (activeMode === "card") {
      const ca = cardArt(p);
      return { src: ca || def, fallbacks: ca && def !== ca ? [def] : [] };
    }
    if (SPRITE_VERSION_PATHS[activeMode]) {
      const sprite = generationSpritePath(p, activeMode);
      const chain = [sprite, def].filter((url, idx, arr) => url && arr.indexOf(url) === idx);
      return { src: chain[0] || def, fallbacks: chain.slice(1) };
    }
    return { src: def, fallbacks: [] };
  }

  function resolve(p) {
    return resolveForMode(p, currentMode);
  }
```

Expose `resolveForMode`:

```js
    resolve,
    resolveForMode,
```

- [ ] **Step 4: Run artwork tests**

Run: `node --test tests/web/artwork-switcher.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/artwork-switcher.js tests/web/artwork-switcher.test.mjs
git commit -m "feat(web): add generation sprite artwork modes"
```

---

### Task 7: Apply Artwork Modes To Drawer And Full View

**Files:**
- Modify: `web/pokemon-drawer.js`
- Modify: `web/pokemon-full-view.js`
- Modify: `tests/web/pokemon-full-view.test.mjs`

- [ ] **Step 1: Write failing full view test**

In `tests/web/pokemon-full-view.test.mjs`, inside `installBrowserStubs`, add:

```js
  globalThis.PokevaultArtwork = {
    resolve(pokemon) {
      return {
        src: `/sprite/${pokemon.slug}.png`,
        fallbacks: ["/fallback.png"],
      };
    },
    attach(img, resolved) {
      img.src = resolved.src;
      img.dataset.fallbacks = resolved.fallbacks.join(",");
    },
  };
```

Append test:

```js
test("renderInto resolves hero image through artwork switcher", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const hero = root.children.find((child) => child.className === "fullview-hero");
  const imageWrap = hero.children.find((child) => child.className === "fullview-hero__img");
  const img = imageWrap.children[0];
  assert.equal(img.src, "/sprite/0001-bulbasaur.png");
  assert.equal(img.dataset.fallbacks, "/fallback.png");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/pokemon-full-view.test.mjs`

Expected: FAIL because full view uses raw `p.image`.

- [ ] **Step 3: Add shared image helper to full view**

In `web/pokemon-full-view.js`, add:

```js
  function attachPokemonArtwork(img, pokemon) {
    const A = window.PokevaultArtwork;
    if (A?.resolve) {
      const resolved = A.resolve(pokemon);
      if (A.attach) A.attach(img, resolved);
      else if (resolved?.src) img.src = resolved.src;
      return;
    }
    const src = normalizeImgPath(pokemon?.image);
    if (src) img.src = src;
  }
```

Replace hero image assignment:

```js
      attachPokemonArtwork(img, p);
```

Replace form image assignment:

```js
        attachPokemonArtwork(img, f);
```

- [ ] **Step 4: Apply same helper in drawer**

In `web/pokemon-drawer.js`, add:

```js
  function attachPokemonArtwork(img, pokemon) {
    const A = window.PokevaultArtwork;
    if (A?.resolve) {
      const resolved = A.resolve(pokemon);
      if (A.attach) A.attach(img, resolved);
      else if (resolved?.src) img.src = resolved.src;
      return;
    }
    const src = normalizeImgPath(pokemon?.image);
    if (src) img.src = src;
  }
```

Replace drawer header image assignment:

```js
      attachPokemonArtwork(img, p);
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/web/pokemon-full-view.test.mjs tests/web/artwork-switcher.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/pokemon-drawer.js web/pokemon-full-view.js tests/web/pokemon-full-view.test.mjs
git commit -m "feat(web): apply artwork modes to pokemon detail views"
```

---

### Task 8: Add Lightpanda E2E Script

**Files:**
- Create: `tests/e2e/lightpanda-print-placeholders.mjs`
- Modify: `Makefile`

- [ ] **Step 1: Create opt-in E2E script**

Create `tests/e2e/lightpanda-print-placeholders.mjs`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const lightpandaBin = process.env.LIGHTPANDA_BIN || "lightpanda";
const appUrl = process.env.POKEVault_E2E_URL || process.env.POKEVAULT_E2E_URL || "http://127.0.0.1:8765/";
const cdpPort = Number(process.env.LIGHTPANDA_CDP_PORT || "9222");
const cdpUrl = `ws://127.0.0.1:${cdpPort}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCdp() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await wait(100);
  }
  throw new Error("Lightpanda CDP server did not start");
}

function connectCdp() {
  const ws = new WebSocket(cdpUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onerror = reject;
    ws.onopen = () => {
      const send = (method, params = {}) => new Promise((done) => {
        const id = seq += 1;
        pending.set(id, done);
        ws.send(JSON.stringify({ id, method, params }));
      });
      resolve({ ws, send });
    };
  });
}

async function main() {
  const proc = spawn(lightpandaBin, ["serve", "--host", "127.0.0.1", "--port", String(cdpPort)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForCdp();
    const { ws, send } = await connectCdp();
    await send("Target.createTarget", { url: appUrl });
    await wait(1000);
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        location.hash = "#/print";
        return {
          title: document.title,
          hasPrint: Boolean(document.querySelector("#viewPrint")),
          hasGroup: Boolean(document.querySelector("#printGroupSelect")),
          hasOutput: Boolean(document.querySelector("#printOutput"))
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result?.result?.value;
    assert.equal(value.hasPrint, true);
    assert.equal(value.hasGroup, true);
    assert.equal(value.hasOutput, true);
    ws.close();
  } finally {
    proc.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add Makefile target**

Add `lightpanda-e2e` to `.PHONY`, then add under Quality:

```make
lightpanda-e2e: ## Run optional Lightpanda browser workflow checks
	node tests/e2e/lightpanda-print-placeholders.mjs
```

- [ ] **Step 3: Run syntax test**

Run: `node --check tests/e2e/lightpanda-print-placeholders.mjs`

Expected: PASS.

- [ ] **Step 4: Run optional E2E locally only when app and Lightpanda are available**

Terminal 1:

```bash
TRACKER_HOST=127.0.0.1 TRACKER_PORT=8765 uv run python -m tracker
```

Terminal 2:

```bash
LIGHTPANDA_BIN=/tmp/lightpanda POKEVAULT_E2E_URL=http://127.0.0.1:8765/ make lightpanda-e2e
```

Expected: PASS if `/tmp/lightpanda` exists and supports CDP.

- [ ] **Step 5: Commit**

```bash
git add Makefile tests/e2e/lightpanda-print-placeholders.mjs
git commit -m "test(e2e): add optional lightpanda print workflow"
```

---

### Task 9: Full Verification

- [ ] **Step 1: Run web tests**

Run: `make web-test`

Expected: all web tests pass.

- [ ] **Step 2: Run Python tests and lint**

Run: `make check`

Expected: ruff, pytest with tracker coverage, and web tests pass.

- [ ] **Step 3: Run optional Lightpanda check if binary exists**

Run:

```bash
test -x /tmp/lightpanda && LIGHTPANDA_BIN=/tmp/lightpanda make lightpanda-e2e || true
```

Expected: PASS when `/tmp/lightpanda` exists; skipped otherwise.

- [ ] **Step 4: Manually inspect print route**

Run:

```bash
TRACKER_HOST=127.0.0.1 TRACKER_PORT=8765 uv run python -m tracker
```

Open `http://127.0.0.1:8765/#/print`, choose `Placeholders cartes`, and verify:

- placeholder cards appear;
- family reserves are visible;
- image selector changes placeholder image sources;
- missing/caught filters update output;
- browser print preview shows A4 pages.

---

## Self-Review

Spec coverage:

- Shared layout engine: Tasks 1-3.
- Printable placeholders: Task 5.
- Page-aware family placement: Task 2 and Task 4.
- Generation sprite modes visible in app: Tasks 6-7.
- Lightpanda E2E: Task 8.
- Verification: Task 9.

No placeholders:

- Every task has concrete paths, test commands, expected results and commit commands.
- Lightpanda remains opt-in because it requires an external binary and should not break normal `make check`.

Type and naming consistency:

- Engine namespace: `window.PokevaultBinderLayout`.
- Slot property names match the approved spec: `binderId`, `binderName`, `page`, `sheet`, `face`, `slot`, `row`, `col`, `pokemon`, `emptyKind`, `familyId`.
- Empty kinds are exactly `family_reserved` and `capacity_empty`.
- Print group mode is exactly `placeholders`.
