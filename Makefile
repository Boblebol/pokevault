SHELL := /bin/sh

UV ?= uv
PYTHON ?= python

TRACKER_HOST ?= 127.0.0.1
TRACKER_PORT ?= 8765
FRONT_URL ?= http://$(TRACKER_HOST):$(TRACKER_PORT)/

.DEFAULT_GOAL := help

.PHONY: help install dev backend web back front fetch run fetch-test test test-all test-cov lint fmt check clean

help: ## Affiche les commandes disponibles
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Installe les deps de dev (uv)
	$(UV) sync --dev

dev: ## Lance l'app web locale (alias backend/web/back)
	TRACKER_HOST=$(TRACKER_HOST) TRACKER_PORT=$(TRACKER_PORT) $(UV) run $(PYTHON) -m tracker
backend: dev ## Alias de dev
web: dev ## Alias de dev
back: dev ## Alias de dev

front: ## Ouvre l'app dans le navigateur
	$(UV) run $(PYTHON) -c "import webbrowser; webbrowser.open('$(FRONT_URL)')"

fetch: ## Scrape complet et génère data/pokedex.json
	$(UV) run $(PYTHON) main.py fetch
run: fetch ## Alias de fetch

fetch-test: ## Scrape rapide (10 entrées, sans images)
	$(UV) run $(PYTHON) main.py fetch --no-images --limit 10

test: ## Lance toute la suite pytest
	$(UV) run pytest tests/
test-all: test ## Alias de test

test-cov: ## Lance les tests avec couverture tracker (100%)
	$(UV) run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100

lint: ## Vérifie le style avec ruff
	$(UV) run ruff check pokedex/ tracker/ main.py tests/

fmt: ## Formate le code avec ruff
	$(UV) run ruff format pokedex/ tracker/ main.py tests/

check: ## lint + test-cov
	$(MAKE) lint
	$(MAKE) test-cov

clean: ## Nettoie les artefacts locaux courants
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov
