# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Optional evolution-family binder layouts now use generated
  `data/evolution-families.json` data to align family stages on the same row
  with intentional empty slots for branching evolutions.
- `make fetch-evolutions` / `python main.py fetch-evolutions` regenerates the
  family layout data from PokéAPI, with `data/evolution-family-overrides.json`
  reserved for manual layout corrections.

## [1.1.0] — 2026-04-28

### Added

- Collection home now includes a Pokédex-first dashboard with not-met, seen,
  caught, shiny bonus, card add-on and regional progress metrics.
- Collection rail now surfaces a short "À compléter maintenant" queue ranked by
  seen-but-not-caught entries, active region misses, regional completion and
  nearby badge progress without promoting cards as primary targets.
- Collection filters now prioritize Pokédex states with quick filters for all,
  missing, seen, caught, shiny and regional forms, with shareable hash state.
- Collection home now has a dedicated mobile layout that keeps progress,
  recommendations, filters and the grid usable down to narrow phone widths.
- Onboarding now starts from a Pokédex-first goal, favorite region and
  simple/advanced tracking mode while keeping cards as a later add-on.
- Pokémon drawer and full page now share a Pokédex-first fiche structure:
  identity, direct status actions, linked forms, personal progress, notes and
  secondary cards.
- Pokémon status can now be edited directly with not-met, seen, caught and shiny
  actions, with shiny gated behind caught state.
- Linked forms now keep their own independent status and preserve the return to
  the filtered collection list.
- Personal Pokédex notes are stored in progress data, exposed through
  `PATCH /api/progress/notes`, and preserved by export/import.
- Card sections in Pokémon fiches are now collapsible by default so long card
  details stay secondary to Pokédex progress.
- Full Pokémon fiches now have a compact mobile layout that keeps status and
  forms visible before cards.
- Drawer card creation can search the public Pokemon TCG API, select a result
  and prefill set, number, rarity, official image URL and catalog id.
- `GET /api/tcg/cards/search` exposes a small local search adapter with optional
  `TRACKER_TCG_API_KEY` support.

### Changed

- Public docs, roadmap copy and the onboarding tour now describe the v1.1.0
  Pokédex-first workflow and identify metadata enrichment as the next active
  track.

## [1.0.2] — 2026-04-27

### Added

- GitHub Actions now runs the vanilla web module tests on pull requests.
- `RELEASING.md` documents the release checklist, version surfaces, tag flow
  and post-release verification.
- Repository ownership is declared through `.github/CODEOWNERS`.
- `.gitattributes` normalizes text line endings and marks binary media files.

### Changed

- Project metadata now points package homepage/documentation at the GitHub
  Pages site and advertises the local-first TCG tracker keywords.
- The uv project is explicitly marked as a non-packaged app so sync does not
  advertise ignored entry points.
- CI now validates the declared Python support range from 3.11 through 3.14.
- Dependabot now tracks the `uv.lock` workflow with the dedicated `uv`
  package ecosystem.
- `make docker-up` now pulls and starts the published GHCR image instead of
  forcing a fresh local build; use `make docker-up-local` to build the current
  checkout.
- Docker release images are published for both `linux/amd64` and `linux/arm64`.
- Regional themes now use full contrast-tested design tokens, updated labels
  and open-source-ready palette documentation.
- Kanto Archive now has stronger page, card and control separation for better
  readability on the light theme.

## [1.0.1] — 2026-04-27

### Added

- Vault Binder brand logo across the app topbar, docs site, favicon surfaces
  and README.
- Focus sessions, next-best-action recommendations and hunt-list targeting for
  collection work.
- Badge progress metadata and locked-badge progress bars.
- Zero-build static docs under `docs/`, plus `SECURITY.md` and postponed-ideas
  documentation.

### Changed

- Docker image base updated from `python:3.12-slim` to `python:3.14-slim`.
- Version display is unified across package metadata, API, app UI, README,
  docs footers and `/api/health`.
- README is now focused on local setup and no longer advertises a hosted live
  demo.
- Public documentation no longer ships internal planning notes.
- `CONTRIBUTING.md` documents current state files, Node web tests, GitHub Pages
  rules and security reporting.

## [1.0.0] — 2026-04-24

