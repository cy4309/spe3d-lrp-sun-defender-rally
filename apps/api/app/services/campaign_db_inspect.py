"""資料庫結構說明 + 即時列數／分布（PM 儀表板用）。"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Campaign
from app.services.campaign_stats import resolve_period

# 靜態欄位目錄（對照 db/init.sql）；usage 標註 MVP 實際有無寫入
SCHEMA_CATALOG: list[dict[str, Any]] = [
    {
        "table": "campaigns",
        "label": "活動設定",
        "phase": "MVP",
        "columns": [
            {"name": "code", "usage": "used", "note": "活動代碼"},
            {"name": "ai_style", "usage": "used", "note": "寫入 generation_jobs 快照"},
            {"name": "starts_at / ends_at", "usage": "used", "note": "兌換碼過期"},
            {"name": "redeem_limit_per_user", "usage": "reserved", "note": "尚未在 API 強制"},
            {"name": "lottery_limit_per_user", "usage": "reserved", "note": "尚未在 API 強制"},
            {"name": "config", "usage": "reserved", "note": "JSONB 擴充用"},
        ],
    },
    {
        "table": "line_users",
        "label": "LINE 使用者",
        "phase": "MVP",
        "columns": [
            {"name": "line_user_id", "usage": "used", "note": "POST /auth/line"},
            {"name": "display_name / picture_url", "usage": "used", "note": "id_token 帶入"},
            {"name": "language", "usage": "unused", "note": "schema 有，程式未寫"},
            {"name": "first_authorized_at / last_authorized_at", "usage": "used", "note": "登入更新"},
        ],
    },
    {
        "table": "user_campaigns",
        "label": "參與狀態（核心）",
        "phase": "MVP",
        "columns": [
            {"name": "consent_at / consent_version", "usage": "partial", "note": "API 有；前端尚未接 consent"},
            {"name": "status", "usage": "used", "note": "狀態機主欄位"},
            {"name": "shared / shared_at", "usage": "used", "note": "分享後更新"},
            {"name": "lottery_eligible", "usage": "used", "note": "分享後 true"},
            {"name": "lottery_result", "usage": "reserved", "note": "Phase 6 抽獎"},
            {"name": "referrer_user_id", "usage": "partial", "note": "schema 有，分享連結未接"},
            {"name": "metadata", "usage": "unused", "note": "目前固定 {}"},
        ],
    },
    {
        "table": "generation_jobs",
        "label": "AI 生圖任務",
        "phase": "MVP",
        "columns": [
            {"name": "input_image_path / output_image_path", "usage": "used", "note": "storage 路徑"},
            {"name": "status", "usage": "used", "note": "queued→succeeded（mock worker）"},
            {"name": "started_at", "usage": "unused", "note": "worker 未寫 processing 時間"},
            {"name": "external_job_id", "usage": "used", "note": "mock 時有值"},
            {"name": "error_code / error_message", "usage": "used", "note": "失敗時"},
        ],
    },
    {
        "table": "redeem_codes",
        "label": "機台兌換碼",
        "phase": "MVP",
        "columns": [
            {"name": "code / status / expires_at", "usage": "used", "note": "生圖成功建立"},
            {"name": "redeemed_machine_id", "usage": "used", "note": "機台 commit 時"},
        ],
    },
    {
        "table": "channel_codes",
        "label": "通路折扣碼池",
        "phase": "MVP",
        "columns": [
            {"name": "code", "usage": "used", "note": "預先匯入"},
            {"name": "user_campaign_id / assigned_at", "usage": "used", "note": "POST /me/channel-code"},
        ],
    },
    {
        "table": "shares",
        "label": "分享紀錄",
        "phase": "MVP",
        "columns": [
            {"name": "shared_at", "usage": "used", "note": "每次分享一筆"},
        ],
    },
    {
        "table": "page_views",
        "label": "頁面瀏覽",
        "phase": "MVP",
        "columns": [
            {"name": "path / viewed_at", "usage": "used", "note": "PageViewTracker"},
            {"name": "line_user_id", "usage": "used", "note": "登入後才有"},
        ],
    },
    {
        "table": "consent_logs",
        "label": "同意條款稽核",
        "phase": "MVP",
        "columns": [
            {"name": "version / consented_at / ip", "usage": "partial", "note": "API 有，前端未強制呼叫"},
        ],
    },
    {
        "table": "line_follow_events",
        "label": "追蹤／取消追蹤",
        "phase": "Phase 6",
        "columns": [
            {"name": "event_type / is_unblocked", "usage": "partial", "note": "webhook 已實作，待乙方轉發"},
        ],
    },
    {
        "table": "machine_redemption_attempts",
        "label": "機台兌換嘗試",
        "phase": "MVP",
        "columns": [
            {"name": "succeeded / reason_code", "usage": "used", "note": "機台 API 每次嘗試"},
        ],
    },
    {
        "table": "lottery_draws + lottery_winners",
        "label": "抽獎場次與中獎",
        "phase": "Phase 6",
        "columns": [{"name": "—", "usage": "unused", "note": "表已建，API 未接"}],
    },
    {
        "table": "push_logs",
        "label": "OA 推播紀錄",
        "phase": "Phase 6",
        "columns": [{"name": "—", "usage": "unused", "note": "表已建，API 未接"}],
    },
]


async def get_db_inspect(
    session: AsyncSession,
    campaign: Campaign,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, Any]:
    cid = campaign.id
    range_start, range_end, d_from, d_to = resolve_period(date_from, date_to)

    async def _scalar(sql: str, **params) -> int:
        r = await session.execute(text(sql), params)
        return int(r.scalar() or 0)

    counts = {
        "line_users_in_campaign": await _scalar(
            """
            SELECT COUNT(DISTINCT uc.user_id) FROM user_campaigns uc
            WHERE uc.campaign_id = :cid
            """,
            cid=cid,
        ),
        "user_campaigns": await _scalar(
            "SELECT COUNT(*) FROM user_campaigns WHERE campaign_id = :cid", cid=cid
        ),
        "user_campaigns_in_period": await _scalar(
            """
            SELECT COUNT(*) FROM user_campaigns
            WHERE campaign_id = :cid AND created_at >= :s AND created_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "generation_jobs": await _scalar(
            """
            SELECT COUNT(*) FROM generation_jobs gj
            JOIN user_campaigns uc ON uc.id = gj.user_campaign_id
            WHERE uc.campaign_id = :cid
            """,
            cid=cid,
        ),
        "generation_jobs_in_period": await _scalar(
            """
            SELECT COUNT(*) FROM generation_jobs gj
            JOIN user_campaigns uc ON uc.id = gj.user_campaign_id
            WHERE uc.campaign_id = :cid AND gj.created_at >= :s AND gj.created_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "redeem_codes": await _scalar(
            """
            SELECT COUNT(*) FROM redeem_codes rc
            JOIN user_campaigns uc ON uc.id = rc.user_campaign_id
            WHERE uc.campaign_id = :cid
            """,
            cid=cid,
        ),
        "channel_codes_total": await _scalar(
            "SELECT COUNT(*) FROM channel_codes WHERE campaign_id = :cid", cid=cid
        ),
        "channel_codes_assigned": await _scalar(
            "SELECT COUNT(*) FROM channel_codes WHERE campaign_id = :cid AND user_campaign_id IS NOT NULL",
            cid=cid,
        ),
        "shares": await _scalar(
            """
            SELECT COUNT(*) FROM shares s
            JOIN user_campaigns uc ON uc.id = s.user_campaign_id
            WHERE uc.campaign_id = :cid AND s.shared_at >= :s AND s.shared_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "page_views": await _scalar(
            """
            SELECT COUNT(*) FROM page_views
            WHERE campaign_id = :cid AND viewed_at >= :s AND viewed_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "consent_logs": await _scalar(
            """
            SELECT COUNT(*) FROM consent_logs
            WHERE campaign_id = :cid AND consented_at >= :s AND consented_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "line_follow_events": await _scalar(
            """
            SELECT COUNT(*) FROM line_follow_events
            WHERE campaign_id = :cid AND occurred_at >= :s AND occurred_at < :e
            """,
            cid=cid,
            s=range_start,
            e=range_end,
        ),
        "machine_attempts": await _scalar(
            """
            SELECT COUNT(*) FROM machine_redemption_attempts
            WHERE attempted_at >= :s AND attempted_at < :e
            """,
            s=range_start,
            e=range_end,
        ),
        "lottery_draws": await _scalar(
            "SELECT COUNT(*) FROM lottery_draws WHERE campaign_id = :cid", cid=cid
        ),
        "push_logs": await _scalar("SELECT COUNT(*) FROM push_logs"),
    }

    uc_status = await session.execute(
        text("""
            SELECT status, COUNT(*) AS c FROM user_campaigns
            WHERE campaign_id = :cid GROUP BY status ORDER BY c DESC
        """),
        {"cid": cid},
    )
    gj_status = await session.execute(
        text("""
            SELECT gj.status, COUNT(*) AS c FROM generation_jobs gj
            JOIN user_campaigns uc ON uc.id = gj.user_campaign_id
            WHERE uc.campaign_id = :cid GROUP BY gj.status ORDER BY c DESC
        """),
        {"cid": cid},
    )
    pv_paths = await session.execute(
        text("""
            SELECT path, COUNT(*) AS c FROM page_views
            WHERE campaign_id = :cid AND viewed_at >= :s AND viewed_at < :e
            GROUP BY path ORDER BY c DESC LIMIT 12
        """),
        {"cid": cid, "s": range_start, "e": range_end},
    )

    recent_uc = await session.execute(
        text("""
            SELECT uc.id, lu.line_user_id, uc.status, uc.consent_at IS NOT NULL AS consented,
                   uc.shared, uc.lottery_eligible, uc.created_at
            FROM user_campaigns uc
            JOIN line_users lu ON lu.id = uc.user_id
            WHERE uc.campaign_id = :cid
            ORDER BY uc.updated_at DESC LIMIT 8
        """),
        {"cid": cid},
    )

    audit_notes = [
        {
            "level": "info",
            "title": "設計上保留、尚未寫入",
            "items": [
                "line_users.language",
                "generation_jobs.started_at（worker 未標 processing）",
                "user_campaigns.metadata（目前皆 {}）",
                "campaigns.redeem_limit_per_user / lottery_limit_per_user（未強制）",
            ],
        },
        {
            "level": "warn",
            "title": "表已建、Phase 6 或外部依賴",
            "items": [
                "lottery_draws / lottery_winners — 抽獎排程未接",
                "push_logs — OA 推播未接",
                "line_follow_events — 需乙方 webhook 才有資料",
            ],
        },
        {
            "level": "info",
            "title": "與 status 並存的旗標（刻意重複）",
            "items": [
                "user_campaigns.shared / lottery_eligible 與 status 欄位並用，方便 PM 查詢與寬鬆狀態機",
            ],
        },
    ]

    return {
        "period": {"date_from": d_from.isoformat(), "date_to": d_to.isoformat()},
        "campaign_code": campaign.code,
        "schema_catalog": SCHEMA_CATALOG,
        "audit_notes": audit_notes,
        "table_counts": counts,
        "distributions": {
            "user_campaign_status": [{"label": r[0], "count": int(r[1])} for r in uc_status.all()],
            "generation_job_status": [{"label": r[0], "count": int(r[1])} for r in gj_status.all()],
            "page_views_by_path": [{"label": r[0], "count": int(r[1])} for r in pv_paths.all()],
        },
        "recent_user_campaigns": [
            {
                "user_campaign_id": str(r[0]),
                "line_user_id": r[1],
                "status": r[2],
                "consented": bool(r[3]),
                "shared": bool(r[4]),
                "lottery_eligible": bool(r[5]),
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in recent_uc.all()
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
