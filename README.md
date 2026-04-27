# pokevault

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tracker_coverage-100%25-brightgreen.svg)](#qualité)
[![Version: 1.0.1](https://img.shields.io/badge/version-1.0.1-00daf3.svg)](CHANGELOG.md)

> Local-first Pokémon collection tracker.
> No account, no cloud — your data stays yours.

<p align="center">
  <img src="docs/assets/logo.svg" alt="pokevault logo" width="140">
</p>

<p align="center">
  <img src="docs/screenshots/list-view.png" alt="List View — Specimens" width="100%">
</p>

---

## Overview

**pokevault** is an all-in-one local tool for Pokémon collectors:

- **Scrapes** the National Pokédex from [Pokepedia](https://www.pokepedia.fr) (1025+ Pokémon, images, forms, regions).
- **Stores** everything in readable, versionable local JSON.
- **Displays** a modern web UI to browse, organize and track your collection.
- **Exposes** a local REST API for custom integrations.

### Why pokevault?

| Problem                                  | pokevault solution                    |
|------------------------------------------|---------------------------------------|
| Online trackers require an account       | Zero account, everything runs locally |
| Data locked in a SaaS                    | Readable JSON, versionable with Git   |
| No tool adapted to physical binders      | Binder view with grids and placements |
| Complex and slow interfaces              | Lightweight vanilla JS SPA            |

---

## Screenshots

<table>
  <tr>
    <td><strong>Vault Explorer</strong><br>Binder management with grid pages and placements<br><br><img src="docs/screenshots/binder-view.png" alt="Vault Explorer" width="100%"></td>
    <td><strong>Collection Statistics</strong><br>Global and regional progress tracking<br><br><img src="docs/screenshots/stats-view.png" alt="Collection Statistics" width="100%"></td>
  </tr>
</table>

---

## Features

### Pokédex Scraper

- Full National Pokédex extraction from Pokepedia.
- Multi-format export: JSON, CSV, YAML, XML.
- Sprite/image download.
- Fast mode for testing (`make fetch-test`).

### Web UI — List View (`#/liste`)

- Visual Pokédex grid.
- **Three-state Pokédex status** (F03) — click cycles `not met → seen →
  caught → not met`. `Shift+click` (or `Shift+C`) toggles the shiny
  flag with a golden glow and a ★ marker.
- Status filters, **regional dex chips** with deep-linking
  (`#/liste?region=johto`).
- **Mes recherches** hunt filter — mark targets from the drawer/full fiche,
  set high priority, keep a note, and feed those priorities back into Focus.
- **Narrative filter chips** (F05) — Starter · Légendaire · Mythique ·
  Pseudo-légendaire · Fossile · Bébé · Ultra-Chimère. Multi-select,
  deep-linked via `?tags=starter,legendary`.
- **Fuzzy search** (tolerates accents and typos) on name, number,
  slug and types.
- Keyboard shortcuts: `/` focus search, `Esc` clears, `j`/`k` move,
  `c` cycle status, `Shift+C` toggle shiny, `i` open the fiche drawer,
  `?` open help.
- Narrative empty states when filters match nothing.
- Global counter, progress bar, and a live « cartes catalogu\u00e9es »
  line fed by F08 (`N cartes dans K sets`).
- **First-run onboarding wizard** (F00) — 3-step dialog capturing your
  collector profile (dex / hybrid / card) and starting preferences;
  re-launchable from Réglages → Profil.

### Web UI — Pokémon drawer (F02)

- Right-side `<dialog>` (420 px) opened from any tile via the
  « Fiche & cartes » button (visible on hover/focus) or the `i`
  keyboard shortcut. Deep-linked through `#/liste?slug=<slug>`.
- Shows the Pokédex identity (sprite, number, FR / EN / JA names,
  form, types, region), the enriched status shortcut (cycle
  not\_met → seen → caught + shiny toggle), and the live list of
  owned cards with inline delete.
- `+ Ajouter une carte` mini-form captures set / number / variant /
  language / condition / quantity / optional note; the first card
  auto-promotes the Pokédex status to `caught` (F09).
- Accessible: focus trap, `role=dialog`, closes on `Esc` or scrim
  click, and exposes a « Voir fiche complète → » CTA.

### Web UI — Fiche complète Pokédex (F10)

- Dedicated route `#/pokemon/:slug` rendered full screen.
- Hero block with official artwork, national number, multilingual
  names (FR / EN / JA), form label, region and type badges.
- Defensive type chart computed from a static 18×18 matrix in
  `web/type-chart.js`: Faiblesses · Résistances · Immunités with
  exact multipliers (`¼×`, `½×`, `2×`, `4×`, `0×`).
- « Autres formes » grid: clickable tiles for every entry sharing
  the same national number.
- « Mes cartes » table fed by `GET /api/cards/by-pokemon/{slug}`.
- Status shortcuts re-render in place on click; browser back keeps
  the grid scroll position.

### Web UI — Binder View (`#/classeur`)

- Create and manage virtual binders.
- Page-by-page navigation.
- Configurable grid (rows x columns).
- Server-side persisted placements.

### Web UI — Statistics (`#/stats`)

- Global and regional progress.
- Detailed collection metrics.

### Web UI — Print View (`#/print`)

- Text-first printable checklist (no images): number, name, binder location.
- Filters before printing: **all**, **caught only**, **missing only**.
- Grouping modes: **by binder**, **by region**, or **Pocket A5 (par région)**
  for a compact `@page { size: A5 }` checklist with `#`/Nom/✓/Carte · note
  columns and a page break per region (F14).
- A4 print stylesheet with page breaks between sections.

### Web UI — Settings (`#/settings`)

- **Affichage** — global "atténuer attrapés / manquants" toggle, four
  regional themes (`Vault` default, `Kanto`, `Hoenn`, `Paldea`) applied
  via `data-theme` on `<html>` (F13), and an artwork switcher (Sugimori
  default, Shiny, First card scan) with a tri-level fallback chain
  (F11). For shiny, the chain is: local `data/images_shiny/<slug>.png`
  → PokéAPI CDN → default Sugimori. You can populate the local folder
  offline with `make fetch-shiny` (downloads the 1025 artworks from
  PokéAPI, respects `--limit` / `--force`). Both the theme and artwork
  choices persist in `localStorage`.
- **Données** — export / import the full backup (schema v3 carrying
  cards and hunt-list targets), launch the printable checklist.
- **Profil** — replay the onboarding wizard (F00).
- **Pokédex multi-profils** — switcher + create/delete to maintain
  several isolated Pokédex (e.g. *Hardcore*, *Casual*, *Shiny only*).
  The default profile keeps the legacy `data/*.json` layout, additional
  profiles store everything under `data/profiles/<id>/...`. Switching
  reloads the page so every cache (progress, cards, binders) refreshes
  against the active profile (F15).

### Web UI — Badges (`#/stats`)

- Server-evaluated badge catalog (F12) covering first encounter / catch
  / shiny, Pokédex centuries, set diversity and regional milestones.
- Unlocks are **monotonic** — once earned a badge stays unlocked even if
  the underlying counter drops (e.g. uncatching a slug).
- Persisted as `badges_unlocked: list[str]` inside
  `data/collection-progress.json`. `GET /api/badges` returns the full
  catalog with `unlocked`, `current`, `target`, `percent` and `hint`
  metadata, and triggers a sync on each read.
- Locked badge tiles show progress bars. The Statistics rail highlights
  the nearest locked badge, and Focus sessions can reuse it as a visible
  reason to keep the next action tied to a milestone.
- Frontend toasts (`web/toast.js`) pop accessible notifications when new
  badges land (silent on first load).

### Collection Backup / Restore

- Export full local state to a single versioned JSON backup.
- Import backup JSON to fully restore caught progress and binder workspace.
- Import preview in Settings before confirmation.

### Local REST API

| Endpoint                          | Method          | Description                    |
|-----------------------------------|-----------------|--------------------------------|
| `/api/progress`                   | GET / PUT / PATCH | Collection progress (legacy bool + enriched statuses) |
| `/api/progress/status`            | PATCH           | F03 — enriched status (state, shiny) |
| `/api/cards`                      | GET / POST      | F08 — list / create TCG cards  |
| `/api/cards/{id}`                 | GET / PUT / DELETE | F08 — manage a single card  |
| `/api/cards/by-pokemon/{slug}`    | GET             | F08 — cards for a Pokédex slug |
| `/api/hunts`                      | GET             | v0.7 — active hunt list         |
| `/api/hunts/{slug}`               | PATCH           | v0.7 — add/update/remove a hunt target |
| `/api/badges`                     | GET             | F12/v0.8 — badge catalog, progress metadata + unlocked ids |
| `/api/profiles`                   | GET / POST      | F15 — list profiles / create a new one |
| `/api/profiles/active`            | PUT             | F15 — switch the active profile |
| `/api/profiles/{id}`              | DELETE          | F15 — delete a profile (default forbidden) |
| `/api/binder`                     | GET             | List binders                   |
| `/api/binder/{id}`                | GET / PUT / DELETE | Manage a binder             |
| `/api/binder/config`              | GET / PUT       | Binder configuration           |
| `/api/binder/placements`          | GET / PUT       | Binder placements              |
| `/api/export`                     | GET             | Full backup export (JSON, v3)  |
| `/api/import`                     | POST            | Full backup restore (v1, v2 or v3) |
| `/api/health`                     | GET             | Liveness probe                 |
| `/data/pokedex.json`              | GET             | Pokédex data                   |
| `/data/narrative-tags.json`       | GET             | Narrative tags (Starter, Légendaire, …) |

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **[uv](https://github.com/astral-sh/uv)** — fast Python package manager

### Install

```bash
git clone https://github.com/Boblebol/pokevault.git
cd pokevault
make install
```

### Run

```bash
# 1. Start the local server (Pokédex data is shipped with the repo)
make dev

# 2. Open in browser
make open
```

App available at [http://127.0.0.1:8765](http://127.0.0.1:8765/).

The reference `data/pokedex.json` is bundled so the UI works right after
`make install`. Sprites are downloaded on demand by `make fetch` (optional —
they are not shipped to keep the repo small).

### Docker

```bash
make docker-build
make docker-up          # start on localhost:8765
make docker-logs        # tail logs
make docker-down        # stop
```

Optional: run `make fetch` first (on the host, before `docker-up`) to download
sprites locally — the image mounts `./data` so sprites are served from disk.

---

## Usage

### CLI

Full CLI powered by [Typer](https://typer.tiangolo.com/):

```bash
# Full scrape
uv run python main.py fetch

# Quick scrape (10 entries, no images)
uv run python main.py fetch --no-images --limit 10

# CSV export
uv run python main.py fetch --format csv

# Browse the Pokédex
uv run python main.py view
uv run python main.py view --number 025
uv run python main.py view --type Feu --region kanto

# Edit an entry
uv run python main.py edit 0025-pikachu
uv run python main.py edit 0006-charizard --field types --value "Feu/Vol"
```

### Makefile

All common commands via `make`:

```bash
make              # Show help
make install      # Install dependencies (uv sync --dev)
make dev          # Start local server
make open         # Open web UI in browser
make fetch        # Full scrape
make fetch-test   # Quick scrape (10 entries, no images)
make fetch-shiny  # Download shiny artworks into data/images_shiny/ (F11)
make test         # Run tests
make test-cov     # Tests + coverage (100% tracker)
make lint         # Check style (ruff)
make fmt          # Format code (ruff)
make check        # lint + test-cov
make docker-build # Build Docker image
make docker-up    # Start via docker compose
make docker-down  # Stop docker compose
make docker-logs  # Tail docker compose logs
make clean        # Clean artifacts
```

### Export / Import / Print

From **Settings**:

- `Export JSON` downloads a full backup (`pokevault-backup-YYYY-MM-DD.json`).
- `Import JSON` loads a backup with a summary preview before applying.

From **Binders**:

- `Print checklist` opens `#/print`.
- Choose binder scope, filter mode, and grouping mode, then print.

### Configuration

Environment variables (`TRACKER_` prefix):

| Variable           | Default       | Description                     |
|--------------------|---------------|---------------------------------|
| `TRACKER_HOST`     | `127.0.0.1`  | Server listen address           |
| `TRACKER_PORT`     | `8765`        | Server port                     |
| `TRACKER_REPO_ROOT`| `.`           | Repo root (for `web/` and `data/`) |

```bash
make dev TRACKER_PORT=9999
```

---

## Architecture

```text
pokevault/
├── main.py                  # CLI entry point (Typer)
├── pokedex/                 # Scraping, models, exports
│   ├── scraper.py           #   Pokepedia extraction
│   ├── models.py            #   Pydantic models
│   ├── exporters.py         #   JSON/CSV/YAML/XML export
│   ├── regions.py           #   Regional data
│   ├── form_labels.py       #   Form labels
│   └── viewer.py            #   CLI display (Rich)
├── tracker/                 # FastAPI backend
│   ├── app.py               #   FastAPI app + static mount
│   ├── config.py            #   Config (pydantic-settings)
│   ├── models.py            #   API models
│   ├── binder_models.py     #   Binder models
│   ├── api/
│   │   ├── controllers/     #   Routes (progress, binder, export/import)
│   │   └── dependencies.py  #   Dependency injection
│   ├── services/            #   Business logic
│   └── repository/          #   JSON persistence
├── web/                     # Front-end (vanilla HTML/CSS/JS)
│   ├── index.html           #   SPA shell
│   ├── app.js               #   Bootstrap, routing, collection
│   ├── binder-v2.js         #   Binder logic
│   ├── binder-collection-view.js  # Binder rendering
│   ├── stats-view.js        #   Statistics view
│   ├── print-view.js        #   Printable checklist view
│   └── styles.css           #   Styles
├── tests/                   # Unit & integration tests
├── docs/
│   └── screenshots/         #   App screenshots
├── Dockerfile               # Production image
├── docker-compose.yml       # One-command local deploy
├── Makefile                 # Common commands
├── pyproject.toml           # Project config & dependencies
└── DESIGN.md                # Design system documentation
```

### Data directory (`data/`)

| File                          | Tracked | Description                         |
|-------------------------------|:-------:|-------------------------------------|
| `pokedex.json`                | ✅      | Full Pokédex reference (shipped)    |
| `narrative-tags.json`         | ✅      | Curated narrative tags              |
| `images/`                     | ✖       | Downloaded sprites and images       |
| `images_shiny/`               | ✖       | Optional shiny artwork cache        |
| `collection-progress.json`    | ✖       | Caught/missing progress by slug     |
| `collection-cards.json`       | ✖       | Physical card catalog               |
| `hunts.json`                  | ✖       | Active search targets               |
| `binder-config.json`          | ✖       | Binder configuration                |
| `binder-placements.json`      | ✖       | Placements slug → page/slot         |
| `profiles.json`               | ✖       | Active profile registry             |
| `profiles/<id>/...`           | ✖       | Per-profile local state             |

Only `data/pokedex.json` and `data/narrative-tags.json` are versioned — all
user state stays out of Git.

---

## Tech Stack

| Layer        | Technologies                                                  |
|--------------|---------------------------------------------------------------|
| CLI          | [Typer](https://typer.tiangolo.com/), [Rich](https://rich.readthedocs.io/) |
| Models       | [Pydantic v2](https://docs.pydantic.dev/)                     |
| Scraping     | [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) + [lxml](https://lxml.de/) |
| API          | [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) |
| Front-end    | HTML / CSS / JavaScript vanilla                                |
| Quality      | [ruff](https://docs.astral.sh/ruff/) (lint + format), [pytest](https://docs.pytest.org/) (100% tracker coverage) |
| Dependencies | [uv](https://github.com/astral-sh/uv)                         |
| Container    | [Docker](https://www.docker.com/) + docker compose             |

### Design System

The UI follows a **"Tech-Noir Editorial"** design system documented in [DESIGN.md](DESIGN.md). Dark mode, Space Grotesk + Inter typography, tonal layering, no-border philosophy.

---

## Quality

The `tracker/` module maintains **100% test coverage** (lines).

```bash
make check    # lint + tests + coverage
```

Linting and formatting use [ruff](https://docs.astral.sh/ruff/) with a strict rule set (pycodestyle, pyflakes, isort, bugbear, pyupgrade, naming, comprehensions, simplify).

---

## Roadmap

The product direction is public and RICE-scored. See [docs/ROADMAP.md](docs/ROADMAP.md)
for the full 16-feature plan organised in 4 delivery waves (V1 Polish,
V2 Activation, V3 Card Layer, V4 Delights). Each entry ships with a
user story, acceptance criteria, tech notes and dependencies.

Delivery status:

- **Wave 1 — Polish immédiat** — ✅ complete (F07 · F04 · F01 · F06).
- **Wave 2 — Activation & Pokédex identity** — ✅ complete (F00 · F03 · F05).
- **Wave 3 — Card Layer** — ✅ complete (F08 · F09 · F02 · F10).
- **Wave 4 — Delights** — ✅ complete (F11 · F12 · F15 · F14 · F13).

Post-1.0 work currently on `main` is documented in [CHANGELOG.md](CHANGELOG.md).
Ideas that are known but intentionally delayed live in
[docs/POSTPONED.md](docs/POSTPONED.md).

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

Quick version:

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add: my feature"`)
4. Push (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## Troubleshooting

| Problem               | Solution                                         |
|-----------------------|--------------------------------------------------|
| Missing data          | `make fetch`                                     |
| UI unreachable        | Check that `make dev` is running, check port     |
| Pokepedia changed     | `uv run python main.py fetch --debug --limit 5`  |
| Port already in use   | `make dev TRACKER_PORT=9999`                      |

---

## Author

**Alexandre Enouf** — [alexandre-enouf.fr](https://alexandre-enouf.fr)

Live demo: [pokevault.alexandre-enouf.fr](https://pokevault.alexandre-enouf.fr)

---

## Project Site

The GitHub Pages site lives in [docs/index.html](docs/index.html). It is a
zero-build static site that presents the product, install guide, architecture,
roadmap and contribution flow.

When GitHub Pages is enabled for the repository, configure it to deploy from the
`docs/` folder on `main`.

---

## License

Distributed under the [MIT](LICENSE) license.
