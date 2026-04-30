# Product Tour Local Trades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the first-run product tour and documentation so Pokevault clearly explains local Pokedex tracking plus optional Trainer Card trade matching.

**Architecture:** Keep the onboarding profile data unchanged and only expand the static wizard copy from three to five steps. Documentation changes describe the same existing local-first data flow and are protected by static tests.

**Tech Stack:** Static HTML/CSS/JS, Node web unit tests, pytest documentation/static checks.

---

### Task 1: Product Tour Coverage Test

**Files:**
- Modify: `tests/test_mobile_home_css.py`
- Validate: `web/index.html`

- [ ] **Step 1: Write the failing test**

Add a pytest that extracts the onboarding block and checks for five steps plus the local trade vocabulary:

```python
def test_onboarding_product_tour_covers_local_trade_workflow() -> None:
    block = HTML.split('id="onboardingWizard"', 1)[1].split('id="settingsDialog"', 1)[0]
    assert block.count('class="onboarding__step') == 5
    for text in [
        "Cherche",
        "J'ai",
        "Double",
        "Vu chez",
        "Match",
        "Dresseurs",
        "sans compte",
    ]:
        assert text in block
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_mobile_home_css.py::test_onboarding_product_tour_covers_local_trade_workflow -q`

Expected: FAIL because the current tour has three steps and does not mention `Vu chez`, `Match`, or `sans compte`.

- [ ] **Step 3: Implement the minimal tour changes**

Modify `web/index.html` so the onboarding has five dots and five sections:

1. `Étape 1 · Pokédex` for `Cherche`, `J'ai`, `Double`.
2. `Étape 2 · Échanges locaux` for `Vu chez`, `Match`, and `Dresseurs`.
3. `Étape 3 · Région favorite` with the existing region select.
4. `Étape 4 · Mode de suivi` with the existing simple/advanced choices.
5. `Étape 5 · Données locales` for no account, exports, imports, and manual updates.

Modify `web/onboarding.js`:

```js
const TOTAL_STEPS = 5;
```

Update the file header comment to describe the five steps.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_mobile_home_css.py::test_onboarding_product_tour_covers_local_trade_workflow -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add web/index.html web/onboarding.js tests/test_mobile_home_css.py
git commit -m "feat(web): expand onboarding product tour"
```

### Task 2: Local Trade Documentation

**Files:**
- Modify: `tests/test_docs_site.py`
- Modify: `docs/TRAINER_CONTACTS.md`
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/index.html`

- [ ] **Step 1: Write the failing docs test**

Extend the docs assertions so the public docs include the full local trade workflow:

```python
def test_trainer_contacts_document_local_trade_workflow() -> None:
    guide = read("docs/TRAINER_CONTACTS.md")
    for text in [
        "Create your Trainer Card",
        "Import a received card",
        "Update a contact",
        "Find a trade",
        "without an account",
        "`Vu chez`",
        "`Match`",
    ]:
        assert text in guide
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_docs_site.py::test_trainer_contacts_document_local_trade_workflow -q`

Expected: FAIL because the current guide is still a compact format note.

- [ ] **Step 3: Expand docs**

Rewrite `docs/TRAINER_CONTACTS.md` as the canonical guide with these sections:

- `What it is`
- `Create your Trainer Card`
- `Export and send it`
- `Import a received card`
- `Update a contact`
- `Find a trade`
- `Privacy and local files`
- `Troubleshooting`

Update public docs and README with short, consistent language that says Trainer Cards are optional, local, manually exchanged files that can produce `Vu chez` and `Match`.

- [ ] **Step 4: Run docs tests**

Run: `uv run pytest tests/test_docs_site.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add README.md docs/TRAINER_CONTACTS.md docs/features.html docs/index.html docs/roadmap.html tests/test_docs_site.py
git commit -m "docs: expand local trade workflow guide"
```

### Task 3: Final Verification

**Files:**
- Validate all changed files.

- [ ] **Step 1: Run focused frontend tests**

Run: `node --test tests/web/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run focused pytest checks**

Run: `uv run pytest tests/test_mobile_home_css.py tests/test_docs_site.py -q`

Expected: all tests pass.

- [ ] **Step 3: Run full project check**

Run: `make check`

Expected: ruff passes, pytest passes, coverage remains at the configured threshold.

- [ ] **Step 4: Confirm git state**

Run: `git status --short --branch`

Expected: branch shows only intentional commits and no uncommitted changes.
