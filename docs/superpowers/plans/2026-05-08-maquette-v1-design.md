# Maquette V1 Design Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the strict `maquette/maquette_v1.html` Vault Lab design to the whole vanilla JS web app, with Badges fully separated from Statistiques.

**Architecture:** Keep the existing static HTML + vanilla JS modules. First lock route, nav, font, and theme contracts with tests; then move the badge gallery to its own page; then restyle the shell and each page using a single Vault Lab CSS foundation that preserves current behavior.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node built-in test runner for `tests/web/*.test.mjs`, pytest static/runtime tests, FastAPI static server through `make dev`.

---

## File Structure

- Modify `web/index.html`: desktop nav order, new `viewBadges`, mobile bottom nav + Plus menu, remove theme select, remove `statsBadges` from the Stats page, script list updates.
- Modify `web/app.js`: route recognition for `#/badges`, page visibility, document title, mobile Plus wiring, Settings without themes.
- Create `web/badges-page.js`: small page controller that renders the existing `PokevaultBadges.renderInto()` output into `#badgesBody`.
- Modify `web/stats-view.js`: make Stats independent from badge gallery rendering.
- Modify `web/badges-view.js`: keep current badge service/gallery/detail behavior, add `_test.setCachedState(state)` for deterministic badge page rendering tests.
- Modify `web/i18n.js`: add the exact FR/EN route, mobile, and badge page keys listed in Task 2.
- Modify `web/styles.css`: local font declarations, Vault Lab tokens, shell/nav/mobile styles, page/component restyling, remove `html[data-theme]` variants.
- Delete `web/themes.js`: the multi-theme runtime is removed for this pass.
- Add `web/assets/fonts/barlow-latin-400.woff2`, `web/assets/fonts/barlow-latin-500.woff2`, `web/assets/fonts/barlow-latin-600.woff2`, `web/assets/fonts/barlow-latin-700.woff2`, `web/assets/fonts/space-mono-latin-400.woff2`, `web/assets/fonts/space-mono-latin-700.woff2`.
- Modify `tests/web/app-ownership.test.mjs`: route tests for `#/badges`.
- Modify `tests/web/stats-view.test.mjs`: assert Stats does not render badges.
- Modify `tests/web/badges-view.test.mjs`: keep existing gallery/detail tests; add the render shape test described in Task 5.
- Modify `tests/test_docs_site.py`: static checks for badges route, script, i18n, and local fonts.
- Modify `tests/test_mobile_home_css.py`: static checks for desktop nav order, mobile bottom nav, and Plus menu contents.
- Modify `tests/test_theme_palettes.py`: replace multi-theme expectations with Vault Lab token and local font checks.

## Task 1: Route And Navigation Contracts

**Files:**
- Modify: `tests/web/app-ownership.test.mjs`
- Modify: `tests/test_mobile_home_css.py`
- Modify: `tests/test_docs_site.py`

- [ ] **Step 1: Add failing route test for `#/badges`**

Add this test near the existing docs route test in `tests/web/app-ownership.test.mjs`:

```js
test("badges route is recognized as a first-class app view", async () => {
  const api = await loadModule();

  globalThis.location.hash = "#/badges";

  assert.equal(api.currentViewFromHash(), "badges");
});
```

- [ ] **Step 2: Add failing static nav-order and mobile-nav tests**

Append these tests to `tests/test_mobile_home_css.py`:

```python
def test_vault_lab_desktop_nav_order_separates_badges_from_stats() -> None:
    nav = HTML.split('class="stitch-topnav"', 1)[1].split("</nav>", 1)[0]
    expected = [
        'href="#/liste"',
        'href="#/classeur"',
        'href="#/dresseurs"',
        'href="#/badges"',
        'href="#/stats"',
        'href="#/print"',
        'href="#/docs"',
        'href="#/settings"',
    ]
    positions = [nav.index(token) for token in expected]
    assert positions == sorted(positions)


def test_vault_lab_mobile_nav_uses_primary_tabs_and_plus_menu() -> None:
    assert 'class="mobile-bottom-nav"' in HTML
    for token in [
        'data-mobile-view="liste"',
        'data-mobile-view="classeur"',
        'data-mobile-view="badges"',
        'data-mobile-view="stats"',
        'id="mobileMoreToggle"',
        'id="mobileMoreMenu"',
    ]:
        assert token in HTML

    more = HTML.split('id="mobileMoreMenu"', 1)[1].split("</nav>", 1)[0]
    for href in ['href="#/dresseurs"', 'href="#/print"', 'href="#/docs"', 'href="#/settings"']:
        assert href in more
```

- [ ] **Step 3: Add failing static app surface checks**

In `tests/test_docs_site.py`, extend `test_web_app_supports_fr_en_switch_on_main_surfaces()` by adding `app.badges.title` to the required i18n-bearing surfaces:

```python
    for key in [
        "app.collection.title",
        "app.badges.title",
        "app.stats.title",
        "app.binders.title",
        "app.trainers.title",
        "app.print.title",
        "app.docs.title",
        "app.settings.title",
        "app.onboarding.title",
        "app.shortcuts.title",
        "app.drawer.kicker",
    ]:
        assert f'data-i18n="{key}"' in index
        assert key in i18n
    assert 'href="#/badges"' in index
    assert 'id="viewBadges"' in index
    assert '"app.nav.badges"' in i18n
```

- [ ] **Step 4: Run route/static tests and verify red**

Run:

```bash
node --test tests/web/app-ownership.test.mjs
uv run pytest tests/test_mobile_home_css.py tests/test_docs_site.py -q
```

Expected: failures mention `badges` returning `liste`, missing `#/badges`, missing `viewBadges`, missing `mobile-bottom-nav`, and missing i18n keys.

- [ ] **Step 5: Commit red tests**

```bash
git add tests/web/app-ownership.test.mjs tests/test_mobile_home_css.py tests/test_docs_site.py
git commit -m "test(web): cover maquette v1 navigation split"
```

