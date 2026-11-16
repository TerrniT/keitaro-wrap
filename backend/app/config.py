from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "keitaro_wrapper.db"


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Keitaro Wrapper"
    app_env: str = "development"
    debug: bool = True

    database_url: str = f"sqlite:///{DEFAULT_DB_PATH}"

    keitaro_base_url: str = "https://tlgk.host"
    keitaro_api_key: str = ""
    keitaro_user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    keitaro_timeout: float = 45.0
    report_timezone: str = "Europe/Moscow"

    # Campaign defaults. Can be changed at runtime from the Settings page.
    campaign_prefix: str = "test_kotovsky_"
    default_domain_id: int | None = None
    default_group_id: int | None = None
    default_traffic_source_id: int | None = None

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    auto_create_tables: bool = False
    seed_offer_cache_on_startup: bool = False

    @field_validator("keitaro_base_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator(
        "default_domain_id",
        "default_group_id",
        "default_traffic_source_id",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlite_path(self) -> Path | None:
        if not self.database_url.startswith("sqlite"):
            return None
        raw = self.database_url.split("sqlite:///", 1)[-1]
        return Path(raw)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.sqlite_path:
        settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    return settings
