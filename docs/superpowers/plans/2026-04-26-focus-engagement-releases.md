# Focus Engagement Releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four incremental releases that make Pokevault more habit-forming by guiding users toward focused completion work.

**Architecture:** Start with a frontend-only Focus session stored in localStorage, then extract recommendation logic, then add a persisted hunt list, then enrich badge progress. Keep the Collection grid as the primary workspace and place new controls inside the existing left rails.

**Tech Stack:** Vanilla JavaScript SPA, CSS, FastAPI/Pydantic backend, JSON repositories, pytest, node syntax checks, local-first export/import.

---

## Release Map

| Release | Product Name | Main Outcome | Persistence | Tag |
|---------|--------------|--------------|-------------|-----|
| `v0.5.0` | Focus Session MVP | One short session of six missing Pokémon | `localStorage` | `v0.5.0-focus-session` |
| `v0.6.0` | Next Best Action | Explain the recommended target | none new | `v0.6.0-next-best-action` |
| `v0.7.0` | Hunt List | Track personal searches and priorities | JSON + export schema v3 | `v0.7.0-hunt-list` |
| `v0.8.0` | Badge Progression V2 | Locked badges show progress and hints | existing progress JSON | `v0.8.0-badge-progression` |

## File Structure

### v0.5.0

- Create: `web/focus-session.js`
  - Owns Focus state, session planning, localStorage persistence, and panel rendering.
- Modify: `web/index.html`
  - Adds Focus panel hosts to Collection and Statistics rails.
  - Loads `focus-session.js`.
- Modify: `web/app.js`
  - Calls `window.PokevaultFocus.refresh()` after grid renders and after empty states.
- Modify: `web/stats-view.js`
  - Calls `window.PokevaultFocus.refresh()` after stats render.
- Modify: `web/styles.css`
  - Adds compact rail panel, target rows, progress, and responsive styling.
- Modify: `CHANGELOG.md`
  - Adds unreleased `v0.5.0` note.

### v0.6.0

- Create: `web/recommendations.js`
  - Extracts scoring currently embedded in `focus-session.js`.
- Modify: `web/focus-session.js`
  - Consumes recommendation output and renders reason text.
- Modify: `web/stats-view.js`
  - Replaces passive `nextPriorityRows()` with the shared recommendation engine.

### v0.7.0

- Modify: `tracker/models.py`
  - Adds `HuntEntry`, `HuntList`, `HuntPatch`, and export/import schema v3 support.
- Create: `tracker/repository/json_hunt_repository.py`
  - Loads/saves `data/hunts.json`.
- Create: `tracker/services/hunt_service.py`
  - Validates and patches hunt state.
- Create: `tracker/api/controllers/hunt_controller.py`
  - Exposes `GET /api/hunts` and `PATCH /api/hunts/{slug}`.
- Create: `web/hunt-list.js`
  - Frontend API wrapper and local UI state.
- Modify: `web/index.html`, `web/app.js`, `web/pokemon-drawer.js`, `web/pokemon-full-view.js`
  - Adds hunt filter and quick actions.
- Add tests under `tests/tracker/test_hunt_*.py`.

### v0.8.0

- Modify: `tracker/models.py`
  - Extends `BadgeDefinition` with optional progress fields.
- Modify: `tracker/services/badge_service.py`
  - Computes current/target/percent/hint for each badge.
- Modify: `web/badges-view.js`
  - Renders progress bars and nearest badge summary.
- Modify: `web/focus-session.js`
  - Surfaces nearest badge as a session reason.
- Extend tests in `tests/tracker/test_badge_service.py` and `tests/tracker/test_badge_api.py`.

---

## v0.5.0 - Focus Session MVP

### Task 1: Add Focus Panel Hosts

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Add the Collection rail host**

Insert after the Collection `.progress-row`:

```html
<section
  class="focus-panel"
  id="focusPanelList"
  aria-label="Session focus collection"
></section>
```

- [ ] **Step 2: Add the Stats rail host**

Insert after `.stats-rail-note`:

```html
<section
  class="focus-panel focus-panel--stats"
  id="focusPanelStats"
  aria-label="Session focus statistiques"
></section>
```

- [ ] **Step 3: Load the module**

Insert after `/app.js` and before `/stats-view.js`:

