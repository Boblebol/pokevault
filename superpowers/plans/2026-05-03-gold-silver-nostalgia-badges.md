# Gold/Silver Nostalgia Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete Pokemon Or/Argent trainer-team badges for Johto, Kanto post-game, Elite Four, Champion Lance and Rival Silver.

**Architecture:** Extend the existing data-driven `BadgeService` catalog with `gs_` team badges. Reuse the current `required_slug_sets` behavior so API responses, progress bars, monotonic unlocks and trainer-card sharing keep working without frontend contract changes.

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic v2, pytest, existing static docs.

---

### Task 1: Badge Catalog Tests

**Files:**
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tests/tracker/test_badge_api.py`

- [x] **Step 1: Write failing service tests**

Add tests for all `gs_` ids, Falkner team completion, Gold/Silver Brock's
post-game team, Lance duplicate Dragonite slots, and Rival Silver variants.

- [x] **Step 2: Write failing API test**

Add a `/api/badges` test proving `gs_falkner` flows through the public response.

- [x] **Step 3: Run RED tests**

Run:
`uv run pytest tests/tracker/test_badge_service.py::test_gold_silver_badges_are_in_catalog tests/tracker/test_badge_service.py::test_gold_silver_johto_gym_badge_requires_full_caught_team tests/tracker/test_badge_service.py::test_gold_silver_kanto_badge_uses_gold_silver_team tests/tracker/test_badge_service.py::test_gold_silver_lance_counts_duplicate_dragonite_once tests/tracker/test_badge_service.py::test_gold_silver_rival_badge_unlocks_with_any_rematch_variant tests/tracker/test_badge_service.py::test_gold_silver_rival_progress_uses_closest_variant tests/tracker/test_badge_api.py::test_badges_endpoint_exposes_gold_silver_trainer_badges -q`

Expected before implementation: failures because `gs_` ids do not exist.

### Task 2: Badge Definitions

**Files:**
- Modify: `tracker/services/badge_service.py`

- [x] **Step 1: Add `gs_` badges**

Append `_team_badge(...)` entries for all Or/Argent teams using exact local
slugs from `data/pokedex.json`.

- [x] **Step 2: Run GREEN tests**

Run the same targeted pytest command from Task 1.

Expected after implementation: targeted tests pass.

### Task 3: Public Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `tests/test_docs_site.py`

- [x] **Step 1: Write docs test**

Extend the nostalgia badge docs test to require `Or/Argent`, `Johto`, `Kanto`
and `Silver`.

- [x] **Step 2: Update docs copy**

Mention Or/Argent badges next to the existing Kanto badge copy.

- [x] **Step 3: Run docs test**

Run:
`uv run pytest tests/test_docs_site.py::test_kanto_nostalgia_badges_are_documented -q`

Expected after docs update: pass.

### Task 4: Full Verification and Shipping

**Files:**
- All changed files

- [x] **Step 1: Run focused verification**

Run:
`uv run pytest tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py tests/test_docs_site.py -q`

- [x] **Step 2: Run full verification**

Run:
`make check`

- [ ] **Step 3: Commit and open PR**

Commit message:
`feat: add gold silver nostalgia badges`
