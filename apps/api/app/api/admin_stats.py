"""PM 活動統計 API（僅 APP_DEBUG 時掛載，免 token）。"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Campaign
from app.services.campaign_db_inspect import get_db_inspect
from app.services.campaign_stats import get_campaign_stats

router = APIRouter()


async def _get_campaign(session: AsyncSession, campaign_code: str) -> Campaign:
    campaign = (
        await session.execute(select(Campaign).where(Campaign.code == campaign_code))
    ).scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="campaign_not_found")
    return campaign


@router.get("/stats")
async def campaign_stats(
    campaign_code: str = Query("anthelios-2026-summer"),
    date_from: date | None = Query(None, description="起始日 YYYY-MM-DD（台北）"),
    date_to: date | None = Query(None, description="結束日 YYYY-MM-DD（台北，含當日）"),
    session: AsyncSession = Depends(get_session),
):
    """活動統計（依日期區間）。未帶日期時預設為今天。"""
    campaign = await _get_campaign(session, campaign_code)
    return await get_campaign_stats(session, campaign, date_from=date_from, date_to=date_to)


@router.get("/db-inspect")
async def db_inspect(
    campaign_code: str = Query("anthelios-2026-summer"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """資料表欄位說明、列數、狀態分布、最近參與者（dev 儀表板用）。"""
    campaign = await _get_campaign(session, campaign_code)
    return await get_db_inspect(session, campaign, date_from=date_from, date_to=date_to)
