# GitHub Pages Open Source Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-build GitHub Pages site in `docs/` and finish the missing open-source documentation.

**Architecture:** Static HTML pages share one CSS file and one small JS file. Pages link to repository documentation for detailed source-of-truth content and use existing screenshots from `docs/screenshots/`.

**Tech Stack:** HTML, CSS, vanilla JavaScript, pytest static link checks, existing `make check`.

---

### Task 1: Static Docs Test

**Files:**
- Create: `tests/test_docs_site.py`

- [x] Add a pytest module that asserts the expected site pages exist, local
  links/images resolve, core nav labels appear and `SECURITY.md` exists.
- [x] Run it before implementation and confirm it fails because the Pages files
  do not exist yet.

### Task 2: Site Assets

**Files:**
- Create: `docs/assets/site.css`
- Create: `docs/assets/site.js`
- Create: `docs/.nojekyll`

- [ ] Add a responsive Tech-Noir theme derived from the app.
- [ ] Add progressive enhancement for active navigation and command copying.

### Task 3: Public Pages

**Files:**
- Create: `docs/index.html`
- Create: `docs/features.html`
- Create: `docs/install.html`
- Create: `docs/architecture.html`
- Create: `docs/roadmap.html`
- Create: `docs/contributing.html`

- [ ] Build the landing page and five supporting pages with shared navigation.
- [ ] Use existing screenshots and repository-relative links only.

### Task 4: Open Source Docs

**Files:**
- Create: `SECURITY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] Add a responsible-disclosure policy.
- [ ] Refresh contribution docs for current user-state files and postponed
  backlog.
- [ ] Link the GitHub Pages site from README.
- [ ] Document the site in the changelog.

### Task 5: Verification

**Files:**
- No production changes.

- [ ] Run `uv run pytest tests/test_docs_site.py -q`.
- [ ] Run `node --check docs/assets/site.js`.
- [ ] Run `make check`.
- [ ] Run `git diff --check`.
