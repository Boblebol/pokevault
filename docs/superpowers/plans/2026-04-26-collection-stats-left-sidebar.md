# Collection and Stats Left Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Collection filters and Statistics summary/scope content into left-side rails so the main content shows more usable rows.

**Architecture:** Reuse the Binder/Print two-column shell pattern instead of inventing a new app layout system. Keep existing element ids and JavaScript state, moving DOM nodes in `web/index.html` and adding scoped CSS in `web/styles.css`; make one small JavaScript scoping fix so list filter buttons remain isolated.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, FastAPI static serving through `tracker`, existing `make dev` workflow.

> Historical note: this file is an implementation plan, not the active backlog.
> Unchecked checklist items describe the original execution steps and should not
> be read as open product work.

---

## File Structure

- Modify: `web/index.html`
  - Restructure `#viewListe` into a header plus `collection-shell`.
  - Restructure `#viewStats` into a `stats-shell` with an aside and main column.
- Modify: `web/styles.css`
  - Add shared shell/rail styles for Collection and Stats.
  - Override the current top-stacked Collection controls.
  - Preserve Binder and Print shell rules.
  - Add responsive behavior at `max-width: 980px`.
- Modify: `web/app.js`
  - Scope status filter setup to `#viewListe .filter-btn[data-filter]`.
  - Leave search, chips, selects, progress, and grid wiring id-based.
- Optional verification only: `docs/screenshots/list-view.png`, `docs/screenshots/stats-view.png`
  - Update only if the implementation task includes screenshot refresh.

---

### Task 1: Restructure the Collection DOM

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Move bulky controls out of the Collection header**

Replace the current `#viewListe` structure so the header contains only the page title/subtitle and display info, and the controls/grid live in a shell immediately below it:

```html
<div id="viewListe" class="app-view">
  <div id="trackerMainBlock">
    <header class="header app-collection-header binder-header">
      <div class="page-header-top">
        <div>
          <h1 class="title">Collection</h1>
          <p class="collection-subtitle">
            Ta progression Pokédex, synchronisée avec tes classeurs.
          </p>
        </div>
        <p class="list-display-info" id="listDisplayInfo" aria-live="polite"></p>
      </div>
    </header>

    <section class="collection-shell" aria-label="Collection Pokédex">
      <aside class="collection-rail" aria-label="Filtres de collection">
        <div class="list-hero">
          <div class="list-hero-left">
            <p class="list-kicker">État de collection</p>
          </div>
          <div class="list-hero-right">
            <span id="listHeroPct" class="list-hero-pct">0%</span>
            <p id="listHeroCount" class="list-hero-count">0 / 0 découverts</p>
            <p
              id="listHeroCards"
              class="list-hero-cards is-dormant"
              aria-live="polite"
            >0 carte dans 0 set</p>
          </div>
        </div>

        <div class="progress-row">
          <div class="progress-bar" role="progressbar" aria-label="Progression de la collection" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar-fill" id="progressFill"></div>
          </div>
          <span class="counter" id="counter">0 / 0</span>
          <button
            type="button"
            class="kb-hint-btn"
            id="kbHelpTrigger"
            aria-label="Afficher les raccourcis clavier"
            title="Raccourcis clavier (touche ?)"
          >?</button>
        </div>

        <label class="search-wrap">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            id="search"
            class="search-input"
            placeholder="Rechercher par nom ou numéro..."
            aria-label="Rechercher par nom ou numéro"
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <div class="filters" role="group" aria-label="Filtrer par statut">
          <button type="button" class="filter-btn is-active" data-filter="all" aria-pressed="true">Tous</button>
          <button type="button" class="filter-btn" data-filter="caught" aria-pressed="false">Attrapés</button>
          <button type="button" class="filter-btn" data-filter="missing" aria-pressed="false">Manquants</button>
        </div>

        <nav
          class="region-chips"
          id="regionChips"
          role="group"
          aria-label="Filtrer par région du Pokédex"
        ></nav>

        <nav
          class="narrative-chips"
          id="narrativeChips"
          role="group"
          aria-label="Filtrer par catégorie narrative (Starter, Légendaire…)"
          hidden
        ></nav>

        <div class="advanced-filters" id="advancedFiltersPanel">
          <label class="region-filter-wrap">
            <span class="region-filter-label">Région</span>
            <select id="regionFilter" class="region-filter" aria-label="Filtrer par région du Pokédex">
              <option value="all">Toutes les régions</option>
            </select>
          </label>
          <label class="region-filter-wrap">
            <span class="region-filter-label">Formes</span>
            <select id="formFilter" class="region-filter" aria-label="Filtrer les formes dans la liste uniquement">
              <option value="all">Tout le dex</option>
              <option value="base_only">Base uniquement</option>
              <option value="base_regional">Base + régional</option>
            </select>
          </label>
          <label class="region-filter-wrap">
            <span class="region-filter-label">Type</span>
            <select id="typeFilter" class="region-filter" aria-label="Filtrer par type Pokémon">
              <option value="all">Tous les types</option>
            </select>
          </label>
          <label class="region-filter-wrap collection-dim-wrap">
            <span class="region-filter-label">Mise en avant</span>
            <select
              id="collectionDimSelect"
              class="region-filter"
              aria-label="Choisir quelles cartes atténuer dans la grille"
            >
              <option value="caught">Atténuer attrapés</option>
              <option value="missing">Atténuer manquants</option>
            </select>
          </label>
        </div>
        <p class="sync-hint" id="syncHint" hidden></p>
      </aside>

      <section class="collection-main" aria-label="Liste des Pokémon">
        <main class="grid" id="grid" aria-live="polite"></main>
        <div id="listScrollSentinel" class="list-scroll-sentinel" aria-hidden="true"></div>
        <p class="list-scroll-end" id="listScrollEnd" aria-live="polite" hidden></p>
      </section>
    </section>
  </div>
</div>
```

