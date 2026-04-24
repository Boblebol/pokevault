"""Logique métier — badges Pokédex (roadmap F12).

Badges are evaluated server-side from the current
:class:`~tracker.models.CollectionProgress` + :class:`~tracker.models.CardList`
state. Rules are **monotonic**: once unlocked, a badge stays unlocked even if
the underlying count later drops (e.g. the user uncatches a Pokémon).

Persisted as ``badges_unlocked: list[str]`` inside
``data/collection-progress.json``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from tracker.models import BadgeDefinition, BadgeState, Card, CollectionProgress
from tracker.repository.base import CardRepository, ProgressRepository

BadgePredicate = Callable[[CollectionProgress, list[Card]], bool]


@dataclass(frozen=True)
class BadgeDef:
    """Internal badge definition — ``id`` is public & stable, ``predicate``
    is evaluated on every mutation."""

    id: str
    title: str
    description: str
    predicate: BadgePredicate


def _caught_count(progress: CollectionProgress) -> int:
    return sum(1 for s in progress.statuses.values() if s.state == "caught")


def _seen_count(progress: CollectionProgress) -> int:
    return len(progress.statuses)


def _shiny_count(progress: CollectionProgress) -> int:
    return sum(
        1 for s in progress.statuses.values() if s.state == "caught" and s.shiny
    )


def _unique_sets(cards: list[Card]) -> int:
    return len({c.set_id.strip() for c in cards if c.set_id.strip()})


def _card_total_qty(cards: list[Card]) -> int:
    return sum(int(c.qty) for c in cards)


BADGES: list[BadgeDef] = [
    BadgeDef(
        "first_encounter",
        "Première rencontre",
        "Identifier ton premier Pokémon.",
        lambda p, c: _seen_count(p) >= 1,
    ),
    BadgeDef(
        "first_catch",
        "Premier Pokéball",
        "Attraper ton premier Pokémon.",
        lambda p, c: _caught_count(p) >= 1,
    ),
    BadgeDef(
        "first_shiny",
        "Premier chromatique",
        "Attraper ton premier Pokémon shiny.",
        lambda p, c: _shiny_count(p) >= 1,
    ),
    BadgeDef(
        "first_card",
        "Première carte",
        "Ajouter ta première carte TCG au carnet.",
        lambda p, c: len(c) >= 1,
    ),
    BadgeDef(
        "century",
        "Centenaire",
        "Attraper 100 Pokémon différents.",
        lambda p, c: _caught_count(p) >= 100,
    ),
    BadgeDef(
        "five_hundred",
        "Cinq cents",
        "Attraper 500 Pokémon différents.",
        lambda p, c: _caught_count(p) >= 500,
    ),
    BadgeDef(
        "thousand",
        "Millénaire",
        "Attraper 1000 Pokémon différents.",
        lambda p, c: _caught_count(p) >= 1000,
    ),
    BadgeDef(
        "shiny_ten",
        "Chasseur",
        "Attraper 10 Pokémon chromatiques.",
        lambda p, c: _shiny_count(p) >= 10,
    ),
    BadgeDef(
        "shiny_hundred",
        "Chasseur légendaire",
        "Attraper 100 Pokémon chromatiques.",
        lambda p, c: _shiny_count(p) >= 100,
    ),
    BadgeDef(
        "ten_sets",
        "Inter-extensions",
        "Posséder des cartes de 10 sets différents.",
        lambda p, c: _unique_sets(c) >= 10,
    ),
    BadgeDef(
        "hundred_cards",
        "Centenaire TCG",
        "Catalogue de 100 cartes uniques.",
        lambda p, c: len(c) >= 100,
    ),
    BadgeDef(
        "dedicated_collector",
        "Collectionneur dévoué",
        "500 cartes en stock (cumul des quantités).",
        lambda p, c: _card_total_qty(c) >= 500,
    ),
]


class BadgeService:
    """Evaluates + persists badge unlocks.

    ``progress_repo`` is the source of truth for both progress state and
    the ``badges_unlocked`` sub-key; ``card_repo`` feeds the card-based
    predicates.
    """

    def __init__(
        self,
        progress_repo: ProgressRepository,
        card_repo: CardRepository,
    ) -> None:
        self._progress_repo = progress_repo
        self._card_repo = card_repo

    def _evaluate_due(
        self,
        progress: CollectionProgress,
        cards: list[Card],
    ) -> set[str]:
        return {b.id for b in BADGES if b.predicate(progress, cards)}

    def sync_unlocked(self) -> list[str]:
        """Re-evaluate predicates and persist any newly unlocked badges.

        Returns the list of newly unlocked badge ids (empty if nothing
        changed). Monotonic: already-unlocked ids are never removed.
        """
        progress = self._progress_repo.load()
        cards = list(self._card_repo.load().cards)
        due = self._evaluate_due(progress, cards)
        already = set(progress.badges_unlocked)
        merged = already | due
        newly = sorted(due - already)
        if merged != already:
            updated = progress.model_copy(
                update={"badges_unlocked": sorted(merged)}
            )
            self._progress_repo.save(updated)
        return newly

    def state(self) -> BadgeState:
        """Return the full catalog + persisted unlocked ids."""
        progress = self._progress_repo.load()
        unlocked = set(progress.badges_unlocked)
        catalog = [
            BadgeDefinition(
                id=b.id,
                title=b.title,
                description=b.description,
                unlocked=b.id in unlocked,
            )
            for b in BADGES
        ]
        return BadgeState(catalog=catalog, unlocked=sorted(unlocked))
