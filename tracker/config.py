"""Configuration du serveur tracker (Pydantic Settings)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class TrackerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRACKER_",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8765
    repo_root: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent.parent,
        description="Racine du dépôt (web/, data/).",
    )

    @property
    def web_dir(self) -> Path:
        return self.repo_root / "web"

    @property
    def data_dir(self) -> Path:
        return self.repo_root / "data"

    @property
    def progress_path(self) -> Path:
        return self.data_dir / "collection-progress.json"

    @property
    def binder_config_path(self) -> Path:
        """v2 classeurs — configuration (grille, feuillets, règles)."""
        return self.data_dir / "binder-config.json"

    @property
    def binder_placements_path(self) -> Path:
        """v2 classeurs — placements (slug → page/slot), fichier séparé."""
        return self.data_dir / "binder-placements.json"

    @property
    def pokedex_path(self) -> Path:
        return self.data_dir / "pokedex.json"

    @property
    def cards_path(self) -> Path:
        """F08 — carnet de cartes TCG physiques (user state)."""
        return self.data_dir / "collection-cards.json"

    @property
    def profiles_registry_path(self) -> Path:
        """F15 — liste des profils Pokédex + profil actif."""
        return self.data_dir / "profiles.json"


@lru_cache
def get_settings() -> TrackerSettings:
    return TrackerSettings()
