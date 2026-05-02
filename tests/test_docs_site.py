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


def test_web_app_supports_fr_en_switch_on_main_surfaces() -> None:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    i18n = (WEB / "i18n.js").read_text(encoding="utf-8")

    assert '<script src="/i18n.js" defer></script>' in index
    assert 'data-i18n-locale="fr"' in index
    assert 'data-i18n-locale="en"' in index
    for key in [
        "app.collection.title",
        "app.stats.title",
        "app.binders.title",
        "app.trainers.title",
        "app.print.title",
        "app.settings.title",
        "app.onboarding.title",
        "app.shortcuts.title",
        "app.drawer.kicker",
    ]:
        assert f'data-i18n="{key}"' in index
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
    assert "Trainer Cards" in readme
    assert "data/trainer-contacts.json" in readme
    assert "/api/trainers" in readme
    assert "searchable local contact book" in readme
    assert "Trainer Cards" in features
    assert "searchable local contact book" in features
    assert "Dresseurs" in roadmap
    assert "trainer-contacts.json" in architecture


def test_trade_state_model_is_documented_publicly() -> None:
    guide_text = (DOCS / "TRAINER_CONTACTS.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    roadmap = (DOCS / "roadmap.html").read_text(encoding="utf-8")

    for text in [guide_text, readme, features, roadmap]:
        assert "Cherche" in text
        assert "Double" in text
    assert "Vu chez" in guide_text
    assert "Match" in guide_text


def test_trainer_contacts_document_local_trade_workflow() -> None:
    guide_text = (DOCS / "TRAINER_CONTACTS.md").read_text(encoding="utf-8")
    for text in [
        "Create your Trainer Card",
        "Import a received card",
        "Update a contact",
        "Find a trade",
        "without an account",
        "`Vu chez`",
        "`Match`",
    ]:
        assert text in guide_text


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

    for text in [readme, features]:
        assert "10 feuillets" in text
        assert "3×3" in text
        assert "Kanto 1" in text
        assert "Familles" in text
