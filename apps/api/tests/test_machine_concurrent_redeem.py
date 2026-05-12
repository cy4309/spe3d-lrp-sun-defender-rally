"""機台扣碼的併發測試 — 兩個 client 同時打同一個 code，必須只有一個成功。

此測試直接走 service 層（不經 HTTP），原因：
- 簡化機台 token 處理
- 把焦點放在 DB-level 的 FOR UPDATE 行為
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def _try_commit(code: str, machine_id: str, request_id: str) -> tuple[bool, str | None]:
    """模擬 machine_commit 的核心邏輯（精簡版）。"""
    engine = create_async_engine(os.environ["DATABASE_URL"])
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as s:
            row = (await s.execute(
                text("SELECT id, status, expires_at FROM redeem_codes WHERE code = :c FOR UPDATE"),
                {"c": code},
            )).first()
            if row is None:
                await s.commit()
                return (False, "not_found")
            code_id, status_v, expires = row
            now = datetime.now(tz=timezone.utc)
            if status_v == "redeemed":
                await s.commit()
                return (False, "already_redeemed")
            if expires <= now:
                await s.commit()
                return (False, "expired")
            # 模擬「處理 0.1 秒」確保兩個 task 真的會碰撞
            await asyncio.sleep(0.1)
            await s.execute(
                text("UPDATE redeem_codes SET status='redeemed', redeemed_at=:n, redeemed_machine_id=:m WHERE id=:i"),
                {"n": now, "m": machine_id, "i": code_id},
            )
            await s.execute(
                text("""INSERT INTO machine_redemption_attempts
                       (id, redeem_code_id, code_text, machine_id, succeeded, reason_code, request_id, attempted_at)
                       VALUES (:id, :rcid, :c, :m, true, 'ok', :rid, :n)"""),
                {"id": uuid4(), "rcid": code_id, "c": code, "m": machine_id, "rid": request_id, "n": now},
            )
            await s.commit()
            return (True, None)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_concurrent_redeem_only_one_wins(fresh_redeem_code: str):
    """同一個 code 被兩個機台同時扣 → 一個 ok=True、一個 ok=False。"""
    results = await asyncio.gather(
        _try_commit(fresh_redeem_code, "machine-A", "req-A"),
        _try_commit(fresh_redeem_code, "machine-B", "req-B"),
    )
    successes = [r for r in results if r[0]]
    failures = [r for r in results if not r[0]]
    assert len(successes) == 1, f"expected 1 success, got {len(successes)}: {results}"
    assert len(failures) == 1
    assert failures[0][1] == "already_redeemed"
