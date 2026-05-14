# CLAUDE.md

> 這份檔案是給 Claude（VSCode Claude extension / Claude Code CLI / Cowork mode）閱讀的專案脈絡。
> 開啟這個 repo 時，請先讀完本檔，再讀 `docs/` 與 `README.md`。

---

## 1. 專案一句話

理膚寶水安得利防曬應援活動的 **LIFF + FastAPI + PostgreSQL + comfyUI** 互動推廣網站。
使用者從 LINE 進入活動 → 上傳照片 → AI 生成應援照 → 拿到 QR Code → 到實體機台兌換樣品 → 分享 LINE 取得抽獎資格。

完整使用者流程見 `docs/liff-user-flow-prd.md`。

## 2. 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 18 + Vite 5 + TypeScript 5 + LIFF SDK 2 |
| 後端 | FastAPI（async） + SQLAlchemy 2 async + asyncpg |
| 資料庫 | PostgreSQL 16 |
| 佇列 / 快取 | Redis 7 |
| Worker | 自寫 Python worker（Phase 5 會改為真正接 comfyUI） |
| 容器 | Docker Compose（web / api / worker / db / redis） |
| 測試 | pytest + pytest-asyncio |

## 3. 目錄結構

```
spe3d-lrp-sun-defender-rally/
├── apps/
│   ├── api/        FastAPI 後端
│   │   ├── app/
│   │   │   ├── main.py           入口（掛 router、CORS、靜態圖片）
│   │   │   ├── config.py         pydantic-settings，讀 .env
│   │   │   ├── db.py             async SQLAlchemy session
│   │   │   ├── models.py         ORM models
│   │   │   ├── schemas.py        Pydantic 請求/回應
│   │   │   ├── deps.py           DI（current_user、internal token、machine token）
│   │   │   ├── line_auth.py      LIFF id_token 驗證（目前打 LINE API）
│   │   │   ├── utils.py
│   │   │   └── api/
│   │   │       ├── health.py
│   │   │       ├── auth.py       /api/v1/auth/line, /auth/consent
│   │   │       ├── jobs.py       /api/v1/jobs（上傳、輪詢、retry）
│   │   │       ├── me.py         /api/v1/me/{result, share, channel-code, lottery}
│   │   │       ├── machine.py    /api/v1/machine/redeem/{check, commit}
│   │   │       └── internal.py   /api/v1/internal/jobs（worker 用）
│   │   ├── tests/                pytest 併發測試
│   │   ├── pytest.ini
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── worker/     Python worker，目前是 mock（直接複製檔案當作生成結果）
│   └── web/        React + Vite + LIFF 前端（目前只剩 Phase 2 骨架，Phase 4 要全換）
├── db/
│   ├── init.sql              Postgres 初始化 schema（首次啟動容器自動跑）
│   └── seed_test_codes.sql
├── docs/                     見下方「文件導覽」
├── docker-compose.yml
├── .env.example
├── .env                      本地用，不可進版控
├── README.md
└── CLAUDE.md                 ← 你正在讀的這份
```

## 4. 開發指令

所有指令都從專案根目錄執行。

```bash
# 第一次啟動：複製環境變數、起所有服務
cp .env.example .env          # 編輯 .env 填 LIFF / LINE 憑證
docker compose up -d
docker compose ps

# 改後端
#   apps/api/app 下任何檔案 → uvicorn --reload 會自動重載
# 改前端
#   apps/web/src 下任何檔案 → Vite HMR 自動更新
# 改 schema
#   先改 db/init.sql，然後：
docker compose down -v
docker compose up -d
#   ⚠️ 這會清掉本地資料。未來導入 Alembic 後改成漸進式 migration。

# 跑後端測試
docker compose exec api pytest tests/ -v

# 看 logs
docker compose logs -f api
docker compose logs -f worker

# 進 DB
docker compose exec db psql -U lrp -d lrp_anthelios

# 重 build 容器（裝新套件時）
docker compose build api worker
docker compose up -d
```

開發時開啟的網址：

- API Swagger：http://localhost:8000/docs
- Web（Vite dev server）：http://localhost:5173
- DB：localhost:5432（user `lrp` / db `lrp_anthelios`，密碼見 `.env`）

## 5. 目前 Phase 進度（2026-05）

依 `docs/01-roadmap.md`：

- [x] **Phase 1** — 規格固定（DB schema、狀態機、API spec、env example）
- [x] **Phase 2** — 專案骨架 + Docker Compose
- [x] **Phase 3** — FastAPI 後端核心
  - 所有核心 API 已上 Swagger（auth / jobs / me / machine / internal）
  - 兩支關鍵併發測試已綠：
    - `tests/test_machine_concurrent_redeem.py` — 機台扣碼併發只一個 win
    - `tests/test_channel_code_pool.py` — 折扣碼池併發各拿不同碼
- [ ] **Phase 4** — LIFF 前端（**接下來要做的事**，見 `docs/PHASE4_KICKOFF.md`）
- [ ] **Phase 5** — 真實 comfyUI / picbot 串接 + 非同步 worker
- [ ] **Phase 6** — 機台、推播、營運後台、上線檢查

## 6. 已知限制（接手前要知道）

來自 `docs/PHASE3_NOTES.md`：

