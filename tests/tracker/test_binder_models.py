"""tracker.binder_models — validation Pydantic des payloads classeur."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload


def test_config_defaults() -> None:
    c = BinderConfigPayload()
    assert c.version == 1
    assert c.convention == "sheet_recto_verso"
    assert c.binders == []
    assert c.form_rules == []


def test_config_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        BinderConfigPayload(version=1, unknown_key="no")  # type: ignore[call-arg]


def test_config_version_must_be_one() -> None:
    with pytest.raises(ValidationError):
        BinderConfigPayload(version=2)  # type: ignore[arg-type]


def test_config_model_validate_roundtrip() -> None:
    d = {
        "version": 1,
        "convention": "sheet_recto_verso",
        "binders": [{"id": "main", "name": "A"}],
        "form_rules": [{"id": "fr", "include_mega": True}],
    }
    c = BinderConfigPayload.model_validate(d)
    assert c.binders[0]["id"] == "main"
    assert c.form_rules[0]["include_mega"] is True


def test_placements_defaults() -> None:
    p = BinderPlacementsPayload()
    assert p.version == 1
    assert p.by_binder == {}


def test_placements_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        BinderPlacementsPayload(version=1, extra="x")  # type: ignore[call-arg]


def test_placements_nested_structure() -> None:
    p = BinderPlacementsPayload(
        version=1,
        by_binder={"b1": {"slug-1": {"page": 0, "slot": 2}}},
    )
    assert p.by_binder["b1"]["slug-1"]["slot"] == 2
