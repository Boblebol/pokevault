# Base Generations Nostalgia Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nostalgic trainer-team badges for every non-remake base version line after Or/Argent, including N and Noir 2/Blanc 2.

**Architecture:** Extend the existing `BadgeService` catalog with data-only `_team_badge(...)` entries using generation-prefixed ids. The current team progress, monotonic unlock, API response and Trainer Card badge sharing behavior remain unchanged.

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic v2, pytest, static README/docs HTML.

---

### Task 1: Source and Scope Notes

**Files:**
- Create: `superpowers/specs/2026-05-03-base-generations-nostalgia-badges-design.md`
- Create: `superpowers/plans/2026-05-03-base-generations-nostalgia-badges.md`

- [x] **Step 1: Record the approved scope**

Document that remakes and third versions are out of scope, while N and
Noir 2/Blanc 2 are included by explicit user approval.

- [x] **Step 2: Record source pages**

List Pokemon Database source pages used for official Gym Leader, Elite Four,
Kahuna, Champion and equivalent teams.

### Task 2: Failing Badge Tests

**Files:**
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tests/tracker/test_badge_api.py`

- [x] **Step 1: Add service catalog tests**

Add a test asserting representative new ids exist for each prefix:
`rs_`, `dp_`, `bw_`, `b2w2_`, `xy_`, `sm_`, `swsh_`, `sv_`.

- [x] **Step 2: Add variant and duplicate behavior tests**

Add focused tests for:

- Rubis/Saphir Roxanne full-team progress.
- Rubis/Saphir Flannery duplicate Slugma counting once.
- Noir/Blanc Trio Badge starter variants.
- Noir/Blanc N final legendary variants.
- Noir 2/Blanc 2 Hugh starter variants.

- [x] **Step 3: Add API exposure tests**

Add `/api/badges` checks for representative newer badges such as `swsh_milo`
and `sv_katy`.

- [x] **Step 4: Run RED tests**

Run targeted pytest for the new tests and confirm failures are due to missing
badge ids.

### Task 3: Badge Definitions

**Files:**
- Modify: `tracker/services/badge_service.py`

- [x] **Step 1: Add Rubis/Saphir and Diamant/Perle badges**

Append `rs_` and `dp_` badge definitions after existing Or/Argent entries.

- [x] **Step 2: Add Noir/Blanc and Noir 2/Blanc 2 badges**

Append `bw_` and `b2w2_` definitions, including N and Hugh variant teams.

- [x] **Step 3: Add X/Y, Soleil/Lune, Epee/Bouclier and Ecarlate/Violet badges**

Append `xy_`, `sm_`, `swsh_` and `sv_` definitions.

- [x] **Step 4: Validate slugs against `data/pokedex.json`**

Run a local validation script that loads all local Pokemon slugs and confirms
every team requirement exists.

- [x] **Step 5: Run GREEN tests**

Run the same targeted pytest command from Task 2 and confirm the new tests pass.

### Task 4: Public Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `tests/test_docs_site.py`

- [x] **Step 1: Add docs test coverage**

Extend the nostalgia badge docs test to require the new version group names and
the no-remake scope.

- [x] **Step 2: Update README and features page**

Mention the expanded base-version nostalgia catalog next to the existing
Rouge/Bleu and Or/Argent copy.

- [x] **Step 3: Run docs test**

Run `uv run pytest tests/test_docs_site.py::test_kanto_nostalgia_badges_are_documented -q`.

### Task 5: Verification and Shipping

**Files:**
- All changed files

- [x] **Step 1: Run focused verification**

Run `uv run pytest tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py tests/test_docs_site.py -q`.

- [x] **Step 2: Run full verification**

Run `make check`.

- [ ] **Step 3: Commit and prepare PR/release**

Commit with `feat: expand nostalgia badges across base generations`, then push
and create the PR/release once verification is green.
