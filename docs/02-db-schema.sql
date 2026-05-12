-- ===========================================================================
-- 理膚寶水安得利防曬應援互動 — PostgreSQL Schema (MVP v0.1)
-- 對應 PRD：liff-user-flow-prd.md
-- 命名規則：snake_case；主鍵一律使用 UUID（gen_random_uuid()）
-- 時間欄位一律 timestamptz；軟刪除以 deleted_at 表示
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;       -- 大小寫不敏感字串（兌換碼用）

-- ---------------------------------------------------------------------------
-- ENUM 型別（對應 PRD「狀態模型」段）
-- ---------------------------------------------------------------------------
CREATE TYPE user_campaign_status AS ENUM (
    'authorized',
    'generated',
    'shared',
    'lottery_eligible',
    'redeemed'
);

CREATE TYPE lottery_result AS ENUM ('pending', 'win', 'lose');

CREATE TYPE generation_job_status AS ENUM (
    'queued',
    'processing',
    'succeeded',
    'failed_retrying',
    'failed_final'
);

CREATE TYPE redeem_status AS ENUM (
    'unused',
    'redeemed',
    'expired',
    'blocked_duplicate'
);

CREATE TYPE entry_source AS ENUM (
    'oa_push',     -- 從 LINE OA 推播進來
    'qr_court',    -- 球場 QR
    'share',       -- 朋友分享
    'unknown'
);

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'closed');

-- ---------------------------------------------------------------------------
-- 1. 活動表（支援未來多活動期 / 多球場）
-- ---------------------------------------------------------------------------
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,           -- e.g. 'anthelios-2026-summer'
    name            TEXT NOT NULL,
    ai_style        TEXT NOT NULL DEFAULT 'korean_fresh_real',
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    redeem_limit_per_user   INT NOT NULL DEFAULT 1,
    lottery_limit_per_user  INT NOT NULL DEFAULT 1,
    status          campaign_status NOT NULL DEFAULT 'draft',
    config          JSONB NOT NULL DEFAULT '{}'::jsonb, -- 彈性參數（輪播文案、機台白名單…）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX idx_campaigns_status_period ON campaigns (status, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- 2. LINE 使用者（身分唯一鍵 = line_user_id）
-- ---------------------------------------------------------------------------
CREATE TABLE line_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id        TEXT NOT NULL UNIQUE,       -- LINE 提供的唯一 ID（U...）
    display_name        TEXT,
    picture_url         TEXT,
    language            TEXT,
    first_authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_authorized_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. 使用者活動參與（核心狀態表 — 一個 user 在一個 campaign 只有一筆）
-- ---------------------------------------------------------------------------
CREATE TABLE user_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    entry_source        entry_source NOT NULL DEFAULT 'unknown',
    referrer_user_id    UUID REFERENCES line_users(id),  -- 由誰分享進來
    consent_at          TIMESTAMPTZ,                     -- 同意條款時間（隱私合規）
    consent_version     TEXT,                            -- 條款版本
    status              user_campaign_status NOT NULL DEFAULT 'authorized',
    shared              BOOLEAN NOT NULL DEFAULT FALSE,
    shared_at           TIMESTAMPTZ,
    lottery_eligible    BOOLEAN NOT NULL DEFAULT FALSE,
    lottery_result      lottery_result NOT NULL DEFAULT 'pending',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, campaign_id)
);

CREATE INDEX idx_uc_campaign_status ON user_campaigns (campaign_id, status);
CREATE INDEX idx_uc_lottery ON user_campaigns (campaign_id, lottery_eligible, lottery_result);
CREATE INDEX idx_uc_referrer ON user_campaigns (referrer_user_id);

-- ---------------------------------------------------------------------------
-- 4. AI 生成任務
-- ---------------------------------------------------------------------------
CREATE TABLE generation_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    input_image_path    TEXT NOT NULL,              -- S3 key 或本地路徑
    input_image_sha256  TEXT,                       -- 防止同檔重複/稽核
    output_image_path   TEXT,
    ai_style            TEXT NOT NULL,              -- 拷貝自 campaign，避免 campaign 改 style 影響歷史
    status              generation_job_status NOT NULL DEFAULT 'queued',
    retry_count         SMALLINT NOT NULL DEFAULT 0,
    max_retries         SMALLINT NOT NULL DEFAULT 1, -- PRD 規則：自動重試 1 次
    external_job_id     TEXT,                       -- comfyUI / picbot 回傳
    error_code          TEXT,
    error_message       TEXT,
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gj_uc ON generation_jobs (user_campaign_id);
CREATE INDEX idx_gj_status ON generation_jobs (status) WHERE status IN ('queued','processing','failed_retrying');
CREATE INDEX idx_gj_external ON generation_jobs (external_job_id);