## Task 2: Badges Route, Page Split, And Stats Purity

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Create: `web/badges-page.js`
- Modify: `web/stats-view.js`
- Modify: `web/i18n.js`
- Modify: `tests/web/stats-view.test.mjs`

- [ ] **Step 1: Add failing Stats purity assertion**

In `tests/web/stats-view.test.mjs`, replace the `PokevaultBadges` stub in the existing test with a throwing `renderInto()` so the test proves Stats does not render the gallery:

```js
  globalThis.PokevaultBadges = {
    renderInto() {
      throw new Error("stats must not render the badge gallery");
    },
    nearest() {
      return {
        title: "Sabrina - Marsh",
        current: 1,
        target: 2,
        percent: 50,
        unlocked: false,
      };
    },
  };
```

Keep the existing assertions that `statsRailBadge` remains hidden and badge copy is absent.

- [ ] **Step 2: Run Stats test and verify red**

Run:

```bash
node --test tests/web/stats-view.test.mjs
```

Expected: FAIL with `stats must not render the badge gallery`.

- [ ] **Step 3: Update `web/index.html` routes and page shells**

Change the desktop nav to this exact order:

```html
<a href="#/liste" class="app-switch-link is-active" data-view="liste" aria-current="page" data-i18n="app.nav.collection">Collection</a>
<a href="#/classeur" class="app-switch-link" data-view="classeur" data-i18n="app.nav.binders">Classeurs</a>
<a href="#/dresseurs" class="app-switch-link" data-view="dresseurs" data-i18n="app.nav.trainers">Dresseurs</a>
<a href="#/badges" class="app-switch-link" data-view="badges" data-i18n="app.nav.badges">Badges</a>
<a href="#/stats" class="app-switch-link" data-view="stats" data-i18n="app.nav.stats">Statistiques</a>
<a href="#/print" class="app-switch-link" data-view="print" data-i18n="app.nav.print">Impression</a>
<a href="#/docs" class="app-switch-link" data-view="docs" data-i18n="app.nav.docs">Docs</a>
<a href="#/settings" class="app-switch-link" data-view="settings" data-i18n="app.nav.settings">Réglages</a>
```

Insert this new view between `viewListe` and `viewStats`:

```html
<div id="viewBadges" class="app-view" hidden>
  <header class="header app-collection-header binder-header badges-header">
    <h1 class="title" data-i18n="app.badges.title">Badges</h1>
    <p class="collection-subtitle" data-i18n="app.badges.subtitle">Galerie complète des badges, filtres et dossiers combat.</p>
  </header>
  <section class="badges-shell" aria-label="Galerie de badges" data-i18n-aria-label="app.badges.shell">
    <main class="badges-content" id="badgesBody"></main>
  </section>
</div>
```

In the Stats view, remove this line:

```html
<section class="stats-main stats-main--badges" id="statsBadges"></section>
```

Add the mobile nav before the closing modal/dialog markup near the end of `<body>`:

```html
<nav class="mobile-bottom-nav" aria-label="Navigation mobile" data-i18n-aria-label="app.nav.mobile">
  <a href="#/liste" class="mobile-bottom-nav__item" data-mobile-view="liste" data-view="liste">
    <span aria-hidden="true">◉</span><span data-i18n="app.nav.collection_short">Dex</span>
  </a>
  <a href="#/classeur" class="mobile-bottom-nav__item" data-mobile-view="classeur" data-view="classeur">
    <span aria-hidden="true">▦</span><span data-i18n="app.nav.binders_short">Classeurs</span>
  </a>
  <a href="#/badges" class="mobile-bottom-nav__item" data-mobile-view="badges" data-view="badges">
    <span aria-hidden="true">⬡</span><span data-i18n="app.nav.badges">Badges</span>
  </a>
  <a href="#/stats" class="mobile-bottom-nav__item" data-mobile-view="stats" data-view="stats">
    <span aria-hidden="true">▣</span><span data-i18n="app.nav.stats_short">Stats</span>
  </a>
  <button type="button" class="mobile-bottom-nav__item" id="mobileMoreToggle" aria-expanded="false" aria-controls="mobileMoreMenu">
    <span aria-hidden="true">☰</span><span data-i18n="app.nav.more">Plus</span>
  </button>
</nav>
<nav class="mobile-more-menu" id="mobileMoreMenu" aria-label="Navigation secondaire" data-i18n-aria-label="app.nav.more_menu" hidden>
  <a href="#/dresseurs" class="mobile-more-menu__link" data-view="dresseurs" data-i18n="app.nav.trainers">Dresseurs</a>
  <a href="#/print" class="mobile-more-menu__link" data-view="print" data-i18n="app.nav.print">Impression</a>
  <a href="#/docs" class="mobile-more-menu__link" data-view="docs" data-i18n="app.nav.docs">Docs</a>
  <a href="#/settings" class="mobile-more-menu__link" data-view="settings" data-i18n="app.nav.settings">Réglages</a>
</nav>
```

Add the new script after `badges-view.js`:

```html
<script src="/badges-page.js" defer></script>
```

- [ ] **Step 4: Create `web/badges-page.js`**

Create this file:

```js
(function initBadgesPage() {
  "use strict";

  let started = false;
  let localeSubscribed = false;

  function render() {
    const host = document.getElementById("badgesBody");
    const badges = window.PokevaultBadges;
    if (!host || !badges?.renderInto) return;
    badges.renderInto(host);
  }

  function start() {
    if (!started) {
      started = true;
      window.PokevaultBadges?.subscribe?.(() => render());
    }
    if (!localeSubscribed) {
      localeSubscribed = true;
      window.PokevaultI18n?.subscribeLocale?.(() => render());
    }
    render();
    void window.PokevaultBadges?.poll?.().then(() => render());
  }

  window.PokevaultBadgesPage = {
    render,
    start,
  };
})();
```

