# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Public product roadmap in [docs/ROADMAP.md](docs/ROADMAP.md): 16 RICE-scored
  features organised in 4 delivery waves (Polish J1, Activation, Card Layer,
  Delights), each with user story, acceptance criteria and tech notes.
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
