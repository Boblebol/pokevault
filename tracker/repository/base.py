"""Contrat du stockage de progression."""

from __future__ import annotations

from typing import Protocol

from tracker.models import CollectionProgress


class ProgressRepository(Protocol):
    def load(self) -> CollectionProgress:
        """Charge l’état persisté (fichier absent → progression vide)."""

    def save(self, data: CollectionProgress) -> None:
        """Écrit l’état complet (remplace le fichier)."""
