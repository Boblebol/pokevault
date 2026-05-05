# Binder Discoverability And Compact Families Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sprite, binder-size and small-print-card workflows findable, and compact family binder rows without printing alignment-only empties.

**Architecture:** Keep the current frontend-only binder architecture. Update `web/binder-layout-engine.js` as the single source for family slot layout, then let binder and print views consume the new `alignment_empty` slot type. Polish visible labels and documentation without changing backend schemas.

**Tech Stack:** Vanilla browser JavaScript, Node `node:test` web tests, Python pytest docs checks, existing i18n dictionaries.

---

## File Map

- Modify `web/binder-layout-engine.js`: change family row construction and flattening to support compact row packing plus `alignment_empty`.
- Modify `tests/web/binder-layout-engine.test.mjs`: add RED tests for Spoink/Groret/Spinda packing, Ptitard/Tarpaud alignment, and `alignment_empty`.
- Modify `web/print-view.js`: skip `alignment_empty` in printable card placeholders.
- Modify `tests/web/print-view.test.mjs`: add RED test that print placeholders skip `alignment_empty`.
- Modify `web/binder-collection-view.js`: render `alignment_empty` as a quiet empty cell with a dedicated class.
- Modify `web/styles.css`: make `alignment_empty` visibly quieter than family reservations.
- Modify `tests/web/binder-collection-view.test.mjs`: assert `alignment_empty` renders with empty-slot copy and the quiet class.
- Modify `web/i18n.js`: update FR/EN labels for image selector, print small fiches and binder settings.
- Modify `web/binder-v2.js`: update fallback copy for binder settings and family summaries.
- Modify `web/index.html`: update static visible text and in-app docs copy.
- Modify `docs/features.html` and `docs/assets/i18n.js`: update public docs copy.
- Modify `README.md`: document exact navigation paths.
- Modify `tests/test_docs_site.py`: assert docs mention generation sprites, binder settings and small binder fiches.

## Task 1: Compact Family Layout Engine

**Files:**
- Modify: `tests/web/binder-layout-engine.test.mjs`
- Modify: `web/binder-layout-engine.js`

- [ ] **Step 1: Write failing layout tests**

Append these tests to `tests/web/binder-layout-engine.test.mjs`:

```js
test("family layout packs a complete solo family into remaining row cells", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0325-spoink", number: "0325" },
      { slug: "0326-grumpig", number: "0326" },
      { slug: "0327-spinda", number: "0327" },
    ],
    familyData: {
      families: [
        { id: "0325-spoink", layout_rows: [["0325-spoink", "0326-grumpig"]] },
        { id: "0327-spinda", layout_rows: [["0327-spinda"]] },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(0, 3).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind]),
    [
      ["0325-spoink", null],
      ["0326-grumpig", null],
      ["0327-spinda", null],
    ],
  );
});

test("family layout closes a short branch row when the next family row cannot fit", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0060-poliwag", number: "0060" },
      { slug: "0061-poliwhirl", number: "0061" },
      { slug: "0062-poliwrath", number: "0062" },
      { slug: "0186-politoed", number: "0186" },
      { slug: "0063-abra", number: "0063" },
      { slug: "0064-kadabra", number: "0064" },
      { slug: "0065-alakazam", number: "0065" },
    ],
    familyData: {
      families: [
        {
          id: "0060-poliwag",
          layout_rows: [
            ["0060-poliwag", "0061-poliwhirl", "0062-poliwrath"],
            ["0186-politoed"],
          ],
        },
        {
          id: "0063-abra",
          layout_rows: [["0063-abra", "0064-kadabra", "0065-alakazam"]],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(0, 9).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0060-poliwag", null, "0060-poliwag"],
      ["0061-poliwhirl", null, "0060-poliwag"],
      ["0062-poliwrath", null, "0060-poliwag"],
      ["0186-politoed", null, "0060-poliwag"],
      [null, "alignment_empty", null],
      [null, "alignment_empty", null],
      ["0063-abra", null, "0063-abra"],
      ["0064-kadabra", null, "0063-abra"],
      ["0065-alakazam", null, "0063-abra"],
    ],
  );
});
```

- [ ] **Step 2: Run the engine tests and confirm RED**

Run:

```bash
node --test tests/web/binder-layout-engine.test.mjs
```

Expected: the new tests fail because `0327-spinda` is placed on the next row and no slot emits `alignment_empty`.