Wave 1 → Wave 4 of the public roadmap (16 RICE-scored features) are
live, backed by 411 passing tests at 100 % coverage on the `tracker/`
module. GitHub Actions runs lint + coverage + Docker smoke-build on
every PR, tagged releases auto-publish a GitHub Release and the Docker
image to `ghcr.io/<owner>/pokevault`.

### Added

- Public product roadmap in [docs/ROADMAP.md](docs/ROADMAP.md): 16 RICE-scored
  features organised in 4 delivery waves (Polish J1, Activation, Card Layer,
  Delights), each with user story, acceptance criteria and tech notes.
- GitHub Actions CI (`.github/workflows/ci.yml`): `ruff check` +
  `pytest --cov=tracker --cov-fail-under=100` on Python 3.11 & 3.12,
  plus a Docker build smoke-test, triggered on every push/PR to `main`.
  Dependabot bumps pip / Docker / github-actions once a month.
- Release pipeline (`.github/workflows/release.yml`): tag-triggered
  (`v*.*.*`), drafts a GitHub Release from the matching CHANGELOG
  section and pushes the image to `ghcr.io/<owner>/pokevault` with
  full semver tags (`1.0.0`, `1.0`, `1`, `latest`).
- Issue & PR templates under `.github/` mirror the Pokédex-first RICE
  roadmap and enforce the `make check` checklist before review.
- `make fetch-shiny` / `python main.py fetch-shiny` CLI: downloads the
  1025 official-artwork shinies from the PokéAPI CDN into
  `data/images_shiny/<slug>.png`, with `--limit` / `--force` /
  `--output-dir` flags.
- Onboarding wizard step 3 now surfaces the **Réglages → Pokédex
  multi-profils** switcher for F15 discoverability.
- **Wave 4 · Délices** shipped:
  - **F13** Thèmes de région — a lightweight `web/themes.js` module persists
    the user's choice in `localStorage` and applies a `data-theme` attribute
    on `<html>`. CSS overrides ship four skins (Vault default, Kanto retro,
    Hoenn ocean, Paldea terracotta) by reassigning the existing `--bg`,
    `--card`, `--accent`, `--text`, `--muted` custom properties, with no
    component refactor required. Switcher lives in **Réglages → Affichage**.
  - **F14** Impression Pokédex de poche (A5) — the print view exposes a new
    "Pocket A5 (par région)" grouping mode that emits a compact `#`/Nom/✓/
    Carte · note checklist with `@page { size: A5; }` and per-region page
    breaks, perfect for slipping inside a binder pouch. The pre-existing
    "Pages de classeur" and "Région" modes stay unchanged.
  - **F12** Pokédex badges — server-side `BadgeService` evaluates 12
    declarative `BadgeDef` predicates (first encounter / catch / shiny,
    Pokédex centuries, set diversity, monotype starters, regional perfect
    runs…) against `CollectionProgress` + the live card list. Unlocks are
    monotonic — once a badge is earned it never drops, even if the user
    later un-catches a slug. Persisted as `badges_unlocked: list[str]`
    inside `data/collection-progress.json` (with safe migration). New
    `GET /api/badges` returns `{catalog: BadgeDefinition[], unlocked:
    string[]}` and triggers a sync on each read. Frontend `web/badges-view.js`
    polls the endpoint, diffs against the cached state and pops accessible
    `web/toast.js` notifications for each new unlock; the **Statistiques**
    view renders the full grid (locked / unlocked tiles).
  - **F11** Artwork switcher — `Card.image_url` is now a first-class field
    on the model and surfaced through the drawer's add-card form. The new
    `web/artwork-switcher.js` module exposes three modes (Sugimori default,
    Shiny `data/images_shiny/<slug>.png`, First card scan) with
    `localStorage` persistence, indexes the live cards on
    `pokevault:cards-changed`, and resolves a per-Pokémon `{src, fallbacks}`
    that the list grid wires through `<img onerror>` cascades. Switcher
    lives in **Réglages → Affichage** and triggers a re-render.
  - **F15** Multi-Pokédex profiles — the new `ProfileService` reads / writes
    a `data/profiles.json` registry (`active_id` + list of profiles) and
    resolves every storage path (progress, cards, binder config &
    placements) from the active profile id. The historical "default" profile
    stays mapped onto the legacy `data/*.json` layout for seamless upgrades;
    additional profiles live under `data/profiles/<id>/...`. New REST surface:
    `GET /api/profiles`, `POST /api/profiles`, `PUT /api/profiles/active`,
    `DELETE /api/profiles/{id}`. Réglages exposes a switcher with create /
    delete buttons and a full reload after switch so every cached collection
    refreshes against the new dataset.

