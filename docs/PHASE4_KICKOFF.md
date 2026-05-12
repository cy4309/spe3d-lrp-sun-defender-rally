# Phase 4 啟動筆記 — LIFF 前端

> 目標：手機從 LINE 進活動，可完整走完主流程（AI 部分用 mock）。
> 對應 `01-roadmap.md` 的 Phase 4 與 `liff-user-flow-prd.md` 的 A 區流程。

## 起點現況

- `apps/web/` 目前是 Phase 2 的骨架頁（只顯示 API/LIFF 健康狀態）。
- 後端 API 已就緒，列表見 `PHASE3_NOTES.md` 或 Swagger（http://localhost:8000/docs）。
- LIFF SDK 已裝、`apps/web/src/lib/liff.ts` 與 `apps/web/src/lib/api.ts` 已有 helper。

## 任務拆分（依建議實作順序）

### T1 — 路由骨架與通用版型

- 導入 `react-router-dom`（已在 dependencies）建立 5 個頁面 route：
  - `/` 活動首頁
  - `/upload` 拍照 / 上傳
  - `/processing/:jobId` 生成中
  - `/result` 結果頁（圖 + QR）
  - `/error` fallback
- 共用版型：頂部品牌條、底部固定 CTA 區、loading mask。
- 完成定義：route 之間能跳轉，每頁顯示佔位內容。

**餵 Claude 的提示範例：**
> 幫我在 `apps/web/src` 建立 react-router 的 5 個頁面 route（首頁、上傳、生成中、結果、error），共用一個 Layout component（頂部標題列、底部 CTA 區）。每頁先放 placeholder。樣式用 vanilla CSS module 即可，先不要引第三方 UI library。

### T2 — LIFF login + auth/line 串接

- `apps/web/src/lib/liff.ts` 已能 init、判斷 mock 模式；補上：
  - `liff.login()`、`liff.getIDToken()` 包成 hook。
  - 呼叫 `POST /api/v1/auth/line` 拿 `access_token`，存進記憶體（context）或 sessionStorage。
  - 之後所有 `apiGet/apiPost` 自動帶 `Authorization: Bearer`。
- 後端目前把 token 放 `X-Access-Token` response header；若 webview 取不到，改讀 response body（後端已預留改動空間）。

**測試方式：** 開發機用 LIFF 內嵌瀏覽器，或用 mock 模式（`liff.ts` 已偵測非 LINE 環境會回 `mock`）。

### T3 — 活動首頁 + 同意條款

- 抓 `VITE_CAMPAIGN_CODE` 顯示活動名稱、規則、兌換限制。
- 「我同意」勾選 → `POST /api/v1/auth/consent?campaign_code=...`
- CTA：開始製作我的應援照 → 跳 `/upload`。

### T4 — 拍照 / 上傳

- 兩個入口：`<input type="file" capture="environment">`（拍照）+ 一般上傳。
- 前端先驗證：< 10 MB、jpeg/png、最小邊 ≥ 720px。
- 上傳到 `POST /api/v1/jobs`（multipart）→ 拿 `job_id` → 跳 `/processing/:jobId`。

### T5 — 生成中頁 + 輪詢

- 每 2 秒（用 `POLLING_INTERVAL_MS`）打 `GET /api/v1/jobs/{id}`。
- 狀態：`queued / processing` 顯示輪播文案（防曬知識、產品亮點）。
- `succeeded` → 跳 `/result`；`failed_final` → 顯示稍後再試 + 重試按鈕（打 `/jobs/{id}/retry`）。
- 超過 60 秒未完成顯示「人潮較多」提示但仍繼續輪詢。

### T6 — 結果頁 + QR

- `GET /api/v1/me/result?campaign_code=...` 拿圖片 URL 與兌換碼。
- 用 `qrcode` 套件（要加進 package.json）把兌換碼畫成 QR。
- CTA：分享到 LINE 抽獎 → 呼叫 `liff.shareTargetPicker()` → 成功後 `POST /api/v1/me/share?campaign_code=...`。
- 領通路折扣碼按鈕：`POST /api/v1/me/channel-code?campaign_code=...`。

### T7 — Error fallback 與例外狀態

- `liff.login` 失敗、API 401 / 5xx、網路斷線各自有提示。
- 同意條款未勾無法上傳。
- 已兌換 / 已過期狀態顯示文案。

### T8 — 視覺收斂

- 等 T1–T7 跑得通再做 visual polish。
- 建議用 Tailwind 或 vanilla CSS；不要引重的 UI library，LIFF webview 包進去會肥。

## 完成 Phase 4 的驗證清單

- [ ] 從手機 LINE 進活動可走完：首頁 → 同意 → 上傳 → 生成中 → 結果 → 分享
- [ ] 結果頁的 QR 在機台模擬腳本 `POST /api/v1/machine/redeem/commit` 能換到 OK
- [ ] 失敗重試一次仍失敗 → 顯示 final error，不會無限 retry
- [ ] mock 模式（非 LINE 環境）下 dev server 可開出整套頁面
- [ ] 跑 `docker compose exec api pytest tests/ -v` 仍綠

## 不在 Phase 4 範圍

- 真實 comfyUI 串接（Phase 5）
- LIFF JWKS 本地驗證（Phase 5/6）
- 抽獎排程與中獎推播（Phase 6）
- 營運後台（Phase 6）

## 給 Claude 的單次任務模板

把下面段落貼給 Claude（VSCode extension 或 chat）即可：

```
我在做 Phase 4 的 T<X>。背景見 CLAUDE.md 與 docs/PHASE4_KICKOFF.md。
請只實作 T<X> 列的事，動到的檔案先列出來再寫程式。
完成後告訴我：1) 動了哪些檔 2) 怎麼測 3) 有沒有需要改後端或 .env 的地方。
```
