"""tracker.services.profile_service (roadmap F15)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from tracker.models import ProfileCreate
from tracker.services.profile_service import (
    DEFAULT_ID,
    PROFILE_SUBDIR,
    ProfileService,
    _slugify,
    _unique_slug_from_name,
)


def _make(tmp_path: Path) -> ProfileService:
    return ProfileService(
        data_root=tmp_path,
        registry_path=tmp_path / "profiles.json",
    )


def test_load_creates_default_when_registry_missing(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    reg = svc.load()
    assert reg.active_id == DEFAULT_ID
    assert [p.id for p in reg.profiles] == [DEFAULT_ID]


def test_load_recovers_from_invalid_json(tmp_path: Path) -> None:
    (tmp_path / "profiles.json").write_text("{not json", encoding="utf-8")
    reg = _make(tmp_path).load()
    assert reg.active_id == DEFAULT_ID


def test_load_recovers_from_invalid_shape(tmp_path: Path) -> None:
    (tmp_path / "profiles.json").write_text(
        json.dumps({"version": 99, "whatever": True}), encoding="utf-8"
    )
    reg = _make(tmp_path).load()
    assert reg.active_id == DEFAULT_ID


def test_load_fixes_dangling_active_id(tmp_path: Path) -> None:
    raw = {
        "version": 1,
        "active_id": "ghost",
        "profiles": [
            {"id": "alt", "name": "Alt", "created_at": "2026-04-24T00:00:00Z"}
        ],
    }
    (tmp_path / "profiles.json").write_text(json.dumps(raw), encoding="utf-8")
    reg = _make(tmp_path).load()
    assert reg.active_id == DEFAULT_ID
    assert {p.id for p in reg.profiles} == {"alt", DEFAULT_ID}


def test_create_profile_generates_unique_slug(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    first = svc.create(ProfileCreate(name="Chasse Pokédex"))
    second = svc.create(ProfileCreate(name="Chasse Pokédex"))
    assert first.id == "chasse-pokedex"
    assert second.id == "chasse-pokedex-2"
    assert (tmp_path / PROFILE_SUBDIR / first.id).is_dir()


def test_set_active_requires_existing_id(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    with pytest.raises(HTTPException) as exc:
        svc.set_active("ghost")
    assert exc.value.status_code == 404


def test_set_active_updates_registry(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    p = svc.create(ProfileCreate(name="Shiny Hunt"))
    svc.set_active(p.id)
    assert svc.active_id() == p.id


def test_delete_default_profile_forbidden(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    with pytest.raises(HTTPException) as exc:
        svc.delete(DEFAULT_ID)
    assert exc.value.status_code == 400


def test_delete_unknown_profile_returns_zero(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    assert svc.delete("ghost") == 0


def test_delete_switches_active_to_default(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    p = svc.create(ProfileCreate(name="Alt"))
    svc.set_active(p.id)
    removed = svc.delete(p.id)
    assert removed == 1
    assert svc.active_id() == DEFAULT_ID


def test_paths_for_default_use_data_root(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    assert svc.progress_path() == tmp_path / "collection-progress.json"
    assert svc.cards_path() == tmp_path / "collection-cards.json"
    assert svc.binder_config_path() == tmp_path / "binder-config.json"
    assert svc.binder_placements_path() == tmp_path / "binder-placements.json"
    assert svc.trainer_contacts_path() == tmp_path / "trainer-contacts.json"


def test_paths_for_custom_profile_are_scoped(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    p = svc.create(ProfileCreate(name="Shiny Hunt"))
    base = tmp_path / PROFILE_SUBDIR / p.id
    assert svc.progress_path(p.id) == base / "collection-progress.json"
    assert svc.cards_path(p.id) == base / "collection-cards.json"
    assert svc.binder_config_path(p.id) == base / "binder-config.json"
    assert svc.binder_placements_path(p.id) == base / "binder-placements.json"
    assert svc.trainer_contacts_path(p.id) == base / "trainer-contacts.json"


def test_paths_default_to_active_profile(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    p = svc.create(ProfileCreate(name="Alt"))
    svc.set_active(p.id)
    assert svc.progress_path().parent.name == p.id


def test_slugify_handles_edge_cases() -> None:
    assert _slugify("   ") == ""
    assert _slugify("Équipe Éléctrique!!") == "equipe-electrique"
    assert _slugify("#####") == ""


def test_unique_slug_fallback_for_empty_name() -> None:
    assert _unique_slug_from_name("", set()) == "profil"


def test_unique_slug_increments_suffix() -> None:
    assert _unique_slug_from_name("Alt", {"alt", "alt-2"}) == "alt-3"
