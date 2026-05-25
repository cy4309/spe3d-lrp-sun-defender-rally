"""使用者面向的 API — 結果頁、分享、領通路折扣碼、抽獎查詢。"""
from __future__ import annotations

from uuid import uuid4

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import active_campaign_by_code, current_user, get_user_campaign
from app.models import ChannelCode, GenerationJob, RedeemCode, Share, UserCampaign
from app.services.result_image_push import try_push_result_image
from app.config import get_settings
from app.schemas import (
    ChannelCodeResponse,
    LotteryResponse,
    MeResultResponse,
    PushResultImageResponse,
    RedeemCodeOut,
    ShareCardResponse,
    ShareRequest,
    ShareResponse,
)
from app.utils import build_qr_payload, now_utc, public_image_url

router = APIRouter()


@router.get("/result", response_model=MeResultResponse)
async def get_my_result(
    campaign_code: str,
    request: Request,
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
        result_image_url=public_image_url(job.output_image_path, request)
        if job and job.output_image_path
        else None,
        redeem_code=(
            RedeemCodeOut(
                code=rc.code, qr_payload=build_qr_payload(rc.code),
                status=rc.status, expires_at=rc.expires_at,
            )
            if rc else None
        ),
        channel_code=cc.code if cc else None,
    )


@router.post("/push-result-image", response_model=PushResultImageResponse)
async def push_result_image(
    campaign_code: str,
    request: Request,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """結果頁進入時推送應援照至 LINE 聊天室（冪等，與 worker 完成後推送共用 push_logs）。"""
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    stmt = (
        select(GenerationJob)
        .where(GenerationJob.user_campaign_id == uc.id, GenerationJob.status == "succeeded")
        .order_by(GenerationJob.completed_at.desc())
        .limit(1)
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if job is None or not job.output_image_path:
        raise HTTPException(status_code=404, detail={"code": "result_not_ready"})

    pushed, reason = await try_push_result_image(session, job_id=job.id, request=request)
    if pushed:
        return PushResultImageResponse(pushed=True)
    if reason == "already_sent":
        return PushResultImageResponse(pushed=False, skipped=True, reason=reason)
    return PushResultImageResponse(pushed=False, skipped=True, reason=reason)


@router.post("/share-card", response_model=ShareCardResponse)
async def upload_share_card(
    request: Request,
    campaign_code: str,
    file: UploadFile = File(...),
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """上傳前端合成的分享卡 PNG，回傳可供 LINE Flex 使用的公開圖片 URL。"""
    campaign = await active_campaign_by_code(campaign_code, session)
    uc = await get_user_campaign(user.id, campaign.id, session)
    if uc is None:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")
    if uc.status == "authorized":
        raise HTTPException(status_code=403, detail={"code": "not_eligible"})

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail={"code": "empty_file"})
    if len(raw) > 8_000_000:
        raise HTTPException(status_code=400, detail={"code": "file_too_large"})

    settings = get_settings()
    now = now_utc()
    rel = f"share/{now:%Y/%m/%d}/{uuid4().hex}.png"
    full = Path(settings.image_storage_path) / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(raw)

    return ShareCardResponse(share_image_url=public_image_url(rel, request))


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
