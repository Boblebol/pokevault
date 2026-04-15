"""Fixtures communes pour le package tracker."""

from __future__ import annotations

import pytest

from tracker.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
