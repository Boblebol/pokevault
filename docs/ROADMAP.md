# Pokevault — Product Roadmap (v0.2 → v1.0)

> Single source of truth for product direction. Priorities are **RICE-scored**
> and grouped into four **delivery waves**. Each feature ships with a
> dev-ready spec (user story, acceptance criteria, tech notes, dependencies).

**Positioning.** Pokevault is a **Pokédex-first** tracker. TCG physical cards
are a **per-Pokémon enrichment layer** (a user can attach the cards they own
to any Pokédex entry), never a replacement for the Pokédex experience.

---

## Summary

| Metric              | Value                          |
|---------------------|--------------------------------|
| Features            | 15 product + 1 onboarding = 16 |
| Total effort        | ~46.5 person-days (solo, PT)   |
| Waves               | 4                              |
| Target duration     | ~9 weeks part-time             |
| Top RICE            | 100 (F07 — Empty states)       |

**RICE formula.** `RICE = (Reach × Impact × Confidence) / Effort`

- **Reach**: percentage of users impacted per month (0 – 100).
- **Impact**: 0.25 minimal · 0.5 low · 1 medium · 2 high · 3 massive.
- **Confidence**: 60 / 80 / 100 %.
- **Effort**: solo dev-days.

---

## Priority board

Sorted by RICE descending. Tone/wave column drives the delivery plan below.

| #  | ID   | Feature                                      |   R |   I |   C |   E | RICE | Wave           |
|----|------|----------------------------------------------|----:|----:|----:|----:|-----:|----------------|
|  1 | F07  | Empty states narratifs                       | 100 | 0.5 | 100%| 0.5 | **100** | V1 · Polish J1 |
|  2 | F04  | Régional dex en chips                        |  70 |   1 |  90%|   1 | **63**  | V1 · Polish J1 |
|  3 | F09  | Auto-derivation caught ← cards               |  60 |   1 |  90%|   1 | **54**  | V3 · Layer Cartes |
|  4 | F01  | Progression multi-niveaux                    |  60 |   1 |  90%|   1 | **54**  | V1 · Polish J1 |
|  5 | F00  | Onboarding 3 étapes                          | 100 |   2 |  80%|   3 | **53**  | V2 · Activation |
|  6 | F03  | États Pokédex enrichis (vu/capturé/shiny)    |  90 |   2 |  60%|   3 | **36**  | V2 · Activation |
|  7 | F06  | Recherche floue + raccourcis clavier         |  40 |   2 |  90%|   2 | **36**  | V1 · Polish J1 |
|  8 | F10  | Fiche complète Pokédex (full screen)         |  70 |   2 |  70%|   4 | **25**  | V3 · Layer Cartes |
|  9 | F02  | Drawer « Mes cartes »                        |  80 |   2 |  70%|   5 | **22**  | V3 · Layer Cartes |
| 10 | F08  | Modèle de données Carte                      |  60 |   2 |  80%|   5 | **19**  | V3 · Layer Cartes |
| 11 | F05  | Filtres narratifs (Starter/Légendaire/…)     |  50 |   1 |  80%|   3 | **13**  | V2 · Activation |
| 12 | F11  | Artwork switcher                             |  50 |   1 |  70%|   3 | **12**  | V4 · Délices    |
| 13 | F12  | Badges Pokédex                               |  40 |   1 |  80%|   3 | **11**  | V4 · Délices    |
| 14 | F15  | Multi-Pokédex (profils)                      |  25 |   2 |  60%|   5 | **6**   | V4 · Délices    |
| 15 | F14  | Impression « Pokédex de poche »              |  20 |   1 |  80%|   3 | **5**   | V4 · Délices    |
| 16 | F13  | Thèmes de région                             |  30 |   1 |  70%|   4 | **5**   | V4 · Délices    |

---

## Delivery plan

