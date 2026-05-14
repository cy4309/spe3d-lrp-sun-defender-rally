"""FastAPI app entrypoint."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, health, internal, jobs, machine, me
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="LRP Anthelios LIFF API",
    version="0.1.0",
    debug=settings.app_debug,
)

_dev_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dev_origins if settings.app_debug else [],
    allow_origin_regex=r"https://.*\.(ngrok-free\.app|trycloudflare\.com|pages\.dev)" if settings.app_debug else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Access-Token"],
)

# Routes ---------------------------------------------------------------
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(me.router, prefix="/api/v1/me", tags=["me"])
app.include_router(machine.router, prefix="/api/v1/machine", tags=["machine"])
app.include_router(internal.router, prefix="/api/v1/internal", tags=["internal"])

# 靜態圖片（dev only — 正式環境用 CDN / signed URL）---------------------
image_dir = Path(settings.image_storage_path)
image_dir.mkdir(parents=True, exist_ok=True)
app.mount("/img", StaticFiles(directory=str(image_dir)), name="img")


@app.get("/")
async def root():
    return {"service": "lrp-anthelios-api", "env": settings.app_env, "docs": "/docs"}
