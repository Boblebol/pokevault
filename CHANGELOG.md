# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Full collection backup API:
  - `GET /api/export` exports progress + binder config + binder placements.
  - `POST /api/import` restores the same payload in one operation.
- New web print route `#/print` with a text checklist layout (no images).
- Print options: all / caught only / missing only, grouped by binder or region.
- Settings data tools:
  - `Export JSON` button to download a full backup.
  - `Import JSON` button with preview and confirmation before restore.
- Test coverage for new export/import flows, keeping tracker coverage at 100%.

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
