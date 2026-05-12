"""使用者面向的 API — 結果頁、分享、領通路折扣碼、抽獎查詢。"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import active_campaign_by_code, current_user, get_user_campaign
from app.models import ChannelCode, GenerationJob, RedeemCode, Share, UserCampaign
from app.schemas import (
    ChannelCodeResponse,
    LotteryResponse,
    MeResultResponse,
    RedeemCodeOut,
    ShareRequest,
    ShareResponse,
)
from app.utils import build_qr_payload, image_url, now_utc

router = APIRouter()


@router.get("/result", response_model=MeResultResponse)
async def get_my_result(
    campaign_code: str,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """重新進入 LIFF 時取目前活動結果 — 對應 UI page 11 全部欄位。"""
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    # 最新一筆 succeeded job
    stmt = (
        select(GenerationJob)
        .where(GenerationJob.user_campaign_id == uc.id, GenerationJob.status == "succeeded")
        .order_by(GenerationJob.completed_at.desc())
        .limit(1)
    )
    res = await session.execute(stmt)
    job = res.scalar_one_or_none()

    # 兌換碼
    rc_stmt = select(RedeemCode).where(
        RedeemCode.user_campaign_id == uc.id,
        RedeemCode.status.in_(["unused", "redeemed"]),
    )
    rc_res = await session.execute(rc_stmt)
    rc = rc_res.scalar_one_or_none()

    # 通路折扣碼
    cc_stmt = select(ChannelCode).where(ChannelCode.user_campaign_id == uc.id)
    cc_res = await session.execute(cc_stmt)
    cc = cc_res.scalar_one_or_none()

    return MeResultResponse(
        user_campaign_id=uc.id,
        status=uc.status,
        result_image_url=image_url(job.output_image_path) if job and job.output_image_path else None,
        redeem_code=(
            RedeemCodeOut(
                code=rc.code, qr_payload=build_qr_payload(rc.code),
                status=rc.status, expires_at=rc.expires_at,
            )
            if rc else None
        ),
        channel_code=cc.code if cc else None,
    )


@router.post("/share", response_model=ShareResponse)
async def record_share(
    campaign_code: str,
    req: ShareRequest,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """紀錄分享動作。重複分享只 INSERT shares，旗標保持 TRUE。"""
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    now = now_utc()
    share = Share(
        id=uuid4(),
        user_campaign_id=uc.id,
        target=req.target,
        shared_at=now,
    )
    session.add(share)

    if not uc.shared:
        uc.shared = True
        uc.shared_at = now
        uc.lottery_eligible = True
        # 升 status，但不要降級 — 若已 generated/redeemed 不動 status
        if uc.status == "generated":
            uc.status = "shared"

    await session.commit()
    return ShareResponse(
        shared=True, lottery_eligible=uc.lottery_eligible, user_campaign_status=uc.status,
    )


@router.post("/channel-code", response_model=ChannelCodeResponse)
async def claim_channel_code(
    campaign_code: str,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """領通路折扣碼。

    冪等：同一個 user_campaign 重複呼叫回同一張碼。
    併發安全：用 SELECT ... FOR UPDATE SKIP LOCKED 從池中取一張未發的碼。
    """
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")
    if uc.status == "authorized":
        raise HTTPException(status_code=403, detail={"code": "not_eligible"})

    # 冪等：已發過直接回
    existing_stmt = select(ChannelCode).where(ChannelCode.user_campaign_id == uc.id)
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        return ChannelCodeResponse(code=existing.code)

    # 從池子挑一張未發的碼（高併發友善）
    pick_sql = text("""
        SELECT id, code
        FROM channel_codes
        WHERE campaign_id = :cid AND user_campaign_id IS NULL
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    """)
    picked = (await session.execute(pick_sql, {"cid": campaign.id})).first()
    if picked is None:
        await session.rollback()
        raise HTTPException(status_code=409, detail={"code": "channel_code_pool_empty"})

    code_id, code_str = picked
    now = now_utc()
    update_sql = text("""
        UPDATE channel_codes
        SET user_campaign_id = :uc_id, assigned_at = :now
        WHERE id = :code_id
    """)
    await session.execute(update_sql, {"uc_id": uc.id, "code_id": code_id, "now": now})
    await session.commit()
    return ChannelCodeResponse(code=code_str)


@router.get("/lottery", response_model=LotteryResponse)
async def get_my_lottery(
    campaign_code: str,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    return LotteryResponse(
        lottery_eligible=uc.lottery_eligible,
        lottery_result=uc.lottery_result,
        prize=None,  # Phase 6 接 lottery_winners 後補
    )
