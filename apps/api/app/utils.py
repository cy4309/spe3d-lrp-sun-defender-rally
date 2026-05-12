"""小工具集合 — 兌換碼產生、session token、圖片儲存。"""
from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import jwt

from app.config import get_settings

# 避開易混淆字：去掉 0/O/o/1/I/l
REDEEM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def generate_redeem_code(length: int = 8) -> str:
    """產生 8 碼英數兌換碼（無 0/O/1/I/L 等易混淆字）。"""
    return "".join(secrets.choice(REDEEM_CODE_ALPHABET) for _ in range(length))


# --- session token（API 端用，把驗過的 LINE 身份簽進 JWT 給後續 request）---
def issue_session_token(line_user_id: str, user_id: UUID, ttl_seconds: int = 3600 * 24) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "iss": "lrp-anthelios-api",
        "sub": str(user_id),
        "line_user_id": line_user_id,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(payload, settings.internal_api_token, algorithm="HS256")


def decode_session_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.internal_api_token, algorithms=["HS256"])


# --- image storage ----------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def save_image(raw: bytes, suffix: str = ".jpg") -> tuple[str, str]:
    """儲存原始檔到 storage path，回傳 (相對路徑, sha256)。

    路徑格式：{IMAGE_STORAGE_PATH}/inputs/yyyy/mm/dd/{sha8}.{ext}
    回傳的相對路徑用於存進 DB。
    """
    settings = get_settings()
    sha = hashlib.sha256(raw).hexdigest()
    now = now_utc()
    rel = f"inputs/{now:%Y/%m/%d}/{sha[:16]}{suffix}"
    full = Path(settings.image_storage_path) / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    if not full.exists():
        full.write_bytes(raw)
    return rel, sha


def image_url(relative_path: str) -> str:
    settings = get_settings()
    return f"{settings.image_base_url.rstrip('/')}/{relative_path.lstrip('/')}"


def build_qr_payload(code: str) -> str:
    """機台 QR 內容 — 用一個帶 code 的 deep link。"""
    settings = get_settings()
    return f"{settings.app_base_url}/r/{code}"
