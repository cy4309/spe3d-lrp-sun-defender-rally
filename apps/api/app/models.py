"""SQLAlchemy ORM models — 對應 db/init.sql 的所有資料表。

設計原則：
- 用 SQLAlchemy 2.0 Mapped[] 風格
- ENUM 在 DB 已建好，這裡用 SQLAlchemy ENUM 對應（create_type=False 不重複建）
- timestamptz 用 DateTime(timezone=True)
- 不在 ORM 層宣告 server_default，全部交給 DB 的 DEFAULT 處理（避免漂移）
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import CITEXT, INET, JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# --- ENUM 名稱（對應 DB CREATE TYPE）------------------------------------
USER_CAMPAIGN_STATUS = Enum(
    "authorized", "generated", "shared", "lottery_eligible", "redeemed",
    name="user_campaign_status", create_type=False,
)
LOTTERY_RESULT = Enum("pending", "win", "lose", name="lottery_result", create_type=False)
GEN_JOB_STATUS = Enum(
    "queued", "processing", "succeeded", "failed_retrying", "failed_final",
    name="generation_job_status", create_type=False,
)
REDEEM_STATUS = Enum(
    "unused", "redeemed", "expired", "blocked_duplicate",
    name="redeem_status", create_type=False,
)
ENTRY_SOURCE = Enum(
    "oa_push", "qr_court", "share", "unknown",
    name="entry_source", create_type=False,
)
CAMPAIGN_STATUS = Enum("draft", "active", "closed", name="campaign_status", create_type=False)


# --- Tables ---------------------------------------------------------------
class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    ai_style: Mapped[str] = mapped_column(Text, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeem_limit_per_user: Mapped[int] = mapped_column(Integer, nullable=False)
    lottery_limit_per_user: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(CAMPAIGN_STATUS, nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LineUser(Base):
    __tablename__ = "line_users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    line_user_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    picture_url: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    first_authorized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_authorized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class UserCampaign(Base):
    __tablename__ = "user_campaigns"
    __table_args__ = (UniqueConstraint("user_id", "campaign_id"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("line_users.id"), nullable=False)
    campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    entry_source: Mapped[str] = mapped_column(ENTRY_SOURCE, nullable=False)
    referrer_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("line_users.id"))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(USER_CAMPAIGN_STATUS, nullable=False)
    shared: Mapped[bool] = mapped_column(Boolean, nullable=False)
    shared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lottery_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    lottery_result: Mapped[str] = mapped_column(LOTTERY_RESULT, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("user_campaigns.id"), nullable=False)
    input_image_path: Mapped[str] = mapped_column(Text, nullable=False)
    input_image_sha256: Mapped[str | None] = mapped_column(Text)
    output_image_path: Mapped[str | None] = mapped_column(Text)
    ai_style: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(GEN_JOB_STATUS, nullable=False)
    retry_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_retries: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    external_job_id: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ChannelCode(Base):
    __tablename__ = "channel_codes"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    code: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    user_campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("user_campaigns.id"), unique=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RedeemCode(Base):
    __tablename__ = "redeem_codes"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("user_campaigns.id"), nullable=False)
    code: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(REDEEM_STATUS, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_machine_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MachineRedemptionAttempt(Base):
    __tablename__ = "machine_redemption_attempts"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    redeem_code_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("redeem_codes.id"))
    code_text: Mapped[str] = mapped_column(Text, nullable=False)
    machine_id: Mapped[str] = mapped_column(Text, nullable=False)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason_code: Mapped[str | None] = mapped_column(Text)
    reason_message: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[str | None] = mapped_column(Text)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Share(Base):
    __tablename__ = "shares"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("user_campaigns.id"), nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PushLog(Base):
    __tablename__ = "push_logs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    line_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    push_type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PageView(Base):
    __tablename__ = "page_views"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    campaign_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    line_user_id: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("line_users.id"))
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


LINE_FOLLOW_EVENT_TYPE = Enum("follow", "unfollow", name="line_follow_event_type", create_type=False)


class LineFollowEvent(Base):
    __tablename__ = "line_follow_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    line_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(LINE_FOLLOW_EVENT_TYPE, nullable=False)
    is_unblocked: Mapped[bool] = mapped_column(Boolean, nullable=False)
    campaign_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("campaigns.id"))
    user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("line_users.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)


class ConsentLog(Base):
    __tablename__ = "consent_logs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("line_users.id"), nullable=False)
    campaign_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("campaigns.id"))
    version: Mapped[str] = mapped_column(Text, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