-- ---------------------------------------------------------------------------
-- 5. 通路折扣碼池（8 碼英數，由甲方預先匯入；發放給每位完成生成的使用者）
--    UI: 結果頁「領取通路折扣碼」按鈕對應這張表
--    user_campaign_id 為 NULL 表示「尚未發放」；assigned 後寫入並改 status
-- ---------------------------------------------------------------------------
CREATE TABLE channel_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code                CITEXT NOT NULL UNIQUE,     -- 8 碼英數，CSV 匯入
    user_campaign_id    UUID UNIQUE REFERENCES user_campaigns(id) ON DELETE SET NULL,
    assigned_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_campaign_unassigned
    ON channel_codes (campaign_id)
    WHERE user_campaign_id IS NULL;

-- ---------------------------------------------------------------------------
-- 6. 機台兌換碼（用於樣品兌換，由系統生成，QR Code 內容）
--    一個 user_campaign 最多一筆 unused 碼
--    過期條件：活動結束（campaign.ends_at）— 寫入時統一設為該值
-- ---------------------------------------------------------------------------
CREATE TABLE redeem_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    code                CITEXT NOT NULL UNIQUE,     -- 系統生成，避開易混淆字（無 0/O/1/I/L）
    status              redeem_status NOT NULL DEFAULT 'unused',
    expires_at          TIMESTAMPTZ NOT NULL,       -- = campaign.ends_at
    redeemed_at         TIMESTAMPTZ,
    redeemed_machine_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 一個 user_campaign 同時間最多一張 unused 碼（避免重發）
CREATE UNIQUE INDEX uniq_active_code_per_uc
    ON redeem_codes (user_campaign_id)
    WHERE status = 'unused';

CREATE INDEX idx_rc_status ON redeem_codes (status);
CREATE INDEX idx_rc_expires ON redeem_codes (expires_at) WHERE status = 'unused';

-- ---------------------------------------------------------------------------
-- 6. 機台兌換嘗試紀錄（無論成功失敗都記，方便除錯與防欺詐）
-- ---------------------------------------------------------------------------
CREATE TABLE machine_redemption_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redeem_code_id  UUID REFERENCES redeem_codes(id) ON DELETE SET NULL,
    code_text       TEXT NOT NULL,                  -- 即使碼不存在也記下來
    machine_id      TEXT NOT NULL,
    succeeded       BOOLEAN NOT NULL,
    reason_code     TEXT,                           -- 'ok'|'expired'|'already_redeemed'|'not_found'|'wrong_campaign'
    reason_message  TEXT,
    request_id      TEXT,                           -- 機台請求 ID（idempotency key）
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mra_machine_time ON machine_redemption_attempts (machine_id, attempted_at DESC);
CREATE INDEX idx_mra_request_id ON machine_redemption_attempts (request_id);

-- ---------------------------------------------------------------------------
-- 7. 分享紀錄（每次分享動作都留底，但抽獎資格只算一次）
-- ---------------------------------------------------------------------------
CREATE TABLE shares (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    target              TEXT NOT NULL DEFAULT 'line', -- 預留未來其他通路
    shared_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shares_uc ON shares (user_campaign_id);

-- ---------------------------------------------------------------------------
-- 8. 抽獎場次（每個 campaign 可能有多次抽獎，例如每週抽）
-- ---------------------------------------------------------------------------
CREATE TABLE lottery_draws (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    draw_name       TEXT NOT NULL,
    drawn_at        TIMESTAMPTZ,
    pool_size       INT,
    winner_count    INT NOT NULL,
    seed            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lottery_winners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_draw_id     UUID NOT NULL REFERENCES lottery_draws(id) ON DELETE CASCADE,
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    prize_type          TEXT NOT NULL,    -- 'line_points' | 'discount_code'
    prize_payload       JSONB,            -- e.g. {"points": 100} 或 {"code": "ABCD1234"}
    notified_at         TIMESTAMPTZ,
    UNIQUE (lottery_draw_id, user_campaign_id)
);

-- ---------------------------------------------------------------------------
-- 9. 推播紀錄（OA push 留底，方便追蹤限流與失敗）
-- ---------------------------------------------------------------------------
CREATE TABLE push_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id    TEXT NOT NULL,
    push_type       TEXT NOT NULL, -- 'generation_done' | 'lottery_win' | 'reminder'
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL, -- 'sent'|'failed'|'rate_limited'
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_user_time ON push_logs (line_user_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- 10. 同意條款紀錄（隱私合規需可追溯）
-- ---------------------------------------------------------------------------
CREATE TABLE consent_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    version         TEXT NOT NULL,
    consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip              INET,
    user_agent      TEXT
);

-- ---------------------------------------------------------------------------
-- updated_at 自動更新 trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'campaigns','line_users','user_campaigns',
        'generation_jobs','redeem_codes'
    ]) LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
    END LOOP;
END$$;
