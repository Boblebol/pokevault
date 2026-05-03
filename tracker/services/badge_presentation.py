"""Presentation metadata for badge catalog entries."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BadgePresentation:
    category: str
    region: str
    rarity: str
    effect: str
    reveal: str
    i18n: dict[str, dict[str, str]]


PREFIX_REGION: dict[str, tuple[str, str, str]] = {
    "kanto": ("kanto", "Rouge/Bleu", "Red/Blue"),
    "gs": ("johto", "Or/Argent", "Gold/Silver"),
    "rs": ("hoenn", "Rubis/Saphir", "Ruby/Sapphire"),
    "dp": ("sinnoh", "Diamant/Perle", "Diamond/Pearl"),
    "bw": ("unova", "Noir/Blanc", "Black/White"),
    "b2w2": ("unova", "Noir 2/Blanc 2", "Black 2/White 2"),
    "xy": ("kalos", "X/Y", "X/Y"),
    "sm": ("alola", "Soleil/Lune", "Sun/Moon"),
    "swsh": ("galar", "Epee/Bouclier", "Sword/Shield"),
    "sv": ("paldea", "Ecarlate/Violet", "Scarlet/Violet"),
}

MILESTONE_EN: dict[str, tuple[str, str]] = {
    "first_encounter": ("First encounter", "Identify your first Pokemon."),
    "first_catch": ("First catch", "Catch your first Pokemon."),
    "first_shiny": ("First shiny", "Catch your first shiny Pokemon."),
    "century": ("Century", "Catch 100 different Pokemon."),
    "five_hundred": ("Five hundred", "Catch 500 different Pokemon."),
    "thousand": ("Millennium", "Catch 1000 different Pokemon."),
    "shiny_ten": ("Hunter", "Catch 10 shiny Pokemon."),
    "shiny_hundred": ("Legendary hunter", "Catch 100 shiny Pokemon."),
}

CARD_EN: dict[str, tuple[str, str]] = {
    "first_card": ("First card", "Add your first TCG card to the binder."),
    "ten_sets": ("Across expansions", "Own cards from 10 different sets."),
    "hundred_cards": ("TCG century", "Catalog 100 unique cards."),
    "dedicated_collector": (
        "Dedicated collector",
        "Reach 500 cards in stock, counting quantities.",
    ),
}

RIVAL_IDS = {
    "bw_n",
    "bw_ghetsis",
}

NAME_OVERRIDES = {
    "lt_surge": "Lt. Surge",
    "rival_champion": "Rival Champion",
    "rival_silver": "Silver",
    "tate_liza": "Tate & Liza",
    "crasher_wake": "Crasher Wake",
    "trio_badge": "Striaton Trio",
    "opelucid": "Drayden/Iris",
    "prof_kukui": "Professor Kukui",
    "n": "N",
}


def presentation_for_badge(
    badge_id: str,
    title: str,
    description: str,
    metric: str,
) -> BadgePresentation:
    if metric == "team":
        return _team_presentation(badge_id, title, description)
    if badge_id in CARD_EN:
        en_title, en_description = CARD_EN[badge_id]
        return _plain_presentation(
            "card",
            "global",
            "rare",
            "metal",
            title,
            description,
            en_title,
            en_description,
        )
    en_title, en_description = MILESTONE_EN.get(
        badge_id,
        (title, "Advance your Pokedex collection."),
    )
    return _plain_presentation(
        "milestone",
        "global",
        "common",
        "metal",
        title,
        description,
        en_title,
        en_description,
    )


def _plain_presentation(
    category: str,
    region: str,
    rarity: str,
    effect: str,
    fr_title: str,
    fr_description: str,
    en_title: str,
    en_description: str,
) -> BadgePresentation:
    return BadgePresentation(
        category=category,
        region=region,
        rarity=rarity,
        effect=effect,
        reveal="transparent",
        i18n={
            "fr": {
                "title": fr_title,
                "description": fr_description,
                "mystery_title": fr_title,
                "mystery_hint": fr_description,
            },
            "en": {
                "title": en_title,
                "description": en_description,
                "mystery_title": en_title,
                "mystery_hint": en_description,
            },
        },
    )


def _team_presentation(
    badge_id: str,
    title: str,
    description: str,
) -> BadgePresentation:
    prefix, trainer_key = _split_prefix(badge_id)
    trainer_name = _trainer_name_from_key(trainer_key)
    known_region = PREFIX_REGION.get(prefix)
    if known_region:
        region, game_fr, game_en = known_region
        fr_hint = f"Une equipe de Pokemon {game_fr} attend d'etre reconstituee."
        en_hint = f"A team from Pokemon {game_en} is waiting to be rebuilt."
        en_description = f"Capture {trainer_name}'s team in Pokemon {game_en}."
    else:
        region = "global"
        fr_hint = "Une equipe mystere attend d'etre reconstituee."
        en_hint = "A mystery team is waiting to be rebuilt."
        en_description = f"Capture {trainer_name}'s mystery team."
    category = _team_category(badge_id, title)
    return BadgePresentation(
        category=category,
        region=region,
        rarity=_rarity_for_category(category),
        effect=_effect_for_category(category),
        reveal="mystery",
        i18n={
            "fr": {
                "title": title,
                "description": description,
                "mystery_title": _mystery_title_fr(category),
                "mystery_hint": fr_hint,
            },
            "en": {
                "title": _team_title_en(category, trainer_name),
                "description": en_description,
                "mystery_title": _mystery_title_en(category),
                "mystery_hint": en_hint,
            },
        },
    )


def _split_prefix(badge_id: str) -> tuple[str, str]:
    for prefix in sorted(PREFIX_REGION, key=len, reverse=True):
        marker = f"{prefix}_"
        if badge_id.startswith(marker):
            return prefix, badge_id[len(marker) :]
    return "global", badge_id


def _team_category(badge_id: str, title: str) -> str:
    lowered = title.casefold()
    if badge_id in RIVAL_IDS or "rival" in lowered or "_rival_" in badge_id:
        return "rival"
    if "conseil 4" in lowered or "_elite_" in badge_id:
        return "elite_four"
    if "maitre de la ligue" in lowered or "champion" in lowered:
        return "champion"
    return "gym"


def _rarity_for_category(category: str) -> str:
    return {
        "gym": "rare",
        "elite_four": "epic",
        "champion": "legendary",
        "rival": "legendary",
    }[category]


def _effect_for_category(category: str) -> str:
    return {
        "gym": "gloss",
        "elite_four": "prism",
        "champion": "holo",
        "rival": "rival",
    }[category]


def _trainer_name_from_key(key: str) -> str:
    if key in NAME_OVERRIDES:
        return NAME_OVERRIDES[key]
    if key.startswith("elite_"):
        key = key.removeprefix("elite_")
    return " ".join(part.capitalize() for part in key.split("_"))


def _team_title_en(category: str, trainer_name: str) -> str:
    suffix = {
        "gym": "Badge",
        "elite_four": "Elite Four Badge",
        "champion": "Champion Badge",
        "rival": "Rival Badge",
    }[category]
    return f"{trainer_name} - {suffix}"


def _mystery_title_fr(category: str) -> str:
    return {
        "gym": "Badge scelle",
        "elite_four": "Conseil scelle",
        "champion": "Couronne scellee",
        "rival": "Rival scelle",
    }[category]


def _mystery_title_en(category: str) -> str:
    return {
        "gym": "Sealed badge",
        "elite_four": "Sealed council",
        "champion": "Sealed crown",
        "rival": "Sealed rival",
    }[category]