- **worker 是 mock**：把輸入圖直接複製當作輸出，Phase 5 會換成真正呼叫 comfyUI。
- **LIFF id_token 走 LINE 線上 API 驗證**：每次登入都會打外網，流量大時要改用本地 JWKS 驗證。
- **`/auth/line` 把 access token 放在 `X-Access-Token` response header**：若前端 LIFF webview 跨域取不到，改放 response body。
- **沒做 rate limit**：MVP 期靠 LINE 入口流量分散即可。
- **沒導入 Alembic**：改 schema 目前都要 `docker compose down -v`，會洗掉資料。
- **機台 token 還沒有後台簽發介面**：目前要手動用 `MACHINE_API_TOKEN_SIGNING_KEY` 簽 JWT。

## 7. 約定 / 慣例

- **語言**：程式碼註解可以中文，commit message 與 PR 標題用英文或中英皆可。
- **API 路徑**：所有業務 API 都掛在 `/api/v1/...` 之下。內部用走 `/api/v1/internal/...`（需 `INTERNAL_API_TOKEN`）。
- **身分驗證**：
  - 前端使用者：`Authorization: Bearer <access_token>`（由 `/auth/line` 拿到）
  - 機台：`Authorization: Bearer <jwt>`（用 `MACHINE_API_TOKEN_SIGNING_KEY` 簽）
  - worker / 內部：`X-Internal-Token` header
- **狀態機**：見 `docs/04-state-machines.md`。`user_campaign / generation_job / redeem_code` 三個核心狀態都不要在 API handler 裡硬寫流轉，集中在 service 層。
- **錢 / 兌換相關的 query**：一律走 `SELECT ... FOR UPDATE` 或 `INSERT ... ON CONFLICT DO NOTHING`，併發保護有測試守。
- **時間**：DB 一律 `timestamptz`，後端用 UTC，前端再轉 `Asia/Taipei`。
- **環境變數**：見 `.env.example` 與 `docs/06-env-example.md`。前端用的變數必須以 `VITE_` 開頭（會 bundle 進 client，**只能放公開資訊**）。

## 8. 文件導覽（`docs/`）

| 檔案 | 用途 |
|---|---|
| `01-roadmap.md` | 整體開發路線圖（Phase 1–6） |
| `02-db-schema.sql` | PostgreSQL schema（已套用在 `db/init.sql`） |
| `03-db-schema-notes.md` | DB 設計決策、欄位選擇理由 |
| `04-state-machines.md` | user_campaign / generation_job / redeem_code 狀態機 |
| `05-api-spec.md` | API 規格（OpenAPI 風格） |
| `06-env-example.md` | 環境變數說明 |
| `liff-user-flow-prd.md` | 使用者流程與 MVP 範圍（PRD） |
| `PHASE3_NOTES.md` | Phase 3 完成時的操作說明、已知限制 |
| `PHASE4_KICKOFF.md` | **下一階段任務拆分**，可直接餵 Claude 當提示 |
| `0505 [啟雲科技] ...Line串接討論.pdf` | 與客戶的 LINE 串接會議資料 |

## 9. 乙方 Webhook 串接（粉絲追蹤通知）

乙方（LINE 官方帳號管理商）負責接收 LINE platform webhook，並將原始事件**原封不動**轉發至我方 API。

**接收端點（待實作，Phase 6）：**

```
POST /api/v1/webhook/line-events
Header: X-Partner-Token: <PARTNER_WEBHOOK_TOKEN>
```

- Body：LINE 原始 webhook JSON，**不需要篩選事件類型，全部轉發**
- 我方自行判斷事件類型（`follow` / `unfollow` 處理，其餘忽略）
- `PARTNER_WEBHOOK_TOKEN` 與 endpoint URL 我方負責產生後透過私密管道提供給乙方
- Token 值不可寫死在程式碼，一律讀 `PARTNER_WEBHOOK_TOKEN` 環境變數

**歸因邏輯：**
LINE webhook 的 `follow` 事件只帶 `userId`，無法直接知道使用者是透過哪個活動追蹤。
需在收到事件後，查 `user_campaigns` 表比對 `line_user_id`，判斷該用戶是否參加過本活動。

**待辦：**
- 實作 `apps/api/app/api/webhook.py` 路由
- 在 `apps/api/app/main.py` 掛上 `/api/v1/webhook` prefix
- 在 `.env.example` 與 `docs/06-env-example.md` 補 `PARTNER_WEBHOOK_TOKEN`

## 10. 給 Claude 的工作守則

- 動 schema 之前先問人，會牽動 `db/init.sql` 與 `apps/api/app/models.py` 兩處。
- 動到 `auth.py` / `machine.py` / `me/channel-code` 這幾條路徑時，務必確認對應的 pytest 還能過：
  ```bash
  docker compose exec api pytest tests/ -v
  ```
- 改完前端後不需要重 build 容器（Vite HMR）；改 `package.json` 或 `requirements.txt` 才需要 `docker compose build`。
- 寫新 endpoint 時：route → schema → service / DB 操作 → 加測試。即使是 MVP 階段，碰到「碼」「兌換」「抽獎」這類業務動作一律補測試。
- 別把 `.env` 提交進版控。新環境變數同時更新 `.env.example` 與 `docs/06-env-example.md`。
- 提到「我的工作目錄」「outputs 資料夾」這類 Cowork 用語時，VSCode extension 環境下實際就是這個 repo 根目錄。
