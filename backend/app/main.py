from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import create_all
from .keitaro import KeitaroAPIError
from .routers import campaigns, health, meta, offers

settings = get_settings()
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.auto_create_tables:
        create_all()
    if settings.seed_offer_cache_on_startup and settings.keitaro_api_key:
        # Optional warm-up. Failures must never prevent the app from starting.
        try:
            from .database import SessionLocal
            from .keitaro import KeitaroClient
            from .services.offers import sync_offers

            db = SessionLocal()
            try:
                await sync_offers(db, KeitaroClient())
            finally:
                db.close()
        except Exception:
            pass
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "FastAPI wrapper around the Keitaro Admin API: campaign creator and "
        "stream/offer editor with live statistics."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(KeitaroAPIError)
async def keitaro_exception_handler(_request, exc: KeitaroAPIError):
    status_code = (
        exc.status_code
        if exc.status_code and 400 <= exc.status_code < 500
        else 502
    )
    payload = {"detail": exc.message, "source": "keitaro"}
    if settings.debug and exc.details is not None:
        payload["keitaro_details"] = exc.details
    return JSONResponse(status_code=status_code, content=payload)


api_prefix = "/api"
app.include_router(health.router, prefix=api_prefix)
app.include_router(meta.router, prefix=api_prefix)
app.include_router(campaigns.router, prefix=api_prefix)
app.include_router(offers.router, prefix=api_prefix)


@app.get("/api", include_in_schema=False)
def api_root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/api/health",
    }


if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
    assets_dir = FRONTEND_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path in {"docs", "openapi.json", "redoc"}:
            raise HTTPException(status_code=404)
        candidate = (FRONTEND_DIR / full_path).resolve()
        if candidate.is_file() and FRONTEND_DIR in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root():
        return {
            "name": settings.app_name,
            "message": "Frontend is not built. Use the Vite dev server or build frontend/dist.",
            "docs": "/docs",
        }
