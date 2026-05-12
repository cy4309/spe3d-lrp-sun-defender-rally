# Phase 3 操作說明

## 路徑映射

你的本機目錄叫 `spe3d-lrp-sun-defender-rally/`，我的檔案產出在 `lrp-anthelios/`，直接覆蓋過去同層路徑即可（資料夾名不影響內容）。

## 套用新檔案

```bash
# 假設你已經把 outputs/lrp-anthelios/ 內容拷貝到 spe3d-lrp-sun-defender-rally/
cd spe3d-lrp-sun-defender-rally

# 後端有新套件（pyjwt、pytest…），需要重 build api 容器
docker compose build api worker
docker compose up -d
docker compose logs -f api    # 確認沒爆
```

## 新增的 API endpoints（在 /docs 都看得到）

| Method | Path | 功能 |
|---|---|---|
| POST | `/api/v1/auth/line` | LIFF 登入；token 回在 `X-Access-Token` header |
| POST | `/api/v1/auth/consent?campaign_code=...` | 紀錄同意條款 |
| POST | `/api/v1/jobs` | 上傳照片建 AI 任務 |
| GET | `/api/v1/jobs/{id}` | 輪詢任務狀態 |
| POST | `/api/v1/jobs/{id}/retry` | 失敗後重試（建新 job） |
| GET | `/api/v1/me/result?campaign_code=...` | 取結果頁資料 |
| POST | `/api/v1/me/share?campaign_code=...` | 紀錄分享 |
| POST | `/api/v1/me/channel-code?campaign_code=...` | 領通路折扣碼 |
| GET | `/api/v1/me/lottery?campaign_code=...` | 查抽獎結果 |
| POST | `/api/v1/machine/redeem/check` | 機台預檢查 |
| POST | `/api/v1/machine/redeem/commit` | 機台正式扣碼（FOR UPDATE） |
| GET | `/api/v1/internal/jobs/{id}` | worker 取 job metadata |
| POST | `/api/v1/internal/jobs/{id}/result` | worker 回寫結果 |

## 測試完整流程（沒有真實 LIFF token，用 mock 路徑）

由於 `/auth/line` 會真的打 LINE API 驗 id_token，本地若沒有真實 token 測不過。
但其他 API 可以用 DB 直接塞測試資料來驗。

**最快驗證：跑單元測試**

```bash
# 灌幾張測試用通路碼
docker compose exec db psql -U lrp -d lrp_anthelios -c \
  "INSERT INTO channel_codes (id, campaign_id, code, created_at)
   SELECT gen_random_uuid(), id, 'TESTC0' || generate_series(1,10)::text, now()
   FROM campaigns WHERE code = 'anthelios-2026-summer';"

# 跑測試
docker compose exec api pytest tests/ -v
```

預期看到：
```
tests/test_machine_concurrent_redeem.py::test_concurrent_redeem_only_one_wins PASSED
tests/test_channel_code_pool.py::test_concurrent_claim_unique_codes PASSED
```

這兩支測試驗的是：
- **機台扣碼併發**：兩個 client 同時扣同一碼 → 只一個成功
- **折扣碼池併發**：兩個 user 同時領 → 各拿到不同的碼

兩個是整套系統最關鍵的併發保護點，這兩支綠了，後續寫業務邏輯時你就可以安心。

## Phase 3 還沒做的事（Phase 4–6 處理）

1. **前端 UI**（Phase 4）— 把 web 從骨架頁換成 PRD UI 流程
2. **真實 comfyUI 串接**（Phase 5）— 把 worker 的 `_run_ai_mock` 換掉
3. **LIFF id_token 改用本地驗證 JWKS**（Phase 5/6）— 目前每次都打 LINE API
4. **抽獎排程 + 中獎通知 push**（Phase 6）
5. **機台 token 簽發後台**（Phase 6）— 目前要手動用 `machine_api_token_signing_key` 簽 JWT
6. **過期碼排程**（Phase 6）— 把 `unused` 但過期的碼批次轉 `expired`
7. **圖片清理排程**（Phase 6）— 過了保存期限的照片刪掉

## 已知限制 / 待改進

- worker mock：直接把 input 圖 copy 為 output。Phase 5 要換成 comfyUI 微服務呼叫。
- LIFF 驗證走 LINE 線上 API：每次登入會打一次外網。流量大時改成 JWKS 本地驗。
- `auth.py` 把 token 放 `X-Access-Token` response header。若你 LIFF webview 跨域取不到 header，改成 response body 的 `access_token` 欄位（小調整即可）。
- 沒做 Rate limit。MVP 期間靠 LINE 入口本身的流量分散即可，正式上線前考慮加。