- [ ] **Step 5: Update `web/app.js` route handling**

Update `currentViewFromHash()`:

```js
  if (raw === "badges") return "badges";
  if (raw === "stats") return "stats";
```

Update `applyAppRoute()` element lookup and visibility:

```js
  const elBadges = document.getElementById("viewBadges");
  const elStats = document.getElementById("viewStats");
```

```js
  if (elBadges) elBadges.hidden = view !== "badges";
  if (elStats) elStats.hidden = view !== "stats";
```

Update titles:

```js
    badges: `pokevault — ${t("app.nav.badges")}`,
```

Start the badge page:

```js
  if (view === "badges" && typeof window.PokevaultBadgesPage?.start === "function") {
    window.PokevaultBadgesPage.start();
  }
```

Add this helper near `updateAppSwitchNav()`:

```js
function setMobileMoreOpen(open) {
  const toggle = document.getElementById("mobileMoreToggle");
  const menu = document.getElementById("mobileMoreMenu");
  if (!toggle || !menu) return;
  const next = Boolean(open);
  menu.hidden = !next;
  toggle.setAttribute("aria-expanded", next ? "true" : "false");
}

function wireMobileMoreNav() {
  const toggle = document.getElementById("mobileMoreToggle");
  const menu = document.getElementById("mobileMoreMenu");
  if (!toggle || !menu || toggle.dataset.wired) return;
  toggle.dataset.wired = "1";
  toggle.addEventListener("click", () => {
    setMobileMoreOpen(menu.hidden);
  });
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMobileMoreOpen(false));
  });
}
```

Call `wireMobileMoreNav()` once before `applyAppRoute()` is first invoked, next to the existing startup wiring:

```js
wireMobileMoreNav();
applyAppRoute();
```

Extend `updateAppSwitchNav(view)` so both desktop and mobile links update:

```js
  document.querySelectorAll("[data-mobile-view]").forEach((item) => {
    const on = item.dataset.mobileView === view;
    item.classList.toggle("is-active", on);
    if (on) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
```

- [ ] **Step 6: Make `web/stats-view.js` independent from badge gallery**

Delete `renderBadgesBlock()` and remove these lines from `startStatsIfNeeded()`:

```js
      window.PokevaultBadges?.subscribe?.(() => {
        renderStats();
        renderBadgesBlock();
      });
```

Replace them with:

```js
      window.PokedexCollection?.subscribeCaught?.(() => renderStats());
```

Remove:

```js
        renderBadgesBlock();
```

Remove:

```js
    window.PokevaultBadges?.poll?.().then(() => renderBadgesBlock());
```

Keep `renderStats()` as the only render call at the end of `startStatsIfNeeded()`.

- [ ] **Step 7: Add i18n keys in `web/i18n.js`**

Add these French keys:

```js
"app.nav.badges": "Badges",
"app.nav.mobile": "Navigation mobile",
"app.nav.more": "Plus",
"app.nav.more_menu": "Navigation secondaire",
"app.nav.collection_short": "Dex",
"app.nav.binders_short": "Classeurs",
"app.nav.stats_short": "Stats",
"app.badges.title": "Badges",
"app.badges.subtitle": "Galerie complète des badges, filtres et dossiers combat.",
"app.badges.shell": "Galerie de badges",
```

Add these English keys:

```js
"app.nav.badges": "Badges",
"app.nav.mobile": "Mobile navigation",
"app.nav.more": "More",
"app.nav.more_menu": "Secondary navigation",
"app.nav.collection_short": "Dex",
"app.nav.binders_short": "Binders",
"app.nav.stats_short": "Stats",
"app.badges.title": "Badges",
"app.badges.subtitle": "Complete badge gallery, filters, and battle dossiers.",
"app.badges.shell": "Badge gallery",
```

- [ ] **Step 8: Run focused tests and verify green**

Run:

```bash
node --test tests/web/app-ownership.test.mjs tests/web/stats-view.test.mjs
uv run pytest tests/test_mobile_home_css.py tests/test_docs_site.py -q
```

Expected: all pass.

- [ ] **Step 9: Commit route split**

```bash
git add web/index.html web/app.js web/badges-page.js web/stats-view.js web/i18n.js tests/web/stats-view.test.mjs
git commit -m "feat(web): split badges from statistics"
```

## Task 3: Local Fonts And Single Vault Lab Theme

**Files:**
- Add: `web/assets/fonts/*.woff2`
- Modify: `web/styles.css`
- Delete: `web/themes.js`
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/i18n.js`
- Modify: `tests/test_theme_palettes.py`
- Modify: `tests/test_docs_site.py`

- [ ] **Step 1: Replace theme tests with single Vault Lab checks**

In `tests/test_theme_palettes.py`, replace `EXPECTED_THEMES` with:

```python
EXPECTED_THEME = "Vault Lab"
```

Replace `test_theme_tokens_cover_readable_open_source_palettes()` with:

```python
def test_vault_lab_tokens_cover_readable_single_theme() -> None:
    css = STYLES.read_text(encoding="utf-8")
    tokens = _theme_tokens(css, "default")
    missing = [token for token in REQUIRED_TOKENS if token not in tokens]
    assert not missing, f"Vault Lab: missing {missing}"

    for surface in ["--bg", "--card", "--surface-low", "--surface-high"]:
        text_contrast = _contrast(tokens["--text"], tokens[surface])
        muted_contrast = _contrast(tokens["--muted"], tokens[surface])
        assert text_contrast >= 7.0, f"Vault Lab: text on {surface}"
        assert muted_contrast >= 4.5, f"Vault Lab: muted on {surface}"

    for signal in ["--accent", "--accent-strong", "--electric"]:
        assert _contrast(tokens[signal], tokens["--bg"]) >= 4.5, f"Vault Lab: {signal} on bg"
        assert _contrast(tokens[signal], tokens["--card"]) >= 4.5, f"Vault Lab: {signal} on card"

    assert _contrast(tokens["--accent-ink"], tokens["--accent"]) >= 4.5, "Vault Lab: accent ink"
