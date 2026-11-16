from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..keitaro import KeitaroClient, KeitaroAPIError
from ..models import AppSettings, OfferCache
from ..schemas import (
    CountryOut,
    DomainOut,
    GroupOut,
    MetaOut,
    SettingsOut,
    SettingsUpdate,
    SourceOut,
)
from ..utils import country_flag, country_name

_meta_cache: dict[str, Any] = {"at": 0.0, "payload": None}
_META_TTL = 30.0


def get_or_create_settings(db: Session) -> AppSettings:
    env = get_settings()
    row = db.get(AppSettings, 1)
    if row is None:
        row = AppSettings(
            id=1,
            campaign_prefix=env.campaign_prefix,
            default_domain_id=env.default_domain_id,
            default_group_id=env.default_group_id,
            default_traffic_source_id=env.default_traffic_source_id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def settings_out(db: Session, row: AppSettings | None = None) -> SettingsOut:
    row = row or get_or_create_settings(db)
    offers_cached = db.scalar(select(func.count()).select_from(OfferCache)) or 0
    env = get_settings()
    return SettingsOut(
        campaign_prefix=row.campaign_prefix,
        default_domain_id=row.default_domain_id,
        default_group_id=row.default_group_id,
        default_traffic_source_id=row.default_traffic_source_id,
        offers_synced_at=row.offers_synced_at,
        offers_cached=int(offers_cached),
        keitaro_base_url=env.keitaro_base_url,
        api_key_configured=bool(env.keitaro_api_key),
    )


def update_settings(db: Session, payload: SettingsUpdate) -> SettingsOut:
    row = get_or_create_settings(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None or field in {
            "default_domain_id",
            "default_group_id",
            "default_traffic_source_id",
        }:
            setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    invalidate_meta_cache()
    return settings_out(db, row)


def invalidate_meta_cache() -> None:
    _meta_cache["at"] = 0.0
    _meta_cache["payload"] = None


def countries() -> list[CountryOut]:
    import pycountry

    items = [
        CountryOut(code=country.alpha_2, name=country.name, flag=country_flag(country.alpha_2))
        for country in pycountry.countries
    ]
    return sorted(items, key=lambda item: item.name)


async def get_meta(db: Session, client: KeitaroClient, force: bool = False) -> MetaOut:
    now = time.monotonic()
    if not force and _meta_cache["payload"] is not None and now - _meta_cache["at"] < _META_TTL:
        return _meta_cache["payload"]

    settings_row = get_or_create_settings(db)
    settings_payload = settings_out(db, settings_row)
    env = get_settings()

    domains: list[dict] = []
    groups: list[dict] = []
    sources: list[dict] = []
    connection_ok = True
    connection_error: str | None = None

    try:
        domains, groups, sources = await asyncio.gather(
            client.list_domains(),
            client.list_groups("campaigns"),
            client.list_traffic_sources(),
        )
    except KeitaroAPIError as exc:
        connection_ok = False
        connection_error = exc.message
    except Exception as exc:  # pragma: no cover - defensive
        connection_ok = False
        connection_error = str(exc)

    payload = MetaOut(
        settings=settings_payload,
        domains=[
            DomainOut(
                id=int(item["id"]),
                name=str(item.get("name") or ""),
                state=str(item.get("state") or "active"),
                is_ssl=bool(item.get("is_ssl")),
                campaigns_count=int(item.get("campaigns_count") or 0),
            )
            for item in domains
        ],
        groups=[
            GroupOut(
                id=int(item["id"]),
                name=str(item.get("name") or ""),
                position=int(item.get("position") or 0),
                type=str(item.get("type") or "campaigns"),
            )
            for item in groups
        ],
        sources=[
            SourceOut(
                id=int(item["id"]),
                name=str(item.get("name") or ""),
                state=str(item.get("state") or "active"),
            )
            for item in sources
        ],
        countries=countries(),
        keitaro_base_url=env.keitaro_base_url,
        api_key_configured=bool(env.keitaro_api_key),
        connection_ok=connection_ok,
        connection_error=connection_error,
    )
    if connection_ok:
        _meta_cache["at"] = now
        _meta_cache["payload"] = payload
    return payload


def resolve_country_names(codes: list[str]) -> list[str]:
    return [country_name(code) for code in codes]
