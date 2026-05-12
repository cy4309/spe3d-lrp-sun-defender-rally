-- ===========================================================================
-- 理膚寶水安得利防曬應援互動 — PostgreSQL Schema (MVP v0.1)
-- 此檔案在 docker compose 第一次啟動 db 時自動套用。
-- 修改後若要重新套用：docker compose down -v && docker compose up -d
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ENUM 型別 -----------------------------------------------------------------
CREATE TYPE user_campaign_status AS ENUM (
    'authorized', 'generated', 'shared', 'lottery_eligible', 'redeemed'
);
CREATE TYPE lottery_result AS ENUM ('pending', 'win', 'lose');
CREATE TYPE generation_job_status AS ENUM (
    'queued', 'processing', 'succeeded', 'failed_retrying', 'failed_final'
);
CREATE TYPE redeem_status AS ENUM (
    'unused', 'redeemed', 'expired', 'blocked_duplicate'
);
CREATE TYPE entry_source AS ENUM (
    'oa_push', 'qr_court', 'share', 'unknown'
);
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'closed');

-- 1. campaigns --------------------------------------------------------------
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    ai_style        TEXT NOT NULL DEFAULT 'korean_fresh_real',
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    redeem_limit_per_user   INT NOT NULL DEFAULT 1,
    lottery_limit_per_user  INT NOT NULL DEFAULT 1,
    status          campaign_status NOT NULL DEFAULT 'draft',
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX idx_campaigns_status_period ON campaigns (status, starts_at, ends_at);

-- 2. line_users -------------------------------------------------------------
CREATE TABLE line_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id        TEXT NOT NULL UNIQUE,
    display_name        TEXT,
    picture_url         TEXT,
    language            TEXT,
    first_authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_authorized_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. user_campaigns ---------------------------------------------------------
CREATE TABLE user_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    entry_source        entry_source NOT NULL DEFAULT 'unknown',
    referrer_user_id    UUID REFERENCES line_users(id),
    consent_at          TIMESTAMPTZ,
    consent_version     TEXT,
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

-- 4. generation_jobs --------------------------------------------------------
CREATE TABLE generation_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    input_image_path    TEXT NOT NULL,
    input_image_sha256  TEXT,
    output_image_path   TEXT,
    ai_style            TEXT NOT NULL,
    status              generation_job_status NOT NULL DEFAULT 'queued',
    retry_count         SMALLINT NOT NULL DEFAULT 0,
    max_retries         SMALLINT NOT NULL DEFAULT 1,
    external_job_id     TEXT,
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

-- 5. channel_codes（通路折扣碼池）-------------------------------------------
CREATE TABLE channel_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code                CITEXT NOT NULL UNIQUE,
    user_campaign_id    UUID UNIQUE REFERENCES user_campaigns(id) ON DELETE SET NULL,
    assigned_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cc_campaign_unassigned
    ON channel_codes (campaign_id) WHERE user_campaign_id IS NULL;

-- 6. redeem_codes（機台兌換碼）---------------------------------------------
CREATE TABLE redeem_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    code                CITEXT NOT NULL UNIQUE,
    status              redeem_status NOT NULL DEFAULT 'unused',
    expires_at          TIMESTAMPTZ NOT NULL,
    redeemed_at         TIMESTAMPTZ,
    redeemed_machine_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_active_code_per_uc
    ON redeem_codes (user_campaign_id) WHERE status = 'unused';
CREATE INDEX idx_rc_status ON redeem_codes (status);
CREATE INDEX idx_rc_expires ON redeem_codes (expires_at) WHERE status = 'unused';

-- 7. machine_redemption_attempts -------------------------------------------
CREATE TABLE machine_redemption_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redeem_code_id  UUID REFERENCES redeem_codes(id) ON DELETE SET NULL,
    code_text       TEXT NOT NULL,
    machine_id      TEXT NOT NULL,
    succeeded       BOOLEAN NOT NULL,
    reason_code     TEXT,
    reason_message  TEXT,
    request_id      TEXT,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mra_machine_time ON machine_redemption_attempts (machine_id, attempted_at DESC);
CREATE INDEX idx_mra_request_id ON machine_redemption_attempts (request_id);

-- 8. shares -----------------------------------------------------------------
CREATE TABLE shares (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_campaign_id    UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
    target              TEXT NOT NULL DEFAULT 'line',
    shared_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shares_uc ON shares (user_campaign_id);

-- 9. lottery_draws + lottery_winners ---------------------------------------
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
    prize_type          TEXT NOT NULL,
    prize_payload       JSONB,
    notified_at         TIMESTAMPTZ,
    UNIQUE (lottery_draw_id, user_campaign_id)
);

-- 10. push_logs -------------------------------------------------------------
CREATE TABLE push_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id    TEXT NOT NULL,
    push_type       TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL,
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_user_time ON push_logs (line_user_id, sent_at DESC);

-- 11. consent_logs ----------------------------------------------------------
CREATE TABLE consent_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    version         TEXT NOT NULL,
    consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip              INET,
    user_agent      TEXT
);

-- updated_at trigger -------------------------------------------------------
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

-- Seed: 預設一筆活動，方便本地開發測試 -----------------------------------
INSERT INTO campaigns (code, name, ai_style, starts_at, ends_at, status)
VALUES (
    'anthelios-2026-summer',
    '理膚寶水安得利防曬應援互動',
    'korean_fresh_real',
    '2026-07-03 00:00:00+08',
    '2026-08-23 23:59:59+08',
    'active'
);
