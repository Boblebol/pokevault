# Pokemon Trade States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible Pokemon status workflow with compact `Cherche`, `J'ai`, and `Double` actions while deriving `Vu chez` and matching from imported trainer contacts.

**Architecture:** Keep the existing backend data models. `J'ai` continues to use progress `caught`, `Cherche` writes to hunts and `TrainerCard.wants`, and `Double` writes to progress `caught` plus `TrainerCard.for_trade`. The global list and binder pages share `createPokemonCard`, so compact chips added there become available in both places.

**Tech Stack:** Vanilla browser JavaScript, FastAPI-backed JSON endpoints, Pydantic models, Node test runner, pytest, existing static docs/GitHub Pages.

---

## File Structure

- Modify `web/pokemon-fiche.js`: add shared ownership action model and DOM renderer used by cards, drawer, and full Pokemon pages.
- Modify `tests/web/pokemon-fiche.test.mjs`: cover ownership action labels and active states.
- Modify `web/trainer-contacts.js`: expose loaded trainer book, own-card list membership updates, contact availability, and match summaries.
- Modify `tests/web/trainer-contacts.test.mjs`: cover list membership and contact matching helpers.
- Modify `web/app.js`: replace card-level click cycling with compact ownership chips, wire state transitions, load/subscribe trainer contacts.
- Modify `web/pokemon-drawer.js` and `web/pokemon-full-view.js`: use ownership actions in Pokemon fiche status sections and show contact availability.
- Modify `web/binder-collection-view.js`: subscribe to trainer contact changes so binder cards refresh `Chez`/`Match` badges.
- Modify `web/keyboard.js` and `web/index.html`: update shortcut behavior/help and onboarding product tour wording.
- Modify `web/styles.css` and `tests/test_mobile_home_css.py`: compact chip/badge styling and guard assertions.
- Modify `README.md`, `docs/TRAINER_CONTACTS.md`, `docs/features.html`, `docs/roadmap.html`, `docs/ROADMAP.md`, `tests/test_docs_site.py`: document the harmonized product behavior.

---

### Task 1: Shared Ownership Action Model

**Files:**
- Modify: `tests/web/pokemon-fiche.test.mjs`
- Modify: `web/pokemon-fiche.js`

- [ ] Add tests for `buildOwnershipActionModel`:
  - no state: `Cherche`, `J'ai`, `Double` all inactive;
  - wanted: `Cherche` active;
  - caught: `J'ai` active;
  - duplicate: `Double` active.
- [ ] Run `node --test tests/web/pokemon-fiche.test.mjs`; expect failure because the helper does not exist.
- [ ] Add `buildOwnershipActionModel`, `ownershipLabel`, and `createOwnershipActions` to `web/pokemon-fiche.js`.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit: `feat(web): add pokemon ownership action model`.

### Task 2: Trainer Contact Trade Helpers

**Files:**
- Modify: `tests/web/trainer-contacts.test.mjs`
- Modify: `web/trainer-contacts.js`

- [ ] Add tests for:
  - updating `wants`/`for_trade` membership without duplicates;
  - creating a minimal own Trainer Card when no card exists;
  - finding contacts that have a slug in `for_trade`;
  - computing `availableFrom` and `matches` for a searched slug.
- [ ] Run `node --test tests/web/trainer-contacts.test.mjs`; expect failure.
- [ ] Add public helpers to `window.PokevaultTrainerContacts`:
  - `ensureLoaded`;
  - `subscribe`;
  - `getOwnCard`;
  - `setOwnListMembership`;
  - `contactsTrading`;
  - `contactsWanting`;
  - `tradeSummary`;
  - test-only pure helpers.
- [ ] Keep `Dresseurs` rendering unchanged except that saves/imports notify subscribers.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit: `feat(web): expose trainer trade helpers`.

### Task 3: List And Binder Pokemon Chips

**Files:**
- Modify: `web/app.js`
- Modify: `web/binder-collection-view.js`
- Modify: `tests/web/pokemon-fiche.test.mjs`

- [ ] Add tests for state transition helper `nextOwnershipState` or equivalent pure helper if added to `pokemon-fiche.js`.
- [ ] Run focused tests; expect failure before implementation.
- [ ] In `web/app.js`, add `ownershipStateForSlug` and `setPokemonOwnershipState`.
- [ ] Replace card-level `cycleStatusBySlug` click use with explicit chips from `createOwnershipActions`.
- [ ] Use `PokevaultHunts.patch` and `PokevaultTrainerContacts.setOwnListMembership` in the ownership state transitions.
- [ ] Render network badges on cards: `Chez N` or `Match N`.
- [ ] In `web/binder-collection-view.js`, subscribe to trainer contact changes and rerender active binder pages.
- [ ] Re-run focused web tests.
- [ ] Commit: `feat(web): add pokemon trade chips to list and binders`.

### Task 4: Drawer And Full Pokemon Page

**Files:**
- Modify: `web/pokemon-drawer.js`
- Modify: `web/pokemon-full-view.js`

- [ ] Replace visible status action rows with the same `Cherche`, `J'ai`, `Double` ownership actions.
- [ ] Keep existing status label for backward compatibility, but relabel `seen` as derived/legacy context rather than primary action.
- [ ] Add a short exchange context block showing contacts who have the Pokemon in `for_trade`.
- [ ] Verify manually through existing web tests and card-helper tests.
- [ ] Commit: `feat(web): show trade actions in pokemon fiches`.

### Task 5: Product Tour, Styles, And Docs

**Files:**
- Modify: `web/index.html`
- Modify: `web/keyboard.js`
- Modify: `web/styles.css`
- Modify: `tests/test_mobile_home_css.py`
- Modify: `README.md`
- Modify: `docs/TRAINER_CONTACTS.md`
- Modify: `docs/features.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/ROADMAP.md`
- Modify: `tests/test_docs_site.py`

- [ ] Add CSS guard assertions for `pokemon-ownership-actions`, `pokemon-trade-chip`, and `pokemon-network-badge`.
- [ ] Run focused CSS/docs tests; expect failure.
- [ ] Style compact chips and network badges for list and binder cards.
- [ ] Update onboarding/product tour wording from `non rencontré / vu / capturé` to the simpler `Cherche / J'ai / Double` mental model.
- [ ] Update shortcut help so `c` maps to `J'ai` and `Shift+C` maps to `Double`.
- [ ] Update README and docs to describe `Double` as the tradeable signal and `Vu chez` as imported-contact context.
- [ ] Re-run focused CSS/docs tests; expect pass.
- [ ] Commit: `docs: document pokemon trade states`.

### Task 6: Final Verification

**Files:**
- No code changes expected.

- [ ] Run `node --test tests/web/*.test.mjs`; expect all web tests pass.
- [ ] Run `make check`; expect ruff pass, 486 Python tests pass, tracker coverage 100%.
- [ ] Run `git status --short --branch`; expect a clean feature worktree.
- [ ] Smoke test local server `GET /api/health`; expect `{"ok":"true","app":"pokevault","api_version":"1.1.0"}`.
