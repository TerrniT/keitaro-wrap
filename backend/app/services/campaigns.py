from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..keitaro import KeitaroAPIError, KeitaroClient
from ..models import CampaignRecord, RemovedOffer
from ..schemas import (
    CampaignCreateIn,
    CampaignDetailOut,
    CampaignListOut,
    CampaignStatsOut,
    CampaignSummaryOut,
    DomainOut,
    GroupOut,
    SourceOut,
    StatMetrics,
    StreamOfferOut,
    StreamOut,
    TrendPoint,
)
from ..utils import (
    distribute_shares,
    ensure_prefix,
    normalize_geo,
    safe_int,
    slugify_alias,
    to_float,
)
from . import offers as offers_service
from . import stats as stats_service
from .app_settings import get_or_create_settings, settings_out


def _zero_metrics() -> StatMetrics:
    return StatMetrics()


def _empty_stats(campaign_id: int, interval: str) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "interval": interval,
        "totals": _zero_metrics(),
        "streams": {},
        "offers": {},
        "trends": {},
        "clicks_today": {},
        "trend_dates": [],
    }


async def _safe_campaign_stats(
    db: Session, client: KeitaroClient, campaign_id: int, interval: str
) -> dict[str, Any]:
    try:
        return await stats_service.get_campaign_stats(
            db,
            client,
            campaign_id,
            interval=interval,
            timezone_name=get_settings().report_timezone,
        )
    except Exception:
        return _empty_stats(campaign_id, interval)


async def _safe_campaigns_stats(
    db: Session, client: KeitaroClient, interval: str
) -> dict[int, StatMetrics]:
    try:
        return await stats_service.get_campaigns_stats(
            db, client, interval=interval, timezone_name=get_settings().report_timezone
        )
    except Exception:
        return {}


def _stream_offer(
    offer_id: int,
    name: str,
    share: int,
    state: str,
    stats_map: dict[str, StatMetrics],
    trends: dict[str, list[TrendPoint]],
    stream_id: int,
    country: list[str] | None = None,
) -> StreamOfferOut:
    return StreamOfferOut(
        offer_id=offer_id,
        name=name,
        share=share,
        state=state,  # type: ignore[arg-type]
        country=country or [],
        stats=stats_map.get(str(offer_id), _zero_metrics()),
        trend=trends.get(f"{stream_id}:{offer_id}", []),
    )


def _extract_country_filter(filters: list[dict[str, Any]]) -> list[str]:
    result: list[str] = []
    for item in filters or []:
        if item.get("name") != "country":
            continue
        payload = item.get("payload") or []
        if isinstance(payload, str):
            payload = [payload]
        for code in payload:
            code = str(code).upper()
            if code not in result:
                result.append(code)
    return result


def _campaign_summary(
    campaign: dict[str, Any],
    local: CampaignRecord | None,
    metrics: StatMetrics | None,
    sources: dict[int, SourceOut] | None = None,
    client: KeitaroClient | None = None,
) -> CampaignSummaryOut:
    metrics = metrics or _zero_metrics()
    campaign_id = safe_int(campaign.get("id"))
    alias = str(campaign.get("alias") or "")
    source_id = safe_int(campaign.get("traffic_source_id"), default=0) or None
    source = (sources or {}).get(source_id) if source_id else None
    return CampaignSummaryOut(
        id=campaign_id,
        name=str(campaign.get("name") or f"Campaign #{campaign_id}"),
        alias=alias,
        state=str(campaign.get("state") or "active"),
        type=str(campaign.get("type") or "position"),
        group_id=safe_int(campaign.get("group_id"), default=0) or None,
        group=str(campaign.get("group") or "") or None,
        domain_id=safe_int(campaign.get("domain_id"), default=0) or None,
        domain=str(campaign.get("domain") or "") or None,
        traffic_source_id=source_id,
        traffic_source=source.name if source else None,
        streams_count=2 if local else 0,
        currency=str(campaign.get("cost_currency") or "USD"),
        clicks=metrics.clicks,
        conversions=metrics.conversions,
        revenue=metrics.revenue,
        cost=metrics.cost,
        profit=metrics.profit,
        roi=metrics.roi,
        cr=metrics.cr,
        created_at=str(campaign.get("created_at") or "") or None,
        updated_at=str(campaign.get("updated_at") or "") or None,
        geo=local.geo if local else [],
        offer_id=local.offer_id if local else None,
        test_url=client.campaign_test_url(alias) if client and alias else None,
        admin_url=client.admin_campaign_url(campaign_id) if client and campaign_id else None,
    )


