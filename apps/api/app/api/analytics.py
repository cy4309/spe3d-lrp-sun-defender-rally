"""前端瀏覽追蹤（寫入 page_views）。"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import campaign_by_code
from app.models import LineUser, PageView
from app.utils import decode_session_token, now_utc

router = APIRouter()


class PageViewRequest(BaseModel):
    campaign_code: str
    path: str = Field(..., min_length=1, max_length=256)


class PageViewResponse(BaseModel):
    recorded: bool


async def optional_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> LineUser | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_session_token(token)
        return await session.get(LineUser, UUID(claims["sub"]))
    except Exception:
        return None


@router.post("/page-view", response_model=PageViewResponse)
async def record_page_view(
    req: PageViewRequest,
    session: AsyncSession = Depends(get_session),
    user: LineUser | None = Depends(optional_current_user),
):
    """紀錄 LIFF 頁面瀏覽。有 Bearer 時會帶入 line_user_id。"""
    campaign = await campaign_by_code(req.campaign_code, session)
    now = now_utc()
    session.add(
        PageView(
            id=uuid4(),
            campaign_id=campaign.id,
            path=req.path,
            line_user_id=user.line_user_id if user else None,
            user_id=user.id if user else None,
            viewed_at=now,
        )
    )
    await session.commit()
    return PageViewResponse(recorded=True)