| Wave                | Duration | Scope                        | User-visible milestone                           |
|---------------------|---------:|------------------------------|--------------------------------------------------|
| **V1 · Polish J1** ✅ | ~1 week  | F07 · F04 · F01 · F06       | App feels alive with zero structural change      |
| **V2 · Activation** ✅ | ~2 weeks | F00 · F03 · F05             | First run is scripted, grid tells a story        |
| **V3 · Layer Cartes** ✅ | ~3 weeks | F08 · F09 · F02 · F10      | Drawer + full-screen page, cards as opt-in layer |
| **V4 · Délices**    | ~3 weeks | F11 · F12 · F15 · F14 · F13  | Full Pokédex identity, multi-profile, polish     |

Each wave can be tagged `v0.2`, `v0.3`, `v0.4`, `v1.0` on GitHub Releases.

---

## Critical dependencies

### F08 is the pivot
The whole card layer (F02, F09, F10) and downstream features (F11 via
card-art, F12 via card-based predicates, F15 via per-profile cards) depend on
**F08 — Card data model**. Locking the `Card` schema **before** starting V3
is the #1 project risk. Schema versioning + migration tests are mandatory.

### F03 changes the progress contract
Moving `caught: dict[str, bool]` to `caught: dict[str, Status]` requires a
versioned migration. Ship F03 **before** F08 so F09 is written against the
final status model, not retrofitted.

### 100 % tracker coverage must hold
Every feature touching `tracker/` ships with tests that keep coverage at
100 %. Adding a GitHub Actions CI that runs `make check` on every PR is a
v0.2 prerequisite.

---

# Wave 1 — Polish immédiat (J1 visible)

**Goal.** 4.5 person-days. Zero refactor. The app feels alive at login.

## F07 — Empty states narratifs

**RICE 100** · Effort 0.5 j · Wave 1

> As a new user, when a list or stat is empty, I want to read a Pokémon-voiced
> message instead of a grey placeholder.

### Acceptance
- Empty list: « Ton Pokédex est vide. Le Professeur t'attend à Bourg Palette. »
- Empty search: « Aucun Pokémon ne répond à cet appel. »
- Each of binder, stats and print views has its own tailored message.

### Tech
- Touch `web/app.js`, `web/binder-collection-view.js`, `web/stats-view.js`, `web/print-view.js`.
- Centralise copy in `web/empty-states.js` (FR + EN dict).
- Zero data change, zero back-end change.

### Deps
None.

---

## F04 — Régional dex en chips

**RICE 63** · Effort 1 j · Wave 1

> As a regional fan, I want to filter my list to Kanto / Johto / … in one
> click and see my regional progression update instantly.

### Acceptance
- Chips row: Kanto · Johto · Hoenn · Sinnoh · Unys · Kalos · Alola · Galar · Hisui · Paldea · National.
- Active chip filters the grid and updates the `X/Y` counter.
- Filter is persistent via hash param `?region=johto`.

### Tech
- Add `setRegionFilter` + rerender in `web/app.js`. `region_dex` is already
  attached to every entry in `pokedex.json` — no scrape change.
- Sync with `#/liste`, optional on `#/print`.

### Deps
None.

---

## F01 — Progression multi-niveaux

**RICE 54** · Effort 1 j · Wave 1

> As a hybrid collector, I want to see at a glance my number of caught
> Pokémon AND my number of catalogued cards.

### Acceptance
- Primary bar unchanged: `X/1025 Pokémon`.
- Secondary line: `N cartes dans K sets` (greyed out when 0).
- Same contract in `#/stats` and in the global header.

### Tech
- `web/stats-view.js`: add `computeCardStats(progress)` (returns `0/0` until F08 ships).
- Contract-first: the card line exists from day one.
- No new API route.

### Deps
Visually meaningful only after F08.

---

## F06 — Recherche floue + raccourcis clavier

**RICE 36** · Effort 2 j · Wave 1

> As a regular user, I want a forgiving search and keyboard shortcuts to
> navigate without a mouse.

