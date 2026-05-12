"""機台 API — picbot/機台 client 呼叫。

三段式設計：
  check  — 預檢查碼可否兌換（不扣）
  commit — 正式扣碼（含 row lock）
  dispense-result — 機台回報出貨結果（可選，MVP 未啟用）

** 核心併發保護：commit 用 SELECT ... FOR UPDATE 鎖住 redeem_codes 的列 **
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import current_machine
from app.models import (
    Campaign,
    LineUser,
    MachineRedemptionAttempt,
    RedeemCode,
    UserCampaign,
)
from app.schemas import MachineRedeemRequest, MachineRedeemResponse
from app.utils import now_utc

router = APIRouter()


async def _record_attempt(
    session: AsyncSession,
    *,
    code_text: str,
    machine_id: str,
    request_id: str,
    redeem_code_id=None,
    succeeded: bool,
    reason_code: str | None = None,
    reason_message: str | None = None,
) -> None:
    attempt = MachineRedemptionAttempt(
        id=uuid4(),
        redeem_code_id=redeem_code_id,
        code_text=code_text,
        machine_id=machine_id,
        request_id=request_id,
        succeeded=succeeded,
        reason_code=reason_code,
        reason_message=reason_message,
        attempted_at=now_utc(),
    )
    session.add(attempt)


def _reason_message(code: str) -> str:
    return {
        "not_found": "兌換碼無效",
        "already_redeemed": "您已領取試用包，感謝參與活動",
        "expired": "兌換碼已過期",
        "wrong_campaign": "兌換碼非當前活動",
        "blocked_duplicate": "請洽現場人員",
    }.get(code, "兌換失敗")


@router.post("/redeem/check", response_model=MachineRedeemResponse)
async def machine_check(
    req: MachineRedeemRequest,
    machine_id: str = Depends(current_machine),
    session: AsyncSession = Depends(get_session),
):
    """預檢查（不扣碼）— 用於 PDF page 15「重複領取偵測」這類 UI 提示。"""
    stmt = select(RedeemCode).where(RedeemCode.code == req.code)
    rc = (await session.execute(stmt)).scalar_one_or_none()

    if rc is None:
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False, reason_code="not_found",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="not_found",
            user_message=_reason_message("not_found"),
        )

    if rc.status == "redeemed":
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False,
            redeem_code_id=rc.id, reason_code="already_redeemed",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="already_redeemed",
            user_message=_reason_message("already_redeemed"),
        )

    now = datetime.now(tz=timezone.utc)
    if rc.expires_at <= now:
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False,
            redeem_code_id=rc.id, reason_code="expired",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="expired",
            user_message=_reason_message("expired"),
        )

    # 取 user 顯示名稱（給機台 UI 用，可選）
    uc = await session.get(UserCampaign, rc.user_campaign_id)
    user = await session.get(LineUser, uc.user_id) if uc else None
    return MachineRedeemResponse(
        ok=True,
        redeem_code_id=rc.id,
        user_display_name=user.display_name if user else None,
    )


@router.post("/redeem/commit", response_model=MachineRedeemResponse)
async def machine_commit(
    req: MachineRedeemRequest,
    machine_id: str = Depends(current_machine),
    session: AsyncSession = Depends(get_session),
):
    """正式扣碼 — 包在 transaction 內，FOR UPDATE 鎖住該列。

    冪等：同一個 request_id 重複呼叫，回相同結果（不會重複扣碼）。
    """
    # 冪等：先查 attempt
    idem_sql = text("""
        SELECT id, succeeded, reason_code FROM machine_redemption_attempts
        WHERE request_id = :rid LIMIT 1
    """)
    prev = (await session.execute(idem_sql, {"rid": req.request_id})).first()
    if prev:
        _, succ, reason = prev
        if succ:
            return MachineRedeemResponse(ok=True, redeemed_at=now_utc())
        return MachineRedeemResponse(
            ok=False, reason_code=reason, user_message=_reason_message(reason or ""),
        )

    # 鎖列 + 驗證
    lock_sql = text("""
        SELECT id, status, expires_at, user_campaign_id
        FROM redeem_codes
        WHERE code = :code
        FOR UPDATE
    """)
    row = (await session.execute(lock_sql, {"code": req.code})).first()

    if row is None:
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False, reason_code="not_found",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="not_found", user_message=_reason_message("not_found"),
        )

    code_id, status_v, expires_at, uc_id = row
    now = now_utc()

    if status_v == "redeemed":
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False,
            redeem_code_id=code_id, reason_code="already_redeemed",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="already_redeemed",
            user_message=_reason_message("already_redeemed"),
        )

    if expires_at <= now:
        await _record_attempt(
            session, code_text=req.code, machine_id=machine_id,
            request_id=req.request_id, succeeded=False,
            redeem_code_id=code_id, reason_code="expired",
        )
        await session.commit()
        return MachineRedeemResponse(
            ok=False, reason_code="expired", user_message=_reason_message("expired"),
        )

    # 通過：扣碼
    await session.execute(text("""
        UPDATE redeem_codes
        SET status = 'redeemed', redeemed_at = :now, redeemed_machine_id = :mid
        WHERE id = :id
    """), {"now": now, "mid": machine_id, "id": code_id})

    # 升 user_campaign.status = redeemed
    await session.execute(text("""
        UPDATE user_campaigns SET status = 'redeemed', updated_at = :now WHERE id = :id
    """), {"now": now, "id": uc_id})

    await _record_attempt(
        session, code_text=req.code, machine_id=machine_id,
        request_id=req.request_id, succeeded=True,
        redeem_code_id=code_id, reason_code="ok",
    )
    await session.commit()

    return MachineRedeemResponse(
        ok=True, redeem_code_id=code_id, redeemed_at=now,
        dispense_token=req.request_id,
    )
