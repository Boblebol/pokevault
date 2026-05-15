"""Static checks for the GitHub Pages site."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
WEB = ROOT / "web"

PAGES = [
    "index.html",
    "features.html",
    "install.html",
    "architecture.html",
    "roadmap.html",
    "contributing.html",
]

NAV_LABELS = ["Fonctions", "Installer", "Architecture", "Roadmap", "Contribuer", "GitHub"]


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if tag == "a" and data.get("href"):
            self.links.append(("href", data["href"] or ""))
        if tag in {"img", "script"} and data.get("src"):
            self.links.append(("src", data["src"] or ""))
        if tag == "link" and data.get("href"):
            self.links.append(("href", data["href"] or ""))

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.text.append(data.strip())


def _parse(path: Path) -> LinkParser:
    parser = LinkParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def test_public_site_pages_exist() -> None:
    for page in PAGES:
        assert (DOCS / page).is_file(), page


def test_public_site_links_resolve() -> None:
    for page in PAGES:
        path = DOCS / page
        parser = _parse(path)
        for attr, value in parser.links:
            if value.startswith(("http://", "https://", "mailto:")):
                continue
            target = urlsplit(value).path
            if not target or target.startswith("#"):
                continue
            candidate = (path.parent / target).resolve()
            assert candidate.exists(), f"{page} {attr}={value}"


def test_public_site_navigation_is_complete() -> None:
    text = " ".join(_parse(DOCS / "index.html").text)
    for label in NAV_LABELS:
        assert label in text

    i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")
    for label in ["Features", "Install", "Contribute", "Language"]:
        assert label in i18n


def test_public_docs_share_language_switch() -> None:
    for page in PAGES:
        text = (DOCS / page).read_text(encoding="utf-8")
        assert '<script src="assets/i18n.js" defer></script>' in text, page
        assert 'data-i18n-locale="fr"' in text, page
        assert 'data-i18n-locale="en"' in text, page
        assert 'data-i18n="nav.features"' in text, page
    assert 'data-i18n-document="landing"' in (DOCS / "index.html").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    assert 'data-i18n-document="landing"' not in features


def test_public_site_footers_link_to_portfolio() -> None:
    for page in PAGES:
        links = {value for _, value in _parse(DOCS / page).links}
        assert "https://alexandre-enouf.fr" in links, page


def test_brand_assets_exist() -> None:
    for asset in [
        DOCS / "assets" / "logo.svg",
        DOCS / "assets" / "logo-mark.svg",
        DOCS / "assets" / "favicon.svg",
        WEB / "assets" / "logo-mark.svg",
        WEB / "assets" / "favicon.svg",
    ]:
        assert asset.is_file(), asset


def test_web_app_references_runtime_brand_assets() -> None:
    links = set(_parse(WEB / "index.html").links)

    assert ("href", "/assets/favicon.svg") in links
    assert ("src", "/assets/logo-mark.svg") in links


def test_web_app_has_no_third_party_font_requests() -> None:
    for path in [WEB / "index.html", WEB / "styles.css", *WEB.rglob("*.js")]:
        text = path.read_text(encoding="utf-8")
        assert "fonts.googleapis.com" not in text, path
        assert "fonts.gstatic.com" not in text, path
        assert "Material+Symbols" not in text, path
        assert "Material Symbols" not in text, path
        assert "material-symbols" not in text, path


def test_web_app_supports_fr_en_switch_on_main_surfaces() -> None:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    i18n = (WEB / "i18n.js").read_text(encoding="utf-8")

    assert '<script src="/i18n.js" defer></script>' in index
    assert 'data-i18n-locale="fr"' in index
    assert 'data-i18n-locale="en"' in index
    for key in [
        "app.collection.title",
        "app.badges.title",
        "app.stats.title",
        "app.binders.title",
        "app.trainers.title",
        "app.docs.title",
        "app.settings.title",
        "app.onboarding.title",
        "app.shortcuts.title",
        "app.drawer.kicker",
    ]:
        assert f'data-i18n="{key}"' in index
        assert key in i18n
    assert 'href="#/badges"' in index
    assert 'id="viewBadges"' in index
    assert '"app.nav.badges"' in i18n
    assert 'href="#/docs"' in index
    assert 'id="viewDocs"' in index
    assert '"app.nav.docs"' in i18n
    for key in [
        "app.docs.quick_start.title",
        "app.docs.workflow.title",
        "app.docs.trainers.title",
        "app.docs.binders.title",
        "app.docs.badges.title",
        "app.docs.data.title",
        "app.docs.api.title",
    ]:
        assert key in i18n


def test_readme_links_changelog_without_hosted_demo() -> None:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    old_hosted_url = "pokevault" + ".alexandre-enouf.fr"
    old_demo_label = "Live " + "demo:"

    assert "[Release notes](CHANGELOG.md)" in text
    assert old_hosted_url not in text
    assert old_demo_label not in text


def test_pokedex_first_backlog_is_linked_from_public_docs() -> None:
    plan = DOCS / "V1_1_POKEDEX_FIRST.md"
    assert plan.is_file()

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    roadmap = (DOCS / "ROADMAP.md").read_text(encoding="utf-8")
    roadmap_page = (DOCS / "roadmap.html").read_text(encoding="utf-8")

    assert "docs/V1_1_POKEDEX_FIRST.md" in readme
    assert "V1_1_POKEDEX_FIRST.md" in roadmap
    assert "V1_1_POKEDEX_FIRST.md" in roadmap_page


def test_open_source_security_policy_exists() -> None:
    security = ROOT / "SECURITY.md"
    assert security.is_file()
    text = security.read_text(encoding="utf-8")
    assert "Security Policy" in text
    assert "GitHub Security Advisories" in text


def test_trainer_contacts_are_documented_publicly() -> None:
    guide = DOCS / "TRAINER_CONTACTS.md"
    assert guide.is_file()

    guide_text = guide.read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    roadmap = (DOCS / "roadmap.html").read_text(encoding="utf-8")
    architecture = (DOCS / "architecture.html").read_text(encoding="utf-8")

    assert "searchable local contact book" in guide_text
    assert "private notes" in guide_text
    assert "Instagram" in guide_text
    assert "Facebook" in guide_text
    assert "Téléphone" in guide_text
    assert "Trainer Cards do not export a wishlist" in guide_text
    assert "Trainer Cards also do not export" in guide_text
    assert "badges; badge progress stays" in guide_text
    assert "Trainer Cards" in readme
    assert "data/trainer-contacts.json" in readme
    assert "/api/trainers" in readme
    assert "searchable local contact book" in readme
    assert "Trainer Cards share only `Double` entries" in readme
    assert "Trainer Cards" in features
    assert "searchable local contact book" in features
    assert "Double and Vu chez context" in features
    assert "Dresseurs" in roadmap
    assert "trainer-contacts.json" in architecture


def test_simplified_trade_state_model_is_documented_publicly() -> None:
    guide_text = (DOCS / "TRAINER_CONTACTS.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    landing = (DOCS / "index.html").read_text(encoding="utf-8")
    roadmap = (DOCS / "roadmap.html").read_text(encoding="utf-8")
    i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")

    for text in [readme, features, landing, roadmap, i18n]:
        assert "Capturé" in text or "Caught" in text
        assert "Double" in text
        assert "Relâcher" in text or "Release" in text
        assert "Vu chez" in text
        assert "Match" not in text
    assert "Capturé" in guide_text
    assert "Double" in guide_text
    assert "Relâcher" in guide_text
    assert "Vu chez" in guide_text
    assert "There is no `Match` state" in guide_text
    for text in [guide_text, readme, features]:
        assert "Cherche" not in text
        assert "Wanted" not in text
        assert "/api/hunts" not in text
    for text in [guide_text, features]:
        assert "hunts" not in text
    assert "Vu chez" in guide_text


def test_removed_active_hunts_missions_and_badge_sharing_copy_is_absent() -> None:
    active_public_docs = [
        ROOT / "README.md",
        DOCS / "TRAINER_CONTACTS.md",
        DOCS / "features.html",
        DOCS / "assets" / "i18n.js",
        DOCS / "index.html",
        DOCS / "roadmap.html",
        DOCS / "architecture.html",
    ]
    forbidden_active_copy = [
        "Badge missions",
        "badge missions",
        "mission follow",
        "mission-follow",
        "follow missions",
        "follow a mission",
        "missions to follow",
        "automatically shared on Trainer Cards",
        "automatically share unlocked badges",
        "unlocked badges are shared",
        "unlocked badges on Trainer Cards",
        "Trainer Cards share badges",
        "Trainer Cards export badges",
    ]

    for path in active_public_docs:
        text = path.read_text(encoding="utf-8")
        for forbidden in forbidden_active_copy:
            assert forbidden not in text, f"{path}: {forbidden}"


def test_legacy_simplified_model_migration_notes_are_documented() -> None:
    guide_text = (DOCS / "TRAINER_CONTACTS.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    architecture = (DOCS / "architecture.html").read_text(encoding="utf-8")

    assert "Older installs may still have `data/hunts.json`" in readme
    assert "Older installs may still have" in architecture
    for text in [readme, architecture]:
        assert "data/hunts.json" in text
        assert "ignored by the active app" in text
        assert "omitted from new backups" in text
        assert "first_encounter" in text
        assert "cleaned/ignored" in text

    assert "Legacy Trainer Card `wants` and `badges`" in guide_text
    assert "tolerated/ignored" in guide_text
    assert "only `for_trade`/`Double` is shared" in guide_text


def test_in_app_documentation_is_documented_publicly() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")

    for text in [readme, features]:
        assert "#/docs" in text
        assert "App documentation" in text
        assert "local-first data" in text
        assert "badges" in text.lower()
        assert "Trainer Cards" in text
        assert "physical binder" in text.lower()


def test_web_app_no_longer_loads_profile_switcher() -> None:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    app = (WEB / "app.js").read_text(encoding="utf-8")

    assert "/profiles.js" not in index
    assert "settingsProfileSelect" not in index
    assert "PokevaultProfiles" not in app


def test_active_docs_do_not_advertise_multi_profiles() -> None:
    checked = [
        ROOT / "README.md",
        ROOT / "CONTRIBUTING.md",
        DOCS / "architecture.html",
        DOCS / "features.html",
        DOCS / "install.html",
        DOCS / "ROADMAP.md",
        WEB / "index.html",
        WEB / "i18n.js",
    ]
    joined = "\n".join(path.read_text(encoding="utf-8") for path in checked)

    forbidden = [
        "/api/profiles",
        "data/profiles/<id>",
        "data/profiles/&lt;id&gt;",
        "data/profiles/",
        "profiles.json",
        "Multi-profile Pokedex",
        "Pokédex multi-profils",
        "Local profiles with isolated progress",
        "Each profile keeps",
    ]
    for value in forbidden:
        assert value not in joined


def test_in_app_docs_cover_complete_product_workflows_in_both_languages() -> None:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    i18n = (WEB / "i18n.js").read_text(encoding="utf-8")

    required_keys = [
        "app.docs.installation.title",
        "app.docs.concepts.title",
        "app.docs.collection.title",
        "app.docs.fiches_cards.title",
        "app.docs.binders.title",
        "app.docs.trainers.title",
        "app.docs.badges.title",
        "app.docs.data_files.title",
        "app.docs.profiles_backup.title",
        "app.docs.api.title",
        "app.docs.shortcuts.title",
        "app.docs.limits.title",
    ]
    for key in required_keys:
        assert f'data-i18n="{key}"' in index
        assert key in i18n

    for text in [
        "data/collection-progress.json",
        "data/game-pokedexes.json",
        "data/binder-config.json",
        "data/trainer-contacts.json",
        "/api/progress",
        "/data/game-pokedexes.json",
        "/api/trainers",
        "/api/export",
        "/api/import",
        "FR:",
        "EN:",
    ]:
        assert text in i18n


def test_docs_describe_single_modal_and_game_pokedex_appearances() -> None:
    web_i18n = (WEB / "i18n.js").read_text(encoding="utf-8")
    index = (WEB / "index.html").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")

    for text in [web_i18n, index, readme, features]:
        assert "modal" in text.lower()
        assert "game-pokedexes.json" in text or "game Pokedex" in text or "Pokédex des jeux" in text


def test_public_features_page_has_bilingual_product_copy() -> None:
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")

    required_keys = [
        "features.hero.title",
        "features.collection.title",
        "features.binders.title",
        "features.trainers.title",
        "features.badges.title",
        "features.data.title",
        "features.docs.title",
        "features.api.title",
    ]
    for key in required_keys:
        assert f'data-i18n="{key}"' in features
        assert key in i18n

    assert "FR:" in i18n
    assert "EN:" in i18n


def test_product_docs_split_badges_from_stats_copy() -> None:
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    docs_i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")
    app_index = (WEB / "index.html").read_text(encoding="utf-8")
    app_i18n = (WEB / "i18n.js").read_text(encoding="utf-8")

    for text in [features, docs_i18n, app_index, app_i18n]:
        assert "Badges et stats" not in text
        assert "Badges and stats" not in text
        assert "requirement previews" not in text
        assert "badge progress" not in text

    assert 'data-i18n="app.docs.badges.title"' in app_index
    assert 'data-i18n="app.docs.stats.title"' in app_index
    assert "features.stats.title" in docs_i18n
    assert '"features.stats.title": "Statistiques"' in docs_i18n
    assert '"features.stats.title": "Stats"' in docs_i18n


def test_readme_is_developer_oriented_and_delegates_product_docs() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert "## Developer Quick Start" in readme
    assert "## Product Documentation" in readme
    assert "Detailed product documentation lives in the app" in readme
    assert "## Feature Documentation" not in readme


def test_trainer_contacts_document_local_trade_workflow() -> None:
    guide_text = (DOCS / "TRAINER_CONTACTS.md").read_text(encoding="utf-8")
    for text in [
        "Create your Trainer Card",
        "Import a received card",
        "Update a contact",
        "Find a trade",
        "without an account",
        "`Vu chez`",
        "There is no `Match` state",
    ]:
        assert text in guide_text


def test_kanto_nostalgia_badges_are_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")

    for text in [readme, features]:
        assert "Souvenirs de Kanto" in text
        assert "Rouge/Bleu" in text
        assert "champions d'arene" in text
        assert "Conseil 4" in text
        assert "rival" in text
        assert "Or/Argent" in text
        assert "Johto" in text
        assert "Kanto" in text
        assert "Silver" in text
        assert "Rubis/Saphir" in text
        assert "Diamant/Perle" in text
        assert "Noir/Blanc" in text
        assert "Noir 2/Blanc 2" in text
        assert "X/Y" in text
        assert "Soleil/Lune" in text
        assert "Epee/Bouclier" in text
        assert "Ecarlate/Violet" in text
        assert "sans remakes" in text


def test_badge_side_quest_v1_is_documented_publicly() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")

    for text in [readme, features]:
        assert "badge gallery" in text
        assert "sealed badges" in text
        assert "Stat" in text


def test_public_story_centers_exploration_trainers_and_pokedex_completion() -> None:
    landing = (DOCS / "index.html").read_text(encoding="utf-8").lower()
    docs_i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8").lower()
    landing_bundle = f"{landing}\n{docs_i18n}"
    readme = (ROOT / "README.md").read_text(encoding="utf-8").lower()

    assert '<html lang="fr"' in landing
    assert "le pokédex des collectionneurs qui préfèrent les vrais échanges au cloud" in landing
    assert "le pokédex des collectionneurs qui préfèrent les vrais échanges au cloud" in readme
    assert "comme avant" in landing

    for text in [
        "explore",
        "meet other trainers",
        "complete your pokedex",
        "local-first",
    ]:
        assert text in landing_bundle
        assert text in readme


def test_public_landing_supports_fr_en_switch() -> None:
    landing = (DOCS / "index.html").read_text(encoding="utf-8")
    i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")

    assert '<script src="assets/i18n.js" defer></script>' in landing
    assert 'data-i18n-locale="fr"' in landing
    assert 'data-i18n-locale="en"' in landing
    assert 'data-i18n="landing.hero.title"' in landing
    assert "Le Pokédex des collectionneurs qui préfèrent les vrais échanges au cloud." in landing
    assert "The collector Pokédex for people who prefer real trades to the cloud." in i18n
    assert "pokevault_locale" in i18n


def test_readme_documents_language_switch() -> None:
    text = (ROOT / "README.md").read_text(encoding="utf-8")

    assert "French by default" in text
    assert "FR/EN" in text


def test_configurable_binder_layouts_are_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    docs_i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")

    assert "10 feuillets" in readme
    assert "10 feuillets" in docs_i18n
    assert "10 sheets" in features
    assert "10 feuillets" not in features

    for text in [readme, features]:
        assert "3×3" in text
        assert "Kanto 1" in text
        assert "Images / sprites" in text

    assert "Classeurs > Réglages" not in readme

    assert "Settings > Images / sprites" in features
    assert "compact family rows such as Spoink / Grumpig / Spinda" in features
    for text in [
        "Réglages > Images / sprites",
        "Groret",
    ]:
        assert text not in features

    assert "Spoink" in readme
    assert "Spinda" in readme
    assert "alignment_empty" in readme

    assert "Planificateur de classeurs physiques" in docs_i18n
    assert "Réglages > Images / sprites" in docs_i18n
    assert "Settings > Images / sprites" in docs_i18n
    assert "`Réglages > Images / sprites`" not in docs_i18n


def test_large_ring_binder_mode_is_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    docs_i18n = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")
    backlog = (DOCS / "V1_1_POKEDEX_FIRST.md").read_text(encoding="utf-8")

    def assert_large_binder_contract(text: str) -> None:
        normalized = " ".join(text.lower().split())
        assert "grand classeur 3" in normalized or "large 3" in normalized
        assert (
            "one physical binder" in normalized
            or "one ring binder" in normalized
            or "un gros classeur" in normalized
        )
        assert (
            "region sections" in normalized
            or "internal region sections" in normalized
            or "régions" in normalized
        )
        assert "recto" in normalized or "sheet front" in normalized
        assert "compact" in normalized
        assert "regional forms" in normalized or "formes régionales" in normalized
        assert "form region" in normalized or "région de leur forme" in normalized
        assert (
            "auto" in normalized
            or "calculates capacity" in normalized
            or "calculated capacity" in normalized
        )
        assert "10 spare sheets" in normalized or "10 feuillets libres" in normalized

    def docs_i18n_message(locale: str, key: str) -> str:
        marker = f"    {locale}: {{"
        block = docs_i18n.split(marker, 1)[1]
        if locale == "fr":
            block = block.split("\n    },\n    en:", 1)[0]
        else:
            block = block.split("\n    }\n  };", 1)[0]
        return block.split(f'"{key}": "', 1)[1].split('",', 1)[0]

    for text in [readme, features, backlog]:
        assert_large_binder_contract(text)

    assert_large_binder_contract(docs_i18n)

    assert_large_binder_contract(docs_i18n_message("fr", "features.binders.text"))
    assert_large_binder_contract(docs_i18n_message("en", "features.binders.text"))