### Acceptance
- `/` focuses search, `Esc` clears it, `j` / `k` moves selection down/up,
  `c` toggles caught on focused entry, `?` opens a help dialog.
- Search tolerates diacritics and common typos (`dracau` → Dracaufeu).
- Search is hybrid on FR / EN / JA name, number, slug and types.

### Tech
- Extract global key handling into `web/keyboard.js`.
- In-house fuzzy matcher: Levenshtein ≤ 2 on `normalize('NFD')` + lowercase.
- Help dialog: native `<dialog>` element, FR + EN.

### Deps
None.

---

# Wave 2 — Activation & identité Pokédex

**Goal.** 9 person-days. Memorable first run, storytelling on the grid.

## F00 — Onboarding 3 étapes

**RICE 53** · Effort 3 j · Wave 2

> As a new user, I want a short welcome wizard that sets the stage and lets
> me pick my collector profile.

### Acceptance
- Step 1 — Welcome: pitch + « C'est parti ». Skippable.
- Step 2 — Profile: Pokédex pur · TCG physique · Mixte (controls which features surface).
- Step 3 — Preferences: language (FR / EN / JA), favourite region, theme.
  Stored in LocalStorage + exported in backup.
- Unlocks a « Première rencontre » badge at completion (see F12).

### Tech
- New `web/onboarding.js`, bootstrap-triggered when `ui.profile` is missing.
- Add `ui.profile` to backup JSON under schema v2 (backward-compat).
- Optional: new `GET / PUT /api/ui` controller to persist server-side.
- Design: centred `<dialog>`, no dedicated route.

### Deps
Optional: F13 (themes) to make step 3 richer.

---

## F03 — États Pokédex enrichis (vu / capturé / shiny)

**RICE 36** · Effort 3 j · Wave 2

> As a collector, I want to distinguish « seen », « caught » and « shiny »
> instead of a simple on/off toggle.

### Acceptance
- Click cycles: not-met → seen → caught → not-met.
- Long-click / Shift+click opens a menu with a « Shiny » option.
- Visual: grey / blue / green / starred circle.
- Backward-compat: existing `caught: true` entries migrate to `status: "caught"`.

### Tech
- `tracker/models.py`: `CollectionProgress.caught` becomes `caught: dict[str, Status]` where `Status = { caught: bool, shiny: bool, seen_at: datetime | None }`.
- One-shot migration in `tracker/repository/json_progress_repository.py` (detect v1 schema, convert).
- `web/app.js`: state-cycle + status SVG icons under `web/icons/status-*.svg`.
- Tests: cycle, migration, shiny toggle, export/import roundtrip.

### Deps
Changes the `progress` contract. Do **before** F08 & F09.

---

## F05 — Filtres narratifs

**RICE 13** · Effort 3 j · Wave 2

> As a fan, I want to filter my grid on Starter, Legendary, Mythic,
> Ultra-Beast, Paradox, Pseudo-legendary.

### Acceptance
- Multi-toggle row above the grid.
- Each toggle shows a dynamic count (`9 Starter`).
- Composes with F04 chips and F06 search.

### Tech
- `pokedex/narrative_tags.py`: static mapping `{ slug → [tag, …] }`.
- Inject into `pokedex.json` via `attach_narrative_tags()` during next `fetch`.
- `web/filters-view.js`: Chip multi-select, same pattern as F04.
- Unit tests: one known starter per generation.

### Deps
Adds a `narrative_tags: list[str]` column on the Pokedex model.

---

# Wave 3 — Layer Cartes (data foundation) ✅

**Goal.** 15 person-days. Card pivot without breaking the Pokédex. F08 is
the anchor: keep the Card schema locked before writing anything downstream.

**Status.** ✅ **Shipped.** F08 locked the `Card` schema and the
`schema_version: 2` export payload (v1 backups keep importing). F09 hooks
into `CardService.create/update` via `ProgressService.ensure_caught`. F02
ships the right-side drawer with inline CRUD. F10 delivers the full-screen
`#/pokemon/:slug` route with a static 18×18 type chart
(`web/type-chart.js`), the « Autres formes » grid, and the owned-cards
table. Tracker coverage: **100 % on 367 tests**.

