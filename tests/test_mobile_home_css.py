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


def _blocks(selector: str) -> list[str]:
    return re.findall(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", CSS, flags=re.MULTILINE)


def test_page_headers_scroll_with_content_under_fixed_app_bar() -> None:
    """The global nav stays fixed; per-page headers must not cover content."""

    topbar = "\n".join(_blocks(".stitch-topbar"))
    assert "position: fixed;" in topbar

    header_blocks = _blocks(".header")
    assert header_blocks
    for block in header_blocks:
        assert "position: sticky" not in block
        assert "top: 0" not in block


def test_details_pill_does_not_cover_top_left_card_number() -> None:
    block = "\n".join(_blocks(".card-details"))
    assert "top: var(--card-details-offset" in block
    assert "left: 50%;" in block
    assert "transform: translate(-50%, -4px);" in block
    assert "top: 10px;" not in block
    assert "left: 10px;" not in block
    assert "transform: translate(-50%, 0);" in CSS


def test_details_pill_is_not_kept_open_by_other_card_controls() -> None:
    assert ".card:focus-within .card-details" not in CSS
    assert ".card-details:focus-visible" in CSS
    assert ".card:hover .card-details" in CSS


def test_details_pill_stays_hover_only_on_dimmed_cards() -> None:
    selector = (
        ".card.is-dimmed > "
        ":not(.card-action):not(.pokemon-network-row):not(.card-details)"
    )
    block = "\n".join(_blocks(selector))
    assert "opacity: 0.35;" in block


def test_binder_cards_keep_pokemon_content_centered() -> None:
    block = "\n".join(_blocks("#viewClasseur .binder-page-grid--cards .binder-card"))
    assert "align-items: center;" in block
    assert "align-items: flex-start;" not in block

    image_wrap = "\n".join(_blocks("#viewClasseur .binder-page-grid--cards .card-img-wrap"))
    assert "margin-left: auto;" in image_wrap
    assert "margin-right: auto;" in image_wrap


def test_badge_detail_modal_and_pokemon_preview_are_responsive() -> None:
    overlay = "\n".join(_blocks(".badge-detail-overlay"))
    assert "position: fixed;" in overlay
    assert "inset: 0;" in overlay

    detail = "\n".join(_blocks(".badge-detail"))
    assert "max-width: min(92vw, 560px);" in detail
    assert "max-height: min(86vh, 720px);" in detail
    assert "overflow: auto;" in detail

    requirements = "\n".join(_blocks(".badge-detail-requirements"))
    assert "grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));" in requirements

    chips = "\n".join(_blocks(".badge-requirement-chip"))
    assert "width: 30px;" in chips
    assert "height: 30px;" in chips


def test_badge_battle_dossier_layout_is_responsive() -> None:
    for selector in [
        ".badge-battle-dossier",
        ".badge-battle-layout",
        ".badge-battle-context",
        ".badge-battle-variants",
        ".badge-battle-card",
        ".badge-battle-matchups",
    ]:
        assert selector in CSS

    mobile = _media_block(720)
    assert ".badge-battle-layout" in mobile
    assert "grid-template-columns: 1fr" in mobile


def test_collection_home_has_no_focus_hunt_or_recommendation_surfaces() -> None:
    assert 'src="/focus-session.js"' not in HTML
    forbidden_html = [
        'id="pokedexNextActions"',
        'id="badgeMissionPanel"',
        'src="/badge-mission.js"',
        'src="/hunt-list.js"',
        'src="/recommendations.js"',
        'src="/pokedex-next-actions.js"',
        "app.filters.hunts",
        "Cherche",
        "Match",
        "focusPanelList",
        "focusPanelStats",
    ]
    for token in forbidden_html:
        assert token not in HTML

    forbidden_css = [
        ".focus-panel",
        ".is-focus-target",
    ]
    for token in forbidden_css:
        assert token not in CSS


def test_collection_home_orders_mobile_workflow_before_grid() -> None:
    """Progression and filters must precede the grid in HTML."""

    dashboard = HTML.index('class="pokedex-dashboard"')
    filters = HTML.index('class="filters"')
    grid = HTML.index('id="grid"')

    assert dashboard < filters < grid


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


def test_dimmed_cards_keep_trade_controls_readable() -> None:
    assert ".card.is-dimmed > :not(.card-action):not(.pokemon-network-row)" in CSS
    assert ".card.is-dimmed .card-action" in CSS
    assert ".card.is-dimmed .pokemon-network-row" in CSS
    assert '.card.is-dimmed .pokemon-trade-chip[data-action="duplicate"][data-active="true"]' in CSS
    assert ".card.is-dimmed {\n  opacity:" not in CSS


def test_seen_badge_keeps_duplicate_availability_styling() -> None:
    assert ".pokemon-network-badge" in CSS
    assert ".pokemon-network-badge.is-match" not in CSS
    assert "rgba(255, 193, 7" in CSS


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
        "Capturé",
        "Plusieurs exemplaires",
        "Capturer",
        "Relâcher",
        "Vu chez",
        "doubles",
        "Dresseurs",
        "Instagram",
        "sans compte",
    ]:
        assert text in block


def test_settings_no_longer_exposes_multi_profile_controls() -> None:
    assert "Pokédex multi-profils" not in HTML
    assert "settingsProfileCreateBtn" not in HTML
    assert "settingsProfileDeleteBtn" not in HTML