- [ ] **Step 2: Run a static id check**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path("web/index.html").read_text()
ids = ["search", "regionChips", "narrativeChips", "advancedFiltersPanel", "regionFilter", "formFilter", "typeFilter", "collectionDimSelect", "grid", "listScrollSentinel", "listScrollEnd", "progressFill", "counter", "kbHelpTrigger"]
missing = [i for i in ids if f'id="{i}"' not in text]
assert not missing, missing
PY
```

Expected: exits with code `0`.

- [ ] **Step 3: Commit**

```bash
git add web/index.html
git commit -m "refactor(ui): move collection controls into shell"
```

---

### Task 2: Add Collection Shell CSS

**Files:**
- Modify: `web/styles.css`

- [ ] **Step 1: Add scoped shell styles near the Stitch parity section**

Add this block after the Binder shell styles:

```css
#viewListe .collection-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  max-width: 1240px;
  margin: 0 auto;
}

#viewListe .collection-rail {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(28, 27, 27, 0.72);
  box-shadow: inset 0 0 0 1px var(--outline-soft);
}

#viewListe .collection-main {
  min-width: 0;
}

#viewListe .collection-main .grid {
  max-width: none;
  margin: 0;
  padding-top: 0;
}

#viewListe .collection-rail .list-hero {
  display: grid;
  gap: 8px;
  margin-bottom: 0;
}

#viewListe .collection-rail .list-hero-right {
  min-width: 0;
  text-align: left;
}

#viewListe .collection-rail .progress-row {
  margin: 0;
}

#viewListe .collection-rail .search-wrap {
  margin-bottom: 0;
}

#viewListe .collection-rail .filters,
#viewListe .collection-rail .region-chips,
#viewListe .collection-rail .narrative-chips {
  margin-bottom: 0;
}

#viewListe .collection-rail .filters {
  display: grid;
  grid-template-columns: 1fr;
}

#viewListe .collection-rail .filter-btn {
  width: 100%;
  min-width: 0;
  text-align: left;
}

#viewListe .collection-rail .region-chips,
#viewListe .collection-rail .narrative-chips {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

#viewListe .collection-rail .region-chip,
#viewListe .collection-rail .narrative-chip {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
}

#viewListe .collection-rail .advanced-filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 0;
  padding: 0;
  background: none;
  box-shadow: none;
}

