# Trainer Card Badge Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export unlocked badges automatically in Trainer Cards and display shared badges on imported trainer contacts.

**Architecture:** Add a compact public badge DTO to `TrainerCard`, normalize it in `TrainerContactService`, and let `web/trainer-contacts.js` inject unlocked badges from `window.PokevaultBadges.state` when building and exporting cards. Rendering remains local to the existing `Dresseurs` tab.

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic v2, vanilla browser JavaScript, Node test runner, pytest.

---

### Task 1: Backend Trainer Card Contract

**Files:**
- Modify: `tracker/models.py`
- Modify: `tracker/services/trainer_contact_service.py`
- Test: `tests/tracker/test_trainer_contact_service.py`
- Test: `tests/tracker/test_trainer_contact_api.py`

- [x] **Step 1: Write failing service and API tests**

Add tests asserting that `badges` is accepted, cleaned, and deduplicated by id.

- [x] **Step 2: Run targeted backend tests and verify RED**

Run: `uv run pytest tests/tracker/test_trainer_contact_service.py::test_save_own_card_cleans_shared_badges tests/tracker/test_trainer_contact_api.py::test_put_own_card_accepts_shared_badges -q`

Expected before implementation: failures because `badges` is rejected or missing.

- [x] **Step 3: Implement model and service cleanup**

Add `TrainerCardBadge` with `id` and `title`, add `badges` to `TrainerCard`, and clean the list in `_clean_card`.

- [x] **Step 4: Re-run targeted backend tests**

Run: `uv run pytest tests/tracker/test_trainer_contact_service.py::test_save_own_card_cleans_shared_badges tests/tracker/test_trainer_contact_api.py::test_put_own_card_accepts_shared_badges -q`

Expected after implementation: both tests pass.

### Task 2: Web Export and Contact Rendering

**Files:**
- Modify: `web/trainer-contacts.js`
- Modify: `web/i18n.js`
- Modify: `web/styles.css`
- Test: `tests/web/trainer-contacts.test.mjs`

- [x] **Step 1: Write failing web tests**

Add tests for unlocked badge injection, locked badge exclusion, and received
contact rendering.

- [x] **Step 2: Run targeted web tests and verify RED**

Run: `node --test tests/web/trainer-contacts.test.mjs`

Expected before implementation: failures because badge helpers and rendering do
not exist.

- [x] **Step 3: Implement minimal web behavior**

Normalize `badges`, collect unlocked badges from `PokevaultBadges.state`, include
them in `cardFromForm`, refresh before export when possible, and render a
compact badge group on contact cards.

- [x] **Step 4: Re-run targeted web tests**

Run: `node --test tests/web/trainer-contacts.test.mjs`

Expected after implementation: all trainer contact web tests pass.

### Task 3: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/TRAINER_CONTACTS.md`
- Test: `tests/test_docs_site.py`

- [x] **Step 1: Document public badge sharing**

Mention that exported Trainer Cards include unlocked badge names.

- [x] **Step 2: Run focused verification**

Run: `uv run pytest tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py tests/test_docs_site.py -q`

Run: `node --test tests/web/trainer-contacts.test.mjs`

- [x] **Step 3: Run full project verification**

Run: `make check`