def _local_records(db: Session) -> dict[int, CampaignRecord]:
    rows = db.scalars(select(CampaignRecord)).all()
    return {row.id: row for row in rows}


async def _resolve_defaults(
    db: Session,
    client: KeitaroClient,
    domain_id: int | None,
    group_id: int | None,
    source_id: int | None,
) -> tuple[DomainOut, GroupOut, SourceOut]:
    domains_raw, groups_raw, sources_raw = await asyncio.gather(
        client.list_domains(),
        client.list_groups("campaigns"),
        client.list_traffic_sources(),
    )
    domains = [
        DomainOut(
            id=safe_int(item.get("id")),
            name=str(item.get("name") or ""),
            state=str(item.get("state") or "active"),
            is_ssl=bool(item.get("is_ssl")),
            campaigns_count=safe_int(item.get("campaigns_count")),
        )
        for item in domains_raw
    ]
    groups = [
        GroupOut(
            id=safe_int(item.get("id")),
            name=str(item.get("name") or ""),
            position=safe_int(item.get("position")),
            type=str(item.get("type") or "campaigns"),
        )
        for item in groups_raw
    ]
    sources = [
        SourceOut(
            id=safe_int(item.get("id")),
            name=str(item.get("name") or ""),
            state=str(item.get("state") or "active"),
        )
        for item in sources_raw
    ]

    app_settings = get_or_create_settings(db)
    env = get_settings()

    target_domain_id = domain_id or app_settings.default_domain_id or env.default_domain_id
    target_group_id = group_id or app_settings.default_group_id or env.default_group_id
    target_source_id = (
        source_id or app_settings.default_traffic_source_id or env.default_traffic_source_id
    )

    domain = next((item for item in domains if item.id == target_domain_id), None)
    if domain is None:
        domain = next((item for item in domains if item.state == "active"), None)
    if domain is None:
        raise ValueError("No active domains found in Keitaro")

    group = next((item for item in groups if item.id == target_group_id), None)
    if group is None:
        group = groups[0] if groups else None
    if group is None:
        raise ValueError("No campaign groups found in Keitaro")

    source = next((item for item in sources if item.id == target_source_id), None)
    if source is None:
        source = next((item for item in sources if item.state == "active"), None)
    if source is None:
        raise ValueError("No traffic sources found in Keitaro")

    return domain, group, source


async def list_campaigns(
    db: Session,
    client: KeitaroClient,
    search: str | None = None,
    interval: str = "today",
) -> CampaignListOut:
    interval = stats_service.normalize_interval(interval)
    campaigns_result, sources_result = await asyncio.gather(
        client.list_campaigns(),
        client.list_traffic_sources(),
        return_exceptions=True,
    )
    if isinstance(campaigns_result, Exception):
        raise campaigns_result
    campaigns_raw = campaigns_result
    sources_raw = [] if isinstance(sources_result, Exception) else sources_result
    stats_map = await _safe_campaigns_stats(db, client, interval)
    sources = {
        safe_int(item.get("id")): SourceOut(
            id=safe_int(item.get("id")),
            name=str(item.get("name") or ""),
            state=str(item.get("state") or "active"),
        )
        for item in sources_raw
    }
    local = _local_records(db)

    items: list[CampaignSummaryOut] = []
    for campaign in campaigns_raw:
        campaign_id = safe_int(campaign.get("id"))
        if not campaign_id:
            continue
        if search:
            needle = search.strip().lower()
            haystack = f"{campaign_id} {campaign.get('name', '')} {campaign.get('alias', '')}".lower()
            if needle not in haystack:
                continue
        items.append(
            _campaign_summary(
                campaign,
                local.get(campaign_id),
                stats_map.get(campaign_id),
                sources,
                client,
            )
        )

    items.sort(key=lambda item: item.id, reverse=True)
    clicks = sum(item.clicks for item in items)
    conversions = sum(item.conversions for item in items)
    revenue = sum(item.revenue for item in items)
    cost = sum(item.cost for item in items)
    profit = sum(item.profit for item in items)
    totals = StatMetrics(
        clicks=clicks,
        conversions=conversions,
        revenue=revenue,
        cost=cost,
        profit=profit,
        roi=profit / cost * 100 if cost else 0,
        cr=conversions / clicks * 100 if clicks else 0,
        epc=revenue / clicks if clicks else 0,
    )
    return CampaignListOut(items=items, total=len(items), interval=interval, totals=totals)


