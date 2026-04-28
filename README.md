# pokevault

[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tracker_coverage-100%25-brightgreen.svg)](#quality)
[![Version: 1.0.2](https://img.shields.io/badge/version-1.0.2-00daf3.svg)](CHANGELOG.md)

<p align="center">
  <img src="docs/assets/logo.svg" alt="pokevault logo" width="140">
</p>

**pokevault** is a local-first Pokemon collection tracker for Pokédex progress,
physical cards, binders, badges and printable checklists.

No account. No cloud database. No hosted live demo yet. Run it locally and keep
your collection data in readable JSON files.

<p align="center">
  <img src="docs/screenshots/list-view.png" alt="Pokevault collection view" width="100%">
</p>

## Links

- [Project site](https://boblebol.github.io/pokevault/)
- [Release notes](CHANGELOG.md)
- [Roadmap](docs/ROADMAP.md)
- [V1.1 Pokédex-first tickets](docs/V1_1_POKEDEX_FIRST.md)
- [Postponed ideas](docs/POSTPONED.md)
- [Design system](DESIGN.md)
- [Contributing](CONTRIBUTING.md)
- [Release process](RELEASING.md)
- [Security policy](SECURITY.md)

## Quick Start

Requirements:

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)

```bash
git clone https://github.com/Boblebol/pokevault.git
cd pokevault
make install
make dev
```

Open the local app at [http://127.0.0.1:8765](http://127.0.0.1:8765/).

The reference `data/pokedex.json` is shipped with the repository, so the UI
works immediately after install. Optional artwork caches are generated locally.

## What It Does

- Scrapes and exports a National Pokédex reference from Pokepedia.
- Tracks seen, caught and shiny status per Pokemon.
- Attaches owned physical cards to Pokemon entries.
- Searches the public Pokemon TCG API to prefill card metadata.
- Models binder pages, grids and card placements.
- Maintains multiple local collection profiles.
- Shows collection stats, badge progress and focus recommendations.
- Exports/imports full local backups.
- Prints binder or regional checklists.
- Exposes a local FastAPI REST API for integrations.

Pokevault is an unofficial fan project. It is not affiliated with Nintendo,
The Pokémon Company, Game Freak, Creatures, Poképédia or the Pokémon brand.

## Screenshots

<table>
  <tr>
    <td><strong>Binder planning</strong><br><img src="docs/screenshots/binder-view.png" alt="Binder view" width="100%"></td>
    <td><strong>Collection statistics</strong><br><img src="docs/screenshots/stats-view.png" alt="Statistics view" width="100%"></td>
  </tr>
</table>

## Common Commands

```bash
make              # Show available commands
make install      # Install dependencies
make dev          # Start local server
make open         # Open local web UI
make fetch        # Full Pokepedia scrape
make fetch-test   # Small scrape for development
make fetch-shiny  # Download shiny artworks locally
make check        # Lint + tests + tracker coverage
make docker-up    # Pull and start the published Docker image
make docker-up-local # Build this checkout and start it
make docker-down  # Stop docker compose
```

## Data Model

Only reference data is versioned:

- `data/pokedex.json`
- `data/narrative-tags.json`

User state is local and ignored by Git:

- `data/collection-progress.json`
- `data/collection-cards.json`
- `data/hunts.json`
- `data/binder-config.json`
- `data/binder-placements.json`
- `data/profiles.json`
- `data/profiles/<id>/...`

## REST API

The local API is mounted next to the web UI:

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | App/API version and liveness |
| `/api/progress` | Collection progress |
| `/api/cards` | Physical card catalog |
| `/api/hunts` | Active search targets |
| `/api/badges` | Badge catalog and progress |
| `/api/profiles` | Local collection profiles |
| `/api/binder/*` | Binder configuration and placements |
| `/api/tcg/cards/search` | Pokemon TCG catalog search for card prefill |
| `/api/export` | Full backup export |
| `/api/import` | Full backup restore |

The TCG catalog lookup uses the public [Pokemon TCG API](https://docs.pokemontcg.io/).
Set `TRACKER_TCG_API_KEY` if you have an API key; the local card inventory stays
in `data/collection-cards.json`.

## Docker

```bash
make docker-up       # Pull ghcr.io/boblebol/pokevault:latest and start it
make docker-up-local # Build this checkout as pokevault:local and start it
```

The container serves the app on [http://127.0.0.1:8765](http://127.0.0.1:8765/)
and mounts `./data` for local persistence. `make docker-up` does not build from
the local checkout, so it avoids the Python base-image pull during everyday
startup. Override `DOCKER_TAG` to pin a release, or `DOCKER_PLATFORM` to force a
Docker platform.

## Project Site

The static GitHub Pages source lives under [docs/](docs/). It is a zero-build
site checked into the repository. There is no public hosted demo URL at the
moment; use the local app for testing.

## Quality

The `tracker/` package is kept at 100% line coverage.

```bash
make check
```

CI runs lint, coverage and Docker build checks on pull requests.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the current release history.

## License

[MIT](LICENSE)
