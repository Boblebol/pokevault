"""Imports publics (couverture des __init__ / docstrings)."""

from __future__ import annotations


def test_import_tracker_package() -> None:
    import tracker

    assert tracker.__doc__ and "Pokédex" in tracker.__doc__


def test_import_repository_exports() -> None:
    from tracker.repository import JsonProgressRepository, ProgressRepository

    assert JsonProgressRepository is not None
    assert ProgressRepository is not None


def test_import_api_controllers() -> None:
    from tracker.api.controllers import binder_router, progress_router

    assert progress_router.prefix == "/api"
    assert binder_router.prefix == "/api/binder"
