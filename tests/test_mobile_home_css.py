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


def _print_media_block() -> str:
    marker = "@media print"
    start = CSS.find(marker)
    assert start >= 0, "missing print media block"
    next_media = CSS.find("@media", start + len(marker))
    return CSS[start:] if next_media < 0 else CSS[start:next_media]


def _blocks(selector: str) -> list[str]:
    return re.findall(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", CSS, flags=re.MULTILINE)


def _blocks_in(css: str, selector: str) -> list[str]:
    return re.findall(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", css, flags=re.MULTILINE)


def _script_index(src: str) -> int:
    marker = f'<script src="{src}"'
    index = HTML.find(marker)
    assert index >= 0, f"missing script {src}"
    return index


def test_late_page_modules_load_before_app_router_for_direct_hashes() -> None:
    """Initial #/stats and #/docs loads need page modules before app.js routes."""

    app_index = _script_index("/app.js")
    assert _script_index("/stats-view.js") < app_index
    assert _script_index("/docs-view.js") < app_index if "/docs-view.js" in HTML else True


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
    assert "max-width: min(92vw, 720px);" in detail
    assert "max-height: min(86vh, 760px);" in detail
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
    dresseurs_view = HTML.split('id="viewDresseurs"', 1)[1].split('id="viewDocs"', 1)[0]
    assert "onboarding" not in dresseurs_view.lower()

    for selector in [".trainer-contact-links li", ".trainer-tag-group li"]:
        block = "\n".join(_blocks(selector))
        assert "border: 1px solid var(--pdx-border);" in block, selector
        assert "border-radius: var(--radius-sm);" in block, selector
        assert "background: var(--pdx-bg);" in block, selector
        assert "color: var(--pdx-text-dim);" in block, selector
        assert "font-family: var(--font-mono);" in block, selector


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


def test_settings_are_grouped_into_coherent_data_sections() -> None:
    settings = HTML.split('id="viewSettings"', 1)[1].split('class="stitch-footer"', 1)[0]

    for text in [
        "Préférences",
        "Sauvegarde",
        "Maintenance",
        "Système",
        "Rafraîchir références",
        "Supprimer mes données locales",
    ]:
        assert text in settings
    for token in [
        'id="settingsMaintenanceStatus"',
        'id="settingsMaintenanceRefreshBtn"',
        'id="settingsDataResetBtn"',
        'settings-action-btn--danger',
    ]:
        assert token in settings


def test_print_view_is_removed() -> None:
    html = (Path(__file__).resolve().parents[1] / "web" / "index.html").read_text(encoding="utf-8")
    for forbidden in ["print-view.js", "viewPrint", "app.nav.print", "#/print"]:
        assert forbidden not in html, f"Expected {forbidden!r} to be absent from index.html"


def test_secondary_pages_use_vault_lab_panels() -> None:
    expected_selectors = [
        "#viewClasseur .binder-shell-layout",
        "#viewDresseurs .trainer-shell",
        "#viewDocs .docs-shell",
        "#viewSettings .stats-main",
    ]
    for selector in expected_selectors:
        block = "\n".join(_blocks(selector))
        assert block, selector
        assert "var(--pdx-" in block, selector


def test_vault_lab_desktop_nav_order_separates_badges_from_stats() -> None:
    nav = HTML.split('class="stitch-topnav"', 1)[1].split("</nav>", 1)[0]
    expected = [
        'href="#/liste"',
        'href="#/classeur"',
        'href="#/dresseurs"',
        'href="#/badges"',
        'href="#/stats"',
        'href="#/docs"',
        'href="#/settings"',
    ]
    positions = [nav.index(token) for token in expected]
    assert positions == sorted(positions)


def test_vault_lab_mobile_nav_uses_primary_tabs_and_plus_menu() -> None:
    assert 'class="mobile-bottom-nav"' in HTML
    for token in [
        'data-mobile-view="liste"',
        'data-mobile-view="classeur"',
        'data-mobile-view="badges"',
        'data-mobile-view="stats"',
        'id="mobileMoreToggle"',
        'id="mobileMoreMenu"',
    ]:
        assert token in HTML

    more = HTML.split('id="mobileMoreMenu"', 1)[1].split("</nav>", 1)[0]
    for href in ['href="#/dresseurs"', 'href="#/docs"', 'href="#/settings"']:
        assert href in more


def test_mobile_nav_is_hidden_on_desktop_and_positioned_on_mobile() -> None:
    bottom_default = "\n".join(_blocks(".mobile-bottom-nav"))
    more_default = "\n".join(_blocks(".mobile-more-menu"))
    assert "display: none;" in bottom_default
    assert "display: none;" in more_default

    mobile = _media_block(720)
    for selector in [
        ".mobile-bottom-nav",
        ".mobile-more-menu",
        ".mobile-more-menu[hidden]",
    ]:
        assert selector in mobile

    bottom_mobile = re.search(r"\.mobile-bottom-nav\s*\{([^}]+)\}", mobile)
    assert bottom_mobile
    assert "display: grid;" in bottom_mobile.group(1)
    assert "grid-template-columns: repeat(5, minmax(0, 1fr));" in bottom_mobile.group(1)
    assert "position: fixed;" in bottom_mobile.group(1)
    assert "bottom: 0;" in bottom_mobile.group(1)

    more_mobile = re.search(r"\.mobile-more-menu\s*\{([^}]+)\}", mobile)
    assert more_mobile
    assert "position: fixed;" in more_mobile.group(1)
    assert "bottom:" in more_mobile.group(1)

    hidden_mobile = re.search(r"\.mobile-more-menu\[hidden\]\s*\{([^}]+)\}", mobile)
    assert hidden_mobile
    assert "display: none;" in hidden_mobile.group(1)


def test_pokemon_modal_stacks_above_fixed_navigation() -> None:
    topbar = "\n".join(_blocks(".stitch-topbar"))
    bottom_nav = "\n".join(_blocks_in(_media_block(720), ".mobile-bottom-nav"))
    modal = "\n".join(_blocks(".pokemon-modal"))

    assert "--z-modal: 220;" in CSS
    assert "z-index: var(--z-app-bar);" in topbar
    assert "z-index: var(--z-mobile-nav);" in bottom_nav
    assert "z-index: var(--z-modal);" in modal


def test_vault_lab_shell_uses_maquette_density_and_mobile_surfaces() -> None:
    body = "\n".join(_blocks("html,\nbody"))
    assert "background-color: var(--pdx-bg);" in body
    assert "background-image: radial-gradient(" in body
    assert "background-size: 22px 22px;" in body
    assert "z-index: -1;" not in body

    topbar = "\n".join(_blocks(".stitch-topbar"))
    assert "height: 48px;" in topbar
    assert "background: var(--pdx-panel);" in topbar
    assert "border-bottom: 1px solid var(--pdx-border);" in topbar

    nav_link = "\n".join(_blocks(".stitch-topnav .app-switch-link"))
    assert "font-family: var(--font-mono);" in nav_link
    assert "text-transform: uppercase;" in nav_link
    assert "height: 48px;" in nav_link

    mobile = _media_block(720)
    for token in [
        ".mobile-bottom-nav",
        "position: fixed;",
        "bottom: 0;",
        "height: 58px;",
        ".mobile-more-menu",
    ]:
        assert token in mobile


def test_stats_page_is_stats_only_vault_lab_dashboard() -> None:
    stats_view = HTML.split('id="viewStats"', 1)[1].split('id="viewClasseur"', 1)[0]
    assert 'id="statsBody"' in stats_view
    assert 'id="statsBadges"' not in stats_view
    assert "stats-main--badges" not in CSS

    stats_shell = "\n".join(_blocks("#viewStats .stats-shell"))
    assert "grid-template-columns:" in stats_shell
    assert "var(--pdx-panel)" in stats_shell or "var(--pdx-bg)" in stats_shell

    stats_panels = "\n".join(
        _blocks(
            "#viewStats .stats-rail,\n"
            "#viewStats .stats-hero,\n"
            "#viewStats .stats-region-wrap"
        )
    )
    assert "background: var(--pdx-panel);" in stats_panels
    assert "border: 1px solid var(--pdx-border);" in stats_panels

    responsive = _media_block(960)
    assert "#viewStats .stats-shell" in responsive
    assert "grid-template-columns: 1fr;" in responsive
    assert "#viewStats .stats-kpi-grid" in responsive


def test_collection_uses_vault_lab_rail_and_cards() -> None:
    collection_shell = "\n".join(_blocks("#viewListe .collection-shell"))
    assert "grid-template-columns:" in collection_shell

    rail = "\n".join(_blocks("#viewListe .collection-rail"))
    assert "var(--pdx-panel)" in rail
    assert "var(--pdx-border)" in rail

    card = "\n".join(_blocks(".card"))
    assert "var(--pdx-panel)" in card or "var(--pdx-bg)" in card
    assert "var(--pdx-border)" in card

    active_filter = "\n".join(_blocks("#viewListe .filter-btn.is-active"))
    assert "var(--pdx-cyan)" in active_filter
    assert "var(--pdx-cyan-dim)" in active_filter
    assert "var(--accent)" not in active_filter
    assert "var(--accent-strong)" not in active_filter

    filter_blocks = _blocks(".filter-btn")
    assert filter_blocks
    final_filter = filter_blocks[-1]
    assert "border: 1px solid var(--pdx-border);" in final_filter
    assert "box-shadow: none;" in final_filter
    assert "var(--outline-soft)" not in final_filter

    shared_filter = "\n".join(_blocks(".filter-btn,\n.region-filter,\n.search-input"))
    assert "border: 1px solid var(--pdx-border);" in shared_filter
    assert "box-shadow: none;" in shared_filter
    assert "var(--outline-soft)" not in shared_filter

    card_focus = "\n".join(_blocks(".card:focus-visible"))
    assert "var(--pdx-cyan)" in card_focus or "var(--pdx-border-hi)" in card_focus
    assert "var(--accent)" not in card_focus

    collection_card = "\n".join(_blocks("#viewListe .grid .card"))
    assert "border-radius: var(--radius-md);" in collection_card
    assert "border-radius: 12px;" not in collection_card
