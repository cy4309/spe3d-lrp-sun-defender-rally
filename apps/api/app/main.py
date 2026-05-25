"""FastAPI app entrypoint."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import admin_stats, analytics, auth, health, internal, jobs, machine, me, webhook
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
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(webhook.router, prefix="/api/v1/webhook", tags=["webhook"])
if settings.app_debug:
    app.include_router(admin_stats.router, prefix="/api/v1/admin", tags=["admin"])

# 靜態圖片（dev only — 正式環境用 CDN / signed URL）---------------------
image_dir = Path(settings.image_storage_path)
image_dir.mkdir(parents=True, exist_ok=True)
app.mount("/img", StaticFiles(directory=str(image_dir)), name="img")

# Dev 工具頁（PM 統計儀表板等）--------------------------------------------
# Docker：compose 將 ./tools 掛到 /app/tools；本機 uvicorn 則用 repo 根目錄的 tools/
if settings.app_debug:
    _api_root = Path(__file__).resolve().parent.parent  # apps/api（容器內為 /app）
    _tools_candidates = [_api_root / "tools", _api_root.parent.parent / "tools"]
    _tools_dir = next((p for p in _tools_candidates if p.is_dir()), None)
    if _tools_dir is not None:
        app.mount("/tools", StaticFiles(directory=str(_tools_dir), html=True), name="tools")


@app.get("/")
async def root():
    return {"service": "lrp-anthelios-api", "env": settings.app_env, "docs": "/docs"}
