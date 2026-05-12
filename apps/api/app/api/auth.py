"""LIFF 登入 + 同意條款。"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import active_campaign_by_code, current_user, get_user_campaign
from app.line_auth import LineTokenError, verify_id_token
from app.models import ConsentLog, LineUser, UserCampaign
from app.schemas import (
    CampaignOut,
    ConsentRequest,
    ConsentResponse,
    LineLoginRequest,
    LoginResponse,
    UserCampaignOut,
    UserOut,
)
from app.utils import issue_session_token, now_utc

router = APIRouter()


@router.post("/line", response_model=LoginResponse)
async def line_login(
    req: LineLoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """LIFF 登入。

    流程：
      1. 拿 LIFF id_token 去 LINE API 驗證
      2. 用 sub（LINE user ID）建立或更新 line_users
      3. 建立或更新 user_campaigns（同 user 同 campaign 一筆）
      4. 簽發我們自己的 session token，回在 X-Access-Token header

    前端：
      const res = await fetch("/api/v1/auth/line", { method: "POST", body: ... });
      const token = res.headers.get("X-Access-Token");
      // 後續所有 API 帶 Authorization: Bearer <token>
    """
    # 1. 驗 id_token
    try:
        claims = await verify_id_token(req.id_token)
    except LineTokenError as e:
        raise HTTPException(status_code=401, detail={"code": "invalid_id_token", "message": str(e)})

    line_user_id = claims["sub"]
    display_name = claims.get("name")
    picture_url = claims.get("picture")

    # 2. 撈活動
    campaign = await active_campaign_by_code(req.campaign_code, session)

    # 3. 建立或更新 line_users
    stmt = select(LineUser).where(LineUser.line_user_id == line_user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    now = now_utc()
    if user is None:
        user = LineUser(
            id=uuid4(),
            line_user_id=line_user_id,
            display_name=display_name,
            picture_url=picture_url,
            first_authorized_at=now,
            last_authorized_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
    else:
        user.display_name = display_name or user.display_name
        user.picture_url = picture_url or user.picture_url
        user.last_authorized_at = now

    await session.flush()

    # 4. 建立或更新 user_campaigns
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        uc = UserCampaign(
            id=uuid4(),
            user_id=user.id,
            campaign_id=campaign.id,
            entry_source=req.entry_source,
            referrer_user_id=req.referrer_user_id,
            status="authorized",
            shared=False,
            lottery_eligible=False,
            lottery_result="pending",
            metadata_={},
            created_at=now,
            updated_at=now,
        )
        session.add(uc)
        await session.flush()

    await session.commit()
    await session.refresh(uc)

    # 5. 簽發 session token
    token = issue_session_token(line_user_id=line_user_id, user_id=user.id)
    response.headers["X-Access-Token"] = token
    response.headers["Access-Control-Expose-Headers"] = "X-Access-Token"

    return LoginResponse(
        user=UserOut(
            id=user.id, line_user_id=user.line_user_id,
            display_name=user.display_name, picture_url=user.picture_url,
        ),
        user_campaign=UserCampaignOut(
            id=uc.id, status=uc.status, shared=uc.shared,
            lottery_eligible=uc.lottery_eligible, lottery_result=uc.lottery_result,
        ),
        campaign=CampaignOut(
            id=campaign.id, code=campaign.code, name=campaign.name,
            starts_at=campaign.starts_at, ends_at=campaign.ends_at, ai_style=campaign.ai_style,
        ),
    )


@router.post("/consent", response_model=ConsentResponse)
async def record_consent(
    campaign_code: str,
    req: ConsentRequest,
    request: Request,
    user: LineUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """紀錄同意條款（對應 UI page 10 checkbox）。"""
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    now = now_utc()
    uc.consent_at = now
    uc.consent_version = req.consent_version

    log = ConsentLog(
        id=uuid4(),
        user_id=user.id,
        campaign_id=campaign.id,
        version=req.consent_version,
        consented_at=now,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    session.add(log)
    await session.commit()
    return ConsentResponse(consent_at=now)
