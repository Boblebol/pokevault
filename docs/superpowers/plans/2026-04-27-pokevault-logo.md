# Pokevault Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Vault Binder logo across the app, documentation site, GitHub Pages, README and design system document.

**Architecture:** Keep the logo as static SVG assets with no build step. The docs site and README use `docs/assets/`; the local app uses `web/assets/` because FastAPI serves `web/` as the app static root.

**Tech Stack:** Static SVG, HTML, CSS, Markdown, pytest static docs checks.

---

## File Structure

- Create `docs/assets/logo.svg`: large reusable Vault Binder mark for README and docs contexts.
- Create `docs/assets/logo-mark.svg`: compact nav/favicon-sized docs mark.
- Create `docs/assets/favicon.svg`: docs favicon using the same mark.
- Create `web/assets/logo-mark.svg`: runtime app nav mark served from `/assets/logo-mark.svg`.
- Create `web/assets/favicon.svg`: runtime app favicon served from `/assets/favicon.svg`.
- Modify `docs/*.html`: add favicon link and replace the generated gradient brand mark with the SVG asset.
- Modify `docs/assets/site.css`: size the image-based docs brand mark.
- Modify `web/index.html`: add favicon link and topbar logo before the wordmark.
- Modify `web/styles.css`: style the app logo and keep header spacing stable.
- Modify `README.md`: add a centered project logo near the top.
- Modify `DESIGN.md`: document the approved logo and asset usage.
- Modify `tests/test_docs_site.py`: assert brand assets exist and keep local docs references checked.

### Task 1: Add Brand Assets

**Files:**
- Create: `docs/assets/logo.svg`
- Create: `docs/assets/logo-mark.svg`
- Create: `docs/assets/favicon.svg`
- Create: `web/assets/logo-mark.svg`
- Create: `web/assets/favicon.svg`

- [x] **Step 1: Add SVG assets**

Use the approved Vault Binder geometry: charcoal binder body, cyan spine, red clasp and light center button.

- [x] **Step 2: Confirm paths exist**

Run: `test -f docs/assets/logo.svg && test -f docs/assets/logo-mark.svg && test -f docs/assets/favicon.svg && test -f web/assets/logo-mark.svg && test -f web/assets/favicon.svg`

Expected: exit code 0.

### Task 2: Integrate Logo In HTML And Markdown

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/features.html`
- Modify: `docs/install.html`
- Modify: `docs/architecture.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/contributing.html`
- Modify: `docs/assets/site.css`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `README.md`
- Modify: `DESIGN.md`

- [x] **Step 1: Add docs favicon and nav mark**

Each docs page head gets:

```html
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
```

Each docs nav brand uses:

```html
<span class="brand-mark" aria-hidden="true"><img src="assets/logo-mark.svg" alt=""></span>
```

- [x] **Step 2: Add app favicon and topbar mark**

The app head gets:

```html
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
```

The app topbar brand wrap starts with:

```html
<img class="stitch-brand-logo" src="/assets/logo-mark.svg" alt="" aria-hidden="true" />
```

- [x] **Step 3: Add README logo block**

Place this below badges and before the existing screenshot:

```html
<p align="center">
  <img src="docs/assets/logo.svg" alt="pokevault logo" width="140">
</p>
```

- [x] **Step 4: Add DESIGN.md logo section**

Add a "Brand Logo" section after the overview describing the Vault Binder mark, colors and asset paths.

### Task 3: Test Static References

**Files:**
- Modify: `tests/test_docs_site.py`

- [x] **Step 1: Add asset existence assertions**

Add a test that checks:

```python
for asset in [
    ROOT / "docs" / "assets" / "logo.svg",
    ROOT / "docs" / "assets" / "logo-mark.svg",
    ROOT / "docs" / "assets" / "favicon.svg",
    ROOT / "web" / "assets" / "logo-mark.svg",
    ROOT / "web" / "assets" / "favicon.svg",
]:
    assert asset.is_file(), asset
```

- [x] **Step 2: Run docs tests**

Run: `uv run pytest tests/test_docs_site.py -q`

Expected: all tests pass.

### Task 4: Final Verification

**Files:**
- Verify: `docs/assets/*.svg`
- Verify: `web/assets/*.svg`
- Verify: `docs/*.html`
- Verify: `web/index.html`
- Verify: `README.md`
- Verify: `DESIGN.md`

- [x] **Step 1: Run static checks**

Run: `uv run pytest tests/test_docs_site.py -q`

Expected: all tests pass.

- [x] **Step 2: Inspect git diff**

Run: `git diff --stat`

Expected: changes are limited to logo assets, app/docs integration, README, DESIGN.md, test and this plan.