```

Replace `test_theme_surfaces_are_visually_distinct()` with:

```python
def test_vault_lab_surfaces_are_visually_distinct() -> None:
    css = STYLES.read_text(encoding="utf-8")
    tokens = _theme_tokens(css, "default")
    assert _channel_distance(tokens["--bg"], tokens["--card"]) >= 0.10
    assert _channel_distance(tokens["--card"], tokens["--control-bg"]) >= 0.05
    assert _channel_distance(tokens["--card"], tokens["--surface-high"]) >= 0.14
```

Replace `test_theme_labels_match_design_language()` with:

```python
def test_single_theme_runtime_is_removed_from_web_app() -> None:
    index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    css = STYLES.read_text(encoding="utf-8")

    assert 'src="/themes.js"' not in index
    assert "settingsThemeSelect" not in index
    assert 'data-theme="kanto"' not in css
    assert 'html[data-theme="kanto"]' not in css
    assert 'html[data-theme="hoenn"]' not in css
    assert 'html[data-theme="paldea"]' not in css
```

Add:

```python
def test_vault_lab_fonts_are_local_and_declared() -> None:
    css = STYLES.read_text(encoding="utf-8")
    for font in [
        "barlow-latin-400.woff2",
        "barlow-latin-500.woff2",
        "barlow-latin-600.woff2",
        "barlow-latin-700.woff2",
        "space-mono-latin-400.woff2",
        "space-mono-latin-700.woff2",
    ]:
        assert (ROOT / "web" / "assets" / "fonts" / font).is_file(), font
        assert f"/assets/fonts/{font}" in css
    assert "fonts.googleapis.com" not in css
    assert "fonts.gstatic.com" not in css
```

- [ ] **Step 2: Extend third-party font static check**

In `tests/test_docs_site.py`, extend `test_web_app_has_no_third_party_font_requests()`:

```python
    for path in [WEB / "index.html", WEB / "styles.css", *WEB.glob("*.js")]:
        text = path.read_text(encoding="utf-8")
        assert "fonts.googleapis.com" not in text, path
        assert "fonts.gstatic.com" not in text, path
        assert "Material Symbols" not in text, path
        assert "material-symbols" not in text, path
```

- [ ] **Step 3: Run theme/font tests and verify red**

Run:

```bash
uv run pytest tests/test_theme_palettes.py tests/test_docs_site.py::test_web_app_has_no_third_party_font_requests -q
```

Expected: failures mention missing font files, `themes.js` still referenced, `settingsThemeSelect`, and `html[data-theme]` blocks.

- [ ] **Step 4: Extract local fonts from `maquette/maquette_v1.html`**

Create `web/assets/fonts/`.

Run this command from the worktree root:

```bash
node --input-type=module -e 'import fs from "node:fs"; import zlib from "node:zlib"; const html = fs.readFileSync("maquette/maquette_v1.html", "utf8"); const manifest = JSON.parse(html.match(/<script type="__bundler\\/manifest">\\n([\\s\\S]*?)\\n  <\\/script>/)[1]); const fonts = new Map([["4e01cf79-c7c2-4e46-888b-5e7ee5c4627e","barlow-latin-400.woff2"],["eca001e7-c918-471b-b1a7-a15b373f6b3a","barlow-latin-500.woff2"],["12a6808c-872e-484c-b4c7-6cae746168e0","barlow-latin-600.woff2"],["34aa77dd-9ef3-4d3d-915a-112d8f9d349d","barlow-latin-700.woff2"],["5e29b3b2-4ca0-46b2-9b55-b201e6c6a321","space-mono-latin-400.woff2"],["77e06af6-4a89-4736-bcf9-35d1c7e302a7","space-mono-latin-700.woff2"]]); fs.mkdirSync("web/assets/fonts", { recursive: true }); for (const [id, name] of fonts) { const entry = manifest[id]; let bytes = Buffer.from(entry.data, "base64"); if (entry.compressed) bytes = zlib.gunzipSync(bytes); fs.writeFileSync(`web/assets/fonts/${name}`, bytes); }'
```

- [ ] **Step 5: Add Vault Lab font declarations and tokens**

At the top of `web/styles.css`, before existing app rules, define:

```css
@font-face {
  font-family: "Barlow";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/barlow-latin-400.woff2") format("woff2");
}

@font-face {
  font-family: "Barlow";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("/assets/fonts/barlow-latin-500.woff2") format("woff2");
}

@font-face {
  font-family: "Barlow";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/assets/fonts/barlow-latin-600.woff2") format("woff2");
}

@font-face {
  font-family: "Barlow";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/assets/fonts/barlow-latin-700.woff2") format("woff2");
}

@font-face {
  font-family: "Space Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/space-mono-latin-400.woff2") format("woff2");
}

