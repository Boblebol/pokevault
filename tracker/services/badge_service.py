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
    required_slug_sets: tuple[frozenset[str], ...] = ()

    def progress(
        self,
        progress: CollectionProgress,
        cards: list[Card],
    ) -> BadgeProgress:
        if self.required_slug_sets:
            return _team_badge_progress(
                self.required_slug_sets,
                progress,
                self.hint_unit,
            )
        current = _metric_value(self.metric, progress, cards)
        return BadgeProgress(
            current=max(0, min(current, self.target)),
            target=self.target,
            hint_unit=self.hint_unit,
        )


def _caught_count(progress: CollectionProgress) -> int:
    return sum(1 for s in progress.statuses.values() if s.state == "caught")


def _caught_slugs(progress: CollectionProgress) -> set[str]:
    return {
        slug
        for slug, status in progress.statuses.items()
        if status.state == "caught"
    }


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


def _team_badge_progress(
    required_slug_sets: tuple[frozenset[str], ...],
    progress: CollectionProgress,
    hint_unit: str,
) -> BadgeProgress:
    caught = _caught_slugs(progress)
    best_current = 0
    best_target = 1
    best_percent = -1.0
    for required in required_slug_sets:
        target = max(1, len(required))
        current = len(required & caught)
        percent = current / target
        if percent > best_percent or (
            percent == best_percent and target < best_target
        ):
            best_current = current
            best_target = target
            best_percent = percent
    return BadgeProgress(
        current=best_current,
        target=best_target,
        hint_unit=hint_unit,
    )