## F08 — Modèle de données Carte

**RICE 19** · Effort 5 j · Wave 3

> As a user, I want to attach concrete cards (set, number, variant, language,
> condition) to each Pokémon I catch.

### Acceptance
- New versioned file `data/collection-cards.json` (user state, gitignored).
- Card fields: `{ id (uuid), pokemon_slug, set_id, num, variant, lang, condition, qty, acquired_at, note }`.
- REST endpoints: `GET / POST / PUT / DELETE /api/cards` and `GET /api/cards/by-pokemon/{slug}`.
- Export / Import JSON includes the `cards` array under schema v2.
- Tracker coverage stays at 100 %.

### Tech
- `tracker/models.py`: `Card` + `CardList` Pydantic models.
- `tracker/repository/json_card_repository.py`: JSON persistence + per-slug index.
- `tracker/services/card_service.py`: CRUD + validation (check `set_id` / `num` exists in `data/tcg/sets` if present).
- `tracker/api/controllers/card_controller.py`, wired into `app.py`.
- Backup migration: if `schema_version == 1`, `cards = []`.
- ~20 test cases covering repo, service, API.

### Deps
Unlocks F02, F09, F10. No upstream dep.

---

## F09 — Auto-derivation `caught ← cards`

**RICE 54** · Effort 1 j · Wave 3

> As a user, when I add my first card for a Pokémon, its Pokédex status is
> automatically promoted to « caught ».

### Acceptance
- `POST /api/cards` that creates the first card of a slug → `progress[slug].caught = true`.
- `DELETE` of the last card of a slug → **does not** modify caught (respects intent).
- UI reflects the change without manual reload.

### Tech
- `tracker/services/card_service.py` post-create hook → `progress_service.mark_caught(slug)`.
- `web/app.js`: listen to custom `pokedex:cards-changed` event and rerender.
- Integration test: `POST card` → `GET progress` reflects `caught = true`.

### Deps
Requires F08. Recommended: F03 (map to `status = "caught"`).

---

## F02 — Drawer « Mes cartes »

**RICE 22** · Effort 5 j · Wave 3

> As a user, clicking a Pokémon tile opens a right-side drawer with the
> quick Pokédex fiche + my cards for that Pokémon + an « Add » button.

### Acceptance
- 420 px drawer sliding from the right, closes on `Esc` or outside click.
- Header: sprite, number, FR / EN name, types, form, region.
- « Mes cartes (N) » section with inline-editable rows (id / set / num / variant / lang / condition / qty).
- `+ Ajouter une carte` CTA opens a mini-form.
- Accessible: focus trap, `aria-labelledby`, `role=dialog`.

### Tech
- New `web/pokemon-drawer.js` component.
- `GET /api/cards/by-pokemon/{slug}` on open, in-memory cache.
- Add form: `POST /api/cards`.
- Router: deep link via `#/liste?slug=0025-pikachu`.

### Deps
F08, F09.

---

## F10 — Fiche complète Pokédex (full screen)

**RICE 25** · Effort 4 j · Wave 3

> As a fan, from the drawer I want to open a full-screen Pokédex page with
> description, evolutions, weaknesses and my cards at the bottom.

### Acceptance
- Route `#/pokemon/:slug`, triggered by « Voir fiche complète » in the drawer.
- Sections: official artwork, Pokepedia description, types + computed
  weaknesses, clickable evolutions, forms, my cards.
- Browser back preserves grid scroll position.
- Responsive: 1 column `< 720 px`, 2 columns `≥ 720 px`.

