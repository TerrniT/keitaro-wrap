from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..keitaro import KeitaroClient, KeitaroAPIError
from ..models import AppSettings, OfferCache
from ..schemas import OfferOut, OfferSyncOut
from ..utils import safe_int


def _to_out(row: OfferCache) -> OfferOut:
    return OfferOut(
        id=row.id,
        name=row.name,
        country=row.country or [],
        group_id=row.group_id,
        state=row.state,
    )


async def sync_offers(db: Session, client: KeitaroClient) -> OfferSyncOut:
    offers = await client.list_offers()
    seen: set[int] = set()
    for item in offers:
        offer_id = safe_int(item.get("id"))
        if not offer_id:
            continue
        seen.add(offer_id)
        row = db.get(OfferCache, offer_id)
        country = item.get("country") or []
        if isinstance(country, str):
            country = [country]
        if row is None:
            row = OfferCache(id=offer_id)
            db.add(row)
        row.name = str(item.get("name") or f"Offer #{offer_id}")
        row.group_id = safe_int(item.get("group_id"), default=0) or None
        row.country = [str(code) for code in country]
        row.state = str(item.get("state") or "active")
        row.updated_at = datetime.now(timezone.utc)

    if seen:
        for row in db.scalars(select(OfferCache)).all():
            if row.id not in seen:
                db.delete(row)

    settings_row = db.get(AppSettings, 1)
    if settings_row is None:
        settings_row = AppSettings(id=1)
        db.add(settings_row)
    synced_at = datetime.now(timezone.utc)
    settings_row.offers_synced_at = synced_at
    db.commit()
    return OfferSyncOut(synced=len(seen), synced_at=synced_at)


async def ensure_offer_cache(db: Session, client: KeitaroClient) -> None:
    count = db.scalar(select(func.count()).select_from(OfferCache)) or 0
    if count == 0:
        await sync_offers(db, client)


async def get_offer(db: Session, client: KeitaroClient, offer_id: int) -> OfferOut:
    row = db.get(OfferCache, offer_id)
    if row is not None and row.state != "deleted":
        return _to_out(row)
    try:
        item = await client.get_offer(offer_id)
    except KeitaroAPIError:
        if row is not None:
            return _to_out(row)
        raise
    country = item.get("country") or []
    if isinstance(country, str):
        country = [country]
    if row is None:
        row = OfferCache(id=offer_id)
        db.add(row)
    row.name = str(item.get("name") or f"Offer #{offer_id}")
    row.group_id = safe_int(item.get("group_id"), default=0) or None
    row.country = [str(code) for code in country]
    row.state = str(item.get("state") or "active")
    db.commit()
    db.refresh(row)
    return _to_out(row)


async def get_offer_map(db: Session, client: KeitaroClient) -> dict[int, OfferOut]:
    try:
        await ensure_offer_cache(db, client)
    except KeitaroAPIError:
        # Names are nice-to-have. The editor must still work when the offers
        # directory is temporarily unavailable.
        pass
    rows = db.scalars(select(OfferCache)).all()
    return {row.id: _to_out(row) for row in rows}


async def search_offers(
    db: Session,
    client: KeitaroClient,
    query: str | None = None,
    limit: int = 30,
) -> tuple[list[OfferOut], int, bool]:
    await ensure_offer_cache(db, client)
    stmt = select(OfferCache).where(OfferCache.state != "deleted")
    if query:
        query = query.strip()
        conditions = [OfferCache.name.ilike(f"%{query}%")]
        if query.isdigit():
            conditions.append(OfferCache.id == int(query))
        stmt = stmt.where(or_(*conditions))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(OfferCache.id.desc()).limit(limit)).all()
    return [_to_out(row) for row in rows], int(total), True
