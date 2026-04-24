# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Public product roadmap in [docs/ROADMAP.md](docs/ROADMAP.md): 16 RICE-scored
  features organised in 4 delivery waves (Polish J1, Activation, Card Layer,
  Delights), each with user story, acceptance criteria and tech notes.
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
