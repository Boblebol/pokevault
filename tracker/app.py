"""Application FastAPI — assemblage routes et fichiers statiques."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from tracker.api.controllers import (
    badge_router,
    binder_router,
    export_router,
    health_router,
    profile_router,
    progress_router,
    trainer_contact_router,
)
from tracker.config import TrackerSettings, get_settings
from tracker.version import APP_VERSION


def create_app(settings: TrackerSettings | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(
        title="pokevault",
        version=APP_VERSION,
        description="Local-first Pokémon collection tracker API.",
    )

    app.include_router(progress_router)
    app.include_router(binder_router)
    app.include_router(badge_router)
    app.include_router(profile_router)
    app.include_router(trainer_contact_router)
    app.include_router(export_router)
    app.include_router(health_router)

    data_dir = s.data_dir.resolve()
    web_dir = s.web_dir.resolve()
    if not web_dir.is_dir():
        msg = f"Dossier web introuvable : {web_dir}"
        raise RuntimeError(msg)

    public_json_files = {
        "pokedex.json": s.pokedex_path.resolve(),
        "narrative-tags.json": data_dir / "narrative-tags.json",
        "evolution-families.json": data_dir / "evolution-families.json",
        "evolution-family-overrides.json": data_dir / "evolution-family-overrides.json",
        "game-pokedexes.json": data_dir / "game-pokedexes.json",
    }

    def serve_public_json(filename: str) -> FileResponse:
        json_file = public_json_files[filename]
        if not json_file.is_file():
            raise HTTPException(status_code=404, detail=f"{filename} absent")
        return FileResponse(
            json_file,
            media_type="application/json",
            headers={"Cache-Control": "max-age=86400, immutable"},
        )

    @app.get("/data/pokedex.json")
    def serve_pokedex_json() -> FileResponse:
        return serve_public_json("pokedex.json")

    @app.get("/data/narrative-tags.json")
    def serve_narrative_tags_json() -> FileResponse:
        return serve_public_json("narrative-tags.json")

    @app.get("/data/evolution-families.json")
    def serve_evolution_families_json() -> FileResponse:
        return serve_public_json("evolution-families.json")

    @app.get("/data/evolution-family-overrides.json")
    def serve_evolution_family_overrides_json() -> FileResponse:
        return serve_public_json("evolution-family-overrides.json")

    @app.get("/data/game-pokedexes.json")
    def serve_game_pokedexes_json() -> FileResponse:
        return serve_public_json("game-pokedexes.json")

    @app.middleware("http")
    async def disable_web_cache(request, call_next):
        """Toujours servir la derniere version des assets web en local."""
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/api/") or path.startswith("/data/"):
            return response
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    images_dir = data_dir / "images"
    if images_dir.is_dir():
        app.mount(
            "/data/images",
            StaticFiles(directory=str(images_dir), check_dir=True),
            name="data-images",
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
