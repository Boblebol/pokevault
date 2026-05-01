"""Static checks for the A5 mobile collection home layout."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")


def _media_block(max_width: int) -> str:
    marker = f"@media (max-width: {max_width}px)"
    start = CSS.find(marker)
    assert start >= 0, f"missing {marker} breakpoint"
    next_media = CSS.find("@media", start + len(marker))
    return CSS[start:] if next_media < 0 else CSS[start:next_media]


def test_collection_home_orders_mobile_workflow_before_grid() -> None:
    """Progression, recommendations and filters must precede the grid in HTML."""

    dashboard = HTML.index('class="pokedex-dashboard"')
    next_actions = HTML.index('id="pokedexNextActions"')
    filters = HTML.index('class="filters"')
    grid = HTML.index('id="grid"')

    assert dashboard < next_actions < filters < grid


def test_mobile_home_has_dedicated_720_layout() -> None:
    block = _media_block(720)

    expected_tokens = [
        "A5 mobile home",
        "#viewListe .collection-shell",
        "grid-template-columns: 1fr",
        "#viewListe .collection-rail",
        "#viewListe .collection-main .grid",
        "repeat(auto-fill, minmax(150px, 1fr))",
        "#viewListe .collection-rail .filters",
        "overflow-x: auto",
    ]
    for token in expected_tokens:
        assert token in block


def test_narrow_mobile_home_prevents_horizontal_overflow() -> None:
    block = _media_block(390)

    expected_tokens = [
        "#viewListe .collection-rail",
        "padding: 10px",
        "#viewListe .pokedex-next-action",
        "grid-template-columns: minmax(0, 1fr) auto",
        "#viewListe .collection-rail .filter-btn",
        "min-width: 82px",
    ]
    for token in expected_tokens:
        assert token in block


def test_mobile_home_keeps_touch_targets_usable() -> None:
    block = _media_block(720)

    min_heights = re.findall(r"min-height:\s*(\d+)px", block)
    assert any(int(value) >= 44 for value in min_heights)


def test_trainer_contacts_are_optional_and_isolated() -> None:
    assert 'href="#/dresseurs"' in HTML
    assert 'id="viewDresseurs"' in HTML
    assert "trainer-shell" in CSS
    assert "trainer-search" in CSS
    assert "trainer-note-form" in CSS
    assert "trainer-danger-btn" in CSS
    assert "trainer-list-groups" in CSS
    dresseurs_view = HTML.split('id="viewDresseurs"', 1)[1].split('id="viewPrint"', 1)[0]
    assert "onboarding" not in dresseurs_view.lower()


def test_trade_chips_have_dedicated_compact_styles() -> None:
    expected_tokens = [
        "pokemon-ownership-actions",
        "pokemon-trade-chip",
        "pokemon-network-row",
        "pokemon-network-badge",
        "pokemon-exchange-context",
        "#viewClasseur .binder-page-grid--cards .pokemon-trade-chip",
    ]
    for token in expected_tokens:
        assert token in CSS


def test_binder_layout_settings_are_optional_and_use_sheet_language() -> None:
    classeur_view = HTML.split('id="viewClasseur"', 1)[1].split('id="viewDresseurs"', 1)[0]

    assert 'id="binderWizardSettings"' in classeur_view
    assert 'id="binderWizardWrap"' in classeur_view
    assert "Réglages" in classeur_view
    assert "10 feuillets" in classeur_view
    assert "3×3" in classeur_view


def test_onboarding_product_tour_covers_local_trade_workflow() -> None:
    block = HTML.split('id="onboardingWizard"', 1)[1].split("</dialog>", 1)[0]

    assert len(re.findall(r'<section class="onboarding__step\b', block)) == 5
    for text in [
        "Cherche",
        "J'ai",
        "Double",
        "Vu chez",
        "Match",
        "Dresseurs",
        "sans compte",
    ]:
        assert text in block
