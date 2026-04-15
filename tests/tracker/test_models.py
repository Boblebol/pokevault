"""tracker.models — Pydantic v2 (BaseModel, ConfigDict)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from tracker.models import CollectionProgress, ProgressPutBody, ProgressSaveResponse


def test_collection_progress_defaults() -> None:
    p = CollectionProgress()
    assert p.version == 1
    assert p.caught == {}


def test_collection_progress_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        CollectionProgress(version=1, caught={}, unknown=1)  # type: ignore[call-arg]


def test_progress_put_body() -> None:
    b = ProgressPutBody(caught={"a": True})
    assert b.caught == {"a": True}


def test_progress_put_body_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        ProgressPutBody(caught={}, x=1)  # type: ignore[call-arg]


def test_progress_save_response_validation() -> None:
    r = ProgressSaveResponse(ok=True, saved=0)
    assert r.saved == 0
    with pytest.raises(ValidationError):
        ProgressSaveResponse(ok=True, saved=-1)