@font-face {
  font-family: "Space Mono";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/assets/fonts/space-mono-latin-700.woff2") format("woff2");
}
```

Replace the current root token block with a single Vault Lab block that keeps legacy token names mapped to concrete hex values:

```css
:root {
  color-scheme: dark;
  --font-ui: "Barlow", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "Space Mono", "SFMono-Regular", Consolas, monospace;
  --pdx-bg: #090E1A;
  --pdx-panel: #111827;
  --pdx-panel-hi: #1A2438;
  --pdx-border: #1E2C42;
  --pdx-border-hi: #2A3E5C;
  --pdx-red: #CC1133;
  --pdx-red-dark: #891022;
  --pdx-red-glow: rgba(204, 17, 51, 0.25);
  --pdx-cyan: #00CCEE;
  --pdx-cyan-dim: rgba(0, 204, 238, 0.15);
  --pdx-green: #00CC77;
  --pdx-amber: #F5A623;
  --pdx-text: #DDE6F0;
  --pdx-text-dim: #5C7099;
  --pdx-text-faint: #2D3C55;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --bg: #090E1A;
  --card: #111827;
  --surface-low: #0D1424;
  --surface-high: #1A2438;
  --surface-highest: #22314A;
  --accent: #CC1133;
  --accent-strong: #E01B3D;
  --accent-ink: #FFFFFF;
  --electric: #00CCEE;
  --text: #DDE6F0;
  --muted: #8EA3C2;
  --outline-soft: #1E2C42;
  --outline-strong: #2A3E5C;
  --control-bg: #090E1A;
  --control-border: #1E2C42;
  --control-hover: #2A3E5C;
  --success: #00CC77;
  --danger: #CC1133;
  --warning: #F5A623;
}
```

- [ ] **Step 6: Remove theme runtime and theme selector**

Delete `web/themes.js`.

Remove this script from `web/index.html`:

```html
<script src="/themes.js"></script>
```

Remove the `settingsThemeSelect` label block from Settings.

Remove `setupThemeSelect()` from `web/app.js`.

Remove this call from `setupSettingsView()`:

```js
  setupThemeSelect();
```

Remove these i18n keys from both locale maps if no longer used:

```js
"app.settings.theme": "Thème",
"app.settings.theme": "Theme",
```

Delete the `html[data-theme="kanto"]`, `html[data-theme="hoenn"]`, and `html[data-theme="paldea"]` blocks from `web/styles.css`.

- [ ] **Step 7: Run focused tests and verify green**

Run:

```bash
uv run pytest tests/test_theme_palettes.py tests/test_docs_site.py::test_web_app_has_no_third_party_font_requests -q
```

Expected: all pass.

- [ ] **Step 8: Commit fonts and theme simplification**

```bash
git add web/assets/fonts web/styles.css web/index.html web/app.js web/i18n.js tests/test_theme_palettes.py tests/test_docs_site.py
git rm web/themes.js
git commit -m "feat(web): adopt single vault lab theme"
```

## Task 4: Vault Lab Shell Styling

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Add failing shell CSS assertions**

Append this test to `tests/test_mobile_home_css.py`:

```python
def test_vault_lab_shell_uses_maquette_density_and_mobile_surfaces() -> None:
    topbar = "\n".join(_blocks(".stitch-topbar"))
    assert "height: 48px;" in topbar
    assert "background: var(--pdx-panel);" in topbar
    assert "border-bottom: 1px solid var(--pdx-border);" in topbar

    nav_link = "\n".join(_blocks(".stitch-topnav .app-switch-link"))
    assert "font-family: var(--font-mono);" in nav_link
    assert "text-transform: uppercase;" in nav_link
    assert "height: 48px;" in nav_link

    mobile = _media_block(720)
    for token in [
        ".mobile-bottom-nav",
        "position: fixed;",
        "bottom: 0;",
        "height: 58px;",
        ".mobile-more-menu",
    ]:
        assert token in mobile
```

- [ ] **Step 2: Run shell CSS test and verify red**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_vault_lab_shell_uses_maquette_density_and_mobile_surfaces -q
```

Expected: FAIL because shell styles still use old dimensions and missing mobile surfaces.

- [ ] **Step 3: Replace shell styles**

In `web/styles.css`, make the global shell match the maquette:

```css
html,
body {
  min-height: 100%;
  background: var(--pdx-bg);
  color: var(--pdx-text);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.4;
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
}

body::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  content: "";
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
  background-size: 22px 22px;
}

.stitch-topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 100;
  height: 48px;
  background: var(--pdx-panel);
  border-bottom: 1px solid var(--pdx-border);
}

.stitch-topbar-inner {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  gap: 18px;
}

.stitch-brand {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--pdx-text);
  text-transform: uppercase;
}

.stitch-topnav {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
}

.stitch-topnav .app-switch-link {
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 12px;
  border-bottom: 2px solid transparent;
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.stitch-topnav .app-switch-link:hover,
.stitch-topnav .app-switch-link.is-active {
  color: var(--pdx-cyan);
}

.stitch-topnav .app-switch-link.is-active {
  border-bottom-color: var(--pdx-cyan);
}

.stitch-canvas {
  min-height: 100vh;
  padding: 64px 16px 24px;
}
```

Add mobile shell styles in the `@media (max-width: 720px)` block:

```css
@media (max-width: 720px) {
  .stitch-topnav {
    display: none;
  }

  .stitch-canvas {
    padding: 56px 10px 72px;
  }

  .mobile-bottom-nav {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 140;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    height: 58px;
    background: var(--pdx-panel);
    border-top: 1px solid var(--pdx-border);
  }

  .mobile-bottom-nav__item {
    display: flex;
    min-width: 0;
    min-height: 44px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    background: transparent;
    color: var(--pdx-text-faint);
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .mobile-bottom-nav__item.is-active {
    color: var(--pdx-cyan);
  }

  .mobile-more-menu {
    position: fixed;
    right: 10px;
    bottom: 68px;
    z-index: 150;
    display: grid;
    gap: 3px;
    min-width: 180px;
    padding: 8px;
    background: var(--pdx-panel);
    border: 1px solid var(--pdx-border-hi);
    border-radius: var(--radius-md);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.35);
  }

  .mobile-more-menu[hidden] {
    display: none;
  }

  .mobile-more-menu__link {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    color: var(--pdx-text-dim);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .mobile-more-menu__link.is-active,
  .mobile-more-menu__link:hover {
    background: var(--pdx-panel-hi);
    color: var(--pdx-cyan);
  }
}
```

For desktop, hide mobile nav:

```css
@media (min-width: 721px) {
  .mobile-bottom-nav,
  .mobile-more-menu {
    display: none !important;
  }
}
```

