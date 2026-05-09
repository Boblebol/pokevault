"""Static checks for Docker helper targets."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAKEFILE = ROOT / "Makefile"
COMPOSE_FILE = ROOT / "docker-compose.yml"
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release.yml"


def _recipe_for(target: str) -> str:
    lines = MAKEFILE.read_text(encoding="utf-8").splitlines()
    start = next(index for index, line in enumerate(lines) if line.startswith(f"{target}:"))
    recipe: list[str] = []
    for line in lines[start + 1 :]:
        if line.startswith("\t") or not line.strip():
            recipe.append(line)
            continue
        break
    return "\n".join(recipe)


def test_docker_up_uses_published_image_without_local_build() -> None:
    makefile = MAKEFILE.read_text(encoding="utf-8")
    compose = COMPOSE_FILE.read_text(encoding="utf-8")
    recipe = _recipe_for("docker-up")

    assert "DOCKER_IMAGE ?= ghcr.io/boblebol/pokevault" in makefile
    assert "DOCKER_PLATFORM ?= linux/amd64" in makefile
    assert "image: ${DOCKER_IMAGE:-ghcr.io/boblebol/pokevault}:${DOCKER_TAG:-latest}" in compose
    assert "docker pull --platform $(DOCKER_PLATFORM) $(DOCKER_IMAGE):$(DOCKER_TAG)" in recipe
    assert "docker compose up -d --no-build --pull never --force-recreate tracker" in recipe
    assert "docker compose build" not in recipe


def test_docker_build_keeps_local_checkout_flow_explicit() -> None:
    makefile = MAKEFILE.read_text(encoding="utf-8")
    build_recipe = _recipe_for("docker-build")
    up_local_recipe = _recipe_for("docker-up-local")

    assert "DOCKER_BUILD_IMAGE ?= pokevault" in makefile
    assert "DOCKER_BUILD_TAG ?= local" in makefile
    assert "DOCKER_IMAGE=$(DOCKER_BUILD_IMAGE) DOCKER_TAG=$(DOCKER_BUILD_TAG)" in build_recipe
    assert "docker compose build tracker" in build_recipe
    assert "--no-cache" not in build_recipe
    assert "docker compose up -d --force-recreate tracker" in up_local_recipe


def test_release_publishes_multi_arch_docker_images() -> None:
    workflow = RELEASE_WORKFLOW.read_text(encoding="utf-8")

    assert "docker/setup-qemu-action" in workflow
    assert "platforms: linux/amd64,linux/arm64" in workflow


def test_docker_image_embeds_reference_data_refresh_source() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    compose = COMPOSE_FILE.read_text(encoding="utf-8")
    dockerignore = (ROOT / ".dockerignore").read_text(encoding="utf-8")

    assert "COPY data/game-pokedexes.json data/game-pokedexes.json" in dockerfile
    assert "COPY data/game-pokedexes.json reference-data/game-pokedexes.json" in dockerfile
    assert "ENV TRACKER_REFERENCE_DATA_DIR=/app/reference-data" in dockerfile
    assert "TRACKER_REFERENCE_DATA_DIR=/app/reference-data" in compose
    for name in [
        "evolution-families.json",
        "evolution-family-overrides.json",
        "game-pokedexes.json",
        "badge-battles.json",
    ]:
        assert f"!data/{name}" in dockerignore
