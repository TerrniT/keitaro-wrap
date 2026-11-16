from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..keitaro import KeitaroClient
from ..models import StatCache
from ..schemas import StatMetrics, TrendPoint
from ..utils import to_float

INTERVAL_ALIASES = {
    "today": "today",
    "yesterday": "yesterday",
    "7d": "7d",
    "7_days": "7d",
    "30d": "30d",
    "30_days": "30d",
    "all": "all",
    "all_time": "all",
}

MEASURES = ["clicks", "conversions", "revenue", "cost", "profit", "roi", "cr", "epc"]


def normalize_interval(value: str | None) -> str:
    return INTERVAL_ALIASES.get((value or "today").lower(), "today")


def build_range(interval: str, timezone_name: str) -> dict[str, Any]:
    today = datetime.now(ZoneInfo(timezone_name)).date()
    if interval == "today":
        return {"interval": "today", "timezone": timezone_name}
    if interval == "yesterday":
        return {"interval": "yesterday", "timezone": timezone_name}
    if interval == "7d":
        return {
            "from": (today - timedelta(days=6)).isoformat(),
            "to": today.isoformat(),
            "timezone": timezone_name,
        }
    if interval == "30d":
        return {
            "from": (today - timedelta(days=29)).isoformat(),
            "to": today.isoformat(),
            "timezone": timezone_name,
        }
    return {"interval": "all_time", "timezone": timezone_name}


def _metrics_from_row(row: dict[str, Any]) -> StatMetrics:
    clicks = to_float(row.get("clicks"))
    conversions = to_float(row.get("conversions"))
    revenue = to_float(row.get("revenue"))
    cost = to_float(row.get("cost"))
    profit = to_float(row.get("profit"))
    roi = to_float(row.get("roi"))
    if not roi and cost:
        roi = profit / cost * 100
    cr = to_float(row.get("cr"))
    if not cr and clicks:
        cr = conversions / clicks * 100
    epc = to_float(row.get("epc"))
    if not epc and clicks:
        epc = revenue / clicks
    return StatMetrics(
        clicks=clicks,
        conversions=conversions,
        revenue=revenue,
        cost=cost,
        profit=profit,
        roi=roi,
        cr=cr,
        epc=epc,
    )


def sum_metrics(rows: list[dict[str, Any]]) -> StatMetrics:
    clicks = sum(to_float(row.get("clicks")) for row in rows)
    conversions = sum(to_float(row.get("conversions")) for row in rows)
    revenue = sum(to_float(row.get("revenue")) for row in rows)
    cost = sum(to_float(row.get("cost")) for row in rows)
    profit = sum(to_float(row.get("profit")) for row in rows)
    roi = profit / cost * 100 if cost else 0.0
    cr = conversions / clicks * 100 if clicks else 0.0
    epc = revenue / clicks if clicks else 0.0
    return StatMetrics(
        clicks=clicks,
        conversions=conversions,
        revenue=revenue,
        cost=cost,
        profit=profit,
        roi=roi,
        cr=cr,
        epc=epc,
    )


def _cache_key(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _get_cached(db: Session, key: str) -> dict[str, Any] | None:
    row = db.execute(select(StatCache).where(StatCache.cache_key == key)).scalar_one_or_none()
    if not row:
        return None
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        return None
    return row.payload


async def _report(
    db: Session | None,
    client: KeitaroClient,
    payload: dict[str, Any],
    ttl_seconds: int = 60,
) -> dict[str, Any]:
    key = _cache_key(payload)
    if db is not None:
        cached = _get_cached(db, key)
        if cached is not None:
            return cached

    data = await client.build_report(payload)
    data = data or {"rows": [], "total": 0}
    if db is not None:
        expires = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        db.add(StatCache(cache_key=key, payload=data, expires_at=expires))
        db.execute(
            delete(StatCache).where(
                StatCache.expires_at < datetime.now(timezone.utc) - timedelta(days=1)
            )
        )
        db.commit()
    return data


async def get_campaign_stats(
    db: Session | None,
    client: KeitaroClient,
    campaign_id: int,
    interval: str = "today",
    trend_days: int = 14,
    timezone_name: str = "Europe/Moscow",
) -> dict[str, Any]:
    interval = normalize_interval(interval)
    report_range = build_range(interval, timezone_name)

    main_payload = {
        "range": report_range,
        "dimensions": ["stream_id", "offer_id"],
        "measures": MEASURES,
        "filters": [
            {"name": "campaign_id", "operator": "EQUALS", "expression": str(campaign_id)}
        ],
        "sort": [{"name": "clicks", "order": "DESC"}],
    }
    main = await _report(db, client, main_payload)
    rows = main.get("rows", [])

    stream_rows: dict[int, list[dict[str, Any]]] = {}
    offer_rows: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        stream_id = int(to_float(row.get("stream_id")))
        offer_id = int(to_float(row.get("offer_id")))
        stream_rows.setdefault(stream_id, []).append(row)
        if offer_id:
            offer_rows.setdefault(offer_id, []).append(row)

    totals = sum_metrics(rows)
    streams = {str(key): sum_metrics(value) for key, value in stream_rows.items()}
    offers = {str(key): sum_metrics(value) for key, value in offer_rows.items()}

    # Daily trend for the sparklines.
    today = datetime.now(ZoneInfo(timezone_name)).date()
    trend_from = today - timedelta(days=trend_days - 1)
    trend_payload = {
        "range": {
            "from": trend_from.isoformat(),
            "to": today.isoformat(),
            "timezone": timezone_name,
        },
        "dimensions": ["stream_id", "offer_id", "day"],
        "measures": ["clicks", "conversions", "profit"],
        "filters": [
            {"name": "campaign_id", "operator": "EQUALS", "expression": str(campaign_id)}
        ],
        "sort": [{"name": "day", "order": "ASC"}],
    }
    trend_data = await _report(db, client, trend_payload)
    trends_by_key: dict[str, dict[str, TrendPoint]] = {}
    for row in trend_data.get("rows", []):
        stream_id = str(int(to_float(row.get("stream_id"))))
        offer_id = int(to_float(row.get("offer_id")))
        key = f"{stream_id}:{offer_id}" if offer_id else f"{stream_id}:0"
        day = str(row.get("day") or "")
        if not day:
            continue
        point = TrendPoint(
            date=day,
            clicks=to_float(row.get("clicks")),
            conversions=to_float(row.get("conversions")),
            profit=to_float(row.get("profit")),
        )
        trends_by_key.setdefault(key, {})[day] = point

    # Fill missing dates so the chart always has a stable X axis.
    dates = [(trend_from + timedelta(days=offset)).isoformat() for offset in range(trend_days)]
    trends: dict[str, list[TrendPoint]] = {}
    all_keys = set(trends_by_key)
    for stream_id, rows in stream_rows.items():
        all_keys.add(f"{stream_id}:0")
        for row in rows:
            offer_id = int(to_float(row.get("offer_id")))
            if offer_id:
                all_keys.add(f"{stream_id}:{offer_id}")
    for key in all_keys:
        points = trends_by_key.get(key, {})
        trends[key] = [
            points.get(day)
            or TrendPoint(date=day, clicks=0, conversions=0, profit=0)
            for day in dates
        ]

    # Clicks today for stream headers (derived from the daily trend report,
    # which already contains today, so we avoid one more Keitaro request).
    today_iso = today.isoformat()
    clicks_today: dict[str, float] = {}
    for row in trend_data.get("rows", []):
        if str(row.get("day") or "") != today_iso:
            continue
        stream_id = str(int(to_float(row.get("stream_id"))))
        clicks_today[stream_id] = clicks_today.get(stream_id, 0) + to_float(
            row.get("clicks")
        )

    return {
        "campaign_id": campaign_id,
        "interval": interval,
        "totals": totals,
        "streams": streams,
        "offers": offers,
        "trends": trends,
        "clicks_today": clicks_today,
        "trend_dates": dates,
    }


async def get_campaigns_stats(
    db: Session | None,
    client: KeitaroClient,
    interval: str = "today",
    timezone_name: str = "Europe/Moscow",
) -> dict[int, StatMetrics]:
    interval = normalize_interval(interval)
    payload = {
        "range": build_range(interval, timezone_name),
        "dimensions": ["campaign_id"],
        "measures": MEASURES,
        "sort": [{"name": "clicks", "order": "DESC"}],
    }
    data = await _report(db, client, payload)
    result: dict[int, StatMetrics] = {}
    for row in data.get("rows", []):
        campaign_id = int(to_float(row.get("campaign_id")))
        result[campaign_id] = _metrics_from_row(row)
    return result
