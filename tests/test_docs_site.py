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

NAV_LABELS = ["Features", "Install", "Architecture", "Roadmap", "Contribute", "GitHub"]


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


def test_open_source_security_policy_exists() -> None:
    security = ROOT / "SECURITY.md"
    assert security.is_file()
    text = security.read_text(encoding="utf-8")
    assert "Security Policy" in text
    assert "GitHub Security Advisories" in text
