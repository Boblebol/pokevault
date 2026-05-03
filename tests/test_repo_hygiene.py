"""Repository maintenance checks for public open-source readiness."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_release_process_documents_all_version_surfaces() -> None:
    text = (ROOT / "RELEASING.md").read_text(encoding="utf-8")

    for surface in [
        "pyproject.toml",
        "tracker/version.py",
        "web/app.js",
        "README.md",
        "docs/*.html",
        "CHANGELOG.md",
    ]:
        assert surface in text

    assert "git tag -a vX.Y.Z" in text
    assert "gh release view vX.Y.Z" in text


def test_ci_matches_public_runtime_support_and_runs_web_tests() -> None:
    workflow = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "permissions:\n  contents: read" in workflow
    assert '"3.10"' not in workflow
    for version in ['"3.11"', '"3.12"', '"3.13"', '"3.14"']:
        assert version in workflow
    assert "node --test tests/web/*.test.mjs" in workflow
    assert "needs: [check, web-tests]" in workflow


def test_dependabot_tracks_uv_lockfile_updates() -> None:
    dependabot = (ROOT / ".github" / "dependabot.yml").read_text(encoding="utf-8")

    assert 'package-ecosystem: "uv"' in dependabot
    assert 'package-ecosystem: "pip"' not in dependabot


def test_make_check_runs_web_tests_by_default() -> None:
    makefile = (ROOT / "Makefile").read_text(encoding="utf-8")

    check_target = re.search(r"^check:\s*(?P<deps>[^#\n]*)", makefile, flags=re.MULTILINE)
    assert check_target is not None
    assert "web-test" in check_target.group("deps").split()
    assert re.search(r"^web-test:.*$", makefile, flags=re.MULTILINE)
    assert "\tnode --test tests/web/*.test.mjs" in makefile


def test_contributing_documents_dependabot_uv_updates() -> None:
    contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")

    assert "Dependabot met à jour uv / docker / github-actions" in contributing
    assert "Dependabot met à jour pip / docker / github-actions" not in contributing


def test_readme_lists_all_versioned_reference_data() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    data_model = readme.split("Only reference data is versioned:", maxsplit=1)[1].split(
        "User state is local and ignored by Git:", maxsplit=1
    )[0]

    for reference_file in [
        "data/pokedex.json",
        "data/narrative-tags.json",
        "data/evolution-families.json",
        "data/evolution-family-overrides.json",
    ]:
        assert reference_file in data_model


def test_runtime_help_references_existing_dev_command() -> None:
    for path in [
        ROOT / "web" / "app.js",
        ROOT / "web" / "binder-collection-view.js",
        ROOT / "web" / "i18n.js",
    ]:
        text = path.read_text(encoding="utf-8")
        assert "make web" not in text, path
        assert "make dev" in text, path


def test_codeowners_declares_default_maintainer() -> None:
    codeowners = (ROOT / ".github" / "CODEOWNERS").read_text(encoding="utf-8")

    assert "* @Boblebol" in codeowners


def test_uv_project_is_declared_as_non_packaged_app() -> None:
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert "[project.scripts]" not in pyproject
    assert "[tool.uv]\npackage = false" in pyproject


def test_repository_normalizes_text_line_endings() -> None:
    attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")

    assert "* text=auto eol=lf" in attributes
    assert "*.png binary" in attributes