```html
<script src="/focus-session.js" defer></script>
```

- [ ] **Step 4: Verify the static hosts**

Run:

```bash
python - <<'PY'
from pathlib import Path
html = Path("web/index.html").read_text()
for needle in ['id="focusPanelList"', 'id="focusPanelStats"', 'src="/focus-session.js"']:
    assert needle in html, needle
PY
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit**

```bash
git add web/index.html
git commit -m "feat(ui): add focus session panel hosts"
```

### Task 2: Implement Focus Session State and Planner

**Files:**
- Create: `web/focus-session.js`

- [ ] **Step 1: Add the module shell**

Create an IIFE that exposes:

```js
window.PokevaultFocus = {
  refresh,
  startSession,
  resetSession,
  openTarget,
  get state() {
    return readSession();
  },
};
```

- [ ] **Step 2: Add the planner rules**

Implement:

```js
function buildSessionPlan(pool, caughtMap, regionDefinitions) {
  const missing = pool.filter((p) => !caughtMap[String(p?.slug || "")]);
  if (!missing.length) return null;
  const grouped = groupMissingByRegion(missing, pool, caughtMap, regionDefinitions);
  const best = grouped[0];
  return {
    version: 1,
    startedAt: new Date().toISOString(),
    targetRegion: best.id,
    targetLabel: best.label,
    reason: best.reason,
    slugs: best.items.slice(0, 6).map((p) => String(p.slug)),
    completed: [],
  };
}
```

Ranking rule:
- Regions with missing entries and the highest completion percentage win.
- Ties prefer fewer missing entries.
- Ties then use Pokédex order.

- [ ] **Step 3: Add localStorage persistence**

Use key `pokevault_focus_session_v1`. Invalid JSON returns `null`; unavailable localStorage keeps the UI usable without persistence.

- [ ] **Step 4: Add auto-completion**

On every render, rebuild `completed` from current caught status:

```js
const completed = session.slugs.filter((slug) => Boolean(caughtMap[slug]));
```

Save the updated session only if the list changed.

- [ ] **Step 5: Verify JS syntax**

Run:

```bash
node --check web/focus-session.js
```

Expected: exits with code `0`.

- [ ] **Step 6: Commit**

```bash
git add web/focus-session.js
git commit -m "feat(ui): add focus session planner"
```

### Task 3: Render the Focus Panels

**Files:**
- Modify: `web/focus-session.js`
- Modify: `web/styles.css`

- [ ] **Step 1: Render idle, active, complete, and all-caught states**

Panel copy:
- Idle title: `Session focus`
- Idle body: `Six cibles, pas plus. Le but est de finir une petite boucle sans perdre le fil.`
- Start button: `Lancer`
- Active progress: `N / 6`
- Complete title: `Session terminée`
- All-caught title: `Pokédex complet sur ce périmètre`

- [ ] **Step 2: Target row behavior**

Each row is a button with:

```js
button.addEventListener("click", () => openTarget(slug));
```

`openTarget(slug)` sets `location.hash` to `#/liste?region=<targetRegion>`, fills the search input with the target display name when available, dispatches an `input` event, and scrolls the card into view after render.

- [ ] **Step 3: Add CSS**

Add scoped classes:

```css
.focus-panel {}
.focus-panel__header {}
.focus-panel__title {}
.focus-panel__progress {}
.focus-panel__meter {}
.focus-panel__bar {}
.focus-panel__targets {}
.focus-panel__target {}
.focus-panel__target.is-complete {}
.focus-panel__actions {}
.focus-panel__btn {}
```

The panel must fit inside the existing rail width and avoid increasing card tile dimensions.

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check web/focus-session.js
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit**

```bash
git add web/focus-session.js web/styles.css
git commit -m "feat(ui): render focus session panels"
```

### Task 4: Wire Refresh Hooks

**Files:**
- Modify: `web/app.js`
- Modify: `web/stats-view.js`

- [ ] **Step 1: Refresh after Collection render**

At the end of `render()` in `web/app.js`, after keyboard repaint:

```js
window.PokevaultFocus?.refresh?.();
```

Also call it before returns from empty states so the panel does not go stale.

- [ ] **Step 2: Refresh after Stats render**

At the end of `renderStats()`:

