"""共用 fixture — 直接連跑起來的本地 db（docker compose 內）。

這些測試會「真的」打 DB，所以執行前 docker compose 必須是 up 狀態。
跑法：
    docker compose exec api pytest tests/ -v
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    db_url = os.environ["DATABASE_URL"]
    engine = create_async_engine(db_url)
    SessionMaker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionMaker() as s:
        yield s
    await engine.dispose()


@pytest_asyncio.fixture
async def campaign_id(session: AsyncSession) -> UUID:
    """取 seed 進去的那筆 anthelios-2026-summer。"""
    r = await session.execute(text("SELECT id FROM campaigns WHERE code = 'anthelios-2026-summer'"))
    row = r.first()
    assert row, "seed campaign missing — 確認 db/init.sql 有跑"
    return row[0]


@pytest_asyncio.fixture
async def fresh_user_campaign(session: AsyncSession, campaign_id: UUID) -> UUID:
    """建立一個新鮮的 user + user_campaign，回傳 user_campaign_id。"""
    user_id = uuid4()
    line_id = f"Utest{uuid4().hex[:24]}"
    now = datetime.now(tz=timezone.utc)
    await session.execute(text("""
        INSERT INTO line_users (id, line_user_id, first_authorized_at, last_authorized_at, created_at, updated_at)
        VALUES (:id, :lid, :now, :now, :now, :now)
    """), {"id": user_id, "lid": line_id, "now": now})

    uc_id = uuid4()
    await session.execute(text("""
        INSERT INTO user_campaigns
        (id, user_id, campaign_id, entry_source, status, shared, lottery_eligible, lottery_result, metadata, created_at, updated_at)
        VALUES (:id, :uid, :cid, 'unknown', 'generated', false, false, 'pending', '{}', :now, :now)
    """), {"id": uc_id, "uid": user_id, "cid": campaign_id, "now": now})
    await session.commit()
    return uc_id


@pytest_asyncio.fixture
async def fresh_redeem_code(session: AsyncSession, fresh_user_campaign: UUID, campaign_id: UUID) -> str:
    """為某 user_campaign 建立一張 unused 兌換碼，回傳 code 字串。"""
    from app.utils import generate_redeem_code
    code = generate_redeem_code(8)
    now = datetime.now(tz=timezone.utc)
    expires = now + timedelta(days=30)
    await session.execute(text("""
        INSERT INTO redeem_codes (id, user_campaign_id, code, status, expires_at, created_at, updated_at)
        VALUES (:id, :uc, :code, 'unused', :exp, :now, :now)
    """), {"id": uuid4(), "uc": fresh_user_campaign, "code": code, "exp": expires, "now": now})
    await session.commit()
    return code