- [ ] **Step 4: Run shell tests and verify green**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_vault_lab_shell_uses_maquette_density_and_mobile_surfaces tests/test_mobile_home_css.py::test_page_headers_scroll_with_content_under_fixed_app_bar -q
```

Expected: all pass.

- [ ] **Step 5: Commit shell styling**

```bash
git add web/styles.css tests/test_mobile_home_css.py
git commit -m "feat(web): restyle vault lab app shell"
```

## Task 5: Badge Page Visual Port

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/web/badges-view.test.mjs`
- Modify: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Add gallery shape test for page rendering**

In `tests/web/badges-view.test.mjs`, add this test after the filter tests:

```js
test("renderInto builds a complete standalone badge gallery surface", async () => {
  installBrowserStubs();
  await import(`../../web/badges-view.js?case=standalone-${Date.now()}`);
  const host = globalThis.document.createElement("section");
  globalThis.window.PokevaultBadges._test.setCachedState({
    catalog: [
      { id: "first", title: "First", unlocked: true, current: 1, target: 1, percent: 100 },
      { id: "locked", title: "Locked", unlocked: false, current: 0, target: 2, percent: 0 },
    ],
    unlocked: ["first"],
  });
  globalThis.window.PokevaultBadges.renderInto(host);

  assert.ok(byClass(host, "stats-badges").length);
  assert.ok(byClass(host, "badge-gallery-controls").length);
  assert.ok(byClass(host, "stats-badges-grid").length);
});
```

- [ ] **Step 2: Run new badge test and verify red**

Run:

```bash
node --test tests/web/badges-view.test.mjs
```

Expected: FAIL because `_test.setCachedState` is missing.

- [ ] **Step 3: Add test-only cached state helper**

In `web/badges-view.js`, add this property inside `window.PokevaultBadges._test`:

```js
      setCachedState(state) {
        cachedState = state;
      },
```

- [ ] **Step 4: Restyle badge page and detail modal**

In `web/styles.css`, add/replace badge page rules:

```css
.badges-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.badges-content {
  min-width: 0;
}

.stats-badges {
  margin: 0;
  padding: 16px;
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
}

.badge-gallery-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}

.badge-filter__btn,
.badge-filter__select {
  min-height: 34px;
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-sm);
  background: var(--pdx-bg);
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.badge-filter__btn.is-active,
.badge-filter__btn[aria-pressed="true"] {
  border-color: var(--pdx-cyan);
  background: var(--pdx-cyan-dim);
  color: var(--pdx-cyan);
  box-shadow: none;
}

.stats-badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.badge-tile {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  min-height: 96px;
  padding: 10px;
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-md);
  opacity: 0.55;
}

.badge-tile.is-unlocked {
  border-color: var(--pdx-cyan);
  opacity: 1;
}

.badge-tile__title {
  color: var(--pdx-text);
  font-size: 12px;
  font-weight: 700;
}

.badge-tile__desc,
.badge-tile__progress,
.badge-tile__status {
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
  font-size: 9px;
}

.badge-detail-overlay {
  background: rgba(9, 14, 26, 0.9);
}

.badge-detail {
  max-width: min(92vw, 720px);
  max-height: min(86vh, 760px);
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border-hi);
  border-radius: var(--radius-lg);
  color: var(--pdx-text);
}
```

Keep existing battle dossier rules, but switch colors to `--pdx-*` tokens when touching those blocks.

- [ ] **Step 5: Run badge tests and responsive static tests**

Run:

```bash
node --test tests/web/badges-view.test.mjs
uv run pytest tests/test_mobile_home_css.py::test_badge_detail_modal_and_pokemon_preview_are_responsive tests/test_mobile_home_css.py::test_badge_battle_dossier_layout_is_responsive -q
```

Expected: all pass.

- [ ] **Step 6: Commit badge page styling**

```bash
git add web/badges-view.js web/styles.css tests/web/badges-view.test.mjs
git commit -m "feat(web): restyle badge gallery page"
```

## Task 6: Statistics Page Visual Port

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/web/stats-view.test.mjs`
- Modify: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Add Stats layout static test**

Append this test to `tests/test_mobile_home_css.py`:

```python
def test_stats_page_is_stats_only_vault_lab_dashboard() -> None:
    stats_view = HTML.split('id="viewStats"', 1)[1].split('id="viewClasseur"', 1)[0]
    assert 'id="statsBody"' in stats_view
    assert 'id="statsBadges"' not in stats_view

    stats_shell = "\n".join(_blocks("#viewStats .stats-shell"))
    assert "grid-template-columns:" in stats_shell
    assert "var(--pdx-panel)" in stats_shell or "var(--pdx-bg)" in stats_shell
```

- [ ] **Step 2: Run Stats static test and verify red**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_stats_page_is_stats_only_vault_lab_dashboard -q
```

Expected before CSS work: FAIL if `statsBadges` is still present or shell tokens are not Vault Lab.

- [ ] **Step 3: Restyle Stats dashboard**

Update Stats CSS with Vault Lab rules:

```css
#viewStats .stats-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  max-width: 1240px;
  margin: 0 auto;
}

#viewStats .stats-rail,
#viewStats .stats-hero,
#viewStats .stats-region-wrap {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
}

#viewStats .stats-rail {
  display: grid;
  gap: 14px;
  padding: 14px;
}

#viewStats .stats-rail-kicker,
#viewStats .stats-section-title,
.stats-kpi-label {
  color: var(--pdx-text-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

#viewStats .stats-rail-value,
.stats-kpi-value,
#viewStats .stats-hero-pct {
  color: var(--pdx-cyan);
  font-family: var(--font-mono);
  font-weight: 700;
}

#viewStats .stats-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
}

#viewStats .stats-main {
  display: grid;
  gap: 14px;
  max-width: none;
  margin: 0;
  padding: 0;
}

#viewStats .stats-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  padding: 18px;
}

#viewStats .stats-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stats-kpi-card {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}

#viewStats .stats-region-bar {
  height: 6px;
  overflow: hidden;
  background: var(--pdx-border);
  border-radius: 3px;
}

#viewStats .stats-region-fill {
  height: 100%;
  background: var(--pdx-cyan);
}
```

