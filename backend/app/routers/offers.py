from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..keitaro import KeitaroClient
from ..schemas import OfferOut, OfferSearchOut, OfferSyncOut
from ..services import offers as offers_service

router = APIRouter(prefix="/offers", tags=["offers"])


def get_client() -> KeitaroClient:
    return KeitaroClient()


@router.post("/sync", response_model=OfferSyncOut)
async def sync_offers(
    db: Session = Depends(get_db), client: KeitaroClient = Depends(get_client)
) -> OfferSyncOut:
    return await offers_service.sync_offers(db, client)


@router.get("", response_model=OfferSearchOut)
async def search_offers(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> OfferSearchOut:
    items, total, cached = await offers_service.search_offers(db, client, q, limit)
    return OfferSearchOut(items=items, total=total, cached=cached)


@router.get("/{offer_id}", response_model=OfferOut)
async def get_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> OfferOut:
    return await offers_service.get_offer(db, client, offer_id)
