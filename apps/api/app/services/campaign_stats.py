"""活動統計聚合 — PM 儀表板（依日期區間）。"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Campaign, LineFollowEvent, PageView, Share, UserCampaign

TZ_TAIPEI = ZoneInfo("Asia/Taipei")


def _taipei_day_bounds(d: date) -> tuple[datetime, datetime]:
    """某日 00:00～次日 00:00（UTC aware）。"""
    start_local = datetime(d.year, d.month, d.day, tzinfo=TZ_TAIPEI)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def resolve_period(
    date_from: date | None,
    date_to: date | None,
) -> tuple[datetime, datetime, date, date]:
    """未帶日期時預設為台北時區今天。"""
    today = datetime.now(TZ_TAIPEI).date()
    d_from = date_from or today
    d_to = date_to or d_from
    if d_to < d_from:
        d_from, d_to = d_to, d_from
    start, _ = _taipei_day_bounds(d_from)
    _, end = _taipei_day_bounds(d_to)
    return start, end, d_from, d_to


async def get_campaign_stats(
    session: AsyncSession,
    campaign: Campaign,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, Any]:
    cid = campaign.id
    range_start, range_end, d_from, d_to = resolve_period(date_from, date_to)
    now = datetime.now(timezone.utc)

    def _in_range(column):
        return (column >= range_start) & (column < range_end)

    page_views_total = await session.scalar(
        select(func.count())
        .select_from(PageView)
        .where(PageView.campaign_id == cid, _in_range(PageView.viewed_at))
    ) or 0

    unique_viewers = await session.scalar(
        select(func.count(func.distinct(PageView.line_user_id)))
        .where(
            PageView.campaign_id == cid,
            PageView.line_user_id.isnot(None),
            _in_range(PageView.viewed_at),
        )
    ) or 0

    participants = await session.scalar(
        select(func.count())
        .select_from(UserCampaign)
        .where(
            UserCampaign.campaign_id == cid,
            UserCampaign.consent_at.isnot(None),
            _in_range(UserCampaign.consent_at),
        )
    ) or 0

    ai_image_sharers = await session.scalar(
        select(func.count())
        .select_from(UserCampaign)
        .where(
            UserCampaign.campaign_id == cid,
            UserCampaign.shared.is_(True),
            UserCampaign.shared_at.isnot(None),
            _in_range(UserCampaign.shared_at),
        )
    ) or 0

    share_actions = await session.scalar(
        select(func.count())
        .select_from(Share)
        .join(UserCampaign, Share.user_campaign_id == UserCampaign.id)
        .where(UserCampaign.campaign_id == cid, _in_range(Share.shared_at))
    ) or 0

    new_fans = await session.scalar(
        select(func.count())
        .select_from(LineFollowEvent)
        .where(
            LineFollowEvent.campaign_id == cid,
            LineFollowEvent.event_type == "follow",
            _in_range(LineFollowEvent.occurred_at),
        )
    ) or 0

    lottery_eligible = await session.scalar(
        select(func.count())
        .select_from(UserCampaign)
        .where(
            UserCampaign.campaign_id == cid,
            UserCampaign.lottery_eligible.is_(True),
            UserCampaign.shared_at.isnot(None),
            _in_range(UserCampaign.shared_at),
        )
    ) or 0

    return {
        "generated_at": now.isoformat(),
        "timezone": "Asia/Taipei",
        "period": {
            "date_from": d_from.isoformat(),
            "date_to": d_to.isoformat(),
        },
        "campaign": {
            "id": str(cid),
            "code": campaign.code,
            "name": campaign.name,
            "starts_at": campaign.starts_at.isoformat(),
            "ends_at": campaign.ends_at.isoformat(),
            "status": campaign.status,
        },
        "totals": {
            "page_views": int(page_views_total),
            "unique_page_viewers": int(unique_viewers),
            "participants": int(participants),
            "ai_image_sharers": int(ai_image_sharers),
            "share_actions": int(share_actions),
            "new_fans": int(new_fans),
            "lottery_eligible": int(lottery_eligible),
        },
    }
