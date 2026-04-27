"""tracker.api — export / import endpoints (TestClient)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.export_controller import router as export_router
from tracker.api.controllers.progress_controller import router as progress_router
from tracker.api.dependencies import (
    get_export_service,
    get_progress_service,
)
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import (
    JsonBinderPlacementsRepository,
)
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_hunt_repository import JsonHuntRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.export_service import ExportService
from tracker.services.progress_service import ProgressService


def test_is_mega_form_excludes_meganium_base() -> None:
    """Méganium (#0154) ne doit pas être détecté comme forme Méga."""
    base = {"slug": "0154-meganium", "number": "0154", "form": None}
    mega = {"slug": "0154-mega-meganium", "number": "0154", "form": "Méga"}
    assert ExportService._is_mega_form(base) is False
    assert ExportService._is_mega_form(mega) is True


def test_is_mega_form_variants() -> None:
    assert ExportService._is_mega_form({"slug": "0003-venusaur-mega", "form": "Méga"}) is True
    assert ExportService._is_mega_form({"slug": "0006-charizard-mega-x", "form": None}) is True
    assert ExportService._is_mega_form({"slug": "0006-charizard-mega-y", "form": None}) is True
    assert ExportService._is_mega_form({"slug": "0001-bulbasaur-mega-x", "form": None}) is True


def test_is_gigamax_and_regional_and_other_named() -> None:
    assert ExportService._is_gigamax({"slug": "0006-charizard-gmax", "form": "Gigamax"}) is True
    assert ExportService._is_regional_form({"slug": "0052-meowth-alola", "form": "d'Alola"}) is True
    assert ExportService._is_regional_form({"slug": "0027-sandshrew-galarian"}) is True
    # Méga l'emporte sur régional
    assert ExportService._is_regional_form({"slug": "0003-venusaur-mega", "form": "Méga"}) is False
    pop_star = {"slug": "0025-pikachu-pop-star", "number": "0025"}
    assert ExportService._is_other_named_form(pop_star) is True
    # Pas de form = pas other
    base = {"slug": "0001-bulbasaur", "number": "0001"}
    assert ExportService._is_other_named_form(base) is False
    # Méga n'est pas "other named"
    mega = {"slug": "0003-mega-venusaur", "number": "0003", "form": "Méga"}
    assert ExportService._is_other_named_form(mega) is False


def test_is_excluded_special_form_for_binder() -> None:
    zarbi = {"slug": "0201-unown-h", "number": "0201", "form": "Lettre H"}
    arceus = {"slug": "0493-arceus-feu", "number": "0493", "form": "Type Feu"}
    normal = {"slug": "0001-bulbasaur", "number": "0001"}
    assert ExportService._is_excluded_special_form_for_binder(zarbi) is True
    assert ExportService._is_excluded_special_form_for_binder(arceus) is True
    assert ExportService._is_excluded_special_form_for_binder(normal) is False


def test_pokemon_matches_form_rule_branches() -> None:
    strict = {
        "include_base": True,
        "include_mega": False,
        "include_gigamax": False,
        "include_regional": False,
        "include_other_named_forms": False,
    }
    assert ExportService._pokemon_matches_form_rule(
        {"slug": "0003-mega-venusaur", "form": "Méga"}, strict,
    ) is False
    assert ExportService._pokemon_matches_form_rule(
        {"slug": "0006-charizard-gmax", "form": "Gigamax"}, strict,
    ) is False
    assert ExportService._pokemon_matches_form_rule(
        {"slug": "0052-meowth-alola", "form": "d'Alola"}, strict,
    ) is False
    assert ExportService._pokemon_matches_form_rule(
        {"slug": "0025-pikachu-pop-star", "number": "0025"}, strict,
    ) is False
    assert ExportService._pokemon_matches_form_rule(
        {"slug": "0001-bulbasaur"}, strict,
    ) is True


def test_pokemon_matches_binder_rule_excludes_special() -> None:
    full = {
        "include_base": True,
        "include_mega": True,
        "include_gigamax": True,
        "include_regional": True,
        "include_other_named_forms": True,
    }
    zarbi = {"slug": "0201-unown-h", "number": "0201", "form": "Lettre H"}
    assert ExportService._pokemon_matches_binder_rule(zarbi, full) is False


def test_keep_single_classic_form_prefers_base() -> None:
    rows = [
        {"slug": "0003-mega-venusaur", "number": "0003", "form": "Méga"},
        {"slug": "0003-venusaur", "number": "0003", "form": None},
        {"slug": "", "number": ""},
    ]
    kept = ExportService._keep_single_classic_form_per_number(rows)
    slugs = [p["slug"] for p in kept]
    assert "0003-venusaur" in slugs
    assert "0003-mega-venusaur" not in slugs


def test_effective_rule_fallback_paths(tmp_path: Path) -> None:
    from tracker.binder_models import BinderConfigPayload
    cfg_empty = BinderConfigPayload(convention="sheet_recto_verso", binders=[], form_rules=[])
    assert ExportService._effective_rule_for_collection(cfg_empty)["include_base"] is True
    cfg_norule = BinderConfigPayload(
        convention="sheet_recto_verso",
        binders=[{"id": "a", "name": "A", "rows": 3, "cols": 3}],
        form_rules=[],
    )
    assert ExportService._effective_rule_for_collection(cfg_norule)["include_mega"] is False
    cfg_unknown = BinderConfigPayload(
        convention="sheet_recto_verso",
        binders=[{"id": "a", "name": "A", "rows": 3, "cols": 3, "form_rule_id": "missing"}],
        form_rules=[{"id": "other", "include_base": True}],
    )
    assert ExportService._effective_rule_for_collection(cfg_unknown)["include_mega"] is False
    cfg_ok = BinderConfigPayload(
        convention="sheet_recto_verso",
        binders=[{"id": "a", "name": "A", "rows": 3, "cols": 3, "form_rule_id": "full"}],
        form_rules=[{"id": "full", "include_base": True, "include_mega": True}],
    )
    assert ExportService._effective_rule_for_collection(cfg_ok)["include_mega"] is True


def test_load_pokedex_rows_variants(tmp_path: Path) -> None:
    import json as _json

    def _svc(path: Path) -> ExportService:
        return ExportService(
            None,  # type: ignore[arg-type]
            None,  # type: ignore[arg-type]
            None,  # type: ignore[arg-type]
            pokedex_path=path,
        )

    assert _svc(tmp_path / "absent.json")._load_pokedex_rows() == []

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert _svc(broken)._load_pokedex_rows() == []

    as_list = tmp_path / "list.json"
    as_list.write_text(_json.dumps([{"slug": "a"}, "bad"]), encoding="utf-8")
    assert _svc(as_list)._load_pokedex_rows() == [{"slug": "a"}]

    as_wrapped = tmp_path / "wrapped.json"
    as_wrapped.write_text(_json.dumps({"pokemon": [{"slug": "b"}]}), encoding="utf-8")
    assert _svc(as_wrapped)._load_pokedex_rows() == [{"slug": "b"}]

    as_weird = tmp_path / "weird.json"
    as_weird.write_text(_json.dumps({"other": 1}), encoding="utf-8")
    assert _svc(as_weird)._load_pokedex_rows() == []


def test_sanitize_placements_ignores_non_dict_slots() -> None:
    from tracker.binder_models import BinderPlacementsPayload
    # ``model_construct`` contourne la validation Pydantic pour tester le garde-fou défensif.
    pl = BinderPlacementsPayload.model_construct(
        by_binder={
            "kanto": {"0001-bulbasaur": {"page": 0, "slot": 1}},
            "broken": "not-a-dict",
        }
    )
    out = ExportService._sanitize_placements(pl, allowed={"0001-bulbasaur"})
    assert "kanto" in out.by_binder
    assert "broken" not in out.by_binder


def _setup(tmp_path: Path, pokedex_rows: list[dict] | None = None) -> TestClient:
    prog = tmp_path / "data" / "collection-progress.json"
    cfg = tmp_path / "data" / "binder-config.json"
    pl = tmp_path / "data" / "binder-placements.json"
    pokedex = tmp_path / "data" / "pokedex.json"
    prog.parent.mkdir(parents=True, exist_ok=True)
    if pokedex_rows is not None:
        import json

        pokedex.write_text(json.dumps(pokedex_rows), encoding="utf-8")

    progress_repo = JsonProgressRepository(prog)
    config_repo = JsonBinderConfigRepository(cfg)
    placements_repo = JsonBinderPlacementsRepository(pl)
    cards_path = tmp_path / "data" / "collection-cards.json"
    card_repo = JsonCardRepository(cards_path)
    hunt_repo = JsonHuntRepository(tmp_path / "data" / "hunts.json")

    def progress_override() -> ProgressService:
        return ProgressService(progress_repo)

    def export_override() -> ExportService:
        return ExportService(
            progress_repo,
            config_repo,
            placements_repo,
            card_repo,
            hunt_repo,
            pokedex_path=pokedex,
        )

    app = FastAPI()
    app.include_router(progress_router)
    app.include_router(export_router)
    app.dependency_overrides[get_progress_service] = progress_override
    app.dependency_overrides[get_export_service] = export_override
    return TestClient(app)


def test_export_empty_collection(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["schema_version"] == 3
    assert data["app"] == "pokevault"
    assert "exported_at" in data
    assert data["progress"]["caught"] == {}
    assert data["binder_config"]["binders"] == []
    assert data["binder_placements"]["by_binder"] == {}
    assert data["cards"] == []
    assert data["hunts"]["hunts"] == {}


def test_export_with_data(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"pikachu": True, "bulbasaur": True}})

    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["progress"]["caught"] == {"pikachu": True, "bulbasaur": True}