### Changed

- F11 shiny mode now resolves through a 3-step fallback chain:
  `data/images_shiny/<slug>.png` → PokéAPI CDN
  (`raw.githubusercontent.com/PokeAPI/sprites`) → Sugimori default.
  Users no longer need to scrape to enjoy the switcher.
- `web/artwork-switcher.js::attach()` tears the `onerror` listener down
  once the fallback chain is exhausted to stop `<img>` error storms.

### Tooling

- 411 passing tests on `tracker/` at 100 % coverage (pytest + ruff
  clean on 3.11 / 3.12).
  - Backend coverage stays at 100% (411 passing tests on the `tracker/`
    module) including new modules `test_badge_service`, `test_badge_api`,
    `test_profile_service`, `test_profile_api`, plus updates to
    `test_dependencies` and `test_config` for the new path resolver.
- **Wave 3 · Layer Cartes** shipped:
  - **F08** Card data model — a new versioned `data/collection-cards.json`
    user-state file (gitignored) stores TCG cards per Pokémon with fields
    `{id (uuid), pokemon_slug, set_id, num, variant, lang, condition, qty,
    acquired_at, note}`. New `Card`, `CardCreate`, `CardUpdate`, `CardList`
    Pydantic models; dedicated `JsonCardRepository`; REST endpoints
    `GET/POST/PUT/DELETE /api/cards`, `GET /api/cards/by-pokemon/{slug}`,
    `GET/PUT/DELETE /api/cards/{card_id}`. Export / Import payloads are now
    `schema_version: 2` and carry the `cards` array; v1 backups keep
    importing with an empty cards list (backward compatible).
  - **F09** Auto-derivation `caught ← cards` — creating the first card for a
    slug promotes its Pokédex status to `caught` without overwriting any
    existing `shiny` flag. Deleting the last card never rewinds the status
    (user intent wins). Wired through `ProgressService.ensure_caught()`
    called from `CardService.create()` and `CardService.update()` when the
    slug changes.
  - **F02** Drawer « Mes cartes » — right-side `<dialog>` (420 px) slides
    from the right on « Fiche & cartes » tile-hover button or `i` keyboard
    shortcut. Shows sprite · number · FR/EN/JA names · types · region ·
    status shortcuts, the live list of owned cards with inline delete, and
    a mini-form `+ Ajouter une carte` (POST to `/api/cards`). Accessible
    focus trap, `aria-labelledby`, `role=dialog`, closes on `Esc` or scrim
    click. Deep-linked via `#/liste?slug=<slug>`.
  - **F10** Fiche complète Pokédex (full screen) — new route
    `#/pokemon/:slug` opens a dedicated page with hero (artwork, national
    number, FR/EN/JA names, form, region, types), defensive type chart
    (faiblesses · résistances · immunités computed from a static 18×18
    matrix in `web/type-chart.js`), other forms sharing the same national
    number (clickable tiles), and the list of cards for that slug. Status
    shortcut and shiny toggle re-render in place. Reachable from the
    drawer via a « Voir fiche complète → » CTA.
  - Backend test suite now ships 367 passing tests at 100% coverage on the
    `tracker/` module, including 3 new modules (`test_json_card_repository`,
    `test_card_service`, `test_card_api`) plus updated export-service
    fixtures for the v2 schema.
