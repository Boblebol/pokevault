"""Version consistency across package metadata, API, docs and static UI."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

from tracker.version import APP_VERSION


def test_project_ui_and_api_versions_match() -> None:
    root = Path(__file__).resolve().parents[2]
    pyproject = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    app_js = (root / "web" / "app.js").read_text(encoding="utf-8")
    m = re.search(r'const APP_VERSION = "([^"]+)";', app_js)

    assert pyproject["project"]["version"] == APP_VERSION
    assert m is not None
    assert m.group(1) == APP_VERSION


def test_release_version_is_visible_in_public_docs() -> None:
    root = Path(__file__).resolve().parents[2]
    readme = (root / "README.md").read_text(encoding="utf-8")
    changelog = (root / "CHANGELOG.md").read_text(encoding="utf-8")
    docs_pages = [
        "index.html",
        "features.html",
        "install.html",
        "architecture.html",
        "roadmap.html",
        "contributing.html",
    ]

    assert f"version-{APP_VERSION}" in readme
    assert f"## [{APP_VERSION}]" in changelog
    for page in docs_pages:
        html = (root / "docs" / page).read_text(encoding="utf-8")
        assert f"Pokevault v{APP_VERSION}" in html


def test_internal_agent_notes_are_not_public_docs() -> None:
    root = Path(__file__).resolve().parents[2]
    internal_notes_dir = "super" + "powers"

    assert not (root / "docs" / internal_notes_dir).exists()
