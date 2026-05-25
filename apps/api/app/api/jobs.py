"""AI 生成任務 API。

實作要點：
- 建立 job 時把任務丟進 redis queue，由 worker 處理
- 同一 user_campaign 一次只能有一個未完成 job
- 輪詢回傳 status；成功時一併附上 redeem_code（在 worker 回寫時就建好）
"""
from __future__ import annotations

from uuid import UUID, uuid4

import redis.asyncio as redis_async
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.deps import current_user
from app.models import GenerationJob, RedeemCode, UserCampaign, Campaign
from app.schemas import JobCreatedResponse, JobStatusResponse, RedeemCodeOut
from app.utils import build_qr_payload, now_utc, public_image_url, save_image

router = APIRouter()
settings = get_settings()

GENERATION_QUEUE_KEY = "queue:generation"
RETRYABLE_ERRORS = {"comfyui_timeout", "comfyui_5xx", "network_error", "queue_overflow"}


async def _push_to_queue(job_id: UUID) -> None:
    """把 job 推進 redis list，worker 用 LPOP / BLPOP 取出。"""
    client = redis_async.from_url(settings.redis_url, decode_responses=True)
    try:
        await client.rpush(GENERATION_QUEUE_KEY, str(job_id))
    finally:
        await client.aclose()


@router.post("", response_model=JobCreatedResponse, status_code=202)
async def create_job(
    user_campaign_id: str = Form(...),
    image: UploadFile = File(...),
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """建立 AI 生成任務。圖片儲存到 /data/images，建 GenerationJob，推進佇列。"""
    # 1. 驗 user_campaign 屬於當前 user
    uc = await session.get(UserCampaign, UUID(user_campaign_id))
    if uc is None or uc.user_id != user.id:
        raise HTTPException(status_code=404, detail="user_campaign_not_found")

    # 2. 檢查是否已有未完成 job
    stmt = select(GenerationJob).where(
        GenerationJob.user_campaign_id == uc.id,
        GenerationJob.status.in_(["queued", "processing", "failed_retrying"]),
    )
    res = await session.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail={"code": "job_already_in_progress"})

    # 3. 圖片基本驗證
    if image.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail={"code": "invalid_image_format"})
    raw = await image.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"code": "image_too_large"})

    # 4. 存圖
    suffix = ".png" if image.content_type == "image/png" else ".jpg"
    rel_path, sha = save_image(raw, suffix=suffix)

    # 5. 撈 campaign 拿 ai_style snapshot
    campaign = await session.get(Campaign, uc.campaign_id)
    if campaign is None:
        raise HTTPException(status_code=500, detail="campaign_missing")

    # 6. 建 GenerationJob
    now = now_utc()
    job = GenerationJob(
        id=uuid4(),
        user_campaign_id=uc.id,
        input_image_path=rel_path,
        input_image_sha256=sha,
        ai_style=campaign.ai_style,
        status="queued",
        retry_count=0,
        max_retries=settings.job_retry_max,
        queued_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    await session.commit()

    # 7. 推佇列
    await _push_to_queue(job.id)

    return JobCreatedResponse(
        job_id=job.id,
        status="queued",
        polling_interval_ms=settings.polling_interval_ms,
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job(
    job_id: UUID,
    request: Request,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """輪詢 job 狀態。"""
    job = await session.get(GenerationJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_not_found")

    # 權限：job 必須屬於當前 user
    uc = await session.get(UserCampaign, job.user_campaign_id)
    if uc is None or uc.user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden")

    if job.status == "succeeded":
        # 撈對應的 redeem_code
        stmt = select(RedeemCode).where(
            RedeemCode.user_campaign_id == uc.id,
            RedeemCode.status == "unused",
        )
        res = await session.execute(stmt)
        rc = res.scalar_one_or_none()
        rc_out = (
            RedeemCodeOut(
                code=rc.code, qr_payload=build_qr_payload(rc.code),
                status=rc.status, expires_at=rc.expires_at,
            )
            if rc else None
        )
        return JobStatusResponse(
            job_id=job.id,
            status="succeeded",
            result_image_url=public_image_url(job.output_image_path, request)
            if job.output_image_path
            else None,
            redeem_code=rc_out,
        )

    if job.status == "failed_final":
        return JobStatusResponse(
            job_id=job.id,
            status="failed_final",
            error_code=job.error_code,
            user_message="人潮較多，請稍後再試" if job.error_code in RETRYABLE_ERRORS else "此照片無法使用，請更換",
            can_retry=True,
        )

    return JobStatusResponse(job_id=job.id, status=job.status)


@router.post("/{job_id}/retry", response_model=JobCreatedResponse, status_code=202)
async def retry_job(
    job_id: UUID,
    user=Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """失敗後重新生成 — 複製 input 建立新 job，舊 job 維持 failed_final。"""
    old = await session.get(GenerationJob, job_id)
    if old is None:
        raise HTTPException(status_code=404, detail="job_not_found")

    uc = await session.get(UserCampaign, old.user_campaign_id)
    if uc is None or uc.user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden")

    if old.status != "failed_final":
        raise HTTPException(status_code=409, detail={"code": "job_not_failed"})

    now = now_utc()
    new_job = GenerationJob(
        id=uuid4(),
        user_campaign_id=uc.id,
        input_image_path=old.input_image_path,
        input_image_sha256=old.input_image_sha256,
        ai_style=old.ai_style,
        status="queued",
        retry_count=0,
        max_retries=old.max_retries,
        queued_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(new_job)
    await session.commit()
    await _push_to_queue(new_job.id)

    return JobCreatedResponse(
        job_id=new_job.id, status="queued",
        polling_interval_ms=settings.polling_interval_ms,
    )
