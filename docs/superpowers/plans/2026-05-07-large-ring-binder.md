# Large Ring Binder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Grand classeur 3x3` binder mode that stores the whole collection in one 3x3 ring binder, grouped by region, with each region starting on a new sheet recto and families compacted within each region.

**Architecture:** Keep the backend schema unchanged because binder configs already allow free-form binder objects. Add a new frontend organization marker, `regional_family_album`, handled by the binder layout engine and created by the binder wizard as one physical binder. Reuse existing family slot semantics so `capacity_empty` stays quiet and `family_reserved` remains printable.

**Tech Stack:** Vanilla browser JavaScript modules, Node `node:test` web tests, FastAPI/Pydantic backend passthrough config, static docs/i18n, `make check`.

---

## File Map

- `web/binder-layout-engine.js`: add `regional_family_album` layout mode, region sheet breaks, family compaction per region, and null-preserving ordering.
- `tests/web/binder-layout-engine.test.mjs`: prove the physical slot algorithm: region starts on a new sheet recto, regional forms stay in their form region, and ordering preserves section gaps.
- `web/binder-v2.js`: add wizard organization option, constants, auto-capacity builder, and test exports.
- `tests/web/binder-layouts.test.mjs`: prove the wizard payload creates one 3x3 album with `base_regional` form rule and minimum sheets plus 10 margin.
- `web/i18n.js`: add FR/EN app strings for the new wizard card and summary.
- `docs/assets/i18n.js`, `docs/features.html`, `README.md`, `docs/V1_1_POKEDEX_FIRST.md`: document the new binder type.
- `tests/test_docs_site.py`: add a positive docs assertion for the large ring binder copy.

---

### Task 1: Layout Engine Mode

**Files:**
- Modify: `web/binder-layout-engine.js`
- Test: `tests/web/binder-layout-engine.test.mjs`

- [ ] **Step 1: Write failing test for new-sheet region breaks**

Add this test to `tests/web/binder-layout-engine.test.mjs` after the existing metadata/range tests:

```js
test("regional family album starts each region on a new sheet recto", async () => {
  const api = await loadEngine();
  const defs = [
    { id: "kanto", low: 1, high: 151 },
    { id: "johto", low: 152, high: 251 },
  ];
  const pokemon = [
    { slug: "0001-bulbasaur", number: "0001", region: "kanto" },
    { slug: "0002-ivysaur", number: "0002", region: "kanto" },
    { slug: "0003-venusaur", number: "0003", region: "kanto" },
    { slug: "0152-chikorita", number: "0152", region: "johto" },
  ];
  const familyData = {
    families: [
      { id: "0001-bulbasaur", layout_rows: [["0001-bulbasaur", "0002-ivysaur", "0003-venusaur"]] },
      { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
    ],
  };

  const slots = api.computeBinderSlots({
    binder: {
      id: "grand",
      organization: "regional_family_album",
      rows: 2,
      cols: 2,
      sheet_count: 2,
    },
    pokemon,
    defs,
    familyData,
    includeCapacity: true,
  });

  assert.equal(slots.length, 16);
  assert.deepEqual(
    slots.map((slot) => ({
      page: slot.page,
      sheet: slot.sheet,
      face: slot.face,
      slug: slot.pokemon?.slug || null,
      emptyKind: slot.emptyKind,
    })),
    [
      { page: 1, sheet: 1, face: "R", slug: "0001-bulbasaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: "0002-ivysaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: "0003-venusaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "alignment_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 3, sheet: 2, face: "R", slug: "0152-chikorita", emptyKind: null },
      { page: 3, sheet: 2, face: "R", slug: null, emptyKind: "alignment_empty" },
      { page: 3, sheet: 2, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 3, sheet: 2, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 4, sheet: 2, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 4, sheet: 2, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 4, sheet: 2, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 4, sheet: 2, face: "V", slug: null, emptyKind: "capacity_empty" },
    ],
  );
});
```

- [ ] **Step 2: Write failing test for regional forms staying in their form region**

Add this test in the same file:

```js
test("regional family album keeps regional forms in their form region", async () => {
  const api = await loadEngine();
  const defs = [
    { id: "kanto", low: 1, high: 151 },
    { id: "alola", low: 722, high: 807 },
  ];
  const pokemon = [
    { slug: "0019-rattata", number: "0019", region: "kanto" },
    { slug: "0019-rattata-alola", number: "0019", region: "alola", region_native: false },
  ];
  const familyData = {
    families: [
      { id: "0019-rattata", layout_rows: [["0019-rattata", "0019-rattata-alola"]] },
    ],
  };

  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "grand",
      organization: "regional_family_album",
      rows: 2,
      cols: 2,
      sheet_count: 2,
    },
    pokemon,
    defs,
    familyData,
  });

  assert.deepEqual(
    ordered.map((p) => p?.slug || null),
    [
      "0019-rattata",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "0019-rattata-alola",
      null,
    ],
  );
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
node --test tests/web/binder-layout-engine.test.mjs
```

Expected: both new tests fail because `regional_family_album` is not recognized and no new-sheet region padding exists.

- [ ] **Step 4: Let family layout ignore cross-region missing slugs**

In `web/binder-layout-engine.js`, change the signature of `familyLayoutBlocks`:

```js
  function familyLayoutBlocks(pokemon = [], familyData = null, cols = 3, options = {}) {
```

At the start of the function, after `const bySlug = new Map(); ...`, add:

```js
    const reserveMissingSlugs = options.reserveMissingSlugs !== false;
```

Inside the raw row loop, replace the current missing-pokemon branch:

```js
          if (!p || emitted.has(slug)) {
            row.push(familyReservedItem(familyId));
            continue;
          }
```

with:

```js
          if (!p || emitted.has(slug)) {
            if (reserveMissingSlugs) row.push(familyReservedItem(familyId));
            continue;
          }
```

This keeps existing binder behavior by default. The new album mode will pass
`{ reserveMissingSlugs: false }` so Rattata d'Alola does not reserve a phantom
Kanto Rattata slot in the Alola section.

- [ ] **Step 5: Implement the layout helpers**

In `web/binder-layout-engine.js`, add these helpers after `flattenFamilyBlocksPageAware`:

```js
  function isRegionalFamilyAlbum(binder = {}) {
    return binder.organization === "regional_family_album";
  }

  function padToNextSheetRecto(items, layout) {
    const perSheet = Math.max(1, layout.perPage * 2);
    const remainder = items.length % perSheet;
    if (remainder === 0) return;
    const missing = perSheet - remainder;
    for (let i = 0; i < missing; i += 1) {
      items.push(capacityItem());
    }
  }

  function regionalFamilyAlbumItems(pokemon = [], defs = [], familyData = null, layout) {
    const regions = Array.isArray(defs) ? defs.filter((r) => r && r.id) : [];
    if (!regions.length) {
      if (familyData && Array.isArray(familyData.families)) {
        return flattenFamilyBlocksPageAware(
          familyLayoutBlocks(pokemon, familyData, layout.cols),
          layout,
        );
      }
      return sortNational(pokemon).map((p) => pokemonItem(p));
    }

    const out = [];
    for (const region of regions) {
      const regionId = String(region.id || "");
      const regionPokemon = pokemon.filter((p) => effectiveRegionId(p, defs) === regionId);
      if (!regionPokemon.length) continue;
      if (out.length > 0) padToNextSheetRecto(out, layout);
      const regionItems =
        familyData && Array.isArray(familyData.families)
          ? flattenFamilyBlocksPageAware(
              familyLayoutBlocks(regionPokemon, familyData, layout.cols, {
                reserveMissingSlugs: false,
              }),
              layout,
            )
          : sortNational(regionPokemon).map((p) => pokemonItem(p));
      out.push(...regionItems);
    }
    return out;
  }
```

- [ ] **Step 6: Route `basicItemsForBinder` through the new mode**

In `basicItemsForBinder`, before the existing `org === "family"` branch, add:

```js
    if (isRegionalFamilyAlbum(binder)) {
      return regionalFamilyAlbumItems(scoped, defs, familyData, layout);
    }
```

Keep the existing `family` and national/regional behavior unchanged.

- [ ] **Step 7: Preserve physical gaps in `orderPokemonForBinder`**

Change the `family` condition in `orderPokemonForBinder`:

