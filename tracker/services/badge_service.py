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

BADGES.extend(
    [
        _team_badge(
            "rs_roxanne",
            "Roxanne - Roche",
            "Capturer l'equipe de Roxanne dans Pokemon Rubis/Saphir.",
            (("0074-geodude", "0299-nosepass"),),
        ),
        _team_badge(
            "rs_brawly",
            "Brawly - Poing",
            "Capturer l'equipe de Brawly dans Pokemon Rubis/Saphir.",
            (("0066-machop", "0296-makuhita"),),
        ),
        _team_badge(
            "rs_wattson",
            "Voltère - Dynamo",
            "Capturer l'equipe de Voltere dans Pokemon Rubis/Saphir.",
            (("0081-magnemite", "0100-voltorb", "0082-magneton"),),
        ),
        _team_badge(
            "rs_flannery",
            "Adriane - Chaleur",
            "Capturer l'equipe d'Adriane dans Pokemon Rubis/Saphir.",
            (("0218-slugma", "0218-slugma", "0324-torkoal"),),
        ),
        _team_badge(
            "rs_norman",
            "Norman - Balancier",
            "Capturer l'equipe de Norman dans Pokemon Rubis/Saphir.",
            (("0289-slaking", "0288-vigoroth", "0289-slaking"),),
        ),
        _team_badge(
            "rs_winona",
            "Alizée - Plume",
            "Capturer l'equipe d'Alizee dans Pokemon Rubis/Saphir.",
            (
                (
                    "0277-swellow",
                    "0279-pelipper",
                    "0227-skarmory",
                    "0334-altaria",
                ),
            ),
        ),
        _team_badge(
            "rs_tate_liza",
            "Tate & Liza - Esprit",
            "Capturer l'equipe de Tate et Liza dans Pokemon Rubis/Saphir.",
            (("0337-lunatone", "0338-solrock"),),
        ),
        _team_badge(
            "rs_wallace",
            "Marc - Pluie",
            "Capturer l'equipe de Marc dans Pokemon Rubis/Saphir.",
            (
                (
                    "0370-luvdisc",
                    "0340-whiscash",
                    "0364-sealeo",
                    "0119-seaking",
                    "0350-milotic",
                ),
            ),
        ),
        _team_badge(
            "rs_sidney",
            "Conseil 4 - Damien",
            "Capturer l'equipe de Damien dans Pokemon Rubis/Saphir.",
            (
                (
                    "0262-mightyena",
                    "0332-cacturne",
                    "0275-shiftry",
                    "0319-sharpedo",
                    "0359-absol",
                ),
            ),
        ),
        _team_badge(
            "rs_phoebe",
            "Conseil 4 - Spectra",
            "Capturer l'equipe de Spectra dans Pokemon Rubis/Saphir.",
            (
                (
                    "0356-dusclops",
                    "0354-banette",
                    "0354-banette",
                    "0302-sableye",
                    "0356-dusclops",
                ),
            ),
        ),
        _team_badge(
            "rs_glacia",
            "Conseil 4 - Glacia",
            "Capturer l'equipe de Glacia dans Pokemon Rubis/Saphir.",
            (
                (
                    "0362-glalie",
                    "0364-sealeo",
                    "0362-glalie",
                    "0364-sealeo",
                    "0365-walrein",
                ),
            ),
        ),
        _team_badge(
            "rs_drake",
            "Conseil 4 - Aragon",
            "Capturer l'equipe d'Aragon dans Pokemon Rubis/Saphir.",
            (
                (
                    "0372-shelgon",
                    "0334-altaria",
                    "0330-flygon",
                    "0330-flygon",
                    "0373-salamence",
                ),
            ),
        ),
        _team_badge(
            "rs_steven",
            "Maitre de la Ligue - Pierre Rochard",
            "Capturer l'equipe de Pierre Rochard dans Pokemon Rubis/Saphir.",
            (
                (
                    "0227-skarmory",
                    "0346-cradily",
                    "0344-claydol",
                    "0348-armaldo",
                    "0306-aggron",
                    "0376-metagross",
                ),
            ),
        ),
        _team_badge(
            "rs_wally",
            "Rival Timmy - Route Victoire",
            "Capturer l'equipe finale de Timmy dans Pokemon Rubis/Saphir.",
            (
                (
                    "0334-altaria",
                    "0301-delcatty",
                    "0082-magneton",
                    "0315-roselia",
                    "0282-gardevoir",
                ),
            ),
        ),
        _team_badge(
            "dp_roark",
            "Pierrick - Charbon",
            "Capturer l'equipe de Pierrick dans Pokemon Diamant/Perle.",
            (("0074-geodude", "0095-onix", "0408-cranidos"),),
        ),
        _team_badge(
            "dp_gardenia",
            "Flo - Foret",
            "Capturer l'equipe de Flo dans Pokemon Diamant/Perle.",
            (("0420-cherubi", "0387-turtwig", "0407-roserade"),),
        ),
        _team_badge(
            "dp_maylene",
            "Mélina - Pave",
            "Capturer l'equipe de Melina dans Pokemon Diamant/Perle.",
            (("0307-meditite", "0067-machoke", "0448-lucario"),),
        ),
        _team_badge(
            "dp_crasher_wake",
            "Lovis - Palustre",
            "Capturer l'equipe de Lovis dans Pokemon Diamant/Perle.",
            (("0130-gyarados", "0195-quagsire", "0419-floatzel"),),
        ),
        _team_badge(
            "dp_fantina",
            "Kimera - Relique",
            "Capturer l'equipe de Kimera dans Pokemon Diamant/Perle.",
            (("0426-drifblim", "0094-gengar", "0429-mismagius"),),
        ),
        _team_badge(
            "dp_byron",
            "Charles - Mine",
            "Capturer l'equipe de Charles dans Pokemon Diamant/Perle.",
            (("0436-bronzor", "0208-steelix", "0411-bastiodon"),),
        ),
        _team_badge(
            "dp_candice",
            "Gladys - Glaçon",
            "Capturer l'equipe de Gladys dans Pokemon Diamant/Perle.",
            (
                (
                    "0459-snover",
                    "0215-sneasel",
                    "0308-medicham",
                    "0460-abomasnow",
                ),
            ),
        ),
        _team_badge(
            "dp_volkner",
            "Tanguy - Phare",
            "Capturer l'equipe de Tanguy dans Pokemon Diamant/Perle.",
            (("0026-raichu", "0424-ambipom", "0224-octillery", "0405-luxray"),),
        ),
        _team_badge(
            "dp_aaron",
            "Conseil 4 - Aaron",
            "Capturer l'equipe d'Aaron dans Pokemon Diamant/Perle.",
            (
                (
                    "0269-dustox",
                    "0267-beautifly",
                    "0214-heracross",
                    "0416-vespiquen",
                    "0452-drapion",
                ),
            ),
        ),
        _team_badge(
            "dp_bertha",
            "Conseil 4 - Terry",
            "Capturer l'equipe de Terry dans Pokemon Diamant/Perle.",
            (
                (
                    "0195-quagsire",
                    "0340-whiscash",
                    "0076-golem",
                    "0185-sudowoodo",
                    "0450-hippowdon",
                ),
            ),
        ),
        _team_badge(
            "dp_flint",
            "Conseil 4 - Adrien",
            "Capturer l'equipe d'Adrien dans Pokemon Diamant/Perle.",
            (
                (
                    "0078-rapidash",
                    "0208-steelix",
                    "0428-lopunny",
                    "0426-drifblim",
                    "0392-infernape",
                ),
            ),
        ),
        _team_badge(
            "dp_lucian",
            "Conseil 4 - Lucio",
            "Capturer l'equipe de Lucio dans Pokemon Diamant/Perle.",
            (
                (
                    "0122-mr-mime",
                    "0203-girafarig",
                    "0308-medicham",
                    "0065-alakazam",
                    "0437-bronzong",
                ),
            ),
        ),
        _team_badge(
            "dp_cynthia",
            "Maitre de la Ligue - Cynthia",
            "Capturer l'equipe de Cynthia dans Pokemon Diamant/Perle.",
            (
                (
                    "0442-spiritomb",
                    "0423-gastrodon-west-sea",
                    "0407-roserade",
                    "0350-milotic",
                    "0448-lucario",
                    "0445-garchomp",
                ),
                (
                    "0442-spiritomb",
                    "0423-gastrodon-east-sea",
                    "0407-roserade",
                    "0350-milotic",
                    "0448-lucario",
                    "0445-garchomp",
                ),
            ),
        ),
        _team_badge(
            "dp_rival_barry",
            "Rival Barry - Combat final",
            "Capturer une equipe finale possible de Barry dans Diamant/Perle.",
            (
                (
                    "0398-staraptor",
                    "0214-heracross",
                    "0143-snorlax",
                    "0078-rapidash",
                    "0407-roserade",
                    "0395-empoleon",
                ),
                (
                    "0398-staraptor",
                    "0214-heracross",
                    "0143-snorlax",
                    "0078-rapidash",
                    "0419-floatzel",
                    "0389-torterra",
                ),
                (
                    "0398-staraptor",
                    "0214-heracross",
                    "0143-snorlax",
                    "0419-floatzel",
                    "0407-roserade",
                    "0392-infernape",
                ),
            ),
        ),
        _team_badge(
            "bw_trio_badge",
            "Dent/Noa/Rachid - Trio",
            "Capturer une equipe du Badge Trio dans Pokemon Noir/Blanc.",
            (
                ("0506-lillipup", "0511-pansage"),
                ("0506-lillipup", "0513-pansear"),
                ("0506-lillipup", "0515-panpour"),
            ),
        ),
        _team_badge(
            "bw_lenora",
            "Aloe - Basique",
            "Capturer l'equipe d'Aloe dans Pokemon Noir/Blanc.",
            (("0507-herdier", "0505-watchog"),),
        ),
        _team_badge(
            "bw_burgh",
            "Artie - Insecte",
            "Capturer l'equipe d'Artie dans Pokemon Noir/Blanc.",
            (("0544-whirlipede", "0557-dwebble", "0542-leavanny"),),
        ),
        _team_badge(
            "bw_elesa",
            "Inezia - Volt",
            "Capturer l'equipe d'Inezia dans Pokemon Noir/Blanc.",
            (("0587-emolga", "0587-emolga", "0523-zebstrika"),),
        ),
        _team_badge(
            "bw_clay",
            "Bardane - Seisme",
            "Capturer l'equipe de Bardane dans Pokemon Noir/Blanc.",
            (("0552-krokorok", "0536-palpitoad", "0530-excadrill"),),
        ),
        _team_badge(
            "bw_skyla",
            "Carolina - Jet",
            "Capturer l'equipe de Carolina dans Pokemon Noir/Blanc.",
            (("0528-swoobat", "0521-unfezant", "0581-swanna"),),
        ),
        _team_badge(
            "bw_brycen",
            "Zhu - Stalactite",
            "Capturer l'equipe de Zhu dans Pokemon Noir/Blanc.",
            (("0583-vanillish", "0615-cryogonal", "0614-beartic"),),
        ),
        _team_badge(
            "bw_opelucid",
            "Watson/Iris - Legende",
            "Capturer l'equipe de Watson ou Iris dans Pokemon Noir/Blanc.",
            (("0611-fraxure", "0621-druddigon", "0612-haxorus"),),
        ),
        _team_badge(
            "bw_shauntal",
            "Conseil 4 - Anis",
            "Capturer l'equipe d'Anis dans Pokemon Noir/Blanc.",
            (
                (
                    "0563-cofagrigus",
                    "0593-jellicent",
                    "0623-golurk",
                    "0609-chandelure",
                ),
            ),
        ),
        _team_badge(
            "bw_grimsley",
            "Conseil 4 - Pieris",
            "Capturer l'equipe de Pieris dans Pokemon Noir/Blanc.",
            (("0560-scrafty", "0510-liepard", "0553-krookodile", "0625-bisharp"),),
        ),
        _team_badge(
            "bw_caitlin",
            "Conseil 4 - Percila",
            "Capturer l'equipe de Percila dans Pokemon Noir/Blanc.",
            (
                (
                    "0579-reuniclus",
                    "0518-musharna",
                    "0561-sigilyph",
                    "0576-gothitelle",
                ),
            ),
        ),
        _team_badge(
            "bw_marshal",
            "Conseil 4 - Kunz",
            "Capturer l'equipe de Kunz dans Pokemon Noir/Blanc.",
            (("0538-throh", "0539-sawk", "0534-conkeldurr", "0620-mienshao"),),
        ),
        _team_badge(
            "bw_alder",
            "Maitre de la Ligue - Goyah",
            "Capturer l'equipe de Goyah dans Pokemon Noir/Blanc.",
            (
                (
                    "0617-accelgor",
                    "0626-bouffalant",
                    "0621-druddigon",
                    "0584-vanilluxe",
                    "0589-escavalier",
                    "0637-volcarona",
                ),
            ),
        ),
        _team_badge(
            "bw_n",
            "N - Chateau Plasma",
            "Capturer une equipe finale possible de N dans Pokemon Noir/Blanc.",
            (
                (
                    "0644-zekrom",
                    "0565-carracosta",
                    "0584-vanilluxe",
                    "0567-archeops",
                    "0571-zoroark",
                    "0601-klinklang",
                ),
                (
                    "0643-reshiram",
                    "0565-carracosta",
                    "0584-vanilluxe",
                    "0567-archeops",
                    "0571-zoroark",
                    "0601-klinklang",
                ),
            ),
        ),
        _team_badge(
            "bw_ghetsis",
            "Ghetis - Chateau Plasma",
            "Capturer l'equipe de Ghetis dans Pokemon Noir/Blanc.",
            (
                (
                    "0563-cofagrigus",
                    "0626-bouffalant",
                    "0537-seismitoad",
                    "0625-bisharp",
                    "0604-eelektross",
                    "0635-hydreigon",
                ),
            ),
        ),
        _team_badge(
            "b2w2_cheren",
            "Tcheren - Basique",
            "Capturer l'equipe de Tcheren dans Pokemon Noir 2/Blanc 2.",
            (("0504-patrat", "0506-lillipup"),),
        ),
        _team_badge(
            "b2w2_roxie",
            "Strykna - Toxique",
            "Capturer l'equipe de Strykna dans Pokemon Noir 2/Blanc 2.",
            (("0109-koffing", "0544-whirlipede"),),
        ),
        _team_badge(
            "b2w2_burgh",
            "Artie - Essaim",
            "Capturer l'equipe d'Artie dans Pokemon Noir 2/Blanc 2.",
            (("0541-swadloon", "0557-dwebble", "0542-leavanny"),),
        ),
        _team_badge(
            "b2w2_elesa",
            "Inezia - Volt",
            "Capturer l'equipe d'Inezia dans Pokemon Noir 2/Blanc 2.",
            (("0587-emolga", "0180-flaaffy", "0523-zebstrika"),),
        ),
        _team_badge(
            "b2w2_clay",
            "Bardane - Seisme",
            "Capturer l'equipe de Bardane dans Pokemon Noir 2/Blanc 2.",
            (("0552-krokorok", "0028-sandslash", "0530-excadrill"),),
        ),
        _team_badge(
            "b2w2_skyla",
            "Carolina - Jet",
            "Capturer l'equipe de Carolina dans Pokemon Noir 2/Blanc 2.",
            (("0528-swoobat", "0227-skarmory", "0581-swanna"),),
        ),
        _team_badge(
            "b2w2_drayden",
            "Watson - Legende",
            "Capturer l'equipe de Watson dans Pokemon Noir 2/Blanc 2.",
            (("0621-druddigon", "0330-flygon", "0612-haxorus"),),
        ),
        _team_badge(
            "b2w2_marlon",
            "Amana - Vague",
            "Capturer l'equipe d'Amana dans Pokemon Noir 2/Blanc 2.",
            (("0565-carracosta", "0321-wailord", "0593-jellicent"),),
        ),
        _team_badge(
            "b2w2_shauntal",
            "Conseil 4 - Anis N2/B2",
            "Capturer l'equipe d'Anis dans Pokemon Noir 2/Blanc 2.",
            (
                (
                    "0563-cofagrigus",
                    "0426-drifblim",
                    "0623-golurk",
                    "0609-chandelure",
                ),
            ),
        ),
        _team_badge(
            "b2w2_grimsley",
            "Conseil 4 - Pieris N2/B2",
            "Capturer l'equipe de Pieris dans Pokemon Noir 2/Blanc 2.",
            (("0510-liepard", "0560-scrafty", "0553-krookodile", "0625-bisharp"),),
        ),
        _team_badge(
            "b2w2_caitlin",
            "Conseil 4 - Percila N2/B2",
            "Capturer l'equipe de Percila dans Pokemon Noir 2/Blanc 2.",
            (
                (
                    "0518-musharna",
                    "0561-sigilyph",
                    "0579-reuniclus",
                    "0576-gothitelle",
                ),
            ),
        ),
        _team_badge(
            "b2w2_marshal",
            "Conseil 4 - Kunz N2/B2",
            "Capturer l'equipe de Kunz dans Pokemon Noir 2/Blanc 2.",
            (("0538-throh", "0539-sawk", "0620-mienshao", "0534-conkeldurr"),),
        ),
        _team_badge(
            "b2w2_iris",
            "Maitre de la Ligue - Iris",
            "Capturer l'equipe d'Iris dans Pokemon Noir 2/Blanc 2.",
            (
                (
                    "0635-hydreigon",
                    "0621-druddigon",
                    "0306-aggron",
                    "0567-archeops",
                    "0131-lapras",
                    "0612-haxorus",
                ),
            ),
        ),
        _team_badge(
            "b2w2_hugh",
            "Rival Matis - Combat final",
            "Capturer une equipe finale possible de Matis dans Noir 2/Blanc 2.",
            (
                (
                    "0521-unfezant",
                    "0516-simipour",
                    "0626-bouffalant",
                    "0330-flygon",
                    "0604-eelektross",
                    "0500-emboar",
                ),
                (
                    "0521-unfezant",
                    "0512-simisage",
                    "0626-bouffalant",
                    "0330-flygon",
                    "0604-eelektross",
                    "0503-samurott",
                ),
                (
                    "0521-unfezant",
                    "0514-simisear",
                    "0626-bouffalant",
                    "0330-flygon",
                    "0604-eelektross",
                    "0497-serperior",
                ),
            ),
        ),
        _team_badge(
            "xy_viola",
            "Violette - Insecte",
            "Capturer l'equipe de Violette dans Pokemon X/Y.",
            (
                ("0283-surskit", "0666-vivillon-icy-snow-pattern"),
                ("0283-surskit", "0666-vivillon-polar-pattern"),
                ("0283-surskit", "0666-vivillon-tundra-pattern"),
                ("0283-surskit", "0666-vivillon-continental-pattern"),
                ("0283-surskit", "0666-vivillon-garden-pattern"),
                ("0283-surskit", "0666-vivillon-elegant-pattern"),
                ("0283-surskit", "0666-vivillon-meadow-pattern"),
                ("0283-surskit", "0666-vivillon-modern-pattern"),
                ("0283-surskit", "0666-vivillon-marine-pattern"),
                ("0283-surskit", "0666-vivillon-archipelago-pattern"),
                ("0283-surskit", "0666-vivillon-high-plains-pattern"),
                ("0283-surskit", "0666-vivillon-sandstorm-pattern"),
                ("0283-surskit", "0666-vivillon-river-pattern"),
                ("0283-surskit", "0666-vivillon-monsoon-pattern"),
                ("0283-surskit", "0666-vivillon-savanna-pattern"),
                ("0283-surskit", "0666-vivillon-sun-pattern"),
                ("0283-surskit", "0666-vivillon-ocean-pattern"),
                ("0283-surskit", "0666-vivillon-jungle-pattern"),
                ("0283-surskit", "0666-vivillon-fancy-pattern"),
                ("0283-surskit", "0666-vivillon-poke-ball-pattern"),
            ),
        ),
        _team_badge(
            "xy_grant",
            "Lino - Mur",
            "Capturer l'equipe de Lino dans Pokemon X/Y.",
            (("0698-amaura", "0696-tyrunt"),),
        ),
        _team_badge(
            "xy_korrina",
            "Cornélia - Lutte",
            "Capturer l'equipe de Cornelia dans Pokemon X/Y.",
            (("0619-mienfoo", "0067-machoke", "0701-hawlucha"),),
        ),
        _team_badge(
            "xy_ramos",
            "Amaro - Plante",
            "Capturer l'equipe d'Amaro dans Pokemon X/Y.",
            (("0189-jumpluff", "0070-weepinbell", "0673-gogoat"),),
        ),
        _team_badge(
            "xy_clemont",
            "Lem - Tension",
            "Capturer l'equipe de Lem dans Pokemon X/Y.",
            (("0587-emolga", "0082-magneton", "0695-heliolisk"),),
        ),
        _team_badge(
            "xy_valerie",
            "Valériane - Nymphe",
            "Capturer l'equipe de Valeriane dans Pokemon X/Y.",
            (("0122-mr-mime", "0303-mawile", "0700-sylveon"),),
        ),
        _team_badge(
            "xy_olympia",
            "Astre - Psychisme",
            "Capturer l'equipe d'Astre dans Pokemon X/Y.",
            (
                (
                    "0561-sigilyph",
                    "0199-slowking",
                    "0678-meowstic-male",
                ),
            ),
        ),
        _team_badge(
            "xy_wulfric",
            "Urup - Iceberg",
            "Capturer l'equipe d'Urup dans Pokemon X/Y.",
            (("0460-abomasnow", "0713-avalugg", "0615-cryogonal"),),
        ),
        _team_badge(
            "xy_wikstrom",
            "Conseil 4 - Thyméo",
            "Capturer l'equipe de Thymeo dans Pokemon X/Y.",
            (
                (
                    "0707-klefki",
                    "0476-probopass",
                    "0681-aegislash-shield-forme",
                    "0212-scizor",
                ),
            ),
        ),
        _team_badge(
            "xy_malva",
            "Conseil 4 - Malva",
            "Capturer l'equipe de Malva dans Pokemon X/Y.",
            (("0668-pyroar", "0663-talonflame", "0324-torkoal", "0609-chandelure"),),
        ),
        _team_badge(
            "xy_drasna",
            "Conseil 4 - Dracéna",
            "Capturer l'equipe de Dracena dans Pokemon X/Y.",
            (("0691-dragalge", "0334-altaria", "0715-noivern", "0621-druddigon"),),
        ),
        _team_badge(
            "xy_siebold",
            "Conseil 4 - Narcisse",
            "Capturer l'equipe de Narcisse dans Pokemon X/Y.",
            (("0693-clawitzer", "0121-starmie", "0130-gyarados", "0689-barbaracle"),),
        ),
        _team_badge(
            "xy_diantha",
            "Maitre de la Ligue - Dianthéa",
            "Capturer l'equipe de Diantha dans Pokemon X/Y.",
            (
                (
                    "0701-hawlucha",
                    "0699-aurorus",
                    "0697-tyrantrum",
                    "0706-goodra",
                    "0711-gourgeist-medium-variety",
                    "0282-gardevoir",
                ),
            ),
        ),
        _team_badge(
            "xy_rival",
            "Rival Kalos - Bastiques",
            "Capturer une equipe finale possible de Serena ou Calem dans X/Y.",
            (
                (
                    "0678-meowstic-male",
                    "0135-jolteon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0655-delphox",
                ),
                (
                    "0678-meowstic-female",
                    "0135-jolteon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0655-delphox",
                ),
                (
                    "0678-meowstic-male",
                    "0136-flareon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0658-greninja",
                ),
                (
                    "0678-meowstic-female",
                    "0136-flareon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0658-greninja",
                ),
                (
                    "0678-meowstic-male",
                    "0134-vaporeon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0652-chesnaught",
                ),
                (
                    "0678-meowstic-female",
                    "0134-vaporeon",
                    "0334-altaria",
                    "0036-clefable",
                    "0359-absol",
                    "0652-chesnaught",
                ),
            ),
        ),
        _team_badge(
            "sm_hala",
            "Pectorius - Doyen Mele-Mele",
            "Capturer l'equipe de Pectorius dans Pokemon Soleil/Lune.",
            (("0056-mankey", "0296-makuhita", "0739-crabrawler"),),
        ),
        _team_badge(
            "sm_olivia",
            "Alyxia - Doyenne Akala",
            "Capturer l'equipe d'Alyxia dans Pokemon Soleil/Lune.",
            (("0299-nosepass", "0525-boldore", "0745-lycanroc-midnight-form"),),
        ),
        _team_badge(
            "sm_nanu",
            "Dan - Doyen Ula-Ula",
            "Capturer l'equipe de Dan dans Pokemon Soleil/Lune.",
            (
                (
                    "0302-sableye",
                    "0552-krokorok",
                    "0053-persian-alolan-form",
                ),
            ),
        ),
        _team_badge(
            "sm_hapu",
            "Paulie - Doyenne Poni",
            "Capturer l'equipe de Paulie dans Pokemon Soleil/Lune.",
            (
                (
                    "0051-dugtrio-alolan-form",
                    "0423-gastrodon-west-sea",
                    "0330-flygon",
                    "0750-mudsdale",
                ),
                (
                    "0051-dugtrio-alolan-form",
                    "0423-gastrodon-east-sea",
                    "0330-flygon",
                    "0750-mudsdale",
                ),
            ),
        ),
        _team_badge(
            "sm_ilima",
            "Althéo - Capitaine",
            "Capturer l'equipe d'Altheo dans Pokemon Soleil/Lune.",
            (("0735-gumshoos", "0235-smeargle"),),
        ),
        _team_badge(
            "sm_lana",
            "Néphie - Capitaine",
            "Capturer l'equipe de Nephie dans Pokemon Soleil/Lune.",
            (("0170-chinchou", "0090-shellder", "0752-araquanid"),),
        ),
        _team_badge(
            "sm_kiawe",
            "Kiawe - Capitaine",
            "Capturer l'equipe de Kiawe dans Pokemon Soleil/Lune.",
            (("0058-growlithe", "0662-fletchinder", "0105-marowak-alolan-form"),),
        ),
        _team_badge(
            "sm_mallow",
            "Barbara - Capitaine",
            "Capturer l'equipe de Barbara dans Pokemon Soleil/Lune.",
            (("0708-phantump", "0756-shiinotic", "0762-steenee"),),
        ),
        _team_badge(
            "sm_mina",
            "Oléa - Capitaine",
            "Capturer l'equipe d'Olea dans Pokemon Soleil/Lune.",
            (
                (
                    "0707-klefki",
                    "0210-granbull",
                    "0756-shiinotic",
                    "0040-wigglytuff",
                    "0743-ribombee",
                ),
            ),
        ),
        _team_badge(
            "sm_elite_hala",
            "Conseil 4 - Pectorius",
            "Capturer l'equipe de Pectorius au Conseil 4 Soleil/Lune.",
            (
                (
                    "0297-hariyama",
                    "0057-primeape",
                    "0760-bewear",
                    "0062-poliwrath",
                    "0740-crabominable",
                ),
            ),
        ),
        _team_badge(
            "sm_elite_olivia",
            "Conseil 4 - Alyxia",
            "Capturer l'equipe d'Alyxia au Conseil 4 Soleil/Lune.",
            (
                (
                    "0369-relicanth",
                    "0703-carbink",
                    "0076-golem-alolan-form",
                    "0476-probopass",
                    "0745-lycanroc-midnight-form",
                ),
            ),
        ),
        _team_badge(
            "sm_acerola",
            "Conseil 4 - Margie",
            "Capturer l'equipe de Margie au Conseil 4 Soleil/Lune.",
            (
                (
                    "0302-sableye",
                    "0426-drifblim",
                    "0781-dhelmise",
                    "0478-froslass",
                    "0770-palossand",
                ),
            ),
        ),
        _team_badge(
            "sm_kahili",
            "Conseil 4 - Kahili",
            "Capturer l'equipe de Kahili au Conseil 4 Soleil/Lune.",
            (
                (
                    "0227-skarmory",
                    "0169-crobat",
                    "0741-oricorio-baile-style",
                    "0630-mandibuzz",
                    "0733-toucannon",
                ),
            ),
        ),
        _team_badge(
            "sm_kukui",
            "Maitre de la Ligue - Prof. Euphorbe",
            "Capturer une equipe finale possible d'Euphorbe dans Soleil/Lune.",
            (
                (
                    "0745-lycanroc-midday-form",
                    "0038-ninetales-alolan-form",
                    "0628-braviary",
                    "0462-magnezone",
                    "0143-snorlax",
                    "0727-incineroar",
                ),
                (
                    "0745-lycanroc-midday-form",
                    "0038-ninetales-alolan-form",
                    "0628-braviary",
                    "0462-magnezone",
                    "0143-snorlax",
                    "0730-primarina",
                ),
                (
                    "0745-lycanroc-midday-form",
                    "0038-ninetales-alolan-form",
                    "0628-braviary",
                    "0462-magnezone",
                    "0143-snorlax",
                    "0724-decidueye",
                ),
            ),
        ),
        _team_badge(
            "sm_hau",
            "Rival Tili - Ligue Alola",
            "Capturer une equipe finale possible de Tili dans Soleil/Lune.",
            (
                (
                    "0026-raichu-alolan-form",
                    "0136-flareon",
                    "0775-komala",
                    "0740-crabominable",
                    "0730-primarina",
                ),
                (
                    "0026-raichu-alolan-form",
                    "0134-vaporeon",
                    "0775-komala",
                    "0740-crabominable",
                    "0724-decidueye",
                ),
                (
                    "0026-raichu-alolan-form",
                    "0470-leafeon",
                    "0775-komala",
                    "0740-crabominable",
                    "0727-incineroar",
                ),
            ),
        ),
        _team_badge(
            "sm_gladion",
            "Rival Gladio - Mont Lanakila",
            "Capturer une equipe finale possible de Gladio dans Soleil/Lune.",
            (
                (
                    "0169-crobat",
                    "0461-weavile",
                    "0448-lucario",
                    "0773-silvally-type-fire",
                ),
                (
                    "0169-crobat",
                    "0461-weavile",
                    "0448-lucario",
                    "0773-silvally-type-water",
                ),
                (
                    "0169-crobat",
                    "0461-weavile",
                    "0448-lucario",
                    "0773-silvally-type-grass",
                ),
            ),
        ),
        _team_badge(
            "swsh_milo",
            "Milo - Plante",
            "Capturer l'equipe de Milo dans Pokemon Epee/Bouclier.",
            (("0829-gossifleur", "0830-eldegoss"),),
        ),
        _team_badge(
            "swsh_nessa",
            "Donna - Eau",
            "Capturer l'equipe de Donna dans Pokemon Epee/Bouclier.",
            (("0118-goldeen", "0846-arrokuda", "0834-drednaw"),),
        ),
        _team_badge(
            "swsh_kabu",
            "Kabu - Feu",
            "Capturer l'equipe de Kabu dans Pokemon Epee/Bouclier.",
            (("0038-ninetales", "0059-arcanine", "0851-centiskorch"),),
        ),
        _team_badge(
            "swsh_bea",
            "Faïza - Combat",
            "Capturer l'equipe de Faiza dans Pokemon Epee.",
            (("0237-hitmontop", "0675-pangoro", "0865-sirfetch-d", "0068-machamp"),),
        ),
        _team_badge(
            "swsh_allister",
            "Alistair - Spectre",
            "Capturer l'equipe d'Alistair dans Pokemon Bouclier.",
            (
                (
                    "0562-yamask-galarian-form",
                    "0778-mimikyu-disguised-form",
                    "0864-cursola",
                    "0094-gengar",
                ),
            ),
        ),
        _team_badge(
            "swsh_opal",
            "Sally - Fee",
            "Capturer l'equipe de Sally dans Pokemon Epee/Bouclier.",
            (
                (
                    "0110-weezing-galarian-form",
                    "0303-mawile",
                    "0468-togekiss",
                    "0869-alcremie-vanilla-cream",
                ),
            ),
        ),
        _team_badge(
            "swsh_gordie",
            "Chaz - Roche",
            "Capturer l'equipe de Chaz dans Pokemon Epee.",
            (("0689-barbaracle", "0213-shuckle", "0874-stonjourner", "0839-coalossal"),),
        ),
        _team_badge(
            "swsh_melony",
            "Lona - Glace",
            "Capturer l'equipe de Lona dans Pokemon Bouclier.",
            (
                (
                    "0873-frosmoth",
                    "0555-darmanitan-galarian-form-standard-mode",
                    "0875-eiscue-ice-face",
                    "0131-lapras",
                ),
            ),
        ),
        _team_badge(
            "swsh_piers",
            "Peterson - Tenebres",
            "Capturer l'equipe de Peterson dans Pokemon Epee/Bouclier.",
            (("0560-scrafty", "0687-malamar", "0435-skuntank", "0862-obstagoon"),),
        ),
        _team_badge(
            "swsh_raihan",
            "Roy - Dragon",
            "Capturer l'equipe de Roy dans Pokemon Epee/Bouclier.",
            (("0526-gigalith", "0330-flygon", "0844-sandaconda", "0884-duraludon"),),
        ),
        _team_badge(
            "swsh_bede",
            "Rival Travis - Successeur Fee",
            "Capturer l'equipe finale de Travis dans Pokemon Epee/Bouclier.",
            (
                (
                    "0303-mawile",
                    "0282-gardevoir",
                    "0078-rapidash-galarian-form",
                    "0858-hatterene",
                ),
            ),
        ),
        _team_badge(
            "swsh_marnie",
            "Rival Rosemary - Demi-finale",
            "Capturer l'equipe finale de Rosemary dans Pokemon Epee/Bouclier.",
            (
                (
                    "0510-liepard",
                    "0454-toxicroak",
                    "0560-scrafty",
                    "0877-morpeko-full-belly-mode",
                    "0861-grimmsnarl",
                ),
            ),
        ),
        _team_badge(
            "swsh_leon",
            "Maitre de la Ligue - Tarak",
            "Capturer une equipe finale possible de Tarak dans Epee/Bouclier.",
            (
                (
                    "0681-aegislash-shield-forme",
                    "0612-haxorus",
                    "0887-dragapult",
                    "0537-seismitoad",
                    "0815-cinderace",
                    "0006-charizard",
                ),
                (
                    "0681-aegislash-shield-forme",
                    "0612-haxorus",
                    "0887-dragapult",
                    "0866-mr-rime",
                    "0818-inteleon",
                    "0006-charizard",
                ),
                (
                    "0681-aegislash-shield-forme",
                    "0612-haxorus",
                    "0887-dragapult",
                    "0464-rhyperior",
                    "0812-rillaboom",
                    "0006-charizard",
                ),
            ),
        ),
        _team_badge(
            "swsh_hop",
            "Rival Nabil - Bois de Sleepwood",
            "Capturer une equipe finale possible de Nabil dans Epee/Bouclier.",
            (
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0818-inteleon",
                    "0889-zamazenta-crowned-shield",
                ),
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0812-rillaboom",
                    "0889-zamazenta-crowned-shield",
                ),
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0815-cinderace",
                    "0889-zamazenta-crowned-shield",
                ),
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0818-inteleon",
                    "0888-zacian-crowned-sword",
                ),
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0812-rillaboom",
                    "0888-zacian-crowned-sword",
                ),
                (
                    "0832-dubwool",
                    "0143-snorlax",
                    "0871-pincurchin",
                    "0823-corviknight",
                    "0815-cinderace",
                    "0888-zacian-crowned-sword",
                ),
            ),
        ),
        _team_badge(
            "sv_katy",
            "Katy - Insecte",
            "Capturer l'equipe de Katy dans Pokemon Ecarlate/Violet.",
            (("0919-nymble", "0917-tarountula", "0216-teddiursa"),),
        ),
        _team_badge(
            "sv_brassius",
            "Colza - Plante",
            "Capturer l'equipe de Colza dans Pokemon Ecarlate/Violet.",
            (("0548-petilil", "0928-smoliv", "0185-sudowoodo"),),
        ),
        _team_badge(
            "sv_iono",
            "Mashynn - Electrique",
            "Capturer l'equipe de Mashynn dans Pokemon Ecarlate/Violet.",
            (("0940-wattrel", "0939-bellibolt", "0404-luxio", "0429-mismagius"),),
        ),
        _team_badge(
            "sv_kofu",
            "Kombu - Eau",
            "Capturer l'equipe de Kombu dans Pokemon Ecarlate/Violet.",
            (("0976-veluza", "0961-wugtrio", "0740-crabominable"),),
        ),
        _team_badge(
            "sv_larry",
            "Okuba - Normal",
            "Capturer l'equipe d'Okuba dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0775-komala",
                    "0982-dudunsparce-two-segment-form",
                    "0398-staraptor",
                ),
            ),
        ),
        _team_badge(
            "sv_ryme",
            "Laïm - Spectre",
            "Capturer l'equipe de Laim dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0354-banette",
                    "0778-mimikyu-disguised-form",
                    "0972-houndstone",
                    "0849-toxtricity-low-key-form",
                ),
            ),
        ),
        _team_badge(
            "sv_tulip",
            "Tully - Psychique",
            "Capturer l'equipe de Tully dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0981-farigiraf",
                    "0282-gardevoir",
                    "0956-espathra",
                    "0671-florges-red-flower",
                ),
            ),
        ),
        _team_badge(
            "sv_grusha",
            "Grusha - Glace",
            "Capturer l'equipe de Grusha dans Pokemon Ecarlate/Violet.",
            (("0873-frosmoth", "0614-beartic", "0975-cetitan", "0334-altaria"),),
        ),
        _team_badge(
            "sv_rika",
            "Conseil 4 - Cayenn",
            "Capturer l'equipe de Cayenn dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0340-whiscash",
                    "0323-camerupt",
                    "0232-donphan",
                    "0051-dugtrio",
                    "0980-clodsire",
                ),
            ),
        ),
        _team_badge(
            "sv_poppy",
            "Conseil 4 - Popi",
            "Capturer l'equipe de Popi dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0879-copperajah",
                    "0462-magnezone",
                    "0437-bronzong",
                    "0823-corviknight",
                    "0959-tinkaton",
                ),
            ),
        ),
        _team_badge(
            "sv_elite_larry",
            "Conseil 4 - Okuba",
            "Capturer l'equipe d'Okuba au Conseil 4 Ecarlate/Violet.",
            (
                (
                    "0357-tropius",
                    "0741-oricorio-pom-pom-style",
                    "0334-altaria",
                    "0398-staraptor",
                    "0973-flamigo",
                ),
            ),
        ),
        _team_badge(
            "sv_hassel",
            "Conseil 4 - Hassel",
            "Capturer l'equipe de Hassel dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0715-noivern",
                    "0612-haxorus",
                    "0691-dragalge",
                    "0841-flapple",
                    "0998-baxcalibur",
                ),
            ),
        ),
        _team_badge(
            "sv_geeta",
            "Maitre de la Ligue - Alisma",
            "Capturer l'equipe d'Alisma dans Pokemon Ecarlate/Violet.",
            (
                (
                    "0956-espathra",
                    "0673-gogoat",
                    "0976-veluza",
                    "0713-avalugg",
                    "0983-kingambit",
                    "0970-glimmora",
                ),
            ),
        ),
        _team_badge(
            "sv_nemona",
            "Rival Menzi - Combat final",
            "Capturer une equipe finale possible de Menzi dans Ecarlate/Violet.",
            (
                (
                    "0745-lycanroc-midday-form",
                    "0706-goodra",
                    "0982-dudunsparce-three-segment-form",
                    "0968-orthworm",
                    "0923-pawmot",
                    "0914-quaquaval",
                ),
                (
                    "0745-lycanroc-midday-form",
                    "0706-goodra",
                    "0982-dudunsparce-three-segment-form",
                    "0968-orthworm",
                    "0923-pawmot",
                    "0908-meowscarada",
                ),
                (
                    "0745-lycanroc-midday-form",
                    "0706-goodra",
                    "0982-dudunsparce-three-segment-form",
                    "0968-orthworm",
                    "0923-pawmot",
                    "0911-skeledirge",
                ),
            ),
        ),
        _team_badge(
            "sv_arven",
            "Rival Pepper - Sentier des Legendes",
            "Capturer l'equipe finale de Pepper dans Ecarlate/Violet.",
            (
                (
                    "0820-greedent",
                    "0952-scovillain",
                    "0934-garganacl",
                    "0949-toedscruel",
                    "0091-cloyster",
                    "0943-mabosstiff",
                ),
            ),
        ),
        _team_badge(
            "sv_penny",
            "Rival Pania - Starfall",
            "Capturer l'equipe finale de Pania dans Ecarlate/Violet.",
            (
                (
                    "0197-umbreon",
                    "0134-vaporeon",
                    "0135-jolteon",
                    "0136-flareon",
                    "0470-leafeon",
                    "0700-sylveon",
                ),
            ),
        ),
    ]
)


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
