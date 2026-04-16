"""Application FastAPI — assemblage routes et fichiers statiques."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from tracker.api.controllers import binder_router, export_router, progress_router
from tracker.config import TrackerSettings, get_settings


def create_app(settings: TrackerSettings | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(
        title="pokevault",
        version="0.1.0",
        description="Local-first Pokémon collection tracker API.",
    )

    app.include_router(progress_router)
    app.include_router(binder_router)
    app.include_router(export_router)

    data_dir = s.data_dir.resolve()
    web_dir = s.web_dir.resolve()
    if not web_dir.is_dir():
        msg = f"Dossier web introuvable : {web_dir}"
        raise RuntimeError(msg)

    pokedex_file = s.pokedex_path.resolve()

    @app.get("/data/pokedex.json")
    def serve_pokedex_json() -> FileResponse:
        if not pokedex_file.is_file():
            raise HTTPException(status_code=404, detail="pokedex.json absent")
        return FileResponse(
            pokedex_file,
            media_type="application/json",
            headers={"Cache-Control": "max-age=86400, immutable"},
        )

    app.mount(
        "/data",
        StaticFiles(directory=str(data_dir), check_dir=True),
        name="data",
    )
    app.mount(
        "/",
        StaticFiles(directory=str(web_dir), html=True, check_dir=True),
        name="web",
    )

    return app


# Instance par défaut pour uvicorn : `uvicorn tracker.app:app`
_settings = get_settings()
app: FastAPI = create_app(_settings)