```js
    if (binder.organization === "family" || isRegionalFamilyAlbum(binder)) {
      return slots.map((slot) => slot.pokemon || null);
    }
```

- [ ] **Step 8: Export helpers for tests**

In `window.PokevaultBinderLayout._test`, add:

```js
      isRegionalFamilyAlbum,
      padToNextSheetRecto,
      regionalFamilyAlbumItems,
```

- [ ] **Step 9: Run tests and commit**

Run:

```bash
node --test tests/web/binder-layout-engine.test.mjs
```

Expected: all tests in `binder-layout-engine.test.mjs` pass.

Commit:

```bash
git add web/binder-layout-engine.js tests/web/binder-layout-engine.test.mjs
git commit -m "feat(web): add regional family album layout"
```

---

### Task 2: Wizard Payload And Auto Capacity

**Files:**
- Modify: `web/binder-v2.js`
- Test: `tests/web/binder-layouts.test.mjs`

- [ ] **Step 1: Write failing test for auto-capacity payload**

Add this test near the regional/family workspace tests in `tests/web/binder-layouts.test.mjs`:

```js
test("large ring binder workspace creates one 3x3 regional family album with margin", async () => {
  const api = await loadModule();
  const defs = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];
  const pokemon = [
    ...makePokemon(10, "kanto"),
    { slug: "0152-chikorita", number: "0152", region: "johto" },
  ];
  const families = {
    families: [
      { id: "0001-pokemon-1", layout_rows: [["0001-pokemon-1", "0002-pokemon-2", "0003-pokemon-3"]] },
      { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
    ],
  };

  const result = api.buildLargeRingBinderWorkspace(
    {
      name: "Grand classeur",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    },
    defs,
    pokemon,
    families,
    "test",
  );

  assert.equal(result.configBody.binders.length, 1);
  assert.deepEqual(result.placementsBody.by_binder, { "classeur-test-grand-3x3": {} });
  assert.equal(result.configBody.binders[0].id, "classeur-test-grand-3x3");
  assert.equal(result.configBody.binders[0].name, "Grand classeur");
  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
  assert.equal(result.configBody.binders[0].rows, 3);
  assert.equal(result.configBody.binders[0].cols, 3);
  assert.equal(result.configBody.binders[0].sheet_count, 12);
  assert.equal(result.configBody.binders[0].form_rule_id, "wizard-forms-base_regional");
  assert.deepEqual(result.configBody.binders[0].layout_options, {
    region_break: "new_sheet",
    family_compact: true,
    auto_capacity: true,
    margin_sheets: 10,
  });
});
```

Why `sheet_count` is `12`: Kanto occupies sheet 1, Johto starts at sheet 2, so minimum is 2 sheets, plus 10 margin sheets.

- [ ] **Step 2: Write failing test for draft dispatch**

Add this test in the same file:

```js
test("buildPersistNewPayloadsFromDraft dispatches the large ring binder mode", async () => {
  const api = await loadModule();
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") {
      return {
        ok: true,
        async json() {
          return {
            meta: {
              regions: [
                { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
                { id: "johto", label_fr: "Johto", low: 152, high: 251 },
              ],
            },
            pokemon: [
              { slug: "0001-bulbasaur", number: "0001", region: "kanto" },
              { slug: "0152-chikorita", number: "0152", region: "johto" },
            ],
          };
        },
      };
    }
    if (url === "/data/evolution-families.json") {
      return {
        ok: true,
        async json() {
          return {
            families: [
              { id: "0001-bulbasaur", layout_rows: [["0001-bulbasaur"]] },
              { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
            ],
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await api.buildPersistNewPayloadsFromDraft({
    name: "Grand classeur",
    organization: "regional_family_album",
    formScope: "base_regional",
    rows: 3,
    cols: 3,
    sheetCount: 1,
  });

  assert.equal(result.configBody.binders.length, 1);
  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
node --test tests/web/binder-layouts.test.mjs
```

Expected: failures for missing `buildLargeRingBinderWorkspace` export and missing dispatch.

- [ ] **Step 4: Add constants and organization normalization**

Near `DEFAULT_FORM_SCOPE` in `web/binder-v2.js`, add:

```js
const ORG_REGIONAL_FAMILY_ALBUM = "regional_family_album";
const LARGE_RING_MARGIN_SHEETS = 10;
```

