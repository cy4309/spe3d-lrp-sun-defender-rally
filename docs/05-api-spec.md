# API 規格 v0.1

對應前端 LIFF 頁面（PDF page 9–13）+ 機台兌換流程（page 14–15）。

- Base URL：`/api/v1`
- Auth：除機台 API 外，皆需 LIFF Login 驗證（HTTP header `Authorization: Bearer <line_id_token>`）
- 機台 API：另一組 `Authorization: Bearer <machine_token>`，machine_id 寫在 token claim
- Response 統一格式：成功直接回 `{...}`，失敗回 `{"error": {"code": "...", "message": "..."}}`

---

## 1. LIFF 端 API（前端使用）

### 1.1 `POST /auth/line` — 登入 / 建立或更新使用者
**對應 UI**：page 9 步驟 2（用戶授權手機網頁互動）

**Request**
```json
{
  "id_token": "eyJhbGciOi...",
  "campaign_code": "anthelios-2026-summer",
  "entry_source": "qr_court",         // oa_push | qr_court | share | unknown
  "referrer_user_id": null            // 從分享連結進來時帶
}
```

**Response 200**
```json
{
  "user": {
    "id": "uuid",
    "line_user_id": "U123...",
    "display_name": "..."
  },
  "user_campaign": {
    "id": "uuid",
    "status": "authorized",
    "shared": false,
    "lottery_eligible": false
  },
  "campaign": {
    "id": "uuid",
    "code": "anthelios-2026-summer",
    "ends_at": "2026-08-23T23:59:00+08:00",
    "ai_style": "korean_fresh_real"
  }
}
```

**Errors**
- `401 invalid_id_token`
- `403 campaign_not_active`（活動未開始或已結束）

---

### 1.2 `POST /campaigns/{campaign_id}/consent` — 紀錄同意條款
**對應 UI**：page 10 checkbox「我已閱讀並同意 隱私權政策 使用條款」

**Request**
```json
{ "consent_version": "2026-06-01" }
```

**Response 200**: `{ "consent_at": "..." }`

---

### 1.3 `POST /jobs` — 建立 AI 生成任務
**對應 UI**：page 10 「開始製作」按鈕

**Request**：`multipart/form-data`
- `image`: file（jpg/png，前端壓到 ≤ 5MB、長邊 ≤ 2048px）
- `user_campaign_id`: text

**Response 202**
```json
{
  "job_id": "uuid",
  "status": "queued",
  "polling_interval_ms": 2000
}
```

**Errors**
- `400 invalid_image_format`
- `400 image_too_large`
- `409 job_already_in_progress`（同 user_campaign 已有未完成 job）
- `429 rate_limited`

---

### 1.4 `GET /jobs/{job_id}` — 輪詢任務狀態
**對應 UI**：page 11 步驟 5（AI 生成中）

**Response 200**（生成中）
```json
{
  "job_id": "uuid",
  "status": "processing",
  "queue_position": 3,
  "estimated_seconds": 25
}
```

**Response 200**（成功）
```json
{
  "job_id": "uuid",
  "status": "succeeded",
  "result_image_url": "https://.../signed-url",
  "redeem_code": {
    "code": "AB3CDEFG",
    "qr_payload": "https://api.../redeem?code=AB3CDEFG",
    "expires_at": "2026-08-23T23:59:00+08:00"
  }
}
```

**Response 200**（最終失敗）
```json
{
  "job_id": "uuid",
  "status": "failed_final",
  "error_code": "comfyui_timeout",
  "user_message": "人潮較多，請稍後再試",
  "can_retry": true       // 前端據此顯示「重試」按鈕（會建立新 job）
}
```

**前端輪詢規則**：每 2 秒一次；連續 60 秒未變動則顯示 fallback；`status` 為終態（succeeded/failed_final）即停止。

---

### 1.5 `POST /jobs/{job_id}/retry` — 失敗後重新生成
**對應 UI**：失敗頁的「重試」按鈕

行為：複製 `input_image_path` 建立**新的** job，舊 job 保持 `failed_final`。

**Response 202**: 同 1.3

**Errors**
- `409 job_not_failed`（只有 failed_final 可重試）
- `429 retry_quota_exceeded`（PRD 規則：保留一次重生機會）

---

### 1.6 `GET /me/result` — 取得目前活動的結果頁資料（重新進入 LIFF 用）
**對應 UI**：page 11 全部欄位、page 12 步驟 8（從 OA 推播點回來）

**Response 200**
```json
{
  "user_campaign_id": "uuid",
  "status": "generated",
  "result_image_url": "...",
  "redeem_code": { "code": "...", "qr_payload": "...", "status": "unused", "expires_at": "..." },
  "channel_code": null,           // 點過「領取通路折扣碼」後才有
  "campaign_locations": [...]      // 三個機台地點與時段
}
```

---

### 1.7 `POST /me/channel-code` — 領取通路折扣碼
**對應 UI**：page 11 「領取通路折扣碼」按鈕

實作：用 `FOR UPDATE SKIP LOCKED` 從 `channel_codes` 池取一張，assign 給 user_campaign。**冪等**（同一個 user_campaign 重複呼叫回同一張碼）。

**Response 200**
```json
{ "code": "A4AAZCXL" }
```

**Errors**
- `409 channel_code_pool_empty`（觸發告警）
- `403 not_eligible`（user_campaign.status 必須 ≥ generated）

---

### 1.8 `POST /me/share` — 紀錄分享動作
**對應 UI**：page 11 / page 12 「分享活動 參加抽獎」按鈕

前端先呼叫 LIFF `liff.shareTargetPicker()` 成功後再 POST 此 API。

