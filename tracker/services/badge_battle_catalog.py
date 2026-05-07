"""Load exact battle metadata for badge details."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.badge_battle_models import BadgeBattleCatalog


def load_badge_battle_catalog(path: Path) -> BadgeBattleCatalog:
    if not path.is_file():
        return BadgeBattleCatalog()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return BadgeBattleCatalog.model_validate(raw)
