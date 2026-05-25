"""FastAPI dependencies — 認證、撈當前活動、撈當前 user_campaign。"""
from __future__ import annotations

import secrets
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import Campaign, LineUser, UserCampaign
from app.utils import decode_session_token


# --- LIFF session token（前端帶 Authorization: Bearer <token>）-----------
async def current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> LineUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")

    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_session_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="session_expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid_session_token")

    user_id = UUID(claims["sub"])
    user = await session.get(LineUser, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user


# --- 機台 token -----------------------------------------------------------
async def current_machine(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """回傳 machine_id（從 token 解出）。MVP 用簡單共享 secret + claim machine_id。"""
    settings = get_settings()
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, settings.machine_api_token_signing_key, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid_machine_token")
    machine_id = claims.get("machine_id")
    if not machine_id:
        raise HTTPException(status_code=401, detail="missing_machine_id")
    return machine_id


# --- internal API token（worker / 排程用）--------------------------------
async def verify_internal(
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> None:
    settings = get_settings()
    if not x_internal_token or not secrets.compare_digest(x_internal_token, settings.internal_api_token):
        raise HTTPException(status_code=403, detail="invalid_internal_token")


async def verify_partner_webhook(
    x_partner_token: Annotated[str | None, Header(alias="X-Partner-Token")] = None,
) -> None:
    settings = get_settings()
    if not settings.partner_webhook_token:
        raise HTTPException(status_code=503, detail="partner_webhook_not_configured")
    if not x_partner_token or not secrets.compare_digest(
        x_partner_token, settings.partner_webhook_token
    ):
        raise HTTPException(status_code=403, detail="invalid_partner_token")


# --- 撈當前活動（active 且時間在範圍內）----------------------------------
async def campaign_by_code(code: str, session: AsyncSession) -> Campaign:
    stmt = select(Campaign).where(Campaign.code == code)
    res = await session.execute(stmt)
    campaign = res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="campaign_not_found")
    return campaign


async def active_campaign_by_code(
    code: str,
    session: AsyncSession,
) -> Campaign:
    campaign = await campaign_by_code(code, session)
    if campaign.status != "active":
        raise HTTPException(status_code=403, detail="campaign_not_active")
    return campaign


async def get_user_campaign(
    user_id: UUID,
    campaign_id: UUID,
    session: AsyncSession,
) -> UserCampaign | None:
    stmt = select(UserCampaign).where(
        UserCampaign.user_id == user_id,
        UserCampaign.campaign_id == campaign_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()
