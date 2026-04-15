"""Point d'entrée du serveur tracker (uvicorn)."""

from __future__ import annotations

import uvicorn

from tracker.config import get_settings


def run() -> None:
    s = get_settings()
    uvicorn.run(
        "tracker.app:app",
        host=s.host,
        port=s.port,
        factory=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
