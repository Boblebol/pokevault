"""Version consistency across package metadata, API and static UI."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

from tracker.version import APP_VERSION


def test_project_ui_and_api_versions_match() -> None:
    root = Path(__file__).resolve().parents[2]
    pyproject = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    app_js = (root / "web" / "app.js").read_text(encoding="utf-8")
    m = re.search(r'const APP_UI_VERSION = "([^"]+)";', app_js)

    assert pyproject["project"]["version"] == APP_VERSION
    assert m is not None
    assert m.group(1) == APP_VERSION