Keep the existing responsive breakpoint but adjust it:

```css
@media (max-width: 960px) {
  #viewStats .stats-shell {
    grid-template-columns: 1fr;
  }

  #viewStats .stats-kpi-grid,
  #viewStats .stats-bento-grid,
  #viewStats .stats-bento-grid--two {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run Stats tests**

Run:

```bash
node --test tests/web/stats-view.test.mjs
uv run pytest tests/test_mobile_home_css.py::test_stats_page_is_stats_only_vault_lab_dashboard -q
```

Expected: all pass.

- [ ] **Step 5: Commit Stats styling**

```bash
git add web/styles.css tests/test_mobile_home_css.py
git commit -m "feat(web): restyle statistics dashboard"
```

## Task 7: Collection, Modal, And Shared Card Visual Port

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/test_mobile_home_css.py`
- Modify: `tests/test_theme_palettes.py`

- [ ] **Step 1: Add Collection Vault Lab static test**

Append this test to `tests/test_mobile_home_css.py`:

```python
def test_collection_uses_vault_lab_rail_and_cards() -> None:
    collection_shell = "\n".join(_blocks("#viewListe .collection-shell"))
    assert "grid-template-columns:" in collection_shell

    rail = "\n".join(_blocks("#viewListe .collection-rail"))
    assert "var(--pdx-panel)" in rail
    assert "var(--pdx-border)" in rail

    card = "\n".join(_blocks(".card"))
    assert "var(--pdx-panel)" in card or "var(--pdx-bg)" in card
    assert "var(--pdx-border)" in card
```

- [ ] **Step 2: Run Collection static test and verify red**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_collection_uses_vault_lab_rail_and_cards -q
```

Expected: FAIL until Collection cards/rail use `--pdx-*` tokens.

- [ ] **Step 3: Restyle Collection shell and cards**

Update Collection CSS:

```css
#viewListe .collection-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  max-width: 1240px;
  margin: 0 auto;
  align-items: start;
}

#viewListe .collection-rail {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
}

#viewListe .collection-main {
  min-width: 0;
}

#viewListe .collection-main .grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.card {
  position: relative;
  min-width: 0;
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-md);
  color: var(--pdx-text);
  overflow: hidden;
}

.card:hover,
.card:focus-within {
  border-color: var(--pdx-border-hi);
  background: var(--pdx-panel-hi);
}

.card-name {
  color: var(--pdx-text);
  font-weight: 600;
}

.card-number,
.card-region,
.card-details {
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
}

.filter-btn,
.region-filter,
.search-input {
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-sm);
  color: var(--pdx-text);
  font-family: var(--font-ui);
}

.filter-btn.is-active,
.filter-btn[aria-pressed="true"] {
  border-color: var(--pdx-cyan);
  background: var(--pdx-cyan-dim);
  color: var(--pdx-cyan);
}
```

Keep existing card behavior classes (`is-caught`, `is-dimmed`, trade chips) and only change their visual tokens.

- [ ] **Step 4: Restyle Pokémon modal with Vault Lab tokens**

Update the Pokémon modal CSS block so these selectors use the token-driven values below:

```css
.pokemon-modal__panel {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border-hi);
  border-radius: var(--radius-lg);
  color: var(--pdx-text);
}

.pokemon-modal__topbar,
.pokemon-fiche-section {
  border-color: var(--pdx-border);
}

.pokemon-modal__kicker,
.pokemon-fiche-section__title,
.pokemon-status-label {
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
}

.pokemon-modal__close,
.pokemon-status-action,
.pokemon-note-editor__save {
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  color: var(--pdx-text-dim);
}

.pokemon-status-action.is-active,
.pokemon-note-editor__save {
  border-color: var(--pdx-cyan);
  color: var(--pdx-cyan);
}
```

- [ ] **Step 5: Run card/modal tests**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_collection_uses_vault_lab_rail_and_cards tests/test_theme_palettes.py::test_pokemon_modal_uses_theme_tokens tests/test_theme_palettes.py::test_mobile_fiche_css_prioritizes_primary_content -q
node --test tests/web/pokemon-modal.test.mjs tests/web/pokemon-fiche.test.mjs tests/web/app-ownership.test.mjs
```

Expected: all pass.

- [ ] **Step 6: Commit Collection and modal styling**

```bash
git add web/styles.css tests/test_mobile_home_css.py
git commit -m "feat(web): restyle collection and pokemon modal"
```

## Task 8: Binder, Trainers, Print, Docs, And Settings Visual Port

**Files:**
- Modify: `web/styles.css`
- Modify: `web/index.html`
- Modify: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Add static tests for remaining page shells**

Append this test to `tests/test_mobile_home_css.py`:

```python
def test_secondary_pages_use_vault_lab_panels() -> None:
    expected_selectors = [
        "#viewClasseur .binder-shell-layout",
        "#viewDresseurs .trainer-shell",
        "#viewPrint .binder-shell-layout",
        "#viewDocs .docs-shell",
        "#viewSettings .stats-main",
    ]
    for selector in expected_selectors:
        block = "\n".join(_blocks(selector))
        assert block, selector
        assert "var(--pdx-" in block, selector
```

- [ ] **Step 2: Run secondary shell test and verify red**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_secondary_pages_use_vault_lab_panels -q
```

Expected: FAIL for selectors not yet using `--pdx-*` or missing docs shell token styles.

- [ ] **Step 3: Restyle Binder and Print shared shells**

Update shared binder/print rules:

```css
#viewClasseur .binder-shell-layout,
#viewPrint .binder-shell-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

#viewClasseur .binder-vaults-nav,
#viewPrint .binder-vaults-nav,
#viewClasseur .binder-shell-main,
#viewPrint .binder-shell-main {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
}

