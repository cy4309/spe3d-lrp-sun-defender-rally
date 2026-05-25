"""內部 API — 由 worker / 排程呼叫。需要 X-Internal-Token header。"""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import verify_internal
from app.models import Campaign, GenerationJob, RedeemCode, UserCampaign
from app.schemas import JobResultWebhook
from app.services.result_image_push import push_result_image_for_job
from app.utils import generate_redeem_code, now_utc

router = APIRouter()

RETRYABLE_ERRORS = {"comfyui_timeout", "comfyui_5xx", "network_error", "queue_overflow"}


@router.get("/jobs/{job_id}", dependencies=[Depends(verify_internal)])
async def get_job_for_worker(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """供 worker 取 job 必要欄位（input_path、ai_style…）。"""
    job = await session.get(GenerationJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return {
        "job_id": str(job.id),
        "input_image_path": job.input_image_path,
        "ai_style": job.ai_style,
        "retry_count": job.retry_count,
        "max_retries": job.max_retries,
    }


@router.post("/jobs/{job_id}/result", dependencies=[Depends(verify_internal)])
async def write_job_result(
    job_id: UUID,
    body: JobResultWebhook,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """worker 跑完 comfyUI 後呼叫此 API 回寫結果。

    成功：更新 job + 升級 user_campaign.status='generated' + 建 redeem_code
    失敗：依錯誤碼決定 failed_retrying（worker 會自己重投）或 failed_final
    """
    job = await session.get(GenerationJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_not_found")

    now = now_utc()

    if body.status == "succeeded":
        # 冪等：若 job 已是 succeeded，直接回 OK（worker 重試保護）
        if job.status == "succeeded":
            return {"ok": True, "status": "succeeded"}

        job.status = "succeeded"
        job.output_image_path = body.output_image_path
        job.external_job_id = body.external_job_id
        job.completed_at = now

        # 升 user_campaign status
        uc = await session.get(UserCampaign, job.user_campaign_id)
        if uc and uc.status == "authorized":
            uc.status = "generated"

        # 建 redeem_code（expires_at = campaign.ends_at）；冪等：已存在則跳過
        campaign = await session.get(Campaign, uc.campaign_id) if uc else None
        if uc and campaign:
            existing_rc = await session.scalar(
                select(RedeemCode).where(RedeemCode.user_campaign_id == uc.id)
            )
            if not existing_rc:
                # 重試 N 次避免極小機率撞碼
                code = None
                for _ in range(5):
                    candidate = generate_redeem_code(8)
                    exists = await session.execute(
                        RedeemCode.__table__.select().where(RedeemCode.code == candidate)
                    )
                    if exists.first() is None:
                        code = candidate
                        break
                if code is None:
                    raise HTTPException(status_code=500, detail="redeem_code_collision")

                rc = RedeemCode(
                    id=uuid4(),
                    user_campaign_id=uc.id,
                    code=code,
                    status="unused",
                    expires_at=campaign.ends_at,
                    created_at=now,
                    updated_at=now,
                )
                session.add(rc)

        await session.commit()
        background_tasks.add_task(push_result_image_for_job, job_id)
        return {"ok": True, "status": "succeeded"}

    # status == "failed"
    is_retryable = (body.error_code in RETRYABLE_ERRORS) and (job.retry_count < job.max_retries)
    if is_retryable:
        job.status = "failed_retrying"
        job.retry_count += 1
        job.error_code = body.error_code
        job.error_message = body.error_message
        await session.commit()
        return {"ok": True, "status": "failed_retrying", "retry_count": job.retry_count}

    job.status = "failed_final"
    job.error_code = body.error_code
    job.error_message = body.error_message
    job.completed_at = now
    await session.commit()
    return {"ok": True, "status": "failed_final"}
