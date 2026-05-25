"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "dev"
    app_debug: bool = True
    app_base_url: str = "http://localhost:8000"
    public_base_url: str = ""  # HTTPS 對外網域（ngrok / 正式網域），LINE Push 取圖用

    database_url: str
    redis_url: str

    liff_id: str = ""
    liff_channel_id: str = ""
    line_channel_access_token: str = ""
    line_channel_secret: str = ""

    internal_api_token: str = ""
    machine_api_token_signing_key: str = ""
    admin_stats_token: str = ""
    partner_webhook_token: str = ""

    image_storage_path: str = "/data/images"
    image_base_url: str = "http://localhost:8000/img"

    comfyui_base_url: str = ""
    comfyui_api_key: str = ""
    picbot_base_url: str = ""

    job_retry_max: int = 1
    polling_interval_ms: int = 2000


@lru_cache
def get_settings() -> Settings:
    return Settings()
