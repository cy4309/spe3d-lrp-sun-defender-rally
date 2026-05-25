"""生圖完成後 Push 應援照至使用者 LINE 聊天室（冪等）。"""
from __future__ import annotations

import logging
from uuid import UUID, uuid4

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GenerationJob, LineUser, PushLog, UserCampaign
from app.services.line_push import push_messages
from app.utils import absolute_public_image_url, now_utc, public_image_url

logger = logging.getLogger(__name__)

PUSH_TYPE = "result_image"
RESULT_TEXT = "您的專屬應援照已完成！請至聊天室查看，長按圖片可儲存。"


async def _already_pushed(session: AsyncSession, job_id: UUID) -> bool:
    """僅成功送達視為已推送；失敗可重試。"""
    row = await session.scalar(
        select(PushLog.id).where(
            PushLog.push_type == PUSH_TYPE,
            PushLog.status == "sent",
            PushLog.payload.contains({"job_id": str(job_id)}),
        )
    )
    return row is not None


async def try_push_result_image(
    session: AsyncSession,
    *,
    job_id: UUID,
    request: Request | None = None,
) -> tuple[bool, str | None]:
    """對單一 succeeded job 推送結果圖。已推送過則跳過。回傳 (是否本次成功送出, skip/fail 原因)。"""
    if await _already_pushed(session, job_id):
        return False, "already_sent"

    job = await session.get(GenerationJob, job_id)
    if job is None or job.status != "succeeded" or not job.output_image_path:
        return False, "job_not_ready"

    uc = await session.get(UserCampaign, job.user_campaign_id)
    if uc is None:
        return False, "user_campaign_not_found"

    user = await session.get(LineUser, uc.user_id)
    if user is None:
        return False, "user_not_found"

    if request is not None:
        image_url = public_image_url(job.output_image_path, request)
    else:
        image_url = absolute_public_image_url(job.output_image_path)

    if not image_url.startswith("https://"):
        err = f"image_url_must_be_https (got {image_url}). Set PUBLIC_BASE_URL=https://your-ngrok-or-domain"
        logger.warning("result_image push skipped job_id=%s: %s", job_id, err)
        now = now_utc()
        session.add(
            PushLog(
                id=uuid4(),
                line_user_id=user.line_user_id,
                push_type=PUSH_TYPE,
                payload={"job_id": str(job_id), "image_url": image_url},
                status="failed",
                error_message=err,
                sent_at=now,
            )
        )
        await session.commit()
        return False, err

    messages = [
        {"type": "text", "text": RESULT_TEXT},
        {
            "type": "image",
            "originalContentUrl": image_url,
            "previewImageUrl": image_url,
        },
    ]

    ok, err = await push_messages(user.line_user_id, messages)
    now = now_utc()
    log = PushLog(
        id=uuid4(),
        line_user_id=user.line_user_id,
        push_type=PUSH_TYPE,
        payload={
            "job_id": str(job_id),
            "user_campaign_id": str(uc.id),
            "image_url": image_url,
        },
        status="sent" if ok else "failed",
        error_message=err,
        sent_at=now,
    )
    session.add(log)
    await session.commit()

    if ok:
        logger.info("result_image push sent job_id=%s line_user_id=%s", job_id, user.line_user_id)
        return True, None

    return False, err or "push_failed"


async def push_result_image_for_job(job_id: UUID) -> None:
    """Background task：worker 回寫成功後非同步推送。"""
    from app.db import SessionLocal

    async with SessionLocal() as session:
        try:
            await try_push_result_image(session, job_id=job_id, request=None)
        except Exception:
            logger.exception("background result_image push failed job_id=%s", job_id)
