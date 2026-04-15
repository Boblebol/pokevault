# pokevault

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tracker_coverage-100%25-brightgreen.svg)](#qualité)

> Local-first Pokémon collection tracker.
> No account, no cloud — your data stays yours.

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
- Click to mark **caught / missing**.
- Status filters, dynamic search (name, number, slug).
- Global counter and progress bar.

### Web UI — Binder View (`#/classeur`)

- Create and manage virtual binders.
- Page-by-page navigation.
- Configurable grid (rows x columns).
- Server-side persisted placements.

### Web UI — Statistics (`#/stats`)

- Global and regional progress.
- Detailed collection metrics.

### Local REST API

| Endpoint                          | Method          | Description                    |
|-----------------------------------|-----------------|--------------------------------|
| `/api/progress`                   | GET / PUT / PATCH | Collection progress          |
| `/api/binder`                     | GET             | List binders                   |
| `/api/binder/{id}`                | GET / PUT / DELETE | Manage a binder             |
| `/api/binder/config`              | GET / PUT       | Binder configuration           |
| `/api/binder/placements`          | GET / PUT       | Binder placements              |
| `/data/pokedex.json`              | GET             | Pokédex data                   |

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
# 1. Scrape the Pokédex (first time)
make fetch

# 2. Start the local server
make dev

# 3. Open in browser
make open
```

App available at [http://127.0.0.1:8765](http://127.0.0.1:8765/).

### Docker

```bash
make docker-build
make fetch              # scrape data locally first
make docker-up          # start on localhost:8765
make docker-logs        # tail logs
make docker-down        # stop
```

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
│   │   ├── controllers/     #   Routes (progress, binder)
│   │   └── dependencies.py  #   Dependency injection
│   ├── services/            #   Business logic
│   └── repository/          #   JSON persistence
├── web/                     # Front-end (vanilla HTML/CSS/JS)
│   ├── index.html           #   SPA shell
│   ├── app.js               #   Bootstrap, routing, collection
│   ├── binder-v2.js         #   Binder logic
│   ├── binder-collection-view.js  # Binder rendering
│   ├── stats-view.js        #   Statistics view
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

### Data directory (`data/`, gitignored)

| File                          | Description                           |
|-------------------------------|---------------------------------------|
| `pokedex.json`                | Full Pokédex reference                |
| `images/`                     | Downloaded sprites and images         |
| `collection-progress.json`    | Caught/missing progress by slug       |
| `binder-config.json`          | Binder configuration                  |
| `binder-placements.json`      | Placements slug → page/slot           |

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

## License

Distributed under the [MIT](LICENSE) license.
