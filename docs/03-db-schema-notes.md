# DB Schema 設計決策說明

對應檔案：`02-db-schema.sql`

我幫你做了一些 PRD 沒明說、但 MVP 一定要先決定的事情。如果哪個你想改，我們就在這個階段改掉，之後就以這份為準。

---

## 1. 為什麼要拆 `line_users` 與 `user_campaigns`？

PRD 雖然 MVP 只一檔活動，但 G 段有提到「未來多活動期、分球場策略」。

把「人」和「人在某活動的狀態」拆兩張表的好處：

- 同一個 LINE user 進入第二檔活動時，不需要重建身分。
- `user_campaigns` 是真正的「狀態載體」，所有 job、redeem、share、lottery 都掛在它底下。
- 後台查詢「這個人總共玩過幾檔」很自然。

PRD 說「身分唯一鍵 = LINE User ID」→ 我把它放在 `line_users.line_user_id` 並加 UNIQUE。

---

## 2. 為什麼用 ENUM 而不是 TEXT？

PostgreSQL 的 ENUM：
- 寫入時會驗證值，避免 typo 進 DB（`"shred"` 之類）。
- 排序、索引比 TEXT 稍微便宜一點。
- 缺點：要新增值需要 migration（`ALTER TYPE ... ADD VALUE`）。

對 MVP 階段，狀態流轉收斂、值不多，ENUM 比 TEXT + CHECK constraint 更安全。

---

## 3. 為什麼 `generation_jobs.ai_style` 要從 campaign 拷貝？

PRD 規則「AI 風格：單一風格」目前是 OK 的。但若日後你在 campaign 上改了 ai_style，**已經生成過的歷史紀錄不該被回溯改變**。所以 job 建立時就把當下風格 snapshot 進去。

同樣概念也用在 `max_retries`：PRD 是「重試 1 次」，存在 job 上而不是寫死在程式裡，未來要 A/B 測試「重試 2 次」會比較好調。

---

## 4. 兌換碼的併發保護（重點）

PRD F 段強調「防重兌換：機台驗證必須具原子性」。

我用兩層保證：

**第一層 — DB 層的唯一性**：
```sql
CREATE UNIQUE INDEX uniq_active_code_per_uc
    ON redeem_codes (user_campaign_id)
    WHERE status = 'unused';
```
保證同一個 user_campaign 不會同時有兩張 unused 碼（避免發碼端 bug）。

**第二層 — 機台扣碼時的 row-level lock**：
這在 API 實作時用 `SELECT ... FOR UPDATE`，下一個階段做 API 時我會給你完整 SQL。

另外 `machine_redemption_attempts` 把**每一次**機台請求都記下來（含失敗原因 code），這是除錯與防欺詐的命脈，不要省。

---

## 5. 為什麼 `push_logs.line_user_id` 用 TEXT 不外鍵？

LINE 的限流、token 失效、舊用戶帳號被合併等情況，可能讓你想推給「沒在我們系統裡」的人（例如測試時）。如果用 FK，這些紀錄就插不進來。

`push_logs` 是觀測表（log），優先選擇「能寫進來」而不是「強參照完整性」。

---

## 6. `referrer_user_id` 給 D 段的「分享擴散」用

PRD D 段說 user A 分享給 user B 會帶來二次流量。我在 `user_campaigns.referrer_user_id` 留欄位，未來要做「邀請排行榜」、「分享獎勵」直接查得到。

---

## 7. `metadata` / `config` JSONB 欄位

幾張表我留了 JSONB 彈性欄位（`campaigns.config`、`user_campaigns.metadata`）。
- `campaigns.config`：輪播文案、機台白名單、UV 顯示策略 — 免得每加一個小東西就改 schema。
- `user_campaigns.metadata`：埋追蹤資料用（utm、AB test bucket）。

**規則**：JSONB 是逃生艙，不是垃圾桶。一旦某個欄位開始被 query，就升格為正規欄位。

---

## 8. 軟刪除？

MVP 不做軟刪除（沒有 `deleted_at` 欄位），保持簡單。

未來若需要「使用者要求刪除個資」，再追加：
- `line_users.deleted_at` + 對應遮罩程序
- 排程把超過保存期的圖片從儲存空間刪掉

---

## 9. 我**沒有**做的事（之後可能要）

- **分區（partitioning）**：`push_logs`、`generation_jobs` 量大時可以按月分區。MVP 不需要。
- **Read replica**：營運後台查詢可以走 replica，MVP 不需要。
- **物化檢視**：抽獎候選人池可以做 materialized view 加速，先用普通 query 即可。

---

## 需要你回答的問題

下一步進入 API 規格之前，我需要你決定這幾件事：

1. **兌換碼格式**：8 碼亂碼？6 碼數字？要不要避開易混淆字（0/O、1/I/L）？
2. **碼的有效期**：從生成成功起算 N 天？還是「活動結束就過期」？
3. **圖片儲存**：MVP 直接存本地磁碟（Docker volume），還是一開始就接 S3 相容（如 MinIO）？
4. **是否要 admin 表**：營運後台登入用，還是先用 IP 白名單 + Basic Auth 過渡？