### Tech
- `web/pokemon-full-view.js` + new route in `web/app.js`.
- Scrape descriptions: extend `pokedex/scraper.py` to enrich each entry with `description_fr`.
- Type-effectiveness computed front-side: static 18×18 matrix in `web/type-chart.js`.
- Tests: type-chart (Fire vs Grass = 2×), description scrape (HTML fixture).

### Deps
F02 for drawer entry-point. Non-blocking if description scrape fails: fall
back to type-only display.

---

# Wave 4 — Délices & personnalisation

**Goal.** 18 person-days. Premium polish, social dimension, long-term
ergonomics. Each item is isolated and can ship in any order.

## F11 — Artwork switcher

**RICE 12** · Effort 3 j · Wave 4

> As a fan, I want to toggle the illustration between official sprite,
> Sugimori artwork, shiny version or a photo of one of my owned cards.

### Acceptance
- Cyclic button top-right of each tile + `a` keyboard shortcut.
- Sources: sprite (existing), Sugimori (scrape), shiny (scrape), card-art (F08 if card exists).
- Choice persisted per user in LocalStorage.

### Tech
- `pokedex/scraper.py`: add `download_sugimori()` + `download_shiny()` under `data/images/artwork/`.
- Extend `Pokemon` model: `artwork_sugimori`, `artwork_shiny` (relative URLs).
- `web/artwork-switcher.js` micro-component.

---

## F12 — Badges Pokédex

**RICE 11** · Effort 3 j · Wave 4

> As a user, I want to be silently rewarded when I reach milestones (first
> Johto complete, 10th shiny, first card catalogued).

### Acceptance
- 12 initial badges, visible in `#/stats`.
- Triggered server-side on every `progress` / `cards` mutation.
- Non-intrusive toast notification on unlock.

### Tech
- `tracker/services/badge_service.py`: declarative rules `{ id, description, predicate }`.
- Persistence: `badges_unlocked` sub-key of `collection-progress.json`.
- `web/toast.js` micro-component.
- Test each predicate in isolation.

### Deps
F03, F08 maximise the available predicates.

---

## F15 — Multi-Pokédex (profils)

**RICE 6** · Effort 5 j · Wave 4

> As an advanced user, I want to maintain several Pokédex in parallel
> (main, shiny living dex, vintage FR).

### Acceptance
- Profile switcher in the header: create / rename / delete.
- Each profile has its own progress + cards + binder.
- Export / Import applies to the current profile only.

### Tech
- Directory tree: `data/profiles/{id}/{progress,cards,binder-*}.json`.
- `tracker/config.py`: `TrackerSettings.active_profile_id` (persisted).
- Migration: existing data → `profiles/default/`.
- Tests: strict data isolation between profiles.

### Deps
F08 must be profile-aware.

---

## F14 — Impression « Pokédex de poche »

**RICE 5** · Effort 3 j · Wave 4

> As a field collector, I want to print a pocket A5 booklet of my Pokédex
> with one line per Pokémon, a checkbox and a free-form note column.

### Acceptance
- New mode in `#/print`: A5 pocket or A4 2-columns.
- Columns: number · name · checkbox · free note (« carte / note »).
- Page break per region.

### Tech
- `web/print-view.js`: new layout backed by `print-pocket.css`.
- `Export PDF` button via `window.print()` + media-print stylesheet.

---

## F13 — Thèmes de région

**RICE 5** · Effort 4 j · Wave 4

> As a fan, I want to skin the app with regional colours (Kanto retro,
> Hoenn ocean, Paldea terracotta).

### Acceptance
- Theme selector in Settings, 4 v1 skins.
- Global application via `data-theme` attribute on `<html>`.
- Theme persisted in LocalStorage + backup.

### Tech
- `web/styles.css`: all colours already exposed as CSS custom properties.
  Add `@import` on `web/themes/*.css`.
- No back-end change.
- Manual visual tests only.

---

## Change log

See [CHANGELOG.md](../CHANGELOG.md) for per-release notes and [CONTRIBUTING.md](../CONTRIBUTING.md)
for workflow conventions.
