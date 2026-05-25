"""乙方轉發的 LINE webhook 事件（follow / unfollow）。"""
from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import verify_partner_webhook
from app.models import Campaign, LineFollowEvent, LineUser, UserCampaign
from app.utils import now_utc

router = APIRouter()


@router.post("/line-events")
async def line_events_webhook(
    body: dict[str, Any],
    _: None = Depends(verify_partner_webhook),
    session: AsyncSession = Depends(get_session),
):
    """接收 LINE 原始 webhook JSON（events 陣列），寫入 line_follow_events。"""
    events = body.get("events") or []
    recorded = 0
    now = now_utc()

    for ev in events:
        ev_type = ev.get("type")
        if ev_type not in ("follow", "unfollow"):
            continue

        source = ev.get("source") or {}
        line_user_id = source.get("userId")
        if not line_user_id:
            continue

        is_unblocked = False
        if ev_type == "follow":
            follow_obj = ev.get("follow") or {}
            is_unblocked = bool(follow_obj.get("isUnblocked"))

        campaign_id, user_id = await _attribute_campaign(session, line_user_id)

        session.add(
            LineFollowEvent(
                id=uuid4(),
                line_user_id=line_user_id,
                event_type=ev_type,
                is_unblocked=is_unblocked,
                campaign_id=campaign_id,
                user_id=user_id,
                occurred_at=now,
                raw_payload=ev,
            )
        )
        recorded += 1

    if recorded:
        await session.commit()

    return {"ok": True, "recorded": recorded}


async def _attribute_campaign(
    session: AsyncSession,
    line_user_id: str,
) -> tuple[UUID | None, UUID | None]:
    """若該 LINE 用戶曾參加活動，歸因到最近一筆 active campaign。"""
    stmt = select(LineUser).where(LineUser.line_user_id == line_user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if not user:
        return None, None

    uc_stmt = (
        select(UserCampaign, Campaign)
        .join(Campaign, UserCampaign.campaign_id == Campaign.id)
        .where(UserCampaign.user_id == user.id, Campaign.status == "active")
        .order_by(UserCampaign.updated_at.desc())
        .limit(1)
    )
    row = (await session.execute(uc_stmt)).first()
    if not row:
        return None, user.id
    uc, campaign = row
    return campaign.id, user.id