Update `readOrgSelectionFromDom`:

```js
  if (org === "by_region" || org === "family" || org === ORG_REGIONAL_FAMILY_ALBUM) return org;
```

Update `buildPersistNewPayloads` and `buildPersistEditPayloads` organization normalization anywhere it currently checks only `by_region` and `family`:

```js
  const org =
    draft.organization === "by_region" ||
    draft.organization === "family" ||
    draft.organization === ORG_REGIONAL_FAMILY_ALBUM
      ? draft.organization
      : "national";
```

- [ ] **Step 5: Add auto-capacity helpers**

Add these functions before `buildRegionalBinderWorkspace`:

```js
function autoSheetCountForLargeRing(selectedPokemon, defs, familyData) {
  const engine = window.PokevaultBinderLayout;
  const rows = 3;
  const cols = 3;
  const perSheet = rows * cols * 2;
  if (!engine?.computeBinderSlots) {
    return LARGE_RING_MARGIN_SHEETS + 1;
  }
  const slots = engine.computeBinderSlots({
    binder: {
      organization: ORG_REGIONAL_FAMILY_ALBUM,
      rows,
      cols,
      sheet_count: 1,
    },
    pokemon: selectedPokemon,
    defs,
    familyData,
    includeCapacity: false,
  });
  const usedSlots = Array.isArray(slots) ? slots.length : selectedPokemon.length;
  const minimumSheets = Math.max(1, Math.ceil(usedSlots / perSheet));
  return minimumSheets + LARGE_RING_MARGIN_SHEETS;
}

function buildLargeRingBinderWorkspace(draft, defs, pokemon, familyData, seed = Date.now().toString(36)) {
  const scope = normalizeFormScope(draft.formScope || "base_regional");
  const formRule = formRuleFromScope(scope);
  const selectedPokemon = selectBinderPokemonPool(Array.isArray(pokemon) ? pokemon : [], formRule);
  const sheetCount = autoSheetCountForLargeRing(selectedPokemon, defs, familyData);
  const id = `classeur-${seed}-grand-3x3`;
  return {
    configBody: {
      version: 1,
      convention: "sheet_recto_verso",
      binders: [
        {
          id,
          name: draft.name || "Grand classeur",
          cols: 3,
          rows: 3,
          sheet_count: sheetCount,
          form_rule_id: formRule.id,
          organization: ORG_REGIONAL_FAMILY_ALBUM,
          layout_options: {
            region_break: "new_sheet",
            family_compact: true,
            auto_capacity: true,
            margin_sheets: LARGE_RING_MARGIN_SHEETS,
          },
        },
      ],
      form_rules: [formRule],
    },
    placementsBody: {
      version: 1,
      by_binder: {
        [id]: {},
      },
    },
  };
}
```

- [ ] **Step 6: Dispatch from `buildPersistNewPayloadsFromDraft`**

In `buildPersistNewPayloadsFromDraft`, add this branch before `by_region`:

```js
  if (draft.organization === ORG_REGIONAL_FAMILY_ALBUM) {
    const { defs, pokemon } = await fetchPokedexBinderData();
    const familyData = await ensureEvolutionFamiliesLoaded();
    return buildLargeRingBinderWorkspace(draft, defs, pokemon, familyData);
  }
```

- [ ] **Step 7: Export test helpers**

In `window.PokedexBinder._test`, add:

```js
    autoSheetCountForLargeRing,
    buildLargeRingBinderWorkspace,
    buildPersistNewPayloadsFromDraft,
```

- [ ] **Step 8: Run tests and commit**

Run:

```bash
node --test tests/web/binder-layouts.test.mjs
```

Expected: all tests in `binder-layouts.test.mjs` pass.

Commit:

```bash
git add web/binder-v2.js tests/web/binder-layouts.test.mjs
git commit -m "feat(web): create large ring binder workspace"
```

---

### Task 3: Wizard UI Copy And Selection

**Files:**
- Modify: `web/binder-v2.js`
- Modify: `web/i18n.js`
- Test: `tests/web/binder-layouts.test.mjs`

- [ ] **Step 1: Write failing test for organization inference**

Add this test to `tests/web/binder-layouts.test.mjs`:

```js
test("prefill keeps large ring binder organization distinct from regional binders", async () => {
  const api = await loadModule();
  const cfg = {
    binders: [
      {
        id: "grand",
        name: "Grand classeur",
        organization: "regional_family_album",
        rows: 3,
        cols: 3,
        sheet_count: 42,
        form_rule_id: "wizard-forms-base_regional",
      },
    ],
    form_rules: [api.formRuleFromScope("base_regional")],
  };

  const draft = api.draftFromConfigForTest(cfg, "grand");

  assert.equal(draft.organization, "regional_family_album");
  assert.equal(draft.formatPreset, "large-ring-3x3");
  assert.equal(draft.formScope, "base_regional");
  assert.equal(draft.rows, 3);
  assert.equal(draft.cols, 3);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test tests/web/binder-layouts.test.mjs
```

Expected: failure because `draftFromConfigForTest` and `large-ring-3x3` do not exist yet.

- [ ] **Step 3: Add i18n fallback strings**

In `BINDER_WIZARD_FALLBACK_I18N` in `web/binder-v2.js`, add:

```js
  "binder_wizard.org.large_ring.title": "Grand classeur 3x3",
  "binder_wizard.org.large_ring.desc": "Un seul classeur a anneaux: regions au recto d'un nouveau feuillet, familles compactes, capacite calculee.",
  "binder_wizard.format.large_ring.title": "Auto 3 x 3",
  "binder_wizard.format.large_ring.desc": "3 x 3 recto-verso, feuillets calcules pour tout faire rentrer + 10 feuillets libres.",
  "binder_wizard.summary.org_large_ring": "Grand classeur 3x3: regions au recto, familles compactes",
  "binder_wizard.summary.preset_large_ring": "3 x 3 auto + 10 feuillets libres",
  "binder_wizard.summary.large_ring_name": "Un seul grand classeur physique, organise par regions internes.",
```

Add matching FR/EN keys in `web/i18n.js`. French values should use the same wording as above with accents. English values:

```js
"binder_wizard.org.large_ring.title": "Large 3x3 ring binder",
"binder_wizard.org.large_ring.desc": "One ring binder: each region starts on a new sheet front, families stay compact, capacity is calculated.",
"binder_wizard.format.large_ring.title": "Auto 3 x 3",
"binder_wizard.format.large_ring.desc": "3 x 3 front/back sheets, calculated to fit everything + 10 spare sheets.",
"binder_wizard.summary.org_large_ring": "Large 3x3 binder: regions on sheet fronts, compact families",
"binder_wizard.summary.preset_large_ring": "Auto 3 x 3 + 10 spare sheets",
"binder_wizard.summary.large_ring_name": "One physical ring binder, organized with internal region sections.",
```

- [ ] **Step 4: Render the new organization card**

In the organization step grid in `renderWizardStep`, append the fourth card:

```js
      mkOrg(
        ORG_REGIONAL_FAMILY_ALBUM,
        tBinderWizard("binder_wizard.org.large_ring.title"),
        tBinderWizard("binder_wizard.org.large_ring.desc"),
      ),
```

When this card is clicked, keep the generic `wizardDraft.organization = org` assignment and additionally force the recommended defaults:

```js
        if (org === ORG_REGIONAL_FAMILY_ALBUM) {
          wizardDraft.formScope = "base_regional";
          wizardDraft.formatPreset = "large-ring-3x3";
          wizardDraft.rows = 3;
          wizardDraft.cols = 3;
        }
```

Place that block inside the existing `btn.addEventListener("click", ...)` in `mkOrg`.

- [ ] **Step 5: Recognize the large-ring format preset**

Update `inferFormatPreset`:

```js
  if (r === 3 && c === 3 && s > 10) return "large-ring-3x3";
```

Update `readFormatSelectionFromDom`:

```js
  if (key === "large-ring-3x3") {
    wizardDraft.rows = 3;
    wizardDraft.cols = 3;
    return true;
  }
```

In the format step, add a fourth format card. The card should be selected when `wizardDraft.formatPreset === "large-ring-3x3"`:

```js
      mkFmt(
        "large-ring-3x3",
        tBinderWizard("binder_wizard.format.large_ring.title"),
        tBinderWizard("binder_wizard.format.large_ring.desc"),
      ),
```