- [ ] **Step 3: Implement `alignment_empty` and compact row packing**

In `web/binder-layout-engine.js`, add a new item constructor near `capacityItem()` and `familyReservedItem()`:

```js
function alignmentEmptyItem() {
  return { pokemon: null, emptyKind: "alignment_empty", familyId: null };
}
```

Replace `padRowToColumns` and `chunkRowToColumns` with width-preserving family rows:

```js
function padRowToColumns(row, cols, familyId, emptyKind = "family_reserved") {
  const out = row.slice(0, cols);
  while (out.length < cols) {
    if (emptyKind === "capacity_empty") out.push(capacityItem());
    else if (emptyKind === "alignment_empty") out.push(alignmentEmptyItem());
    else out.push(familyReservedItem(familyId));
  }
  return out;
}

function chunkRowToColumns(row, cols) {
  const chunks = [];
  const width = positiveInt(cols, 3);
  for (let start = 0; start < row.length; start += width) {
    chunks.push(row.slice(start, start + width));
  }
  return chunks.length ? chunks : [[]];
}
```

In `familyLayoutBlocks`, keep explicit `null` values as `family_reserved`, but stop padding every short family row:

```js
blockRows.push(...chunkRowToColumns(row, cols));
```

For leftovers, create one-cell rows:

```js
rows: [[pokemonItem(p, String(p.slug || ""))]],
```

Replace `flattenFamilyBlocksPageAware` with compact row placement:

```js
function flattenFamilyBlocksPageAware(blocks = [], layout) {
  const out = [];
  let rowInPage = 0;
  let currentRow = [];

  const flushRow = (emptyKind = "alignment_empty") => {
    if (!currentRow.length) return;
    out.push(...padRowToColumns(currentRow, layout.cols, null, emptyKind));
    currentRow = [];
    rowInPage = (rowInPage + 1) % layout.rows;
  };

  const fillPageWithCapacity = () => {
    flushRow("alignment_empty");
    while (rowInPage > 0) {
      out.push(...padRowToColumns([], layout.cols, null, "capacity_empty"));
      rowInPage = (rowInPage + 1) % layout.rows;
    }
  };

  const remainingCells = () => layout.cols - currentRow.length;

  for (const block of blocks) {
    const blockRows = (block.rows || []).filter((row) => Array.isArray(row));
    if (!blockRows.length) continue;

    const firstRow = blockRows[0];
    if (currentRow.length && firstRow.length > remainingCells()) {
      flushRow("alignment_empty");
    }

    if (
      !currentRow.length &&
      rowInPage > 0 &&
      blockRows.length <= layout.rows &&
      rowInPage + blockRows.length > layout.rows
    ) {
      fillPageWithCapacity();
    }

    for (let i = 0; i < blockRows.length; i += 1) {
      const row = blockRows[i];
      if (currentRow.length && row.length > remainingCells()) {
        flushRow("alignment_empty");
      }
      currentRow.push(...row);
      if (currentRow.length >= layout.cols) {
        flushRow("alignment_empty");
      } else if (i < blockRows.length - 1) {
        flushRow("alignment_empty");
      }
    }
  }

  flushRow("alignment_empty");
  return out;
}
```

- [ ] **Step 4: Run the engine tests and confirm GREEN**

Run:

```bash
node --test tests/web/binder-layout-engine.test.mjs
```

