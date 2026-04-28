"""Static contrast checks for the app theme tokens."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "web" / "styles.css"
THEMES = ROOT / "web" / "themes.js"
DESIGN = ROOT / "DESIGN.md"

EXPECTED_THEMES = {
    "default": "Vault Lab",
    "kanto": "Kanto Archive",
    "hoenn": "Hoenn Deepsea",
    "paldea": "Paldea Field Lab",
}

REQUIRED_TOKENS = [
    "--bg",
    "--card",
    "--surface-low",
    "--surface-high",
    "--surface-highest",
    "--accent",
    "--accent-strong",
    "--accent-ink",
    "--electric",
    "--text",
    "--muted",
    "--outline-soft",
    "--outline-strong",
    "--control-bg",
    "--control-border",
    "--control-hover",
    "--success",
    "--danger",
    "--warning",
]


def _blocks(selector_pattern: str, css: str) -> list[str]:
    return re.findall(rf"{selector_pattern}\s*\{{([^}}]+)\}}", css, flags=re.MULTILINE)


def _media_block(css: str, query: str) -> str:
    marker = f"@media {query} {{"
    blocks: list[str] = []
    search_from = 0
    while True:
        start = css.find(marker, search_from)
        if start < 0:
            break
        index = start + len(marker)
        depth = 1
        while index < len(css) and depth:
            char = css[index]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
            index += 1
        assert depth == 0, f"{query}: media block is not closed"
        blocks.append(css[start + len(marker) : index - 1])
        search_from = index
    assert blocks, f"{query}: media block missing"
    return "\n".join(blocks)


def _tokens_from_block(block: str) -> dict[str, str]:
    return {
        name: value.strip()
        for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", block)
    }


def _theme_tokens(css: str, theme: str) -> dict[str, str]:
    tokens: dict[str, str] = {}
    for block in _blocks(r":root", css):
        tokens.update(_tokens_from_block(block))
    if theme != "default":
        for block in _blocks(rf'html\[data-theme="{theme}"\]', css):
            tokens.update(_tokens_from_block(block))
    return tokens


def _hex_to_rgb(hex_value: str) -> tuple[float, float, float]:
    raw = hex_value.removeprefix("#")
    return tuple(int(raw[index : index + 2], 16) / 255 for index in (0, 2, 4))


def _linear(channel: float) -> float:
    if channel <= 0.03928:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _luminance(hex_value: str) -> float:
    red, green, blue = (_linear(channel) for channel in _hex_to_rgb(hex_value))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def _contrast(foreground: str, background: str) -> float:
    left = _luminance(foreground)
    right = _luminance(background)
    lighter, darker = max(left, right), min(left, right)
    return (lighter + 0.05) / (darker + 0.05)


def _channel_distance(left: str, right: str) -> float:
    left_rgb = _hex_to_rgb(left)
    right_rgb = _hex_to_rgb(right)
    return sum(abs(a - b) for a, b in zip(left_rgb, right_rgb, strict=True))


def test_theme_tokens_cover_readable_open_source_palettes() -> None:
    css = STYLES.read_text(encoding="utf-8")

    for theme in EXPECTED_THEMES:
        tokens = _theme_tokens(css, theme)
        missing = [token for token in REQUIRED_TOKENS if token not in tokens]
        assert not missing, f"{theme}: missing {missing}"

        for surface in ["--bg", "--card", "--surface-low", "--surface-high"]:
            text_contrast = _contrast(tokens["--text"], tokens[surface])
            muted_contrast = _contrast(tokens["--muted"], tokens[surface])
            assert text_contrast >= 7.0, f"{theme}: text on {surface}"
            assert muted_contrast >= 4.5, f"{theme}: muted on {surface}"

        for signal in ["--accent", "--accent-strong", "--electric"]:
            assert _contrast(tokens[signal], tokens["--bg"]) >= 4.5, f"{theme}: {signal} on bg"
            assert _contrast(tokens[signal], tokens["--card"]) >= 4.5, f"{theme}: {signal} on card"

        assert _contrast(tokens["--accent-ink"], tokens["--accent"]) >= 4.5, f"{theme}: accent ink"


def test_theme_surfaces_are_visually_distinct() -> None:
    css = STYLES.read_text(encoding="utf-8")

    for theme in EXPECTED_THEMES:
        tokens = _theme_tokens(css, theme)
        assert _channel_distance(tokens["--bg"], tokens["--card"]) >= 0.10, f"{theme}: bg/card"
        assert _channel_distance(tokens["--card"], tokens["--control-bg"]) >= 0.05, (
            f"{theme}: card/control"
        )
        assert _channel_distance(tokens["--card"], tokens["--surface-high"]) >= 0.14, (
            f"{theme}: card/surface-high"
        )

        if theme == "kanto":
            assert _channel_distance(tokens["--bg"], tokens["--card"]) >= 0.90, (
                "kanto: bg/card"
            )
            assert _channel_distance(tokens["--card"], tokens["--control-bg"]) >= 0.50, (
                "kanto: card/control"
            )
            assert _channel_distance(tokens["--card"], tokens["--surface-high"]) >= 0.90, (
                "kanto: card/surface-high"
            )


def test_theme_labels_match_design_language() -> None:
    themes_js = THEMES.read_text(encoding="utf-8")
    design = DESIGN.read_text(encoding="utf-8")

    for theme_id, label in EXPECTED_THEMES.items():
        assert f'id: "{theme_id}", label: "{label}"' in themes_js
        assert label in design
    assert "Google Stitch" not in design


def test_pokemon_drawer_uses_theme_tokens() -> None:
    css = STYLES.read_text(encoding="utf-8")
    panel_blocks = _blocks(r"\.drawer__panel", css)
    assert panel_blocks, "drawer panel styles missing"
    panel_css = panel_blocks[0]

    assert "background: var(--card);" in panel_css
    assert "color: var(--text);" in panel_css
    assert "--panel" not in panel_css
    assert "--ink" not in panel_css

    token_driven_selectors = [
        ".drawer__topbar",
        ".drawer__kicker",
        ".drawer__close",
        ".drawer-header__img",
        ".drawer-status-row__btn",
        ".pokemon-fiche-section__toggle",
        ".pokemon-status-action",
        ".pokemon-note-editor__input",
        ".pokemon-note-editor__save",
        ".fullview-cards-body",
        ".drawer-card-row",
        ".drawer-tcg-result",
        ".drawer-add-form__submit",
    ]
    for selector in token_driven_selectors:
        blocks = _blocks(re.escape(selector), css)
        assert blocks, f"{selector}: styles missing"
        block = "\n".join(blocks)
        assert "var(--" in block, f"{selector}: should follow selected theme tokens"


def test_mobile_fiche_css_prioritizes_primary_content() -> None:
    css = STYLES.read_text(encoding="utf-8")
    mobile = _media_block(css, "(max-width: 720px)")
    small = _media_block(css, "(max-width: 520px)")
    narrow = _media_block(css, "(max-width: 390px)")

    hero = "\n".join(_blocks(re.escape(".fullview-hero"), mobile))
    assert "grid-template-columns: minmax(72px, 96px) minmax(0, 1fr);" in hero
    assert "align-items: center;" in hero

    hero_img = "\n".join(_blocks(re.escape(".fullview-hero__img"), mobile))
    assert "max-width: 96px;" in hero_img
    assert "margin: 0;" in hero_img

    title = "\n".join(_blocks(re.escape(".fullview-hero__title"), mobile))
    assert "overflow-wrap: anywhere;" in title

    actions = "\n".join(_blocks(re.escape(".pokemon-status-actions"), small))
    assert "display: grid;" in actions
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in actions

    action_button = "\n".join(_blocks(re.escape(".pokemon-status-action"), small))
    assert "width: 100%;" in action_button

    forms = "\n".join(_blocks(re.escape(".fullview-forms-grid"), mobile))
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in forms

    form_label = "\n".join(_blocks(re.escape(".fullview-form-tile__label"), mobile))
    assert "overflow-wrap: anywhere;" in form_label

    cards = "\n".join(_blocks(re.escape(".fullview-cards-body"), mobile))
    assert "overflow-x: auto;" in cards

    compact_form_image = "\n".join(_blocks(re.escape(".fullview-form-tile img"), narrow))
    assert "width: 56px;" in compact_form_image
    assert "height: 56px;" in compact_form_image