async def create_campaign(
    db: Session,
    client: KeitaroClient,
    payload: CampaignCreateIn,
) -> CampaignDetailOut:
    geo = normalize_geo(payload.geo)
    app_settings = get_or_create_settings(db)
    final_name = ensure_prefix(payload.name, app_settings.campaign_prefix)
    domain, group, source = await _resolve_defaults(
        db, client, payload.domain_id, payload.group_id, payload.traffic_source_id
    )
    offer = await offers_service.get_offer(db, client, payload.offer_id)
    if offer.state != "active":
        raise ValueError(f"Offer #{offer.id} is not active")

    alias = f"{slugify_alias(final_name)}-{secrets.token_hex(4)}"
    campaign_payload = {
        "name": final_name,
        "alias": alias,
        "group_id": group.id,
        "domain_id": domain.id,
        "traffic_source_id": source.id,
        "type": "position",
        "state": "active",
        "cost_type": "CPC",
        "cost_value": 0,
        "notes": payload.notes or "Created by Keitaro Wrapper",
    }
    campaign = await client.create_campaign(campaign_payload)
    campaign_id = safe_int(campaign.get("id"))
    if not campaign_id:
        raise KeitaroAPIError("Keitaro did not return a campaign ID", details=campaign)

    try:
        await client.create_stream(
            {
                "campaign_id": campaign_id,
                "type": "regular",
                "name": "Google",
                "position": 1,
                "schema": "redirect",
                "action_type": "http",
                "action_payload": "https://www.google.com",
                "collect_clicks": True,
                "filters": [{"name": "country", "mode": "accept", "payload": geo}],
            }
        )
        await client.create_stream(
            {
                "campaign_id": campaign_id,
                "type": "regular",
                "name": "Offers",
                "position": 2,
                "schema": "landings",
                "action_type": "http",
                "action_payload": "",
                "collect_clicks": True,
                "offers": [{"offer_id": offer.id, "share": 100, "state": "active"}],
            }
        )
    except Exception:
        # Best-effort rollback so a half-created campaign is not left active.
        try:
            await client.archive_campaign(campaign_id)
        except Exception:
            pass
        raise

    record = CampaignRecord(
        id=campaign_id,
        name=final_name,
        alias=alias,
        geo=geo,
        offer_id=offer.id,
        domain_id=domain.id,
        group_id=group.id,
        traffic_source_id=source.id,
    )
    db.add(record)
    db.commit()
    return await get_campaign_detail(db, client, campaign_id, interval="today")


async def _get_campaign_or_fallback(client: KeitaroClient, campaign_id: int) -> dict[str, Any]:
    try:
        return await client.get_campaign(campaign_id)
    except KeitaroAPIError as exc:
        if exc.status_code not in (403, 404):
            raise
        campaigns = await client.list_campaigns()
        for item in campaigns:
            if safe_int(item.get("id")) == campaign_id:
                return item
        raise