#viewClasseur .binder-vault-item,
#viewPrint .binder-vault-item {
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-md);
  color: var(--pdx-text);
}

#viewClasseur .binder-vault-item.is-active,
#viewPrint .binder-vault-item.is-active {
  border-color: var(--pdx-cyan);
  background: var(--pdx-cyan-dim);
}

#viewClasseur .binder-page-panel,
#viewPrint .print-section {
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-md);
}
```

- [ ] **Step 4: Restyle Dresseurs**

Update trainer rules:

```css
#viewDresseurs .trainer-shell {
  display: grid;
  gap: 16px;
  max-width: 1240px;
  margin: 0 auto;
}

.trainer-card,
.trainer-panel,
.trainer-contact-card {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
  color: var(--pdx-text);
}

.trainer-tag,
.trainer-social-link,
.trainer-danger-btn,
.trainer-note-form button {
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-sm);
  background: var(--pdx-bg);
  color: var(--pdx-text-dim);
  font-family: var(--font-mono);
}
```

- [ ] **Step 5: Restyle Docs and Settings**

Replace the existing docs shell opening tag with:

```html
<section class="docs-shell" aria-label="Documentation" data-i18n-aria-label="app.docs.shell">
```

Add this key to both the French and English dictionaries:

```js
"app.docs.shell": "Documentation",
```

Use CSS:

```css
#viewDocs .docs-shell,
#viewSettings .stats-main {
  display: grid;
  gap: 14px;
  max-width: 960px;
  margin: 0 auto;
}

#viewDocs .docs-panel,
#viewSettings .stats-kpi-card {
  background: var(--pdx-panel);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-lg);
  color: var(--pdx-text);
}

#viewSettings .settings-action-btn {
  background: var(--pdx-bg);
  border: 1px solid var(--pdx-border);
  border-radius: var(--radius-sm);
  color: var(--pdx-text);
  font-family: var(--font-mono);
}
```

- [ ] **Step 6: Run focused page tests**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_secondary_pages_use_vault_lab_panels tests/test_mobile_home_css.py::test_binder_cards_keep_pokemon_content_centered tests/test_mobile_home_css.py::test_trainer_contacts_are_optional_and_isolated tests/test_mobile_home_css.py::test_settings_no_longer_exposes_multi_profile_controls -q
node --test tests/web/binder-collection-view.test.mjs tests/web/binder-layout-engine.test.mjs tests/web/print-view.test.mjs tests/web/trainer-contacts.test.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit secondary page styling**

```bash
git add web/index.html web/styles.css web/i18n.js tests/test_mobile_home_css.py
git commit -m "feat(web): restyle secondary vault lab pages"
```

## Task 9: Full Test Pass And Browser Verification

**Files:**
- Modify only if verification reveals regressions.

- [ ] **Step 1: Run full web tests**

Run:

```bash
make web-test
```

Expected: 0 failures.

- [ ] **Step 2: Run full Python tests**

Run:

```bash
make test
```

Expected: 0 failures.

- [ ] **Step 3: Start local app server**

Run on an unused port:

```bash
TRACKER_HOST=127.0.0.1 TRACKER_PORT=8765 uv run python -m tracker
```

Expected: server starts and serves the app at `http://127.0.0.1:8765/`.

- [ ] **Step 4: Capture desktop visual checkpoints**

Open or capture these URLs at approximately 1280px width:

```text
http://127.0.0.1:8765/#/liste
http://127.0.0.1:8765/#/badges
http://127.0.0.1:8765/#/stats
http://127.0.0.1:8765/#/classeur
http://127.0.0.1:8765/#/dresseurs
http://127.0.0.1:8765/#/print
http://127.0.0.1:8765/#/docs
http://127.0.0.1:8765/#/settings
```

Compare against `maquette/maquette_v1.html` for:

- topbar density and nav order;
- Vault Lab colors;
- Barlow/Space Mono rendering;
- panel radius and borders;
- Stats without badge gallery;
- Badges as its own gallery page;
- Pokémon and badge details opening as modals.

- [ ] **Step 5: Capture responsive checkpoints**

Check at approximately 768px and 390px:

- bottom nav is visible;
- `Plus` opens `Dresseurs`, `Impression`, `Docs`, `Réglages`;
- no horizontal overflow on Collection, Badges, Stats, and Binder;
- card text fits inside cards and buttons.

- [ ] **Step 6: Stop local server**

Stop the running server session cleanly with `Ctrl+C` in the terminal that owns it.

- [ ] **Step 7: Commit visual verification notes if fixes were needed**

If any fix was made during verification:

```bash
git add web tests
git commit -m "fix(web): polish maquette v1 responsive surfaces"
```

If no fix was made, do not create an empty commit.

## Task 10: Final Branch Readiness

**Files:**
- No code changes expected.

- [ ] **Step 1: Check worktree status**

Run:

```bash
git status --short --branch
```

Expected: only intentional untracked local references such as `AGENTS.md` and `maquette/`, or a clean tree if they were ignored locally. No modified tracked files.

- [ ] **Step 2: Show commit series**

Run:

```bash
git log --oneline origin/main..HEAD
```

Expected: commits for tests, route split, theme/fonts, shell styling, page styling, and any verification fixes.

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin feature/maquette-v1-design
```

Expected: branch pushed.

- [ ] **Step 4: Prepare PR summary**

Use this PR summary:

```markdown
## Summary
- apply the maquette v1 Vault Lab design across the web app shell and pages
- split Badges into a standalone route/page separate from Statistiques
- replace multi-theme UI with a single local-font Vault Lab design system
- restyle Collection, Classeurs, Dresseurs, Badges, Statistiques, Impression, Docs, and Réglages while preserving behavior

## Tests
- make web-test
- make test
- visual checks at 1280px, 768px, and 390px against maquette/maquette_v1.html
```