When this format is clicked, set:

```js
        } else if (key === "large-ring-3x3") {
          wizardDraft.rows = 3;
          wizardDraft.cols = 3;
          wizardDraft.organization = ORG_REGIONAL_FAMILY_ALBUM;
          wizardDraft.formScope = "base_regional";
```

- [ ] **Step 6: Summarize the new mode correctly**

Update summary labels in `renderWizardStep`:

```js
      wizardDraft.organization === ORG_REGIONAL_FAMILY_ALBUM
        ? tBinderWizard("binder_wizard.summary.org_large_ring")
        : wizardDraft.organization === "family"
```

Update preset label:

```js
      wizardDraft.formatPreset === "large-ring-3x3"
        ? tBinderWizard("binder_wizard.summary.preset_large_ring")
        : wizardDraft.formatPreset === "3x3-10"
```

Update `nameRecap` before the family branch:

```js
      wizardDraft.organization === ORG_REGIONAL_FAMILY_ALBUM && !wizardDraft.editBinderId
        ? tBinderWizard("binder_wizard.summary.large_ring_name")
        : wizardDraft.organization === "family" && !wizardDraft.editBinderId
```

- [ ] **Step 7: Add a test-only draft helper**

Add this function near `prefillWizardDraftFromConfig`:

```js
function draftFromConfigForTest(cfg, binderIdOpt = null) {
  const previous = { ...wizardDraft };
  prefillWizardDraftFromConfig(cfg, binderIdOpt);
  const out = { ...wizardDraft };
  wizardDraft = previous;
  return out;
}
```

Update `prefillWizardDraftFromConfig` organization inference:

```js
  const org = b.organization === ORG_REGIONAL_FAMILY_ALBUM
    ? ORG_REGIONAL_FAMILY_ALBUM
    : b.organization === "family"
      ? "family"
      : hasScope
        ? "national"
        : b.organization === "by_region"
          ? "by_region"
          : "national";
```

Export `draftFromConfigForTest` in `_test`.

- [ ] **Step 8: Run tests and commit**

Run:

```bash
node --test tests/web/binder-layouts.test.mjs
```

Expected: all tests pass.

Commit:

```bash
git add web/binder-v2.js web/i18n.js tests/web/binder-layouts.test.mjs
git commit -m "feat(web): expose large ring binder wizard option"
```

---

### Task 4: Print And Binder View Regression Coverage

**Files:**
- Modify: `tests/web/print-view.test.mjs`
- Verify: `web/print-view.js`
- Verify: `web/binder-collection-view.js`

- [ ] **Step 1: Write print regression test**

Add this test to `tests/web/print-view.test.mjs` after `placeholder section skips alignment empties`:

```js
test("small binder cards skip large-ring region sheet gaps", async () => {
  const api = await loadModule();
  const binder = {
    id: "grand",
    name: "Grand classeur",
    organization: "regional_family_album",
    rows: 2,
    cols: 2,
    sheet_count: 2,
  };
  const caughtMap = {};
  const slots = [
    { pokemon: { slug: "0001-bulbasaur", number: "0001", names: { fr: "Bulbizarre" } }, emptyKind: null, page: 1, sheet: 1, face: "R", slot: 1 },
    { pokemon: null, emptyKind: "alignment_empty", page: 1, sheet: 1, face: "R", slot: 2 },
    { pokemon: null, emptyKind: "capacity_empty", page: 2, sheet: 1, face: "V", slot: 1 },
    { pokemon: null, emptyKind: "capacity_empty", page: 2, sheet: 1, face: "V", slot: 2 },
    { pokemon: { slug: "0152-chikorita", number: "0152", names: { fr: "Germignon" } }, emptyKind: null, page: 3, sheet: 2, face: "R", slot: 1 },
  ];

  const section = api.buildPlaceholderSection(binder, slots, caughtMap, "all", "");

  assert.deepEqual(
    section.pages.flatMap((page) => page.slots.map((slot) => slot.title)),
    ["Bulbizarre", "Germignon"],
  );
});
```

- [ ] **Step 2: Run print tests**

Run:

```bash
node --test tests/web/print-view.test.mjs
```

