"""LIFF id_token 驗證。

LINE 的 id_token 是 JWT (RS256)，可以用兩種方式驗：

  (A) 拿 token 去打 https://api.line.me/oauth2/v2.1/verify
      → 簡單，每次都打 LINE API，有 rate limit 風險
  (B) 用 LINE 的 JWKS（https://api.line.me/oauth2/v2.1/certs）在本地驗簽
      → 較快，需要快取 JWKS，需要處理 key rotation

MVP 用 (A)，未來流量大再換 (B)。

回傳 dict 含這些欄位（LINE 官方）:
  sub  → LINE user ID
  name → display name (若使用者授權)
  picture → picture URL (若使用者授權)
  aud  → channel_id
  exp / iat
"""
from __future__ import annotations

import httpx

from app.config import get_settings

VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify"


class LineTokenError(Exception):
    """id_token 驗證失敗（過期、被竄改、aud 不符等）。"""


async def verify_id_token(id_token: str) -> dict:
    """向 LINE 換取已驗證的 token claims。

    要點：
    - 需要傳 client_id（= LIFF channel ID），LINE 會驗 aud 是否相符
    - 若 client_id 未設定，dev 環境給警告但仍嘗試（方便本地測試）
    """
    settings = get_settings()
    client_id = settings.liff_channel_id

    if not client_id:
        # dev 環境 fallback：不檢查 aud，但仍要驗 token 本身有效
        # 正式環境必須有 client_id
        if settings.app_env != "dev":
            raise LineTokenError("liff_channel_id is not configured")

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(
            VERIFY_ENDPOINT,
            data={"id_token": id_token, "client_id": client_id} if client_id else {"id_token": id_token},
        )

    if resp.status_code != 200:
        try:
            err = resp.json().get("error_description", resp.text)
        except Exception:
            err = resp.text
        raise LineTokenError(f"LINE verify failed: {err}")

    claims = resp.json()
    sub = claims.get("sub")
    if not sub:
        raise LineTokenError("missing sub in claims")

    return claims
