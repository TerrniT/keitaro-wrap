from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..keitaro import KeitaroClient
from ..schemas import (
    CampaignCreateIn,
    CampaignDetailOut,
    CampaignListOut,
    CampaignStatsOut,
    OfferAddIn,
    StreamOffersUpdateIn,
    StreamOut,
)
from ..services import campaigns as campaigns_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def get_client() -> KeitaroClient:
    return KeitaroClient()


@router.get("", response_model=CampaignListOut)
async def list_campaigns(
    search: str | None = Query(default=None, max_length=200),
    interval: str = Query(default="today"),
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> CampaignListOut:
    try:
        return await campaigns_service.list_campaigns(db, client, search, interval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("", response_model=CampaignDetailOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreateIn,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> CampaignDetailOut:
    try:
        return await campaigns_service.create_campaign(db, client, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{campaign_id}", response_model=CampaignDetailOut)
async def get_campaign(
    campaign_id: int,
    interval: str = Query(default="today"),
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> CampaignDetailOut:
    try:
        return await campaigns_service.get_campaign_detail(db, client, campaign_id, interval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{campaign_id}/stats", response_model=CampaignStatsOut)
async def get_campaign_stats(
    campaign_id: int,
    interval: str = Query(default="today"),
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> CampaignStatsOut:
    try:
        return await campaigns_service.get_campaign_stats(db, client, campaign_id, interval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{campaign_id}/streams/{stream_id}/offers", response_model=StreamOut)
async def replace_stream_offers(
    campaign_id: int,
    stream_id: int,
    payload: StreamOffersUpdateIn,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> StreamOut:
    try:
        return await campaigns_service.save_stream_offers(
            db, client, campaign_id, stream_id, payload.offers
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{campaign_id}/streams/{stream_id}/offers", response_model=StreamOut)
async def add_stream_offer(
    campaign_id: int,
    stream_id: int,
    payload: OfferAddIn,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> StreamOut:
    try:
        return await campaigns_service.add_stream_offer(
            db, client, campaign_id, stream_id, payload.offer_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/{campaign_id}/streams/{stream_id}/offers/{offer_id}", response_model=StreamOut
)
async def remove_stream_offer(
    campaign_id: int,
    stream_id: int,
    offer_id: int,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> StreamOut:
    try:
        return await campaigns_service.remove_stream_offer(
            db, client, campaign_id, stream_id, offer_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{campaign_id}/streams/{stream_id}/offers/{offer_id}/restore",
    response_model=StreamOut,
)
async def restore_stream_offer(
    campaign_id: int,
    stream_id: int,
    offer_id: int,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> StreamOut:
    try:
        return await campaigns_service.restore_stream_offer(
            db, client, campaign_id, stream_id, offer_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> Response:
    await campaigns_service.archive_campaign(db, client, campaign_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
