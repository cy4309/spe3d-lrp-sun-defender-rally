-- 塞 10 張測試用通路折扣碼（給 pytest 用）
-- 重複執行不會出錯（ON CONFLICT DO NOTHING）
INSERT INTO channel_codes (id, campaign_id, code, created_at)
SELECT gen_random_uuid(), c.id, 'TESTC0' || s::text, now()
FROM campaigns c, generate_series(1, 10) AS s
WHERE c.code = 'anthelios-2026-summer'
ON CONFLICT (code) DO NOTHING;

-- 顯示池子目前剩幾張未發
SELECT count(*) AS unassigned_codes
FROM channel_codes
WHERE user_campaign_id IS NULL;
