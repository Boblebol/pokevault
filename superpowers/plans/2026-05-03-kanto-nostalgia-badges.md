# Kanto Nostalgia Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add Red/Blue Kanto trainer-team badges for Gym Leaders, Elite Four, Champion and rival final-team variants.

**Architecture:** Extend the existing `BadgeService` catalog with a second badge rule type: captured-team requirements. Keep the public `/api/badges` response unchanged by mapping trainer-team progress into the existing `current`, `target`, `percent` and `hint` fields. Use data-driven internal definitions so later regions can add teams without changing the API.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, pytest, ruff, vanilla JavaScript badge UI.

---

## File Map

- `tracker/services/badge_service.py`: add captured-team badge definitions, progress logic and Kanto Red/Blue catalog entries.
- `tests/tracker/test_badge_service.py`: add service-level TDD coverage for Kanto badges, duplicate species and rival variants.
- `tests/tracker/test_badge_api.py`: add API-level coverage proving trainer badges flow through `/api/badges`.
- `README.md` and `docs/features.html`: mention nostalgic Kanto badge coverage after implementation.

## Task 1: Captured-Team Badge Engine

**Files:**
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tracker/services/badge_service.py`

- [x] **Step 1: Write failing service tests**

Add these tests to `tests/tracker/test_badge_service.py`:

```python
def _catch_all(progress: ProgressService, slugs: list[str]) -> None:
    for slug in slugs:
        progress.patch_status(ProgressStatusPatch(slug=slug, state="caught"))