```js
window.PokevaultFocus?.refresh?.();
```

- [ ] **Step 3: Verify JS syntax**

Run:

```bash
node --check web/app.js
node --check web/stats-view.js
```

Expected: both commands exit with code `0`.

- [ ] **Step 4: Commit**

```bash
git add web/app.js web/stats-view.js
git commit -m "feat(ui): keep focus session in sync"
```

### Task 5: Release Verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Add a `v0.5.0 - Focus Session` section describing the local-first Focus panel.

- [ ] **Step 2: Run verification**

Run:

```bash
node --check web/focus-session.js
node --check web/app.js
node --check web/stats-view.js
python - <<'PY'
from pathlib import Path
html = Path("web/index.html").read_text()
for needle in ['id="focusPanelList"', 'id="focusPanelStats"', 'src="/focus-session.js"']:
    assert needle in html, needle
PY
../../.venv/bin/python -m pytest tests/ -q
```

Expected:
- JS checks exit `0`.
- Static check exits `0`.
- `411 passed`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: document focus session release"
```

---

## v0.6.0 - Next Best Action

### Task 1: Extract Recommendation Engine

**Files:**
- Create: `web/recommendations.js`
- Modify: `web/index.html`
- Modify: `web/focus-session.js`
- Modify: `web/stats-view.js`

- [ ] Create `window.PokevaultRecommendations.rankTargets({ pool, caughtMap, statusMap, regionDefinitions, badges })`.
- [ ] Move region completion scoring out of `focus-session.js`.
- [ ] Add `reason` values such as `Johto est proche d'etre completee` or `Ce badge est a portee`.
- [ ] Replace `nextPriorityRows()` in stats with the shared ranking.
- [ ] Run `node --check web/recommendations.js web/focus-session.js web/stats-view.js`.
- [ ] Commit with `feat(ui): add next best action recommendations`.

## v0.7.0 - Hunt List

### Task 1: Add Hunt Persistence

**Files:**
- Modify: `tracker/models.py`
- Create: `tracker/repository/json_hunt_repository.py`
- Create: `tracker/services/hunt_service.py`
- Create: `tracker/api/controllers/hunt_controller.py`
- Modify: `tracker/api/dependencies.py`
- Modify: `tracker/app.py`
- Add: `tests/tracker/test_hunt_service.py`
- Add: `tests/tracker/test_hunt_api.py`

- [ ] Write service tests for create/update/clear hunt state.
- [ ] Implement the JSON repository and service.
- [ ] Add REST routes and dependency wiring.
- [ ] Add export/import schema v3 tests before touching import code.
- [ ] Commit with `feat(tracker): add hunt list persistence`.

### Task 2: Add Hunt UI

**Files:**
- Create: `web/hunt-list.js`
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/pokemon-drawer.js`
- Modify: `web/pokemon-full-view.js`
- Modify: `web/styles.css`

- [ ] Add `Mes recherches` filter in the Collection rail.
- [ ] Add drawer/full-view buttons: `Rechercher`, `Priorite haute`, and note field.
- [ ] Make Focus planner prefer high-priority hunt items.
- [ ] Run JS syntax checks and full pytest.
- [ ] Commit with `feat(ui): add hunt list controls`.

## v0.8.0 - Badge Progression V2

### Task 1: Add Badge Progress Metadata

**Files:**
- Modify: `tracker/models.py`
- Modify: `tracker/services/badge_service.py`
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tests/tracker/test_badge_api.py`

- [x] Extend `BadgeDefinition` with `current`, `target`, `percent`, and `hint`.
- [x] Replace predicate-only badge definitions with evaluator functions returning progress.
- [x] Preserve monotonic `unlocked` behavior.
- [x] Commit with `feat(tracker): expose badge progress`.

### Task 2: Render Badge Guidance

**Files:**
- Modify: `web/badges-view.js`
- Modify: `web/focus-session.js`
- Modify: `web/stats-view.js`
- Modify: `web/styles.css`

- [x] Add progress bars to locked badge tiles.
- [x] Surface nearest badge in Stats rail.
- [x] Add nearest badge as an optional Focus session reason.
- [x] Run JS syntax checks and full pytest.
- [x] Commit with `feat(ui): show badge progression`.