- **Wave 2 · Activation & Pokédex identity** shipped:
  - **F03** Enriched Pokédex status — the legacy `caught: bool` dict
    keeps working as a derived mirror while the new source of truth is
    `statuses: {slug: {state, shiny, seen_at}}` with `state ∈ {seen,
    caught}` and an independent `shiny` flag. New `PATCH
    /api/progress/status` endpoint; existing progress files migrate in
    flight (tracker coverage stays at 100 %). List cards cycle
    `not_met → seen → caught → not_met` on click, toggle shiny with
    `Shift+click` or `Shift+C`. Keyboard help dialog reflects the new
    shortcuts.
  - **F05** Narrative filter chips — a curated
    `data/narrative-tags.json` ships 238 tagged Pokémon across seven
    narrative categories (Starter, Légendaire, Mythique,
    Pseudo-légendaire, Fossile, Bébé, Ultra-Chimère). The chips
    compose with region / type / caught filters and persist via the
    `?tags=starter,legendary` hash parameter.
  - **F00** Three-step onboarding wizard — first-run dialog that
    positions Pokevault as a Pokédex-first tracker, captures the
    collector profile (dex / hybrid / card) and sets starting form
    scope + dim mode. Persisted under
    `localStorage["pokevault.ui.profile"]`; re-launchable from
    Réglages → Profil.
- **Wave 1 · Polish J1** kickoff:
  - **F07** Narrative empty states across list, stats, print and binder
    views, centralised in `web/empty-states.js`.
  - **F04** One-click regional Pokédex chips above the list grid, with
    deep-linking via `#/liste?region=<id>`. The filter state is now
    shareable and bookmarkable.
  - **F01** Secondary progression line: `N cartes dans K sets`, visible
    from the list hero and the stats view. Contract-first — currently
    dormant, will light up with F08 (card data model).
  - **F06** Fuzzy search (diacritic-insensitive + Levenshtein up to 2)
    now also indexes types and unpadded numbers (e.g. `dracau` finds
    Dracaufeu, `charmel` finds Charméléon). New keyboard shortcuts
    (`/`, `Esc`, `j`/`k`, `c`, `?`) with a native `<dialog>` help
    panel, plus a discreet "?" affordance in the progress row.
- Full collection backup API:
  - `GET /api/export` exports progress + binder config + binder placements.
  - `POST /api/import` restores the same payload in one operation.
- New web print route `#/print` with a text checklist layout (no images).
- Print options: all / caught only / missing only, grouped by binder or region.
- Settings data tools:
  - `Export JSON` button to download a full backup.
  - `Import JSON` button with preview and confirmation before restore.
- New `GET /api/health` endpoint (`{"ok": "true", "app": "pokevault", ...}`) for
  container probes and uptime checks.
- Reference `data/pokedex.json` is now shipped with the repository so the UI
  runs out of the box without invoking the scraper on first boot.
- Curated `data/narrative-tags.json` shipped alongside `pokedex.json` so the
  narrative chip filter works out of the box (and inside the Docker image).
- Test coverage for new export/import flows, form-filtering helpers, health
  endpoint and dependencies, keeping tracker coverage at 100%.

### Changed

- UI harmonization pass to align non-binder pages with binder visual headers and navigation patterns.
- Makefile quality-of-life updates:
  - richer grouped `help` output,
  - new `build` alias for Docker image build,
  - `docker-up` now opens the web UI automatically.
- Web static asset caching disabled in local tracker responses to always serve the latest frontend files.
- Print view now uses the same collection scope as list/binders (excluding out-of-scope special forms).
- Export/import payload sanitization now keeps only in-scope collection slugs (progress and binder placements), including backend-side enforcement.

### Fixed

- Mega-form detection now uses word boundaries on the `form` label so Pokémon
  whose name contains the substring "mega" (notably Méganium #0154) are no
  longer mistakenly filtered as Mega evolutions.
- Normalized a stray `"form": "null"` string to a proper `null` value for the
  Méganium base entry in the shipped Pokédex data.

## [0.1.0] — 2025

### Added

- National Pokédex scraper from Pokepedia (1025+ Pokémon).
- Multi-format export: JSON, CSV, YAML, XML.
- Sprite/image download.
- Full CLI (fetch, view, edit) via Typer.
- Local REST API via FastAPI (progress, binders).
- Web UI — list view with filters, search, caught/missing toggle.
- Web UI — binder view with configurable grid and placements.
- Web UI — statistics view (global and regional progress).
- Local JSON persistence (progress, binders, config).
- Browser-side offline queue.
- Test suite with 100% coverage on the tracker module.
- Self-documenting Makefile.
- Design system documentation (DESIGN.md) from Google Stitch.