Expected: all tests in `binder-layout-engine.test.mjs` pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add web/binder-layout-engine.js tests/web/binder-layout-engine.test.mjs
git commit -m "feat(web): compact family binder rows"
```

Expected: a commit containing only the layout engine and its tests.

## Task 2: Print And Binder View Handling For Alignment Empties

**Files:**
- Modify: `tests/web/print-view.test.mjs`
- Modify: `web/print-view.js`
- Modify: `tests/web/binder-collection-view.test.mjs`
- Modify: `web/binder-collection-view.js`
- Modify: `web/styles.css`

- [ ] **Step 1: Write failing print test**

In `tests/web/print-view.test.mjs`, add an `alignment_empty` slot to the existing placeholder-slot test fixture or add this focused test near the placeholder section tests:

```js
test("placeholder section skips alignment empties", async () => {
  const api = await loadModule();
  const slots = [
    ...placeholderSlots(),
    {
      binderId: "kanto",
      binderName: "Kanto",
      page: 1,
      sheet: 1,
      face: "R",
      slot: 3,
      row: 1,
      col: 3,
      pokemon: null,
      emptyKind: "alignment_empty",
      familyId: null,
    },
  ];

  const section = api.buildPlaceholderSection(
    { id: "kanto", name: "Kanto", rows: 1, cols: 3 },
    slots,
    {},
    "all",
    "",
  );

  assert.deepEqual(
    section.pages[0].slots.map((slot) => slot.emptyKind),
    [null, "family_reserved"],
  );
});
```

- [ ] **Step 2: Run print tests and confirm RED**

Run:

```bash
node --test tests/web/print-view.test.mjs
```

Expected: the new test fails because `alignment_empty` is included in placeholder output.

- [ ] **Step 3: Skip alignment empties in print placeholders**

In `web/print-view.js`, change the skip guard inside `buildPlaceholderSection` from:

```js
if (!rawSlot || rawSlot.emptyKind === "capacity_empty") continue;
```

to:

```js
if (
  !rawSlot ||
  rawSlot.emptyKind === "capacity_empty" ||
  rawSlot.emptyKind === "alignment_empty"
) {
  continue;
}
```

- [ ] **Step 4: Run print tests and confirm GREEN**

Run:

```bash
node --test tests/web/print-view.test.mjs
```

Expected: all print view tests pass.

- [ ] **Step 5: Write failing binder-view test for quiet alignment empties**

In `tests/web/binder-collection-view.test.mjs`, add this test after `binder shell creates a visible family reserved card`:

```js
test("binder grid renders alignment empty as quiet empty slot", async () => {
  const api = await loadModule();
  const card = api.createReservedSlotCard({
    emptyKind: "alignment_empty",
    familyId: null,
    slot: 2,
  });

  assert.equal(card.dataset.emptyKind, "alignment_empty");
  assert.equal(card.dataset.familyId, "");
  assert.equal(card.className.includes("card--alignment-empty"), true);
  assert.ok(String(card.textContent || "").includes("Emplacement vide"));
  assert.equal(String(card.textContent || "").includes("Reserve famille"), false);
});
```

- [ ] **Step 6: Run binder collection tests and confirm RED**

Run:

```bash
node --test tests/web/binder-collection-view.test.mjs
```

Expected: the new test fails because `card--alignment-empty` is not emitted yet.

- [ ] **Step 7: Add quiet alignment class and styling**

In `web/binder-collection-view.js`, update `createReservedSlotCard()` immediately after `card.className = "card card--reserved-slot binder-card";`:

```js
if (slot?.emptyKind === "alignment_empty") {
  card.classList.add("card--alignment-empty");
}
```

Keep the label branch so only `family_reserved` gets reserved-family copy:

```js
label.textContent = tBinderShell(
  slot?.emptyKind === "family_reserved"
    ? "binder_shell.reserved_family"
    : "binder_shell.empty_slot",
);
```

In `web/styles.css`, add this block after `.card--reserved-slot`:

```css
.card--alignment-empty {
  opacity: 0.58;
  background: color-mix(in srgb, var(--surface-low) 58%, transparent);
}
```

- [ ] **Step 8: Run Task 2 tests and confirm GREEN**

Run:

```bash
node --test tests/web/print-view.test.mjs tests/web/binder-collection-view.test.mjs
```

Expected: both test files pass.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add web/print-view.js tests/web/print-view.test.mjs web/binder-collection-view.js tests/web/binder-collection-view.test.mjs web/styles.css
git commit -m "fix(web): skip alignment empties in print placeholders"
```

Expected: a commit containing print/binder handling and tests.

## Task 3: Visible Labels For Sprites, Binder Format And Small Fiches

**Files:**
- Modify: `web/i18n.js`
- Modify: `web/binder-v2.js`
- Modify: `web/index.html`
- Modify: `tests/web/i18n.test.mjs`

- [ ] **Step 1: Write failing i18n assertions**

In `tests/web/i18n.test.mjs`, add assertions to the existing FR/EN dictionary test:

```js
assert.equal(api.t("app.settings.artwork"), "Images / sprites");
assert.equal(api.t("app.settings.artwork", {}, "en"), "Images / sprites");
assert.equal(api.t("app.print.placeholders"), "Petites fiches classeur");
assert.equal(api.t("app.print.placeholders", {}, "en"), "Small binder cards");
assert.equal(api.t("app.binders.settings"), "Modifier format");
assert.equal(api.t("app.binders.settings", {}, "en"), "Edit format");
```

- [ ] **Step 2: Run i18n tests and confirm RED**

