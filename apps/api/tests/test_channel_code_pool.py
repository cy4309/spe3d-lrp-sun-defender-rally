"""通路折扣碼池併發發放測試 — 兩個 user 同時領，不能拿到同一張碼。"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def _claim_one(uc_id: UUID, campaign_id: UUID) -> str | None:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as s:
            picked = (await s.execute(text("""
                SELECT id, code FROM channel_codes
                WHERE campaign_id = :cid AND user_campaign_id IS NULL
                ORDER BY created_at
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            """), {"cid": campaign_id})).first()
            if picked is None:
                await s.commit()
                return None
            cid, code = picked
            await asyncio.sleep(0.1)
            now = datetime.now(tz=timezone.utc)
            await s.execute(text("""
                UPDATE channel_codes SET user_campaign_id = :uc, assigned_at = :now WHERE id = :id
            """), {"uc": uc_id, "now": now, "id": cid})
            await s.commit()
            return code
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def two_user_campaigns(session, campaign_id: UUID):
    """建立兩個獨立 user_campaign，回傳 (uc_a, uc_b)。"""
    out: list[UUID] = []
    now = datetime.now(tz=timezone.utc)
    for _ in range(2):
        u, uc = uuid4(), uuid4()
        await session.execute(text("""
            INSERT INTO line_users (id, line_user_id, first_authorized_at, last_authorized_at, created_at, updated_at)
            VALUES (:id, :lid, :n, :n, :n, :n)
        """), {"id": u, "lid": f"Utest{uuid4().hex[:24]}", "n": now})
        await session.execute(text("""
            INSERT INTO user_campaigns
            (id, user_id, campaign_id, entry_source, status, shared, lottery_eligible, lottery_result, metadata, created_at, updated_at)
            VALUES (:id, :uid, :cid, 'unknown', 'generated', false, false, 'pending', '{}', :n, :n)
        """), {"id": uc, "uid": u, "cid": campaign_id, "n": now})
        out.append(uc)
    await session.commit()
    return out


@pytest_asyncio.fixture
async def seed_two_codes(session, campaign_id: UUID):
    """池子裡塞兩張碼。"""
    codes = []
    now = datetime.now(tz=timezone.utc)
    for i in range(2):
        c = f"TESTC0{i}{uuid4().hex[:2].upper()}"
        await session.execute(text("""
            INSERT INTO channel_codes (id, campaign_id, code, created_at)
            VALUES (:id, :cid, :code, :now)
        """), {"id": uuid4(), "cid": campaign_id, "code": c, "now": now})
        codes.append(c)
    await session.commit()
    yield codes
    # cleanup
    await session.execute(text("DELETE FROM channel_codes WHERE code = ANY(:cs)"), {"cs": codes})
    await session.commit()


@pytest.mark.asyncio
async def test_concurrent_claim_unique_codes(two_user_campaigns, seed_two_codes, campaign_id):
    uc_a, uc_b = two_user_campaigns
    a, b = await asyncio.gather(
        _claim_one(uc_a, campaign_id),
        _claim_one(uc_b, campaign_id),
    )
    assert a is not None and b is not None, f"both should succeed: a={a} b={b}"
    assert a != b, f"two users got the same code: {a}"
