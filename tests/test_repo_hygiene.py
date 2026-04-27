"""Repository maintenance checks for public open-source readiness."""

from __future__ import annotations

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
