"""Background worker — 從 redis queue 拉任務，呼叫 AI 微服務，回寫結果。

Phase 3：mock AI 用 sleep + 直接 copy 原圖到 outputs 路徑，回寫 succeeded。
Phase 5：把 _run_ai_mock 換成真的呼叫 comfyUI 微服務。
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import signal
from pathlib import Path

import httpx
import redis.asyncio as redis_async

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] worker: %(message)s",
)
log = logging.getLogger("worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
API_BASE = os.getenv("APP_BASE_URL", "http://api:8000")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "")
IMAGE_STORAGE = Path(os.getenv("IMAGE_STORAGE_PATH", "/data/images"))
QUEUE_KEY = "queue:generation"


async def _run_ai_mock(input_rel_path: str) -> tuple[str, None]:
    """Mock：sleep 3 秒模擬生成，把輸入檔 copy 到 outputs 路徑當輸出。

    回傳：(輸出檔相對路徑, error_code or None)
    """
    await asyncio.sleep(3)
    src = IMAGE_STORAGE / input_rel_path
    if not src.exists():
        log.error("input file not found: %s", src)
        return ("", "invalid_image")

    out_rel = input_rel_path.replace("inputs/", "outputs/", 1)
    out_full = IMAGE_STORAGE / out_rel
    out_full.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, out_full)
    log.info("mock-generated: %s", out_rel)
    return (out_rel, None)


async def _post_result(job_id: str, body: dict) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{API_BASE}/api/v1/internal/jobs/{job_id}/result",
            json=body,
            headers={"X-Internal-Token": INTERNAL_TOKEN},
        )
        if resp.status_code >= 400:
            log.error("write back failed: %s %s", resp.status_code, resp.text)


async def _fetch_job_meta(job_id: str) -> dict | None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{API_BASE}/api/v1/internal/jobs/{job_id}",
            headers={"X-Internal-Token": INTERNAL_TOKEN},
        )
        if resp.status_code != 200:
            log.error("fetch job meta failed: %s %s", resp.status_code, resp.text)
            return None
        return resp.json()


async def _process_job(job_id: str) -> None:
    """處理一個 job — 從 API 取 metadata、跑 AI、回寫結果。"""
    log.info("picked job=%s", job_id)

    meta = await _fetch_job_meta(job_id)
    if meta is None:
        await _post_result(job_id, {"status": "failed", "error_code": "invalid_image"})
        return

    input_rel = meta["input_image_path"]
    out_rel, err = await _run_ai_mock(input_rel)
    if err:
        await _post_result(job_id, {"status": "failed", "error_code": err})
        return

    await _post_result(job_id, {
        "status": "succeeded",
        "output_image_path": out_rel,
        "external_job_id": f"mock-{job_id[:8]}",
    })


async def main() -> None:
    log.info("worker started — connecting to %s", REDIS_URL)
    client = redis_async.from_url(REDIS_URL, decode_responses=True)

    stop = asyncio.Event()
    def _handle(*_): stop.set()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle)

    log.info("waiting for jobs on queue: %s", QUEUE_KEY)
    while not stop.is_set():
        try:
            # BLPOP 阻塞最多 5 秒，timeout 後回 None 讓我們檢查 stop flag
            item = await client.blpop([QUEUE_KEY], timeout=5)
        except Exception as e:
            log.error("blpop error: %s; sleep 3s", e)
            await asyncio.sleep(3)
            continue

        if item is None:
            continue

        _, job_id = item  # (queue_name, value)
        try:
            await _process_job(job_id)
        except Exception as e:
            log.exception("process job failed: %s", e)
            await _post_result(job_id, {"status": "failed", "error_code": "network_error"})

    await client.aclose()
    log.info("worker shut down")


if __name__ == "__main__":
    asyncio.run(main())