**Request**
```json
{ "target": "line" }
```

**Response 200**
```json
{
  "shared": true,
  "lottery_eligible": true,
  "user_campaign_status": "shared"
}
```

---

### 1.9 `GET /me/lottery` — 查詢抽獎結果
**對應 UI**：page 12 / 13 中獎通知（也可從 LIFF 重進來查）

**Response 200**
```json
{
  "lottery_eligible": true,
  "lottery_result": "win",
  "prize": {
    "type": "discount_code",
    "code": "A4AAZCXLVZA2",
    "title": "滿 $1500 折 $300"
  }
}
```

`lottery_result` ∈ `pending | win | lose`。

---

## 2. 機台 API（picbot 呼叫）

機台流程詳見 PDF page 14–15。三段式：scan → check → commit。**也可以兩段式（合併 check 與 commit）**，但 MVP 拆三段較好除錯。

### 2.1 `POST /machine/redeem/check` — 預檢查（不扣碼）
**對應 UI**：page 14 步驟 2「系統感應中」、page 15 步驟 3「偵測重複領取」

**Request**
```json
{
  "code": "AB3CDEFG",
  "machine_id": "tmu-baseball-001",
  "request_id": "client-side-uuid"   // idempotency key
}
```

**Response 200**
```json
{
  "ok": true,
  "redeem_code_id": "uuid",
  "user_display_name": "..."         // 可選，供機台顯示「歡迎 XXX」
}
```

**Response 200（不通過）**
```json
{
  "ok": false,
  "reason_code": "already_redeemed",  // not_found | already_redeemed | expired | wrong_campaign
  "user_message": "您已領取試用包，感謝參與活動"
}
```

> 不通過情境也回 200（業務層級失敗），讓機台拿到 `user_message` 直接顯示。HTTP 4xx/5xx 留給「真正的錯誤」（無效 token、伺服器錯）。

---

### 2.2 `POST /machine/redeem/commit` — 正式扣碼（觸發掉物）
**對應 UI**：page 14 步驟 3「樣品掉落中」

**Request**
```json
{
  "code": "AB3CDEFG",
  "machine_id": "tmu-baseball-001",
  "request_id": "uuid"               // 同一 request_id 重複呼叫回同樣結果（冪等）
}
```

實作：transaction + `FOR UPDATE`（見 `04-state-machines.md` §3）。

**Response 200**
```json
{
  "ok": true,
  "dispense_token": "abc-xyz",       // 可選；給機台確認「我這次掉落是合法的」
  "redeemed_at": "2026-07-03T13:42:00+08:00"
}
```

**Response 200（失敗，不要掉物）**：同 2.1 不通過格式

---

### 2.3 `POST /machine/redeem/dispense-result` — 機台回報實際出貨結果（可選）
**用途**：機台掉物失敗（卡住、缺貨）時通知後端。MVP 可先不做。

---

## 3. 內部 API（worker / 排程）

不對外，由 worker 與排程任務呼叫。

### 3.1 `POST /internal/jobs/{job_id}/result` — worker 回寫 AI 結果
- 由 comfyUI/picbot proxy 呼叫
- 需要 internal token

### 3.2 `POST /internal/lottery/draw` — 觸發抽獎
- 由排程觸發（例如活動結束後 N 小時）
- 從 `user_campaigns` 撈 `lottery_eligible = TRUE` 名單，亂數抽 N 個，寫入 `lottery_winners`
- 後續觸發 push（見 3.3）

### 3.3 `POST /internal/push/lottery-result` — 寄發中獎通知
- 對 `lottery_winners` 中 `notified_at IS NULL` 的，呼叫 LINE OA push API
- 寫入 `push_logs`

---

## 4. 錯誤代碼總表（供前端統一處理）

| code | HTTP | 使用者訊息 | 動作 |
|---|---|---|---|
| `invalid_id_token` | 401 | 請重新從 LINE 進入活動 | 觸發重新登入 |
| `campaign_not_active` | 403 | 活動已結束 | 顯示活動結束頁 |
| `invalid_image_format` | 400 | 請上傳 JPG 或 PNG 圖片 | 留在上傳頁 |
| `image_too_large` | 400 | 圖片過大，請重新選擇 | 留在上傳頁 |
| `job_already_in_progress` | 409 | 您已有一個正在進行的生成 | 跳轉到 result 頁 |
| `comfyui_timeout` | — | 人潮較多，請稍後再試 | 顯示重試按鈕 |
| `nsfw_detected` | — | 此照片無法使用，請更換 | 回到上傳頁 |
| `no_face_detected` | — | 請上傳清晰人像照 | 回到上傳頁 |
| `channel_code_pool_empty` | 409 | 折扣碼已發送完畢 | 顯示活動公告 |
| `retry_quota_exceeded` | 429 | 已達重試上限 | 灰掉重試按鈕 |
| `already_redeemed` | — | 您已領取試用包 | 機台顯示阻擋頁 |

---

## 5. 待你確認的 API 設計問題

1. **機台是 picbot 直接呼我們，還是中間有 picbot proxy？** 若有 proxy，token 簽發方式要再討論。
2. **圖片回傳**：`result_image_url` MVP 用 signed URL（過期 1 小時），還是直接給靜態 URL？前者較安全但前端要處理 refresh。
3. **抽獎時機**：活動結束統一抽？還是每天抽一批？（影響 `lottery_draws` 排程）
4. **被分享者進場**：page 12 顯示「LINE Points 100 點」獎勵分享者，這獎勵是直接送（每邀一人 = 100 點），還是抽獎才送？
