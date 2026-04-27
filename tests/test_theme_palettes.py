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
