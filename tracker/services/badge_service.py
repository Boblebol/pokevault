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

from tracker.models import BadgeDefinition, BadgeState, Card, CollectionProgress
from tracker.repository.base import CardRepository, ProgressRepository


@dataclass(frozen=True)
class BadgeProgress:
    current: int
    target: int
    hint_unit: str

    @property
    def complete(self) -> bool:
        return self.current >= self.target

    @property
    def percent(self) -> int:
        if self.complete:
            return 100
        return max(0, min(99, int((self.current / self.target) * 100)))

    @property
    def hint(self) -> str:
        if self.complete:
            return "Badge obtenu."
        remaining = self.target - self.current
        return f"Encore {remaining} {self.hint_unit}."


@dataclass(frozen=True)
class BadgeDef:
    """Internal badge definition — ``id`` is public & stable."""

    id: str
    title: str
    description: str
    metric: str
    target: int
    hint_unit: str

    def progress(
        self,
        progress: CollectionProgress,
        cards: list[Card],
    ) -> BadgeProgress:
        current = _metric_value(self.metric, progress, cards)
        return BadgeProgress(
            current=max(0, min(current, self.target)),
            target=self.target,
            hint_unit=self.hint_unit,
        )


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


def _metric_value(
    metric: str,
    progress: CollectionProgress,
    cards: list[Card],
) -> int:
    if metric == "seen":
        return _seen_count(progress)
    if metric == "caught":
        return _caught_count(progress)
    if metric == "shiny":
        return _shiny_count(progress)
    if metric == "cards":
        return len(cards)
    if metric == "sets":
        return _unique_sets(cards)
    if metric == "card_qty":
        return _card_total_qty(cards)
    raise ValueError(f"Unknown badge metric: {metric}")


BADGES: list[BadgeDef] = [
    BadgeDef(
        "first_encounter",
        "Première rencontre",
        "Identifier ton premier Pokémon.",
        "seen",
        1,
        "Pokémon à identifier",
    ),
    BadgeDef(
        "first_catch",
        "Premier Pokéball",
        "Attraper ton premier Pokémon.",
        "caught",
        1,
        "Pokémon à attraper",
    ),
    BadgeDef(
        "first_shiny",
        "Premier chromatique",
        "Attraper ton premier Pokémon shiny.",
        "shiny",
        1,
        "Pokémon shiny à attraper",
    ),
    BadgeDef(
        "first_card",
        "Première carte",
        "Ajouter ta première carte TCG au carnet.",
        "cards",
        1,
        "carte TCG à ajouter",
    ),
    BadgeDef(
        "century",
        "Centenaire",
        "Attraper 100 Pokémon différents.",
        "caught",
        100,
        "Pokémon à attraper",
    ),
    BadgeDef(
        "five_hundred",
        "Cinq cents",
        "Attraper 500 Pokémon différents.",
        "caught",
        500,
        "Pokémon à attraper",
    ),
    BadgeDef(
        "thousand",
        "Millénaire",
        "Attraper 1000 Pokémon différents.",
        "caught",
        1000,
        "Pokémon à attraper",
    ),
    BadgeDef(
        "shiny_ten",
        "Chasseur",
        "Attraper 10 Pokémon chromatiques.",
        "shiny",
        10,
        "Pokémon shiny à attraper",
    ),
    BadgeDef(
        "shiny_hundred",
        "Chasseur légendaire",
        "Attraper 100 Pokémon chromatiques.",
        "shiny",
        100,
        "Pokémon shiny à attraper",
    ),
    BadgeDef(
        "ten_sets",
        "Inter-extensions",
        "Posséder des cartes de 10 sets différents.",
        "sets",
        10,
        "set TCG à cataloguer",
    ),
    BadgeDef(
        "hundred_cards",
        "Centenaire TCG",
        "Catalogue de 100 cartes uniques.",
        "cards",
        100,
        "carte TCG à cataloguer",
    ),
    BadgeDef(
        "dedicated_collector",
        "Collectionneur dévoué",
        "500 cartes en stock (cumul des quantités).",
        "card_qty",
        500,
        "carte en stock à ajouter",
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
        return {b.id for b in BADGES if b.progress(progress, cards).complete}

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
        cards = list(self._card_repo.load().cards)
        catalog = []
        for badge in BADGES:
            badge_progress = self._definition_progress(
                badge,
                progress,
                cards,
                unlocked,
            )
            catalog.append(
                BadgeDefinition(
                    id=badge.id,
                    title=badge.title,
                    description=badge.description,
                    unlocked=badge.id in unlocked,
                    current=badge_progress.current,
                    target=badge_progress.target,
                    percent=badge_progress.percent,
                    hint=badge_progress.hint,
                )
            )
        return BadgeState(catalog=catalog, unlocked=sorted(unlocked))

    def _definition_progress(
        self,
        badge: BadgeDef,
        progress: CollectionProgress,
        cards: list[Card],
        unlocked: set[str],
    ) -> BadgeProgress:
        current = badge.progress(progress, cards)
        if badge.id not in unlocked or current.complete:
            return current
        return BadgeProgress(
            current=current.target,
            target=current.target,
            hint_unit=current.hint_unit,
        )