Expected: pass without production changes because `buildPlaceholderSection` already skips `capacity_empty` and `alignment_empty`.

- [ ] **Step 3: Run binder collection tests**

Run:

```bash
node --test tests/web/binder-collection-view.test.mjs
```

Expected: pass without production changes. The large ring binder has no `region_scope`, so the existing single-binder path remains active.

- [ ] **Step 4: Commit**

Run:

```bash
node --test tests/web/print-view.test.mjs tests/web/binder-collection-view.test.mjs
```

Expected: both suites pass.

Commit:

```bash
git add tests/web/print-view.test.mjs
git commit -m "test(web): cover large ring binder printing"
```

---

### Task 5: Product Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `docs/assets/i18n.js`
- Modify: `docs/V1_1_POKEDEX_FIRST.md`
- Test: `tests/test_docs_site.py`

- [ ] **Step 1: Write failing docs test**

Add this test to `tests/test_docs_site.py` near other binder documentation tests:

```python
def test_large_ring_binder_mode_is_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")
    backlog = (DOCS / "V1_1_POKEDEX_FIRST.md").read_text(encoding="utf-8")

    for text in [readme, features, i18n, backlog]:
        assert "Grand classeur 3" in text or "large 3" in text.lower()
        assert "recto" in text.lower() or "sheet front" in text.lower()
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_large_ring_binder_mode_is_documented -q
```

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update README binder section**

In `README.md`, add a short paragraph after the existing binder planning format paragraph:

```md
The `Grand classeur 3x3` mode is for a large ring binder with 3x3
front/back sheets. It keeps one physical binder, groups Pokemon by the app's
region sections, starts each region on a new sheet front, compacts evolution
families within each region, and auto-calculates the required sheet count with
10 spare sheets.
```

- [ ] **Step 4: Update public feature copy**

In `docs/features.html`, update the binder feature paragraph to mention:

```html
Grand classeur 3x3 for one large ring binder, region sections that start on a
new sheet front, compact families per region and auto capacity with 10 spare
sheets.
```

In `docs/assets/i18n.js`, add the same concept to both `features.binders.text` values:

French phrase:

```js
"Grand classeur 3x3 pour un gros classeur a anneaux: regions au recto d'un nouveau feuillet, familles compactes par region et capacite auto avec 10 feuillets libres."
```

English phrase:

```js
"Large 3x3 ring binder mode for one physical binder: region sections start on a new sheet front, families stay compact per region and capacity includes 10 spare sheets."
```

- [ ] **Step 5: Update backlog/design docs**

In `docs/V1_1_POKEDEX_FIRST.md`, add a binder bullet under the binder section:

```md
- Grand classeur 3x3: one ring binder, internal region sections, each region
  starts on a sheet front, families compact per region, regional forms stay in
  their form region, and capacity is calculated with 10 spare sheets.
```

- [ ] **Step 6: Run docs tests and commit**

Run:

```bash
uv run pytest tests/test_docs_site.py -q
```

Expected: docs tests pass.

Commit:

```bash
git add README.md docs/features.html docs/assets/i18n.js docs/V1_1_POKEDEX_FIRST.md tests/test_docs_site.py
git commit -m "docs: document large ring binder mode"
```

---

### Task 6: Full Verification And Final Commit Hygiene

**Files:**
- Verify all changed files

- [ ] **Step 1: Run targeted JS tests**

Run:

```bash
node --test tests/web/binder-layout-engine.test.mjs tests/web/binder-layouts.test.mjs tests/web/print-view.test.mjs tests/web/binder-collection-view.test.mjs
```

Expected: all targeted web tests pass.

- [ ] **Step 2: Run full project check**

Run:

```bash
make check
```

Expected:

- Ruff: `All checks passed!`
- Python tests: all pass with tracker coverage at `100.00%`
- Node web tests: all pass

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short --branch
git log --oneline -6
```

Expected:

- working tree clean after commits;
- branch contains the existing simplification commits plus the new large ring binder commits.

- [ ] **Step 4: Prepare final summary**

Report:

- new `Grand classeur 3x3` option added;
- one physical binder, internal region sections;
- region starts at sheet recto;
- families compact per region;
- regional forms live in their form region;
- auto capacity + 10 spare sheets;
- verification output from `make check`.