def test_kanto_badges_are_in_catalog(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    ids = {badge.id for badge in badge_service.state().catalog}

    assert {
        "kanto_brock",
        "kanto_misty",
        "kanto_lt_surge",
        "kanto_erika",
        "kanto_koga",
        "kanto_sabrina",
        "kanto_blaine",
        "kanto_giovanni",
        "kanto_lorelei",
        "kanto_bruno",
        "kanto_agatha",
        "kanto_lance",
        "kanto_rival_champion",
    } <= ids


def test_kanto_gym_badge_requires_full_caught_team(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0074-geodude", state="caught"))

    state = badge_service.state()
    by_id = {badge.id: badge for badge in state.catalog}

    assert by_id["kanto_brock"].unlocked is False
    assert by_id["kanto_brock"].current == 1
    assert by_id["kanto_brock"].target == 2
    assert by_id["kanto_brock"].hint == "Encore 1 Pokemon de l'equipe à capturer."

    progress.patch_status(ProgressStatusPatch(slug="0095-onix", state="caught"))
    newly = badge_service.sync_unlocked()

    assert "kanto_brock" in newly


def test_kanto_team_badges_count_duplicate_species_once(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    _catch_all(progress, ["0109-koffing", "0089-muk"])

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_koga"].unlocked is False
    assert by_id["kanto_koga"].current == 2
    assert by_id["kanto_koga"].target == 3

    progress.patch_status(ProgressStatusPatch(slug="0110-weezing", state="caught"))

    assert "kanto_koga" in badge_service.sync_unlocked()
```

- [x] **Step 2: Run tests and verify red**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py::test_kanto_badges_are_in_catalog tests/tracker/test_badge_service.py::test_kanto_gym_badge_requires_full_caught_team tests/tracker/test_badge_service.py::test_kanto_team_badges_count_duplicate_species_once -q
```

Expected: FAIL because `kanto_*` badge ids do not exist yet.

- [x] **Step 3: Implement captured-team definitions**

In `tracker/services/badge_service.py`, extend `BadgeDef` with optional team requirements:

```python
@dataclass(frozen=True)
class BadgeDef:
    """Internal badge definition — ``id`` is public & stable."""

    id: str
    title: str
    description: str
    metric: str
    target: int
    hint_unit: str
    required_slug_sets: tuple[frozenset[str], ...] = ()

    def progress(
        self,
        progress: CollectionProgress,
        cards: list[Card],
    ) -> BadgeProgress:
        if self.required_slug_sets:
            return _team_badge_progress(self.required_slug_sets, progress, self.hint_unit)
        current = _metric_value(self.metric, progress, cards)
        return BadgeProgress(
            current=max(0, min(current, self.target)),
            target=self.target,
            hint_unit=self.hint_unit,
        )
```

Add helpers near the metric helpers:

```python
def _caught_slugs(progress: CollectionProgress) -> set[str]:
    return {slug for slug, status in progress.statuses.items() if status.state == "caught"}


def _team_badge_progress(
    required_slug_sets: tuple[frozenset[str], ...],
    progress: CollectionProgress,
    hint_unit: str,
) -> BadgeProgress:
    caught = _caught_slugs(progress)
    best_current = 0
    best_target = 1
    best_percent = -1.0
    for required in required_slug_sets:
        target = max(1, len(required))
        current = len(required & caught)
        percent = current / target
        if percent > best_percent or (percent == best_percent and target < best_target):
            best_current = current
            best_target = target
            best_percent = percent
    return BadgeProgress(
        current=best_current,
        target=best_target,
        hint_unit=hint_unit,
    )
```

Add a small factory:

```python
def _team_badge(
    badge_id: str,
    title: str,
    description: str,
    required_slug_sets: tuple[tuple[str, ...], ...],
) -> BadgeDef:
    return BadgeDef(
        badge_id,
        title,
        description,
        "team",
        1,
        "Pokemon de l'equipe à capturer",
        tuple(frozenset(slugs) for slugs in required_slug_sets),
    )
```

- [x] **Step 4: Add Kanto badge definitions**

Append these entries to `BADGES`:

```python
    _team_badge(
        "kanto_brock",
        "Pierre - Roche de Kanto",
        "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
        (("0074-geodude", "0095-onix"),),
    ),
    _team_badge(
        "kanto_misty",
        "Ondine - Cascade",
        "Capturer l'equipe d'Ondine dans Pokemon Rouge/Bleu.",
        (("0120-staryu", "0121-starmie"),),
    ),
    _team_badge(
        "kanto_lt_surge",
        "Major Bob - Foudre",
        "Capturer l'equipe de Major Bob dans Pokemon Rouge/Bleu.",
        (("0100-voltorb", "0025-pikachu", "0026-raichu"),),
    ),
    _team_badge(
        "kanto_erika",
        "Erika - Prisme",
        "Capturer l'equipe d'Erika dans Pokemon Rouge/Bleu.",
        (("0071-victreebel", "0114-tangela", "0045-vileplume"),),
    ),
    _team_badge(
        "kanto_koga",
        "Koga - Ame",
        "Capturer l'equipe de Koga dans Pokemon Rouge/Bleu.",
        (("0109-koffing", "0089-muk", "0109-koffing", "0110-weezing"),),
    ),
    _team_badge(
        "kanto_sabrina",
        "Morgane - Marais",
        "Capturer l'equipe de Morgane dans Pokemon Rouge/Bleu.",
        (("0064-kadabra", "0122-mr-mime", "0049-venomoth", "0065-alakazam"),),
    ),
    _team_badge(
        "kanto_blaine",
        "Auguste - Volcan",
        "Capturer l'equipe d'Auguste dans Pokemon Rouge/Bleu.",
        (("0058-growlithe", "0077-ponyta", "0078-rapidash", "0059-arcanine"),),
    ),
    _team_badge(
        "kanto_giovanni",
        "Giovanni - Terre",
        "Capturer l'equipe de Giovanni dans Pokemon Rouge/Bleu.",
        (("0111-rhyhorn", "0051-dugtrio", "0031-nidoqueen", "0034-nidoking", "0112-rhydon"),),
    ),
    _team_badge(
        "kanto_lorelei",
        "Conseil 4 - Olga",
        "Capturer l'equipe d'Olga au Plateau Indigo Rouge/Bleu.",
        (("0087-dewgong", "0091-cloyster", "0080-slowbro", "0124-jynx", "0131-lapras"),),
    ),
    _team_badge(
        "kanto_bruno",
        "Conseil 4 - Aldo",
        "Capturer l'equipe d'Aldo au Plateau Indigo Rouge/Bleu.",
        (("0095-onix", "0107-hitmonchan", "0106-hitmonlee", "0095-onix", "0068-machamp"),),
    ),
    _team_badge(
        "kanto_agatha",
        "Conseil 4 - Agatha",
        "Capturer l'equipe d'Agatha au Plateau Indigo Rouge/Bleu.",
        (("0094-gengar", "0042-golbat", "0093-haunter", "0024-arbok", "0094-gengar"),),
    ),
    _team_badge(
        "kanto_lance",
        "Conseil 4 - Peter",
        "Capturer l'equipe de Peter au Plateau Indigo Rouge/Bleu.",
        (("0130-gyarados", "0148-dragonair", "0148-dragonair", "0142-aerodactyl", "0149-dragonite"),),
    ),
    _team_badge(
        "kanto_rival_champion",
        "Maitre de la Ligue - Rival",
        "Capturer une equipe finale possible du rival dans Pokemon Rouge/Bleu.",
        (
            ("0018-pidgeot", "0065-alakazam", "0112-rhydon", "0130-gyarados", "0103-exeggutor", "0006-charizard"),
            ("0018-pidgeot", "0065-alakazam", "0112-rhydon", "0059-arcanine", "0103-exeggutor", "0009-blastoise"),
            ("0018-pidgeot", "0065-alakazam", "0112-rhydon", "0130-gyarados", "0059-arcanine", "0003-venusaur"),
        ),
    ),
```

- [x] **Step 5: Run service tests**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py -q
```

Expected: PASS.

## Task 2: Rival Variant Progress and Monotonic Behavior

**Files:**
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tracker/services/badge_service.py` only if tests expose a defect.

- [x] **Step 1: Write rival and monotonic tests**

Add:

```python
def test_kanto_rival_badge_unlocks_with_any_final_team_variant(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0018-pidgeot",
            "0065-alakazam",
            "0112-rhydon",
            "0059-arcanine",
            "0103-exeggutor",
            "0009-blastoise",
        ],
    )

    newly = set(badge_service.sync_unlocked())

    assert "kanto_rival_champion" in newly


def test_kanto_rival_progress_uses_closest_variant(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0018-pidgeot",
            "0065-alakazam",
            "0112-rhydon",
            "0059-arcanine",
            "0103-exeggutor",
        ],
    )

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_rival_champion"].current == 5
    assert by_id["kanto_rival_champion"].target == 6
    assert by_id["kanto_rival_champion"].percent == 83


def test_kanto_trainer_unlocks_are_monotonic(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    _catch_all(progress, ["0074-geodude", "0095-onix"])
    badge_service.sync_unlocked()
    progress.patch_status(ProgressStatusPatch(slug="0095-onix", state="not_met"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_brock"].unlocked is True
    assert by_id["kanto_brock"].current == 2
    assert by_id["kanto_brock"].target == 2
    assert by_id["kanto_brock"].percent == 100
```

- [x] **Step 2: Run tests**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py::test_kanto_rival_badge_unlocks_with_any_final_team_variant tests/tracker/test_badge_service.py::test_kanto_rival_progress_uses_closest_variant tests/tracker/test_badge_service.py::test_kanto_trainer_unlocks_are_monotonic -q
```

Expected: PASS after Task 1.

## Task 3: API Coverage

**Files:**
- Modify: `tests/tracker/test_badge_api.py`

- [x] **Step 1: Write API test**

Add:

```python
def test_badges_endpoint_exposes_kanto_trainer_badges(tmp_path: Path) -> None:
    app, client, progress, _cards = _app(tmp_path)
    try:
        progress.patch_status(ProgressStatusPatch(slug="0074-geodude", state="caught"))
        progress.patch_status(ProgressStatusPatch(slug="0095-onix", state="caught"))

        body = client.get("/api/badges").json()
        by_id = {badge["id"]: badge for badge in body["catalog"]}

        assert by_id["kanto_brock"] == {
            "id": "kanto_brock",
            "title": "Pierre - Roche de Kanto",
            "description": "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
            "unlocked": True,
            "current": 2,
            "target": 2,
            "percent": 100,
            "hint": "Badge obtenu.",
        }
        assert "kanto_brock" in body["unlocked"]
    finally:
        app.dependency_overrides.clear()
```

- [x] **Step 2: Run API tests**

Run:

```bash
uv run pytest tests/tracker/test_badge_api.py -q
```

Expected: PASS.

## Task 4: Product Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `tests/test_docs_site.py`

- [x] **Step 1: Write docs test**

Add to `tests/test_docs_site.py`:

```python
def test_kanto_nostalgia_badges_are_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")

    for text in [readme, features]:
        assert "Souvenirs de Kanto" in text
        assert "Rouge/Bleu" in text
        assert "champions d'arene" in text
        assert "Conseil 4" in text
        assert "rival" in text
```

- [x] **Step 2: Run docs test and verify red**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_kanto_nostalgia_badges_are_documented -q
```

Expected: FAIL until docs are updated.

- [x] **Step 3: Update docs**

In `README.md`, update the badge bullet near feature summary to mention:

```markdown
- Shows collection stats, badge progress and focus recommendations, including
  "Souvenirs de Kanto" badges for Rouge/Bleu champions d'arene, Conseil 4,
  Maitre de la Ligue and rival teams.
```

In `docs/features.html`, update the Badges and stats feature paragraph to include:

```html
Track global, regional and badge progress with transparent next-action recommendations, including Souvenirs de Kanto badges for Rouge/Bleu champions d'arene, Conseil 4 and rival teams.
```

- [x] **Step 4: Run docs tests**

Run:

```bash
uv run pytest tests/test_docs_site.py -q
```

Expected: PASS.

## Task 5: Final Verification and Commit

**Files:**
- All modified files.

- [x] **Step 1: Run focused tests**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py tests/test_docs_site.py -q
```

Expected: PASS.

- [x] **Step 2: Run full gate**

Run:

```bash
make check
git diff --check
```

Expected: PASS.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add tracker/services/badge_service.py tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py README.md docs/features.html tests/test_docs_site.py superpowers/plans/2026-05-03-kanto-nostalgia-badges.md
git commit -m "feat: add kanto nostalgia badges"
```

Expected: commit contains code, tests, docs and plan. Do not add `AGENTS.md`.
