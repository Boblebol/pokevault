"""Static contrast checks for the app theme tokens."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "web" / "styles.css"
THEMES_RUNTIME = ROOT / "web" / "themes.js"

EXPECTED_THEME = "Vault Lab"

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


def test_vault_lab_tokens_cover_readable_single_theme() -> None:
    css = STYLES.read_text(encoding="utf-8")
    tokens = _theme_tokens(css, "default")
    missing = [token for token in REQUIRED_TOKENS if token not in tokens]
    assert not missing, f"{EXPECTED_THEME}: missing {missing}"

    for surface in ["--bg", "--card", "--surface-low", "--surface-high"]:
        text_contrast = _contrast(tokens["--text"], tokens[surface])
        muted_contrast = _contrast(tokens["--muted"], tokens[surface])
        assert text_contrast >= 7.0, f"{EXPECTED_THEME}: text on {surface}"
        assert muted_contrast >= 4.5, f"{EXPECTED_THEME}: muted on {surface}"

    for signal in ["--accent", "--accent-strong", "--electric"]:
        assert _contrast(tokens[signal], tokens["--bg"]) >= 4.5, f"{EXPECTED_THEME}: {signal} on bg"
        assert _contrast(tokens[signal], tokens["--card"]) >= 4.5, f"{EXPECTED_THEME}: {signal} on card"

    assert _contrast(tokens["--accent-ink"], tokens["--accent"]) >= 4.5, f"{EXPECTED_THEME}: accent ink"


def test_vault_lab_surfaces_are_visually_distinct() -> None:
    css = STYLES.read_text(encoding="utf-8")
    tokens = _theme_tokens(css, "default")
    assert _channel_distance(tokens["--bg"], tokens["--card"]) >= 0.10
    assert _channel_distance(tokens["--card"], tokens["--control-bg"]) >= 0.05
    assert _channel_distance(tokens["--card"], tokens["--surface-high"]) >= 0.14


def test_single_theme_runtime_is_removed_from_web_app() -> None:
    index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    css = STYLES.read_text(encoding="utf-8")

    assert not THEMES_RUNTIME.exists()
    assert 'src="/themes.js"' not in index
    assert "settingsThemeSelect" not in index
    assert 'data-theme="kanto"' not in css
    assert 'html[data-theme="kanto"]' not in css
    assert 'html[data-theme="hoenn"]' not in css
    assert 'html[data-theme="paldea"]' not in css


def test_vault_lab_fonts_are_local_and_declared() -> None:
    css = STYLES.read_text(encoding="utf-8")
    for font in [
        "barlow-latin-400.woff2",
        "barlow-latin-500.woff2",
        "barlow-latin-600.woff2",
        "barlow-latin-700.woff2",
        "space-mono-latin-400.woff2",
        "space-mono-latin-700.woff2",
    ]:
        assert (ROOT / "web" / "assets" / "fonts" / font).is_file(), font
        assert f"/assets/fonts/{font}" in css
    assert "fonts.googleapis.com" not in css
    assert "fonts.gstatic.com" not in css


def test_pokemon_modal_uses_theme_tokens() -> None:
    css = STYLES.read_text(encoding="utf-8")
    modal_css = css.split("/* ── Pokémon modal", 1)[1].split("/* ── Pokémon list details", 1)[0]
    panel_blocks = _blocks(r"\.pokemon-modal__panel", css)
    assert panel_blocks, "modal panel styles missing"
    panel_css = panel_blocks[0]

    assert "background:" in panel_css
    assert "var(--card)" in panel_css
    assert "var(--outline-soft)" in panel_css
    assert "animation: pokemon-modal-panel-in" in modal_css
    assert "animation: pokemon-modal-scrim-in" in modal_css
    assert "backdrop-filter: blur(" in modal_css
    assert "scrollbar-gutter: stable;" in css
    for legacy_ref in [
        "var(--surface)",
        "var(--surface-2)",
        "var(--ink)",
        "var(--border)",
        "var(--shadow-lg)",
    ]:
        assert legacy_ref not in modal_css

    token_driven_selectors = [
        ".pokemon-modal__topbar",
        ".pokemon-modal__kicker",
        ".pokemon-modal__close",
        ".pokemon-modal-hero__img",
        ".pokemon-modal-status-label",
        ".pokemon-modal-form",
        ".pokemon-modal-type-badge",
        ".pokemon-fiche-section__toggle",
        ".pokemon-status-action",
        ".pokemon-note-editor__input",
        ".pokemon-note-editor__save",
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

    modal = "\n".join(_blocks(re.escape(".pokemon-modal"), mobile))
    assert "padding: 0;" in modal
    assert "align-items: stretch;" in modal

    panel = "\n".join(_blocks(re.escape(".pokemon-modal__panel"), mobile))
    assert "width: 100%;" in panel
    assert "max-height: 100dvh;" in panel

    hero = "\n".join(_blocks(re.escape(".pokemon-modal-matchups"), mobile))
    assert "grid-template-columns: 1fr;" in hero

    actions = "\n".join(_blocks(re.escape(".pokemon-status-actions"), small))
    assert "display: grid;" in actions
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in actions

    action_button = "\n".join(_blocks(re.escape(".pokemon-status-action"), small))
    assert "width: 100%;" in action_button
