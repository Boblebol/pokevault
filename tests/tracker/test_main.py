"""tracker.main et tracker.__main__ — point d'entrée."""

from __future__ import annotations

import runpy
import sys
from unittest import mock


def test_run_invokes_uvicorn() -> None:
    with mock.patch("tracker.main.uvicorn.run") as uv_run:
        from tracker.main import run

        run()
    uv_run.assert_called_once()
    args, kwargs = uv_run.call_args
    assert args[0] == "tracker.app:app"
    assert kwargs["factory"] is False
    assert "host" in kwargs and "port" in kwargs


def test_main_module_cli() -> None:
    sys.modules.pop("tracker.main", None)
    with mock.patch("tracker.main.uvicorn.run"):
        runpy.run_module("tracker.main", run_name="__main__")


def test_package_main_module() -> None:
    sys.modules.pop("tracker.__main__", None)
    with mock.patch("tracker.main.uvicorn.run"):
        runpy.run_module("tracker.__main__", run_name="__main__")