Run:

```bash
node --test tests/web/i18n.test.mjs
```

Expected: assertions fail on the old labels.

- [ ] **Step 3: Update app i18n labels**

In `web/i18n.js`, update both FR and EN dictionaries:

```js
"app.binders.settings": "Modifier format",
"app.print.placeholders": "Petites fiches classeur",
"app.settings.artwork": "Images / sprites",
"app.docs.binders.family": "Le mode Familles compacte les familles courtes quand elles tiennent sur la même ligne, tout en gardant les branches lisibles avec des vides discrets non imprimés.",
```

For EN:

```js
"app.binders.settings": "Edit format",
"app.print.placeholders": "Small binder cards",
"app.settings.artwork": "Images / sprites",
"app.docs.binders.family": "Family mode compacts short families when they fit on the same row, while keeping branches readable with discrete non-printable alignment empties.",
```

- [ ] **Step 4: Update static HTML fallback labels**

In `web/index.html`, update the literal fallback text:

```html
<button type="button" class="binder-refresh binder-refresh--ghost" id="binderWizardSettings" hidden data-i18n="app.binders.settings">Modifier format</button>
```

```html
<option value="placeholders" data-i18n="app.print.placeholders">Petites fiches classeur</option>
```

```html
<span class="region-filter-label" data-i18n="app.settings.artwork">Images / sprites</span>
```

Update the in-app docs list item fallback for family layout to match the new compact rule:

```html
<li data-i18n="app.docs.binders.family">Le mode Familles compacte les familles courtes quand elles tiennent sur la même ligne, tout en gardant les branches lisibles avec des vides discrets non imprimés.</li>
```

- [ ] **Step 5: Update binder wizard fallback copy**

In `web/binder-v2.js`, update fallback strings:

```js
"binder_wizard.org.family.desc": "Familles compactes : les petites familles partagent une ligne quand elles tiennent, les branches gardent des vides discrets.",
"binder_wizard.summary.org_family": "Familles d'évolution compactes",
"binder_wizard.summary.family_name": "Un ou plusieurs classeurs Familles : les familles courtes économisent des lignes, les branches restent lisibles.",
```

Keep the persisted values (`organization: "family"`) unchanged.

- [ ] **Step 6: Run i18n tests and confirm GREEN**

Run:

```bash
node --test tests/web/i18n.test.mjs
```

Expected: i18n tests pass.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add web/i18n.js web/binder-v2.js web/index.html tests/web/i18n.test.mjs
git commit -m "copy(web): clarify binder and sprite controls"
```

Expected: a commit containing label and copy updates.

## Task 4: Public And In-App Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `docs/assets/i18n.js`
- Modify: `web/index.html`
- Modify: `web/i18n.js`
- Modify: `tests/test_docs_site.py`

- [ ] **Step 1: Write failing docs assertions**

In `tests/test_docs_site.py`, extend `test_configurable_binder_layouts_are_documented()`:

```python
for text in [readme, features]:
    assert "Images / sprites" in text
    assert "Petites fiches classeur" in text
    assert "Classeurs > Réglages" in text
```

Add an assertion for compact family wording:

```python
assert "Spoink" in readme
assert "Spinda" in readme
assert "vides discrets" in readme
```

- [ ] **Step 2: Run docs test and confirm RED**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_configurable_binder_layouts_are_documented -q
```

Expected: the test fails because docs do not yet mention the new exact labels.

- [ ] **Step 3: Update README binder and print docs**

In `README.md`, update `Physical Binder Layouts` with this content:

```markdown
Collectors who use smaller or larger binders can open `Classeurs > Réglages`,
choose a preset or custom grid, and regenerate the local binder view. The same
settings control rows, columns and the number of physical sheets.

Generation sprites are available from `Réglages > Images / sprites`. Print can
also choose its own image mode, so a collector can print retro sprites without
changing the main collection view.

The optional `Familles` organization uses `data/evolution-families.json` to keep
evolution stages readable while saving space. Short complete families can share
a 3×3 row, for example Spoink / Groret / Spinda. Branches keep their readable
shape: Ptitard / Têtarte / Tartard stay together, Tarpaud starts the next row,
and the two remaining cells are discrete empties that are not printed as card
placeholders.

Printable small binder cards live under `Impression > Regrouper par > Petites
fiches classeur`. They print Pokemon slots and intentional family reservations,
but skip ordinary capacity and alignment empties.
```