def _team_badge(
    badge_id: str,
    title: str,
    description: str,
    required_slug_sets: tuple[tuple[str, ...], ...],
) -> BadgeDef:
    return BadgeDef(
        badge_id,
        title,
        description,
        "team",
        1,
        "Pokemon de l'equipe à capturer",
        tuple(frozenset(slugs) for slugs in required_slug_sets),
    )


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
    _team_badge(
        "kanto_brock",
        "Pierre - Roche de Kanto",
        "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
        (("0074-geodude", "0095-onix"),),
    ),
    _team_badge(
        "kanto_misty",
        "Ondine - Cascade",
        "Capturer l'equipe d'Ondine dans Pokemon Rouge/Bleu.",
        (("0120-staryu", "0121-starmie"),),
    ),
    _team_badge(
        "kanto_lt_surge",
        "Major Bob - Foudre",
        "Capturer l'equipe de Major Bob dans Pokemon Rouge/Bleu.",
        (("0100-voltorb", "0025-pikachu", "0026-raichu"),),
    ),
    _team_badge(
        "kanto_erika",
        "Erika - Prisme",
        "Capturer l'equipe d'Erika dans Pokemon Rouge/Bleu.",
        (("0071-victreebel", "0114-tangela", "0045-vileplume"),),
    ),
    _team_badge(
        "kanto_koga",
        "Koga - Ame",
        "Capturer l'equipe de Koga dans Pokemon Rouge/Bleu.",
        (("0109-koffing", "0089-muk", "0109-koffing", "0110-weezing"),),
    ),
    _team_badge(
        "kanto_sabrina",
        "Morgane - Marais",
        "Capturer l'equipe de Morgane dans Pokemon Rouge/Bleu.",
        (("0064-kadabra", "0122-mr-mime", "0049-venomoth", "0065-alakazam"),),
    ),
    _team_badge(
        "kanto_blaine",
        "Auguste - Volcan",
        "Capturer l'equipe d'Auguste dans Pokemon Rouge/Bleu.",
        (("0058-growlithe", "0077-ponyta", "0078-rapidash", "0059-arcanine"),),
    ),
    _team_badge(
        "kanto_giovanni",
        "Giovanni - Terre",
        "Capturer l'equipe de Giovanni dans Pokemon Rouge/Bleu.",
        (
            (
                "0111-rhyhorn",
                "0051-dugtrio",
                "0031-nidoqueen",
                "0034-nidoking",
                "0112-rhydon",
            ),
        ),
    ),
    _team_badge(
        "kanto_lorelei",
        "Conseil 4 - Olga",
        "Capturer l'equipe d'Olga au Plateau Indigo Rouge/Bleu.",
        (
            (
                "0087-dewgong",
                "0091-cloyster",
                "0080-slowbro",
                "0124-jynx",
                "0131-lapras",
            ),
        ),
    ),
    _team_badge(
        "kanto_bruno",
        "Conseil 4 - Aldo",
        "Capturer l'equipe d'Aldo au Plateau Indigo Rouge/Bleu.",
        (("0095-onix", "0107-hitmonchan", "0106-hitmonlee", "0095-onix", "0068-machamp"),),
    ),
    _team_badge(
        "kanto_agatha",
        "Conseil 4 - Agatha",
        "Capturer l'equipe d'Agatha au Plateau Indigo Rouge/Bleu.",
        (("0094-gengar", "0042-golbat", "0093-haunter", "0024-arbok", "0094-gengar"),),
    ),
    _team_badge(
        "kanto_lance",
        "Conseil 4 - Peter",
        "Capturer l'equipe de Peter au Plateau Indigo Rouge/Bleu.",
        (
            (
                "0130-gyarados",
                "0148-dragonair",
                "0148-dragonair",
                "0142-aerodactyl",
                "0149-dragonite",
            ),
        ),
    ),
    _team_badge(
        "kanto_rival_champion",
        "Maitre de la Ligue - Rival",
        "Capturer une equipe finale possible du rival dans Pokemon Rouge/Bleu.",
        (
            (
                "0018-pidgeot",
                "0065-alakazam",
                "0112-rhydon",
                "0130-gyarados",
                "0103-exeggutor",
                "0006-charizard",
            ),
            (
                "0018-pidgeot",
                "0065-alakazam",
                "0112-rhydon",
                "0059-arcanine",
                "0103-exeggutor",
                "0009-blastoise",
            ),
            (
                "0018-pidgeot",
                "0065-alakazam",
                "0112-rhydon",
                "0130-gyarados",
                "0059-arcanine",
                "0003-venusaur",
            ),
        ),
    ),
    _team_badge(
        "gs_falkner",
        "Albert - Zephyr",
        "Capturer l'equipe d'Albert dans Pokemon Or/Argent.",
        (("0016-pidgey", "0017-pidgeotto"),),
    ),
    _team_badge(
        "gs_bugsy",
        "Hector - Essaim",
        "Capturer l'equipe d'Hector dans Pokemon Or/Argent.",
        (("0011-metapod", "0014-kakuna", "0123-scyther"),),
    ),
    _team_badge(
        "gs_whitney",
        "Blanche - Plaine",
        "Capturer l'equipe de Blanche dans Pokemon Or/Argent.",
        (("0035-clefairy", "0241-miltank"),),
    ),
    _team_badge(
        "gs_morty",
        "Mortimer - Brume",
        "Capturer l'equipe de Mortimer dans Pokemon Or/Argent.",
        (("0092-gastly", "0093-haunter", "0093-haunter", "0094-gengar"),),
    ),
    _team_badge(
        "gs_chuck",
        "Chuck - Choc",
        "Capturer l'equipe de Chuck dans Pokemon Or/Argent.",
        (("0057-primeape", "0062-poliwrath"),),
    ),
    _team_badge(
        "gs_jasmine",
        "Jasmine - Mineral",
        "Capturer l'equipe de Jasmine dans Pokemon Or/Argent.",
        (("0081-magnemite", "0081-magnemite", "0208-steelix"),),
    ),
    _team_badge(
        "gs_pryce",
        "Fredo - Glacier",
        "Capturer l'equipe de Fredo dans Pokemon Or/Argent.",
        (("0086-seel", "0087-dewgong", "0221-piloswine"),),
    ),
    _team_badge(
        "gs_clair",
        "Sandra - Lever",
        "Capturer l'equipe de Sandra dans Pokemon Or/Argent.",
        (("0148-dragonair", "0148-dragonair", "0148-dragonair", "0230-kingdra"),),
    ),
    _team_badge(
        "gs_brock",
        "Pierre - Roche Or/Argent",
        "Capturer l'equipe de Pierre dans le Kanto de Pokemon Or/Argent.",
        (
            (
                "0075-graveler",
                "0111-rhyhorn",
                "0139-omastar",
                "0141-kabutops",
                "0095-onix",
            ),
        ),
    ),
    _team_badge(
        "gs_misty",
        "Ondine - Cascade Or/Argent",
        "Capturer l'equipe d'Ondine dans le Kanto de Pokemon Or/Argent.",
        (("0055-golduck", "0195-quagsire", "0131-lapras", "0121-starmie"),),
    ),
    _team_badge(
        "gs_lt_surge",
        "Major Bob - Foudre Or/Argent",
        "Capturer l'equipe de Major Bob dans le Kanto de Pokemon Or/Argent.",
        (
            (
                "0026-raichu",
                "0101-electrode",
                "0082-magneton",
                "0101-electrode",
                "0125-electabuzz",
            ),
        ),
    ),
    _team_badge(
        "gs_erika",
        "Erika - Prisme Or/Argent",
        "Capturer l'equipe d'Erika dans le Kanto de Pokemon Or/Argent.",
        (("0114-tangela", "0071-victreebel", "0189-jumpluff", "0182-bellossom"),),
    ),
    _team_badge(
        "gs_janine",
        "Jeannine - Ame",
        "Capturer l'equipe de Jeannine dans le Kanto de Pokemon Or/Argent.",
        (
            (
                "0169-crobat",
                "0110-weezing",
                "0168-ariados",
                "0110-weezing",
                "0049-venomoth",
            ),
        ),
    ),
    _team_badge(
        "gs_sabrina",
        "Morgane - Marais Or/Argent",
        "Capturer l'equipe de Morgane dans le Kanto de Pokemon Or/Argent.",
        (("0196-espeon", "0122-mr-mime", "0065-alakazam"),),
    ),
    _team_badge(
        "gs_blaine",
        "Auguste - Volcan Or/Argent",
        "Capturer l'equipe d'Auguste dans le Kanto de Pokemon Or/Argent.",
        (("0219-magcargo", "0126-magmar", "0078-rapidash"),),
    ),
    _team_badge(
        "gs_blue",
        "Blue - Terre",
        "Capturer l'equipe de Blue dans le Kanto de Pokemon Or/Argent.",
        (
            (
                "0018-pidgeot",
                "0065-alakazam",
                "0112-rhydon",
                "0130-gyarados",
                "0103-exeggutor",
                "0059-arcanine",
            ),
        ),
    ),
    _team_badge(
        "gs_will",
        "Conseil 4 - Clement",
        "Capturer l'equipe de Clement au Plateau Indigo Or/Argent.",
        (("0178-xatu", "0124-jynx", "0103-exeggutor", "0080-slowbro", "0178-xatu"),),
    ),
    _team_badge(
        "gs_koga",
        "Conseil 4 - Koga",
        "Capturer l'equipe de Koga au Plateau Indigo Or/Argent.",
        (
            (
                "0168-ariados",
                "0049-venomoth",
                "0205-forretress",
                "0089-muk",
                "0169-crobat",
            ),
        ),
    ),
    _team_badge(
        "gs_bruno",
        "Conseil 4 - Aldo",
        "Capturer l'equipe d'Aldo au Plateau Indigo Or/Argent.",
        (("0237-hitmontop", "0106-hitmonlee", "0107-hitmonchan", "0095-onix", "0068-machamp"),),
    ),
    _team_badge(
        "gs_karen",
        "Conseil 4 - Marion",
        "Capturer l'equipe de Marion au Plateau Indigo Or/Argent.",
        (("0197-umbreon", "0045-vileplume", "0198-murkrow", "0094-gengar", "0229-houndoom"),),
    ),
    _team_badge(
        "gs_lance",
        "Maitre de la Ligue - Peter",
        "Capturer l'equipe de Peter, Maitre de la Ligue Or/Argent.",
        (
            (
                "0130-gyarados",
                "0149-dragonite",
                "0149-dragonite",
                "0142-aerodactyl",
                "0006-charizard",
                "0149-dragonite",
            ),
        ),
    ),
    _team_badge(
        "gs_rival_silver",
        "Rival Silver - Plateau Indigo",
        "Capturer une equipe finale possible de Silver dans Pokemon Or/Argent.",
        (
            (
                "0215-sneasel",
                "0169-crobat",
                "0082-magneton",
                "0094-gengar",
                "0065-alakazam",
                "0154-meganium",
            ),
            (
                "0215-sneasel",
                "0169-crobat",
                "0082-magneton",
                "0094-gengar",
                "0065-alakazam",
                "0157-typhlosion",
            ),
            (
                "0215-sneasel",
                "0169-crobat",
                "0082-magneton",
                "0094-gengar",
                "0065-alakazam",
                "0160-feraligatr",
            ),
        ),
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