async def get_campaign_detail(
    db: Session,
    client: KeitaroClient,
    campaign_id: int,
    interval: str = "today",
) -> CampaignDetailOut:
    interval = stats_service.normalize_interval(interval)
    campaign_result, streams_result, sources_result = await asyncio.gather(
        _get_campaign_or_fallback(client, campaign_id),
        client.list_streams(campaign_id),
        client.list_traffic_sources(),
        return_exceptions=True,
    )
    if isinstance(campaign_result, Exception):
        raise campaign_result
    if isinstance(streams_result, Exception):
        raise streams_result
    campaign = campaign_result
    streams_raw = streams_result
    sources_raw = [] if isinstance(sources_result, Exception) else sources_result
    sources = {
        safe_int(item.get("id")): SourceOut(
            id=safe_int(item.get("id")),
            name=str(item.get("name") or ""),
            state=str(item.get("state") or "active"),
        )
        for item in sources_raw
    }
    stats = await _safe_campaign_stats(db, client, campaign_id, interval)
    offer_map = await offers_service.get_offer_map(db, client)
    local = db.get(CampaignRecord, campaign_id)

    removed_rows = db.scalars(
        select(RemovedOffer).where(RemovedOffer.campaign_id == campaign_id)
    ).all()
    removed_by_stream: dict[int, list[RemovedOffer]] = {}
    for row in removed_rows:
        removed_by_stream.setdefault(row.stream_id, []).append(row)

    offers_stats: dict[str, StatMetrics] = stats.get("offers", {})
    stream_stats: dict[str, StatMetrics] = stats.get("streams", {})
    trends: dict[str, list[TrendPoint]] = stats.get("trends", {})
    clicks_today: dict[str, float] = stats.get("clicks_today", {})

    streams: list[StreamOut] = []
    has_removed = False
    for stream in sorted(streams_raw, key=lambda item: safe_int(item.get("position"))):
        stream_id = safe_int(stream.get("id"))
        active_ids: set[int] = set()
        offers: list[StreamOfferOut] = []
        for item in stream.get("offers") or []:
            offer_id = safe_int(item.get("offer_id"))
            if not offer_id:
                continue
            active_ids.add(offer_id)
            cached = offer_map.get(offer_id)
            offers.append(
                _stream_offer(
                    offer_id=offer_id,
                    name=cached.name if cached else f"Offer #{offer_id}",
                    share=safe_int(item.get("share")),
                    state=str(item.get("state") or "active"),
                    stats_map=offers_stats,
                    trends=trends,
                    stream_id=stream_id,
                    country=cached.country if cached else [],
                )
            )

        removed_offers: list[StreamOfferOut] = []
        tombstone_changed = False
        for row in removed_by_stream.get(stream_id, []):
            if row.offer_id in active_ids:
                # The offer was restored directly in Keitaro; local tombstone is stale.
                db.delete(row)
                tombstone_changed = True
                continue
            has_removed = True
            cached = offer_map.get(row.offer_id)
            removed_offers.append(
                _stream_offer(
                    offer_id=row.offer_id,
                    name=cached.name if cached else (row.offer_name or f"Offer #{row.offer_id}"),
                    share=0,
                    state="removed",
                    stats_map=offers_stats,
                    trends=trends,
                    stream_id=stream_id,
                    country=cached.country if cached else [],
                )
            )
        if tombstone_changed:
            db.commit()

        streams.append(
            StreamOut(
                id=stream_id,
                name=str(stream.get("name") or f"Stream #{stream_id}"),
                position=safe_int(stream.get("position")),
                type=str(stream.get("type") or "regular"),
                schema=str(stream.get("schema") or "landings"),
                state=str(stream.get("state") or "active"),
                action_type=stream.get("action_type"),
                action_payload=stream.get("action_payload"),
                filters=stream.get("filters") or [],
                country_filter=_extract_country_filter(stream.get("filters") or []),
                clicks_today=clicks_today.get(str(stream_id), 0),
                stats=stream_stats.get(str(stream_id), _zero_metrics()),
                offers=offers,
                removed_offers=removed_offers,
            )
        )

    summary = _campaign_summary(
        campaign, local, stats.get("totals"), sources, client=client
    )
    summary.streams_count = len(streams)
    return CampaignDetailOut(
        campaign=summary,
        streams=streams,
        interval=interval,
        totals=stats.get("totals", _zero_metrics()),
        has_removed_offers=has_removed,
    )