def test_import_restores_collection(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 1,
        "progress": {"version": 1, "caught": {"charmander": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [{"id": "kanto", "name": "Kanto", "rows": 3, "cols": 3}],
            "form_rules": [],
        },
        "binder_placements": {
            "version": 1,
            "by_binder": {"kanto": {"charmander": {"page": 0, "slot": 3}}},
        },
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["caught_count"] == 1
    assert body["binder_count"] == 1

    exported = client.get("/api/export").json()
    assert exported["progress"]["caught"] == {"charmander": True}
    assert len(exported["binder_config"]["binders"]) == 1
    assert exported["binder_config"]["binders"][0]["id"] == "kanto"
    assert "charmander" in exported["binder_placements"]["by_binder"]["kanto"]


def test_import_overwrites_existing(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"old-pokemon": True}})

    payload = {
        "schema_version": 1,
        "progress": {"version": 1, "caught": {"new-pokemon": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
    }
    client.post("/api/import", json=payload)

    exported = client.get("/api/export").json()
    assert exported["progress"]["caught"] == {"new-pokemon": True}
    assert "old-pokemon" not in exported["progress"]["caught"]


def test_import_accepts_v1_legacy_payload(tmp_path: Path) -> None:
    """Schema v1 (pre-F08, no cards) remains importable for backward compat."""
    client = _setup(tmp_path)
    payload = {
        "schema_version": 1,
        "progress": {"version": 1, "caught": {"pichu": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["caught_count"] == 1
    assert body["card_count"] == 0


def test_import_rejects_bad_schema_version(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 99,
        "progress": {"version": 1, "caught": {}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 422


def test_export_import_roundtrips_hunts(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 3,
        "progress": {"version": 1, "caught": {"pikachu": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
        "cards": [],
        "hunts": {
            "version": 1,
            "hunts": {
                "0025-pikachu": {
                    "wanted": True,
                    "priority": "high",
                    "note": "Holo FR",
                    "updated_at": "2026-04-26T12:00:00+00:00",
                }
            },
        },
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 200

    exported = client.get("/api/export").json()
    assert exported["schema_version"] == 3
    assert exported["hunts"]["hunts"]["0025-pikachu"]["priority"] == "high"


def test_import_rejects_malformed_json(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    r = client.post("/api/import", json={"garbage": True})
    assert r.status_code == 422


def test_roundtrip_export_import(tmp_path: Path) -> None:
    """Export then re-import should yield identical state."""
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"pikachu": True, "eevee": True}})

    exported = client.get("/api/export").json()
    client.put("/api/progress", json={"caught": {}})

    assert client.get("/api/export").json()["progress"]["caught"] == {}

    r = client.post("/api/import", json=exported)
    assert r.status_code == 200

    restored = client.get("/api/export").json()
    assert restored["progress"]["caught"] == {"pikachu": True, "eevee": True}


def test_export_import_filters_out_of_scope_forms(tmp_path: Path) -> None:
    client = _setup(
        tmp_path,
        pokedex_rows=[
            {"slug": "0001-bulbizarre", "number": "0001", "form": ""},
            {"slug": "0001-bulbizarre-mega", "number": "0001", "form": "Mega"},
        ],
    )

    payload = {
        "schema_version": 1,
        "progress": {
            "version": 1,
            "caught": {"0001-bulbizarre": True, "0001-bulbizarre-mega": True},
        },
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [{"id": "kanto", "name": "Kanto", "rows": 3, "cols": 3}],
            "form_rules": [],
        },
        "binder_placements": {
            "version": 1,
            "by_binder": {
                "kanto": {
                    "0001-bulbizarre": {"page": 0, "slot": 1},
                    "0001-bulbizarre-mega": {"page": 0, "slot": 2},
                }
            },
        },
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 200

    exported = client.get("/api/export")
    assert exported.status_code == 200
    data = exported.json()
    assert data["progress"]["caught"] == {"0001-bulbizarre": True}
    assert data["binder_placements"]["by_binder"]["kanto"] == {
        "0001-bulbizarre": {"page": 0, "slot": 1}
    }
