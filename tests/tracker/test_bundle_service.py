"""Tests pour le service de consolidation des données."""

import json
from pathlib import Path

from tracker.services.bundle_service import BundleService


def test_bundle_service_combines_files(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    pokedex_path = data_dir / "pokedex.json"
    pokedex_path.write_text(json.dumps({"pokemon": [], "meta": {"regions": []}}))

    (data_dir / "badge-battles.json").write_text(json.dumps({"badges": {}}))
    (data_dir / "game-pokedexes.json").write_text(json.dumps({}))
    (data_dir / "evolution-families.json").write_text(json.dumps({"families": []}))
    (data_dir / "narrative-tags.json").write_text(json.dumps({"labels": {}}))
    (data_dir / "i18n.json").write_text(json.dumps({"fr": {}, "en": {}}))

    service = BundleService(data_dir, pokedex_path)
    bundle = service.get_bundle()

    assert "version" in bundle
    assert "pokedex" in bundle
    assert "badges" in bundle
    assert "i18n" in bundle
    assert bundle["pokedex"]["pokemon"] == []

def test_bundle_service_tolerates_missing_files(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pokedex_path = data_dir / "pokedex.json"

    service = BundleService(data_dir, pokedex_path)
    bundle = service.get_bundle()

    assert bundle["pokedex"] is None
    assert bundle["badges"] is None
