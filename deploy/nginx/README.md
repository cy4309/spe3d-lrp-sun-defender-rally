# Nginx 部署交接說明

給部署工程師：本目錄提供 **單網域** 反向代理範例，讓 LIFF 前端與 FastAPI 共用同一個 HTTPS 網域（與本地 Vite dev proxy 行為一致）。

## 架構示意

```
使用者 (LINE LIFF WebView)
        │
        ▼
   Nginx :443  (本檔)
        ├── /          → React SPA（apps/web/dist）
        ├── /api/      → FastAPI :8000（僅內網）
        └── /img/      → FastAPI 靜態圖（storage volume）
```

背景服務（不經 Nginx 對外）：

| 服務 | 預設 | 說明 |
|------|------|------|
| api | `127.0.0.1:8000` | `docker compose` 或 systemd |
| worker | 無 port | 透過 Redis + internal API |
| db | `127.0.0.1:5432` | 勿對外 |
| redis | `127.0.0.1:6379` | 勿對外 |

## 部署步驟

### 1. 複製並編輯設定

```bash
cp deploy/nginx/lrp-anthelios.conf.example /etc/nginx/sites-available/lrp-anthelios.conf
# 編輯 server_name、ssl_certificate、root、upstream
ln -s /etc/nginx/sites-available/lrp-anthelios.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 2. 建置前端

```bash
cd apps/web
npm ci
# 與正式網域同源時，VITE_API_BASE_URL 留空即可
export VITE_LIFF_ID=<LINE LIFF ID>
export VITE_CAMPAIGN_CODE=anthelios-2026-summer
export VITE_MOCK_MODE=false
npm run build
rsync -av dist/ /var/www/lrp-anthelios/web/dist/
```

### 3. 後端環境變數（`.env` 重點）

| 變數 | 建議值（單網域） |
|------|------------------|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false`（關閉 `/tools`、`/api/v1/admin`） |
| `IMAGE_BASE_URL` | `/img`（同源，靠 Nginx 轉發標頭組絕對 URL） |
| `APP_BASE_URL` | `https://<正式網域>`（QR deep link 用） |
| `DATABASE_URL` / `REDIS_URL` | 指向內網 db / redis |
| `INTERNAL_API_TOKEN` | 強隨機字串，worker 與 API 共用 |

Worker 容器內 **`APP_BASE_URL` 必須是 API 可達位址**（Docker 內為 `http://api:8000`），見 `docker-compose.yml`。

### 4. API 僅聽內網

正式環境請勿將 `8000` 直接暴露公網。範例：

```yaml
# docker-compose 生產調整示意
api:
  ports:
    - "127.0.0.1:8000:8000"
```

或 uvicorn 只 bind `127.0.0.1`。

### 5. 儲存體

`storage/`（compose 掛載為 API / worker 的 `/data`）需持久化 volume，內含使用者上傳與 AI 結果圖。

### 6. LINE / LIFF 設定

- **LIFF Endpoint URL**：`https://<正式網域>/`（與 `server_name` 一致，必須 HTTPS）
- 若使用 **ngrok 僅限開發**；上線後改正式網域並更新 LINE Console

## Nginx 路由對照

| 路徑 | 處理 |
|------|------|
| `/` | SPA，`try_files` → `index.html` |
| `/api/*` | 反向代理 → FastAPI |
| `/img/*` | 反向代理 → FastAPI 靜態圖 |
| `/assets/*` | 靜態檔，長快取 |
| `/docs`、`/tools/`、`/api/v1/admin/` | 範例設定回 **404**（正式環境） |

## 上傳與逾時

- `client_max_body_size 20M`：照片上傳（可依需求調整）
- `proxy_read_timeout 120s`：AI job 建立；輪詢為短請求，一般足夠

## 健康檢查

```bash
curl -fsS https://<正式網域>/api/v1/health
```

## 常見問題

**Q：圖片在 LIFF 裡破圖？**  
確認 Nginx 有帶 `X-Forwarded-Proto`、`X-Forwarded-Host`，且 `IMAGE_BASE_URL=/img`。

**Q：登入後拿不到 token？**  
檢查 `/api/v1/auth/line` 回應 header `X-Access-Token`；跨網域時需改為 body 回傳（見 `docs/PHASE3_NOTES.md`）。

**Q：乙方 webhook？**  
`POST https://<網域>/api/v1/webhook/line-events`，Header `X-Partner-Token`（見 `CLAUDE.md` §11）。

## 相關文件

- 環境變數：`docs/06-env-example.md`、`.env.example`
- API 規格：`docs/05-api-spec.md`
- 專案脈絡：`CLAUDE.md`