- [ ] **Step 4: Update public feature page fallback HTML**

In `docs/features.html`, replace the binder feature paragraph with:

```html
<article class="feature"><h3 data-i18n="features.binders.title">Physical binder planner</h3><p data-i18n="features.binders.text">Create local binders with a 3×3 · 10 feuillets default, `Classeurs > Réglages` custom grids, generation sprites from `Réglages > Images / sprites`, compact Familles layouts such as Spoink / Groret / Spinda, and printable `Petites fiches classeur` while waiting for real cards.</p></article>
```

- [ ] **Step 5: Update public docs i18n**

In `docs/assets/i18n.js`, update both FR and EN values for `features.binders.text`:

```js
"features.binders.text": "Crée des classeurs locaux avec défaut 3×3 · 10 feuillets, grilles custom via `Classeurs > Réglages`, sprites depuis `Réglages > Images / sprites`, familles compactes comme Spoink / Groret / Spinda et `Petites fiches classeur` imprimables en attendant les vraies cartes.",
```

For EN:

```js
"features.binders.text": "Create local binders with a 3×3 · 10 feuillets default, custom grids through `Classeurs > Réglages`, sprites from `Réglages > Images / sprites`, compact family rows such as Spoink / Grumpig / Spinda, and printable `Petites fiches classeur` while waiting for real cards.",
```

- [ ] **Step 6: Update in-app docs copy**

In `web/index.html`, replace the existing `app.docs.binders.custom` and
`app.docs.binders.family` fallback list items under `Classeurs physiques`, and
insert the new print item after the family item:

```html
<li data-i18n="app.docs.binders.custom">`Classeurs > Réglages` permet de modifier lignes, colonnes, feuillets, périmètre de formes et organisation.</li>
<li data-i18n="app.docs.binders.family">Le mode Familles compacte les familles courtes quand elles tiennent sur la même ligne, tout en gardant les branches lisibles avec des vides discrets non imprimés.</li>
<li data-i18n="app.docs.print.placeholders">`Impression > Regrouper par > Petites fiches classeur` imprime des cartes temporaires et saute les vides d'alignement.</li>
```

In `web/i18n.js`, add these FR keys:

```js
"app.docs.binders.custom": "`Classeurs > Réglages` permet de modifier lignes, colonnes, feuillets, périmètre de formes et organisation.",
"app.docs.binders.family": "Le mode Familles compacte les familles courtes quand elles tiennent sur la même ligne, tout en gardant les branches lisibles avec des vides discrets non imprimés.",
"app.docs.print.placeholders": "`Impression > Regrouper par > Petites fiches classeur` imprime des cartes temporaires et saute les vides d'alignement.",
```

And these EN keys:

```js
"app.docs.binders.custom": "`Classeurs > Réglages` lets you edit rows, columns, sheets, form scope and organization.",
"app.docs.binders.family": "Family mode compacts short families when they fit on the same row, while keeping branches readable with discrete non-printable alignment empties.",
"app.docs.print.placeholders": "`Impression > Regrouper par > Petites fiches classeur` prints temporary cards and skips alignment empties.",
```

- [ ] **Step 7: Run docs test and confirm GREEN**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_configurable_binder_layouts_are_documented -q
```

Expected: docs test passes.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add README.md docs/features.html docs/assets/i18n.js web/index.html web/i18n.js tests/test_docs_site.py
git commit -m "docs: explain compact binders and print fiches"
```

Expected: a commit containing only docs and doc-test updates.

## Task 5: Full Verification

**Files:**
- Read-only verification unless failures reveal task-scoped issues.

- [ ] **Step 1: Run all web tests**

Run:

```bash
make web-test
```

Expected: all Node web tests pass.

- [ ] **Step 2: Run docs tests**

Run:

```bash
uv run pytest tests/test_docs_site.py -q
```

Expected: all docs-site tests pass.

- [ ] **Step 3: Run targeted Python hygiene if docs tests touched static copy**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py tests/test_theme_palettes.py -q
```

Expected: static UI/CSS checks pass.

- [ ] **Step 4: Inspect final git state**

Run:

```bash
git status --short --branch
```

Expected: branch is clean except for the pre-existing untracked `AGENTS.md`.

- [ ] **Step 5: Summarize implementation**

Report:

- compact family examples now produced by tests;
- sprite, binder and print controls now named in the UI/docs;
- verification commands and results;
- remaining untracked `AGENTS.md` if still present.
