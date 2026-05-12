# 理膚寶水安得利防曬應援互動 — 開發路線圖

本文件為 PRD 之後的執行路線。每階段結束都應有可驗證的交付物。

---

## Phase 1 — 規格固定（DB / API / 狀態機）

**目標**：把所有後續開發要依賴的「合約」固定下來，避免邊寫邊改。

- [ ] DB Schema（PostgreSQL）
- [ ] 狀態機圖（user_campaign / generation_job / redeem_code）
- [ ] API 規格（OpenAPI 風格的 endpoint 列表）
- [ ] 環境變數清單（`.env.example`）

**交付物**：
- `02-db-schema.sql`
- `03-db-schema-notes.md`（設計決策說明）
- `04-api-spec.md`
- `05-state-machines.md`

---

## Phase 2 — 專案骨架 + Docker Compose

**目標**：本地一鍵跑起所有服務。

- [ ] Monorepo 結構（`apps/web`, `apps/api`, `apps/worker`, `infra/`）
- [ ] `docker-compose.yml`：web / api / db / worker / redis（佇列用）
- [ ] FastAPI Hello World、React+Vite Hello LIFF
- [ ] Alembic migration 套用 Phase 1 schema

**交付物**：repo 可 `docker compose up` 跑起，DB 表都建好。

---

## Phase 3 — FastAPI 後端核心

**目標**：核心 API 在 Swagger / Postman 可跑通（前端尚未串）。

- [ ] LIFF 登入驗證（驗 ID Token）
- [ ] `POST /api/v1/auth/line` — 建立或更新使用者
- [ ] `POST /api/v1/jobs` — 建立 AI 任務（先用 mock comfyUI）
- [ ] `GET /api/v1/jobs/{id}` — 任務輪詢
- [ ] `POST /api/v1/share` — 分享回拋
- [ ] `POST /api/v1/redeem/verify` — 兌換驗證（含原子鎖）
- [ ] `POST /api/v1/redeem/commit` — 機台扣碼

**交付物**：`/docs` 可逐一測試。

---

## Phase 4 — LIFF 前端

**目標**：手機開 LIFF 可完整走完主流程（AI 用 mock）。

- [ ] LIFF SDK 初始化、登入、取得 user profile
- [ ] 活動首頁、同意條款
- [ ] 拍照 / 上傳 + 前端基本驗證
- [ ] 生成中頁 + 輪詢 + 輪播文案
- [ ] 結果頁（圖 + QR）
- [ ] 分享至 LINE

**交付物**：手機可從進場走到拿到 QR。

---

## Phase 5 — comfyUI / picbot 串接 + 非同步 worker

**目標**：AI 任務真實執行，不再用 mock。

- [ ] worker（celery 或 arq）拉 queue 任務
- [ ] comfyUI proxy 呼叫、結果回寫
- [ ] 失敗重試 1 次 → 標記 `failed_final`
- [ ] picbot 中介（若由它觸發 comfy）
- [ ] 圖片儲存（本地或 S3 相容）

**交付物**：丟一張照片，真的能拿到 AI 圖回來。

---

## Phase 6 — 機台、推播、營運後台、上線檢查

- [ ] 機台 API（scan/check/redeem，含併發測試）
- [ ] LINE OA push（中獎通知、生成完成提醒）
- [ ] 抽獎排程（每期固定時間 / 手動觸發）
- [ ] 基礎營運後台（查詢 user / job / redeem）
- [ ] 隱私同意紀錄、照片保存週期排程
- [ ] 監控（job 失敗率、API p95、外部呼叫成功率）
- [ ] 上線檢查清單

**交付物**：MVP 可上線。
