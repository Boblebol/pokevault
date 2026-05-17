import json
from pathlib import Path
from datetime import datetime, UTC

DATA_DIR = Path("data")
BUNDLE_PATH = DATA_DIR / "pokevault_bundle.json"

FILES = {
    "pokedex": "pokedex.json",
    "badges": "badge-battles.json",
    "game_pokedexes": "game-pokedexes.json",
    "evolution_families": "evolution-families.json",
    "narrative_tags": "narrative-tags.json",
    "i18n": "i18n.json"
}

def main():
    bundle = {
        "version": "1.7.0",
        "metadata": {
            "generated_at": datetime.now(UTC).isoformat(),
            "description": "Consolidated Pokevault data bundle"
        }
    }

    for key, filename in FILES.items():
        path = DATA_DIR / filename
        if path.exists():
            print(f"Adding {filename}...")
            with open(path, "r", encoding="utf-8") as f:
                bundle[key] = json.load(f)
        else:
            print(f"Warning: {filename} not found.")

    # Special case: i18n
    # I'll create a dummy placeholder for now, or extract it if I can.
    # For now, let's just focus on the core data files.

    print(f"Saving bundle to {BUNDLE_PATH}...")
    with open(BUNDLE_PATH, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=None) # Compact

    print(f"Bundle size: {BUNDLE_PATH.stat().st_size / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    main()
