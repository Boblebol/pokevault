"""Service de consolidation des données de référence."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tracker.version import APP_VERSION


class BundleService:
    def __init__(self, data_dir: Path, pokedex_path: Path):
        self.data_dir = data_dir
        self.pokedex_path = pokedex_path

    def get_bundle(self) -> dict[str, Any]:
        """Combine all reference JSON files into one."""
        bundle = {
            "version": APP_VERSION,
            "metadata": {
                "generated_at": datetime.now(UTC).isoformat(),
                "description": "Consolidated Pokevault data bundle",
            },
            "pokedex": self._load_json(self.pokedex_path),
            "badges": self._load_json(self.data_dir / "badge-battles.json"),
            "game_pokedexes": self._load_json(self.data_dir / "game-pokedexes.json"),
            "evolution_families": self._load_json(self.data_dir / "evolution-families.json"),
            "narrative_tags": self._load_json(self.data_dir / "narrative-tags.json"),
            "i18n": self._load_json(self.data_dir / "i18n.json"),
        }
        return bundle

    def _load_json(self, path: Path) -> Any:
        if not path.is_file():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
