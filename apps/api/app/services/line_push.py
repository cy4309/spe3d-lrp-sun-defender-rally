"""LINE Messaging API — OA push（結果圖、抽獎通知等）。"""
from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


async def push_messages(line_user_id: str, messages: list[dict]) -> tuple[bool, str | None]:
    """Push 訊息至指定 LINE user。回傳 (成功, 錯誤訊息)。"""
    token = get_settings().line_channel_access_token.strip()
    if not token:
        return False, "line_channel_access_token_not_configured"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {"to": line_user_id, "messages": messages}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(LINE_PUSH_URL, headers=headers, json=body)
    except httpx.HTTPError as exc:
        logger.warning("LINE push HTTP error: %s", exc)
        return False, str(exc)

    if resp.status_code == 200:
        return True, None

    err = f"line_api_{resp.status_code}: {resp.text[:500]}"
    logger.warning("LINE push failed: %s", err)
    return False, err