#viewListe .collection-rail .advanced-filters[hidden] {
  display: none !important;
}

#viewListe .collection-rail .region-filter-wrap,
#viewListe .collection-rail .collection-dim-wrap {
  display: flex !important;
  margin: 0;
  width: 100%;
}

#viewListe .collection-rail .region-filter {
  width: 100%;
  max-width: none;
}
```

- [ ] **Step 2: Remove conflicting hide rules**

Delete or override these existing rules:

```css
#viewListe .region-filter-wrap,
#viewListe .collection-dim-wrap {
  display: none !important;
}
```

Expected: the advanced filters are visible in the left rail.

- [ ] **Step 3: Add responsive behavior**

Extend the existing `@media (max-width: 980px)` block:

```css
@media (max-width: 980px) {
  #viewListe .collection-shell {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add web/styles.css
git commit -m "style(ui): add collection sidebar layout"
```

---

### Task 3: Scope Collection Filter JavaScript

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Update `setupFilters()`**

Replace:

```js
function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterMode = btn.dataset.filter || "all";
      resetDisplayedCount();
      document.querySelectorAll(".filter-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  });
}
```

With:

```js
function setupFilters() {
  const buttons = document.querySelectorAll("#viewListe .filter-btn[data-filter]");
  buttons.forEach((btn) => {
    if (btn.dataset.filterWired) return;
    btn.dataset.filterWired = "1";
    btn.addEventListener("click", () => {
      filterMode = btn.dataset.filter || "all";
      resetDisplayedCount();
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  });
}
```

- [ ] **Step 2: Run a syntax smoke check**

Run:

```bash
node --check web/app.js
```

Expected: no output and exit code `0`.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "fix(ui): scope collection status filters"
```

---

### Task 4: Restructure the Stats DOM

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Replace the current Stats body with a shell**

Replace:

```html
<section class="stats-main" id="statsBody"></section>
<section class="stats-main" id="statsBadges"></section>
```

With:

```html
<section class="stats-shell" aria-label="Tableau de bord statistiques">
  <aside class="stats-rail" aria-label="Résumé statistiques">
    <p class="stats-rail-kicker">Synthèse</p>
    <div class="stats-rail-summary">
      <span class="stats-rail-value" id="statsRailPct">0%</span>
      <span class="stats-rail-label" id="statsRailCount">0 / 0 attrapés</span>
      <span class="stats-rail-label" id="statsRailMissing">0 manquants</span>
    </div>
    <div class="stats-rail-note">
      Les statistiques suivent le même périmètre de formes que la collection.
    </div>
  </aside>
  <main class="stats-content">
    <section class="stats-main" id="statsBody"></section>
    <section class="stats-main" id="statsBadges"></section>
  </main>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add web/index.html
git commit -m "refactor(ui): add stats sidebar shell"
```

---

### Task 5: Populate the Stats Rail

**Files:**
- Modify: `web/stats-view.js`

- [ ] **Step 1: Add a helper before `renderStats()`**

```js
function renderStatsRail(caught, total) {
  const pct = total ? Math.round((caught / total) * 100) : 0;
  const pctEl = document.getElementById("statsRailPct");
  const countEl = document.getElementById("statsRailCount");
  const missingEl = document.getElementById("statsRailMissing");
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (countEl) countEl.textContent = `${caught} / ${total} attrapés`;
  if (missingEl) missingEl.textContent = `${Math.max(0, total - caught)} manquants`;
}
```

- [ ] **Step 2: Call the helper after totals are computed**

In `renderStats()`, immediately after:

```js
const globalPct = gTotal ? Math.round((gCaught / gTotal) * 100) : 0;
```

Add:

```js
renderStatsRail(gCaught, gTotal);
```

- [ ] **Step 3: Ensure empty states reset the rail**

Inside the early empty-state branch, before `return`, add:

```js
renderStatsRail(0, pool.length);
```

- [ ] **Step 4: Run a syntax smoke check**

Run:

```bash
node --check web/stats-view.js
```

Expected: no output and exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add web/stats-view.js
git commit -m "feat(ui): update stats sidebar summary"
```

---

### Task 6: Add Stats Shell CSS

**Files:**
- Modify: `web/styles.css`

- [ ] **Step 1: Add stats shell styles near existing `#viewStats` rules**

```css
#viewStats .stats-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  max-width: 1240px;
  margin: 0 auto;
}

#viewStats .stats-rail {
  display: grid;
  gap: 14px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(28, 27, 27, 0.72);
  box-shadow: inset 0 0 0 1px var(--outline-soft);
}

#viewStats .stats-rail-kicker {
  margin: 0;
  color: #c4a29d;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.66rem;
  font-weight: 700;
}

#viewStats .stats-rail-summary {
  display: grid;
  gap: 6px;
}

#viewStats .stats-rail-value {
  color: var(--electric);
  font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
  font-weight: 700;
  font-size: 2.2rem;
  line-height: 1;
}

#viewStats .stats-rail-label,
#viewStats .stats-rail-note {
  color: #c9a9a3;
  font-size: 0.78rem;
  line-height: 1.4;
}

#viewStats .stats-content {
  min-width: 0;
  display: grid;
  gap: 14px;
}

#viewStats .stats-content .stats-main {
  max-width: none;
  margin: 0;
}
```

- [ ] **Step 2: Adjust the shared width rule**

Replace:

```css
#viewStats > .stats-main,
```

With:

```css
#viewStats > .stats-shell,
```

Expected: width constraining applies to the shell, not to individual stat sections.

- [ ] **Step 3: Add responsive behavior**

Extend the existing `@media (max-width: 980px)` block:

```css
#viewStats .stats-shell {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Commit**

```bash
git add web/styles.css
git commit -m "style(ui): add stats sidebar layout"
```

---

### Task 7: Manual UI Verification

**Files:**
- Verify: `web/index.html`
- Verify: `web/styles.css`
- Verify: `web/app.js`
- Verify: `web/stats-view.js`

- [ ] **Step 1: Run static syntax checks**

```bash
node --check web/app.js
node --check web/stats-view.js
```

Expected: both commands exit `0`.

- [ ] **Step 2: Start the app**

```bash
make dev
```

Expected: FastAPI serves the UI at `http://127.0.0.1:8765/`.

- [ ] **Step 3: Verify Collection desktop layout**

Open `http://127.0.0.1:8765/#/liste`.

Expected:
- Left rail contains progress, search, status filters, region chips, narrative chips, advanced selects, and keyboard help.
- Main column starts with the Pokémon grid.
- At least two rows of Pokémon cards are clearly visible on a normal laptop viewport.
- Search, status filters, region chips, type select, form select, and dim select still update the grid.
- `#/liste?region=johto` activates Johto and filters the grid.

- [ ] **Step 4: Verify Stats desktop layout**

Open `http://127.0.0.1:8765/#/stats`.

Expected:
- Left rail shows percentage, caught count, and missing count.
- Main column shows the existing hero, KPI cards, regional archive, gaps, type completion, and badges.
- Toggling a Pokémon in Collection and returning to Stats updates the rail and stats content.

- [ ] **Step 5: Verify responsive layout**

Use browser dev tools at `980px`, `820px`, and a mobile width around `390px`.

Expected:
- Collection rail stacks above the grid.
- Stats rail stacks above stats content.
- No button text overlaps its container.
- Binder and Print still collapse as before.

- [ ] **Step 6: Commit verification notes if screenshots are updated**

Only if screenshots are refreshed:

```bash
git add docs/screenshots/list-view.png docs/screenshots/stats-view.png
git commit -m "docs: refresh sidebar layout screenshots"
```

---

## Self-Review

- Spec coverage: Collection rail, Stats rail, breakpoint, existing ids, no API changes, and verification are covered by Tasks 1-7.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: new ids are `statsRailPct`, `statsRailCount`, and `statsRailMissing`; the JavaScript helper uses the same names.
- Risk: CSS conflicts are most likely around old `#viewListe .region-filter-wrap` hide rules and the shared width rule. Tasks 2 and 6 call those out explicitly.
