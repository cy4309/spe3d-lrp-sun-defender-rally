# 理膚寶水安得利防曬應援互動推廣 - LIFF User Flow（MVP）

## 文件目的

本文件用於固定本專案 MVP 階段的使用者流程與系統狀態，作為後續 PRD、UI 規格、API 規格與開發拆工基準。

## 專案範圍（MVP）

- 前端：React + Vite（LIFF 手機活動頁）
- 後端：Python FastAPI
- 資料庫：PostgreSQL
- 部署：Docker Compose
- 外部串接：
  - picbot（掃碼/機台流程）
  - comfyUI（AI 生成，經 proxy 呼叫）
- LINE 相關環境變數：
  - `push_message_token`
  - `liff_id`

## 核心規則（已確認）

- AI 風格：單一風格（A：真人韓系清爽應援）
- 身分唯一鍵：`LINE User ID`
- 抽獎資格：每活動期每人 1 次
- AI 失敗策略：自動重試 1 次；若仍失敗，顯示稍後再試並保留一次重生機會

---

## A. LINE / LIFF 互動主流程

1. **入口觸發**
   - 使用者從 LINE OA 推播或球場 QR Code 進入活動。
   - 進入 LIFF 活動頁（建議帶 `campaign_id`、`entry_source`）。

2. **授權與身份建立**
   - 新用戶：完成 LIFF Login + OA 授權。
   - 舊用戶：直接帶入 session。
   - 後端建立或更新該 `LINE User ID` 的活動參與紀錄。

3. **活動首頁**
   - 顯示活動說明、個資同意、活動規則、兌換限制。
   - CTA：`開始製作我的應援照`。

4. **照片輸入**
   - 使用者可 `拍照` 或 `上傳照片`。
   - 前端先做基本驗證（檔案大小、格式、解析度）。

5. **建立 AI 任務**
   - 前端上傳圖片到後端。
   - 後端建立 `generation_job`，呼叫 comfyUI（可經 proxy/picbot 中介）。
   - 狀態進入 `queued` / `processing`。

6. **AI 生成中頁**
   - 顯示生成中 UI 與品牌資訊輪播（防曬知識、產品亮點、UV 提醒）。
   - 前端輪詢任務狀態（含 timeout 與錯誤提示）。

7. **生成成功結果頁**
   - 顯示 AI 圖片、活動資訊、兌換 QR Code（或等效碼）。
   - 後端建立 `redeem_code <-> line_user_id <-> campaign_id` 對應。

8. **分享至 LINE（抽獎轉換）**
   - CTA：`分享到 LINE 參加抽獎`。
   - 分享成功後，後端將該 user 標記為 `shared=true`。
   - 同活動期若已取得抽獎資格，不重複計次。

9. **OA 推播通知**
   - 可推送內容：生成結果連結、活動提醒、中獎通知。
   - 使用 `push_message_token` 送出。

---

## B. AI 失敗與例外流程

10. **第一次失敗**
    - 狀態：`failed_retryable`。
    - 系統自動重試一次（同一張圖片、同一風格）。

11. **第二次仍失敗**
    - 狀態：`failed_final`。
    - 顯示「人潮較多，請稍後再試」。
    - 提供 CTA：`稍後重試`，並保留一次重新生成機會。

---

## C. 機台兌換流程（樣品發放）

1. **待機頁**
   - 顯示廣告輪播與紫外線指數。
   - CTA：`點擊開始兌換`。

2. **出示 QR Code**
   - 使用者於手機結果頁出示兌換 QR。

3. **後端驗證**
   - 驗證條件：
     - 兌換碼是否存在且屬於當前活動期
     - 是否綁定有效 `LINE User ID`
     - 是否已兌換（防重）
     - 是否未過期

4. **通過：出貨**
   - 機台收到允許信號後掉落樣品。
   - 顯示「樣品掉落中」與廣告。
   - 完成後提示「請領取」，數秒後回首頁。

5. **不通過：阻擋**
   - 顯示原因（已兌換/無效/逾時）。
   - 引導回活動頁查詢或聯繫現場人員。

---

## D. 分享擴散與中獎通知

- User A 分享活動連結給 User B，可帶來二次流量進入同一活動流程。
- 中獎通知原則：推送給「符合抽獎規則且實際中獎者」本人，不預設一定是被分享者。
- 抽獎資格判定以活動期與 `LINE User ID` 為準。

---

## E. 建議狀態模型（供 API / DB 對齊）

### 1) 使用者活動狀態 `user_campaign_status`

- `authorized`
- `generated`
- `shared`
- `lottery_eligible`
- `redeemed`
- `lottery_result`（win/lose/pending）

### 2) AI 任務狀態 `generation_job_status`

- `queued`
- `processing`
- `succeeded`
- `failed_retrying`
- `failed_final`

### 3) 兌換碼狀態 `redeem_status`

- `unused`
- `redeemed`
- `expired`
- `blocked_duplicate`

---

## F. 風險與注意事項（MVP 必須處理）

- **外部服務不穩定**：comfyUI/picbot 需有 timeout、重試、熔斷與明確錯誤碼。
- **流量尖峰**：生成中頁輪詢頻率需節流，避免高峰壓垮後端。
- **防重兌換**：機台驗證必須具原子性（避免併發重複掉貨）。
- **LINE 依賴**：授權失敗、push 限流、token 失效需有告警與備援處理。
- **隱私合規**：照片保存週期、刪除策略、同意條款需在頁面可見且可追溯。

---

## G. 建議交付範圍（適合接案）

- LIFF 活動前台（授權、上傳、生成中、結果、分享）
- FastAPI 後端（任務管理、結果回寫、兌換驗證、推播）
- PostgreSQL schema（user、job、redeem、share、lottery）
- 機台驗證 API（scan/check/redeem）
- Docker Compose 一鍵啟動（web/api/db/worker）
- 基礎營運後台（查詢生成/兌換/分享記錄）

> 本文件為 MVP 流程基準版。若後續加入多風格、多活動期、分球場策略或多機台併行，請以本版延伸版本控管。
