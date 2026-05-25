-- 既有 DB 增量 migration（不想 docker compose down -v 時手動執行）
-- docker compose exec db psql -U lrp -d lrp_anthelios -f /path/migrate_analytics_tables.sql

DO $$ BEGIN
    CREATE TYPE line_follow_event_type AS ENUM ('follow', 'unfollow');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS page_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    line_user_id    TEXT,
    user_id         UUID REFERENCES line_users(id) ON DELETE SET NULL,
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pv_campaign_time ON page_views (campaign_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_campaign_user ON page_views (campaign_id, line_user_id);

CREATE TABLE IF NOT EXISTS line_follow_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id    TEXT NOT NULL,
    event_type      line_follow_event_type NOT NULL,
    is_unblocked    BOOLEAN NOT NULL DEFAULT FALSE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES line_users(id) ON DELETE SET NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_payload     JSONB
);
CREATE INDEX IF NOT EXISTS idx_lfe_campaign_time ON line_follow_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lfe_line_user ON line_follow_events (line_user_id, occurred_at DESC);
