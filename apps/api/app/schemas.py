"""Pydantic 模型 — API 的 request / response 形狀。

集中放一支檔案；若未來特定 domain 超過 ~30 行再拆檔。
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

EntrySource = Literal["oa_push", "qr_court", "share", "unknown"]
JobStatus = Literal["queued", "processing", "succeeded", "failed_retrying", "failed_final"]
LotteryResult = Literal["pending", "win", "lose"]


# --- auth -----------------------------------------------------------------
class LineLoginRequest(BaseModel):
    id_token: str
    campaign_code: str
    entry_source: EntrySource = "unknown"
    referrer_user_id: UUID | None = None


class UserOut(BaseModel):
    id: UUID
    line_user_id: str
    display_name: str | None = None
    picture_url: str | None = None


class UserCampaignOut(BaseModel):
    id: UUID
    status: str
    shared: bool
    lottery_eligible: bool
    lottery_result: LotteryResult


class CampaignOut(BaseModel):
    id: UUID
    code: str
    name: str
    starts_at: datetime
    ends_at: datetime
    ai_style: str


class LoginResponse(BaseModel):
    user: UserOut
    user_campaign: UserCampaignOut
    campaign: CampaignOut


# --- consent --------------------------------------------------------------
class ConsentRequest(BaseModel):
    consent_version: str


class ConsentResponse(BaseModel):
    consent_at: datetime


# --- jobs -----------------------------------------------------------------
class JobCreatedResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    polling_interval_ms: int


class RedeemCodeOut(BaseModel):
    code: str
    qr_payload: str
    status: str
    expires_at: datetime


class JobStatusResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    queue_position: int | None = None
    estimated_seconds: int | None = None
    result_image_url: str | None = None
    redeem_code: RedeemCodeOut | None = None
    error_code: str | None = None
    user_message: str | None = None
    can_retry: bool | None = None


# --- me -------------------------------------------------------------------
class MeResultResponse(BaseModel):
    user_campaign_id: UUID
    status: str
    result_image_url: str | None = None
    redeem_code: RedeemCodeOut | None = None
    channel_code: str | None = None


class ShareRequest(BaseModel):
    target: str = "line"


class ShareResponse(BaseModel):
    shared: bool
    lottery_eligible: bool
    user_campaign_status: str


class ChannelCodeResponse(BaseModel):
    code: str


class LotteryResponse(BaseModel):
    lottery_eligible: bool
    lottery_result: LotteryResult
    prize: dict | None = None


# --- machine --------------------------------------------------------------
class MachineRedeemRequest(BaseModel):
    code: str
    machine_id: str
    request_id: str = Field(..., description="Idempotency key — 同一個值重複呼叫回同樣結果")


class MachineRedeemResponse(BaseModel):
    ok: bool
    redeem_code_id: UUID | None = None
    user_display_name: str | None = None
    reason_code: str | None = None
    user_message: str | None = None
    redeemed_at: datetime | None = None
    dispense_token: str | None = None


# --- internal -------------------------------------------------------------
class JobResultWebhook(BaseModel):
    status: Literal["succeeded", "failed"]
    output_image_path: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    external_job_id: str | None = None
