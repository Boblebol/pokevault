SHELL := /bin/sh

UV ?= uv
PYTHON ?= python

TRACKER_HOST ?= 127.0.0.1
TRACKER_PORT ?= 8765
FRONT_URL ?= http://$(TRACKER_HOST):$(TRACKER_PORT)/

DOCKER_IMAGE ?= pokevault
DOCKER_TAG ?= latest

.DEFAULT_GOAL := help

.PHONY: help install dev fetch fetch-test test test-cov lint fmt check clean \
        docker-build docker-up docker-down docker-logs

# ── General ──────────────────────────────────────────────────────────────────

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dev dependencies (uv sync)
	$(UV) sync --dev

# ── Development ──────────────────────────────────────────────────────────────

dev: ## Start the local tracker server (FastAPI + static UI)
	TRACKER_HOST=$(TRACKER_HOST) TRACKER_PORT=$(TRACKER_PORT) $(UV) run $(PYTHON) -m tracker

open: ## Open the web UI in the default browser
	$(UV) run $(PYTHON) -c "import webbrowser; webbrowser.open('$(FRONT_URL)')"

fetch: ## Scrape Pokepedia and generate data/pokedex.json
	$(UV) run $(PYTHON) main.py fetch

fetch-test: ## Quick scrape (10 entries, no images)
	$(UV) run $(PYTHON) main.py fetch --no-images --limit 10

# ── Quality ──────────────────────────────────────────────────────────────────

test: ## Run the full test suite
	$(UV) run pytest tests/

test-cov: ## Run tests with coverage (100% on tracker)
	$(UV) run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100

lint: ## Check code style (ruff)
	$(UV) run ruff check pokedex/ tracker/ main.py tests/

fmt: ## Auto-format code (ruff)
	$(UV) run ruff format pokedex/ tracker/ main.py tests/

check: lint test-cov ## Run lint + tests with coverage

# ── Docker ───────────────────────────────────────────────────────────────────

docker-build: ## Build the Docker image
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-up: ## Start the tracker via docker compose
	docker compose up -d

docker-down: ## Stop docker compose services
	docker compose down

docker-logs: ## Tail docker compose logs
	docker compose logs -f

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean: ## Remove local build artifacts
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov
