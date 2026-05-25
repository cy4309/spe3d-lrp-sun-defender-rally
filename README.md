# 理膚寶水安得利防曬應援互動 — LIFF 活動

LIFF + FastAPI + PostgreSQL + comfyUI 的活動互動網站。

> **接手 / 切到 VSCode 看這份**：[`CLAUDE.md`](./CLAUDE.md)
> 裡面有完整脈絡、開發指令、目前 Phase 進度、約定慣例。
> Claude（VSCode extension / Cowork mode）開啟此 repo 會自動讀 `CLAUDE.md`。

## 結構

```
spe3d-lrp-sun-defender-rally/
├── apps/
│   ├── api/        # FastAPI 後端
│   ├── web/        # React + Vite + LIFF 前端
│   └── worker/     # 處理 AI 任務的非同步 worker
├── db/
│   └── init.sql    # PostgreSQL 初始化 schema
├── docs/           # PRD、roadmap、API spec、狀態機、Phase 筆記
├── tools/          # 開發用靜態工具頁（見下方「開發工具頁」）
├── deploy/nginx/   # 正式環境 Nginx 範例設定
├── docker-compose.yml
├── .env.example
├── .env            # 本地用，不可進版控
├── CLAUDE.md       # 給 Claude 讀的專案脈絡
└── README.md
```

## 快速啟動

```bash
# 1. 複製環境變數
cp .env.example .env
# 2. 編輯 .env，填入 LIFF / LINE 相關憑證

# 3. 啟動所有服務
docker compose up -d

# 4. 確認服務狀態
docker compose ps

# 5. 查看 API（Swagger）
open http://localhost:8000/docs

# 6. 查看 Web
open http://localhost:5173
```

第一次啟動時 Postgres 會自動執行 `db/init.sql` 建立所有表。

## 服務 Port 對照

| 服務 | Port | 說明 |
|---|---|---|
| web | 5173 | Vite dev server |
| api | 8000 | FastAPI（Swagger 在 `/docs`） |
| db | 5432 | PostgreSQL |
| redis | 6379 | 任務佇列 |
| worker | — | 背景處理 |

## 開發流程

- **改後端**：`apps/api/app` 內任何檔案，FastAPI `--reload` 會自動重載
- **改前端**：`apps/web/src` 內任何檔案，Vite HMR 自動更新
- **改 schema**：先改 `db/init.sql`，然後 `docker compose down -v && docker compose up -d`（會清掉資料！未來導入 Alembic 後會做漸進式 migration）

## 開發工具頁（`tools/`）

僅供本機／ngrok 開發除錯，需 `APP_DEBUG=true`（預設）且 `docker compose up` 後 API 會掛載 `/tools`。

| 工具 | 路徑 | 用途 |
|------|------|------|
| 流程 API 測試台 | [`tools/campaign_flow_tester.html`](./tools/campaign_flow_tester.html) | 在 LINE 內用 LIFF 登入，逐步呼叫 auth / jobs / me / share 等 API，附 DB 欄位說明與 job 輪詢 |
| PM 數據儀表板 | [`tools/campaign_analytics_dashboard.html`](./tools/campaign_analytics_dashboard.html) | 查活動 KPI、分頁圖表、資料庫總覽（`GET /api/v1/admin/stats`、`/admin/db-inspect`，dev 免 token） |

**開啟方式**（擇一，建議走 Vite 同源 proxy）：

```text
http://localhost:5173/tools/campaign_flow_tester.html
http://localhost:5173/tools/campaign_analytics_dashboard.html
```

使用 ngrok 測 LIFF 時（`ngrok http 5173`）：

```text
https://<你的-ngrok>.ngrok-free.app/tools/campaign_flow_tester.html
https://<你的-ngrok>.ngrok-free.app/tools/campaign_analytics_dashboard.html
```

- **流程測試台**：請在 LINE App 內開啟，並將 ngrok 網址設為 LIFF Endpoint（與正式活動相同 `VITE_LIFF_ID`）。
- **數據儀表板**：瀏覽器即可；可選日期區間查詢。
- 正式上線請設 `APP_DEBUG=false`，`/tools` 與 admin stats 不會對外開放。

## 測試

```bash
docker compose exec api pytest tests/ -v
```

目前綠燈的兩支併發測試：

- `tests/test_machine_concurrent_redeem.py` — 兩個 client 同時扣同一碼，只一個成功
- `tests/test_channel_code_pool.py` — 兩個 user 同時領碼，各拿到不同的碼

## 目前進度

依 `docs/01-roadmap.md`：

- [x] Phase 1 — 規格固定
- [x] Phase 2 — 專案骨架 + Docker Compose
- [x] Phase 3 — FastAPI 後端核心（API 全上 Swagger、併發測試綠）
- [ ] Phase 4 — LIFF 前端 ← **進行中**，任務拆分見 `docs/PHASE4_KICKOFF.md`
- [ ] Phase 5 — comfyUI / picbot 真實串接
- [ ] Phase 6 — 機台、推播、營運後台、上線

## 正式環境 Nginx

部署工程師請見 [`deploy/nginx/README.md`](./deploy/nginx/README.md) 與範例設定 [`deploy/nginx/lrp-anthelios.conf.example`](./deploy/nginx/lrp-anthelios.conf.example)（單網域：SPA + `/api` + `/img` 反向代理）。

## 與外部服務的串接（Phase 5 處理）

- **comfyUI**：透過公司微服務 API（位址待確認），目前 worker 用 mock。
- **picbot**：機台流程，目前用 stub 模擬。

## 文件導覽

| 檔案 | 用途 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | 給 Claude 的專案脈絡（最先讀） |
| [`docs/01-roadmap.md`](./docs/01-roadmap.md) | 整體開發路線圖 |
| [`docs/02-db-schema.sql`](./docs/02-db-schema.sql) | DB Schema |
| [`docs/03-db-schema-notes.md`](./docs/03-db-schema-notes.md) | DB 設計決策說明 |
| [`docs/04-state-machines.md`](./docs/04-state-machines.md) | 狀態機設計 |
| [`docs/05-api-spec.md`](./docs/05-api-spec.md) | API 規格 |
| [`docs/06-env-example.md`](./docs/06-env-example.md) | 環境變數說明 |
| [`docs/liff-user-flow-prd.md`](./docs/liff-user-flow-prd.md) | 使用者流程 / MVP PRD |
| [`docs/PHASE3_NOTES.md`](./docs/PHASE3_NOTES.md) | Phase 3 完成筆記與已知限制 |
| [`docs/PHASE4_KICKOFF.md`](./docs/PHASE4_KICKOFF.md) | Phase 4 任務拆分 |