async def get_campaign_stats(
    db: Session, client: KeitaroClient, campaign_id: int, interval: str = "today"
) -> CampaignStatsOut:
    interval = stats_service.normalize_interval(interval)
    data = await stats_service.get_campaign_stats(
        db, client, campaign_id, interval=interval, timezone_name=get_settings().report_timezone
    )
    return CampaignStatsOut(
        campaign_id=campaign_id,
        interval=interval,
        totals=data["totals"],
        streams=data["streams"],
        offers=data["offers"],
        trends=data["trends"],
        clicks_today=data.get("clicks_today", {}),
        trend_dates=data.get("trend_dates", []),
    )


def _item_get(item: Any, key: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _normalize_input_offers(offers: list[Any]) -> list[dict[str, Any]]:
    seen: set[int] = set()
    result: list[dict[str, Any]] = []
    for item in offers:
        offer_id = safe_int(_item_get(item, "offer_id"))
        if not offer_id or offer_id in seen:
            continue
        seen.add(offer_id)
        result.append(
            {
                "offer_id": offer_id,
                "share": safe_int(_item_get(item, "share", 0)),
                "state": str(_item_get(item, "state", "active") or "active"),
            }
        )
    return result


async def save_stream_offers(
    db: Session,
    client: KeitaroClient,
    campaign_id: int,
    stream_id: int,
    offers_in: list[Any],
) -> StreamOut:
    streams = await client.list_streams(campaign_id)
    stream = next((item for item in streams if safe_int(item.get("id")) == stream_id), None)
    if stream is None:
        raise ValueError(f"Stream #{stream_id} does not belong to campaign #{campaign_id}")
    if str(stream.get("schema")) != "landings":
        raise ValueError("Offers can only be edited on a 'landings' stream")

    offer_map = await offers_service.get_offer_map(db, client)
    current = {
        safe_int(item.get("offer_id")): item for item in (stream.get("offers") or [])
    }
    input_offers = _normalize_input_offers(offers_in)
    for item in input_offers:
        if item["state"] not in {"active", "disabled"}:
            item["state"] = "active"
        # Existing offers may belong to groups this API user cannot read via
        # /offers. Never block a save just because their name is unavailable.
        if item["offer_id"] in current:
            continue
        if item["offer_id"] not in offer_map:
            item_offer = await offers_service.get_offer(db, client, item["offer_id"])
            offer_map[item_offer.id] = item_offer

    # Guarantee valid traffic distribution: active offers always sum to 100%.
    active_ids = [item["offer_id"] for item in input_offers if item["state"] == "active"]
    shares = distribute_shares(active_ids)
    for item in input_offers:
        item["share"] = shares.get(item["offer_id"], 0) if item["state"] == "active" else 0

    new_ids = {item["offer_id"] for item in input_offers}

    # Remember offers that are removed from the stream.
    for offer_id, current_item in current.items():
        if offer_id in new_ids:
            continue
        cached = offer_map.get(offer_id)
        tombstone = db.scalar(
            select(RemovedOffer).where(
                RemovedOffer.campaign_id == campaign_id,
                RemovedOffer.stream_id == stream_id,
                RemovedOffer.offer_id == offer_id,
            )
        )
        if tombstone is None:
            tombstone = RemovedOffer(
                campaign_id=campaign_id,
                stream_id=stream_id,
                offer_id=offer_id,
            )
            db.add(tombstone)
        tombstone.offer_name = cached.name if cached else f"Offer #{offer_id}"
        tombstone.last_share = safe_int(current_item.get("share"))
        tombstone.removed_at = datetime.now(timezone.utc)

    # Offers that are active again should lose their tombstone.
    for offer_id in new_ids:
        tombstone = db.scalar(
            select(RemovedOffer).where(
                RemovedOffer.campaign_id == campaign_id,
                RemovedOffer.stream_id == stream_id,
                RemovedOffer.offer_id == offer_id,
            )
        )
        if tombstone is not None:
            db.delete(tombstone)

    await client.update_stream(
        stream_id,
        {
            "offers": [
                {
                    "offer_id": item["offer_id"],
                    "share": item["share"],
                    "state": item["state"],
                }
                for item in input_offers
            ]
        },
    )
    db.commit()

    stats_spark = []
    for item in input_offers:
        cached = offer_map.get(item["offer_id"])
        stats_spark.append(
            StreamOfferOut(
                offer_id=item["offer_id"],
                name=cached.name if cached else f"Offer #{item['offer_id']}",
                share=item["share"],
                state=item["state"],
                country=cached.country if cached else [],
            )
        )
    return StreamOut(
        id=stream_id,
        name=str(stream.get("name") or f"Stream #{stream_id}"),
        position=safe_int(stream.get("position")),
        type=str(stream.get("type") or "regular"),
        schema=str(stream.get("schema") or "landings"),
        state=str(stream.get("state") or "active"),
        action_type=stream.get("action_type"),
        action_payload=stream.get("action_payload"),
        filters=stream.get("filters") or [],
        country_filter=_extract_country_filter(stream.get("filters") or []),
        offers=stats_spark,
    )


async def add_stream_offer(
    db: Session,
    client: KeitaroClient,
    campaign_id: int,
    stream_id: int,
    offer_id: int,
) -> StreamOut:
    streams = await client.list_streams(campaign_id)
    stream = next((item for item in streams if safe_int(item.get("id")) == stream_id), None)
    if stream is None:
        raise ValueError(f"Stream #{stream_id} does not belong to campaign #{campaign_id}")
    current = [
        {
            "offer_id": safe_int(item.get("offer_id")),
            "share": safe_int(item.get("share")),
            "state": str(item.get("state") or "active"),
        }
        for item in (stream.get("offers") or [])
    ]
    if any(item["offer_id"] == offer_id for item in current):
        raise ValueError(f"Offer #{offer_id} is already in this stream")
    current.append({"offer_id": offer_id, "share": 0, "state": "active"})
    return await save_stream_offers(db, client, campaign_id, stream_id, current)


async def remove_stream_offer(
    db: Session,
    client: KeitaroClient,
    campaign_id: int,
    stream_id: int,
    offer_id: int,
) -> StreamOut:
    streams = await client.list_streams(campaign_id)
    stream = next((item for item in streams if safe_int(item.get("id")) == stream_id), None)
    if stream is None:
        raise ValueError(f"Stream #{stream_id} does not belong to campaign #{campaign_id}")
    current = [
        {
            "offer_id": safe_int(item.get("offer_id")),
            "share": safe_int(item.get("share")),
            "state": str(item.get("state") or "active"),
        }
        for item in (stream.get("offers") or [])
        if safe_int(item.get("offer_id")) != offer_id
    ]
    return await save_stream_offers(db, client, campaign_id, stream_id, current)


async def restore_stream_offer(
    db: Session,
    client: KeitaroClient,
    campaign_id: int,
    stream_id: int,
    offer_id: int,
) -> StreamOut:
    streams = await client.list_streams(campaign_id)
    stream = next((item for item in streams if safe_int(item.get("id")) == stream_id), None)
    if stream is None:
        raise ValueError(f"Stream #{stream_id} does not belong to campaign #{campaign_id}")
    current = [
        {
            "offer_id": safe_int(item.get("offer_id")),
            "share": safe_int(item.get("share")),
            "state": str(item.get("state") or "active"),
        }
        for item in (stream.get("offers") or [])
    ]
    if any(item["offer_id"] == offer_id for item in current):
        raise ValueError(f"Offer #{offer_id} is already in this stream")
    current.append({"offer_id": offer_id, "share": 0, "state": "active"})
    return await save_stream_offers(db, client, campaign_id, stream_id, current)


async def archive_campaign(db: Session, client: KeitaroClient, campaign_id: int) -> None:
    await client.archive_campaign(campaign_id)
    db.execute(delete(RemovedOffer).where(RemovedOffer.campaign_id == campaign_id))
    db.execute(delete(CampaignRecord).where(CampaignRecord.id == campaign_id))
    db.commit()
