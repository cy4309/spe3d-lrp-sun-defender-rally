# 環境變數清單（.env.example 來源）

Phase 2 建專案骨架時會把這些放進 `.env.example`，現在先把該蒐集/申請的事項列清楚。

---

## API（FastAPI 後端）

| 變數名 | 用途 | 取得方式 |
|---|---|---|
| `APP_ENV` | dev/staging/prod | 自填 |
| `DATABASE_URL` | PostgreSQL 連線 | docker-compose 內預設 |
| `REDIS_URL` | 任務佇列 | docker-compose 內預設 |
| `LIFF_CHANNEL_ID` | 驗 LIFF id_token 的 audience | LINE Developers Console |
| `LIFF_ID` | 前端用，但後端也需要驗來源 | LINE Developers Console |
| `LINE_CHANNEL_ACCESS_TOKEN` | OA push（即 PRD 的 `push_message_token`） | LINE OA Manager |
| `LINE_CHANNEL_SECRET` | webhook 驗簽 | LINE Developers Console |
| `INTERNAL_API_TOKEN` | worker / 排程呼內部 API | 自產隨機 64 字元 |
| `MACHINE_API_TOKEN_SIGNING_KEY` | 機台 token 簽發 | 自產 |
| `IMAGE_STORAGE_PATH` | 本地圖片儲存目錄 | `/data/images`（容器內） |
| `IMAGE_BASE_URL` | 圖片回傳給前端的 URL 前綴 | 例如 `https://api.lrp.com.tw/img` |
| `COMFYUI_BASE_URL` | comfyUI proxy | 待 picbot 端提供 |
| `COMFYUI_API_KEY` | comfyUI 認證 | 待 picbot 端提供 |
| `PICBOT_BASE_URL` | picbot 中介（若需要） | 待 picbot 端提供 |
| `JOB_RETRY_MAX` | AI 重試上限 | 預設 1（PRD 規則） |
| `POLLING_INTERVAL_MS` | 回給前端的輪詢間隔 | 預設 2000 |

---

## Web（React + Vite + LIFF）

| 變數名 | 用途 |
|---|---|
| `VITE_LIFF_ID` | LIFF SDK 初始化 |
| `VITE_API_BASE_URL` | 後端 API 入口 |
| `VITE_CAMPAIGN_CODE` | 預設活動代碼（也可從 query string 讀） |

---

## Worker

| 變數名 | 用途 |
|---|---|
| `DATABASE_URL` | 同 API |
| `REDIS_URL` | 同 API |
| `INTERNAL_API_TOKEN` | 回寫結果 |
| `COMFYUI_BASE_URL` / `COMFYUI_API_KEY` | 同 API |
| `WORKER_CONCURRENCY` | 同時處理的 job 數 |

---

## DB（Postgres）

`docker-compose.yml` 內：
- `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`

---

## 你需要去申請或跟對口要的東西（清單）

開發前最好先把這些備齊，否則中途會卡住：

1. **LINE Developers Console**
   - 建立 LINE Login channel → 拿 `LIFF_CHANNEL_ID`
   - 建立 LIFF App → 拿 `LIFF_ID`、設定 endpoint URL（要 HTTPS，本地用 ngrok）

2. **LINE 官方帳號（OA）Manager**
   - 拿 `LINE_CHANNEL_ACCESS_TOKEN`（推播用）
   - 拿 `LINE_CHANNEL_SECRET`

3. **picbot / comfyUI 對口**
   - `COMFYUI_BASE_URL`
   - 認證方式（API Key？簽章？）
   - 輸入格式（檔案上傳？URL？base64？）
   - 回傳格式（同步還是 webhook？）
   - 風格 prompt / model 指定方式
   - 失敗錯誤代碼定義

4. **甲方需提供**
   - 通路折扣碼 CSV（8 碼英數一批，建議至少準備 預估參加人數 × 1.2）
   - 抽獎獎品（折扣碼池或 LINE Points 認領方式）
   - 同意條款 / 隱私政策文案 + 版本號
   - Logo / 主視覺 / 廣告素材（page 14–15 機台閒置時播放）

5. **機台對口（picbot 端）**
   - 機台識別 ID 命名規則（建議 `<location-code>-<seq>` 例如 `tmu-baseball-001`）
   - 機台請求格式（會帶哪些 header？）
   - 掉物失敗的回報通道
