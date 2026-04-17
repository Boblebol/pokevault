SHELL := /bin/sh

UV ?= uv
PYTHON ?= python

TRACKER_HOST ?= 127.0.0.1
TRACKER_PORT ?= 8765
FRONT_URL ?= http://$(TRACKER_HOST):$(TRACKER_PORT)/

DOCKER_IMAGE ?= pokevault
DOCKER_TAG ?= latest

AWK ?= awk

.DEFAULT_GOAL := help

.PHONY: help vars install dev open fetch fetch-test test test-cov lint fmt check clean \
	build docker-build docker-up docker-down docker-logs

##@ General

help: ## Afficher l'aide (sections + descriptions)
	@printf "\n\033[1mPokevault Make Helper\033[0m\n\n"
	@printf "\033[36mUsage:\033[0m make \033[33m<target>\033[0m [VAR=valeur]\n\n"
	@$(AWK) '\
		BEGIN {FS=":.*## "} \
		/^##@/ { \
			gsub(/^##@ ?/, "", $$0); \
			printf "\033[1m%s\033[0m\n", $$0; \
			next \
		} \
		/^[a-zA-Z0-9_.-]+:.*## / { \
			printf "  \033[33m%-16s\033[0m %s\n", $$1, $$2 \
		} \
	' $(MAKEFILE_LIST)
	@printf "\n\033[36mExemples:\033[0m\n"
	@printf "  make dev\n"
	@printf "  make open TRACKER_PORT=9000\n"
	@printf "  make docker-up DOCKER_TAG=latest\n\n"

vars: ## Afficher les variables utiles (et leurs valeurs)
	@printf "\033[1mVariables actives\033[0m\n"
	@printf "  %-14s %s\n" "UV" "$(UV)"
	@printf "  %-14s %s\n" "PYTHON" "$(PYTHON)"
	@printf "  %-14s %s\n" "TRACKER_HOST" "$(TRACKER_HOST)"
	@printf "  %-14s %s\n" "TRACKER_PORT" "$(TRACKER_PORT)"
	@printf "  %-14s %s\n" "FRONT_URL" "$(FRONT_URL)"
	@printf "  %-14s %s\n" "DOCKER_IMAGE" "$(DOCKER_IMAGE)"
	@printf "  %-14s %s\n" "DOCKER_TAG" "$(DOCKER_TAG)"

install: ## Installer les dependances dev (uv sync)
	$(UV) sync --dev

##@ Development

dev: ## Lancer le serveur local (FastAPI + UI statique)
	TRACKER_HOST=$(TRACKER_HOST) TRACKER_PORT=$(TRACKER_PORT) $(UV) run $(PYTHON) -m tracker

open: ## Ouvrir l'UI web dans le navigateur par defaut
	$(UV) run $(PYTHON) -c "import webbrowser; webbrowser.open('$(FRONT_URL)')"

fetch: ## Scraper Pokepedia et generer data/pokedex.json
	$(UV) run $(PYTHON) main.py fetch

fetch-test: ## Scrape rapide (10 entrees, sans images)
	$(UV) run $(PYTHON) main.py fetch --no-images --limit 10

##@ Quality

test: ## Lancer tous les tests
	$(UV) run pytest tests/

test-cov: ## Lancer les tests avec couverture (100% tracker)
	$(UV) run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100

lint: ## Verifier le style (ruff check)
	$(UV) run ruff check pokedex/ tracker/ main.py tests/

fmt: ## Formater le code (ruff format)
	$(UV) run ruff format pokedex/ tracker/ main.py tests/

check: lint test-cov ## Executer lint + tests couverture

##@ Docker

build: docker-build ## Alias: builder l'image Docker

docker-build: ## Builder l'image Docker
	DOCKER_IMAGE=$(DOCKER_IMAGE) DOCKER_TAG=$(DOCKER_TAG) docker compose build --no-cache tracker
	@echo ""
	@echo "Pour servir cette image: recreer le conteneur (make docker-up ou"
	@echo "  docker compose up -d --force-recreate tracker)"
	@echo "Sinon, l'ancien conteneur peut encore tourner avec l'image precedente."

docker-up: ## Demarrer le tracker via docker compose
	DOCKER_IMAGE=$(DOCKER_IMAGE) DOCKER_TAG=$(DOCKER_TAG) docker compose build --no-cache tracker
	DOCKER_IMAGE=$(DOCKER_IMAGE) DOCKER_TAG=$(DOCKER_TAG) docker compose up -d --force-recreate tracker
	@$(MAKE) --no-print-directory open

docker-down: ## Arreter les services docker compose
	docker compose down

docker-logs: ## Suivre les logs docker compose
	docker compose logs -f

##@ Cleanup

clean: ## Supprimer les artefacts locaux
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov
