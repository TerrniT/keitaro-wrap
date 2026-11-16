from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CampaignRecord, RemovedOffer
from app.schemas import CampaignCreateIn
from app.services.campaigns import (
    create_campaign,
    remove_stream_offer,
    restore_stream_offer,
    save_stream_offers,
)

from .conftest import FakeKeitaroClient


@pytest.mark.asyncio
async def test_create_campaign_builds_two_streams(db: Session):
    client = FakeKeitaroClient()
    detail = await create_campaign(
        db,
        client,
        CampaignCreateIn(name="campaign1", geo="au, ca", offer_id=10184),
    )

    assert detail.campaign.name == "test_kotovsky_campaign1"
    assert detail.campaign.geo == ["AU", "CA"]
    assert detail.campaign.offer_id == 10184
    assert detail.campaign.streams_count == 2
    assert detail.campaign.group_id == 1
    assert detail.campaign.domain_id == 1
    assert detail.campaign.traffic_source_id == 1
    assert detail.campaign.traffic_source == "Test source"

    google, offers = detail.streams
    assert google.schema_type == "redirect"
    assert google.action_payload == "https://www.google.com"
    assert google.country_filter == ["AU", "CA"]
    assert offers.schema_type == "landings"
    assert [item.offer_id for item in offers.offers] == [10184]
    assert offers.offers[0].share == 100

    record = db.get(CampaignRecord, detail.campaign.id)
    assert record is not None
    assert record.geo == ["AU", "CA"]

    created_streams = [call for call in client.calls if call[0] == "create_stream"]
    assert len(created_streams) == 2


@pytest.mark.asyncio
async def test_add_remove_restore_offers_and_shares(db: Session):
    client = FakeKeitaroClient()
    detail = await create_campaign(
        db,
        client,
        CampaignCreateIn(name="campaign1", geo="AU", offer_id=10184),
    )
    campaign_id = detail.campaign.id
    stream = next(item for item in detail.streams if item.schema_type == "landings")

    updated = await save_stream_offers(
        db,
        client,
        campaign_id,
        stream.id,
        [
            {"offer_id": 10184, "share": 34, "state": "active"},
            {"offer_id": 24800, "share": 33, "state": "active"},
            {"offer_id": 19958, "share": 33, "state": "active"},
        ],
    )
    assert [item.share for item in updated.offers] == [34, 33, 33]
    assert sum(item.share for item in updated.offers) == 100

    updated = await remove_stream_offer(db, client, campaign_id, stream.id, 19958)
    assert [item.offer_id for item in updated.offers] == [10184, 24800]
    assert [item.share for item in updated.offers] == [50, 50]

    tombstones = db.scalars(select(RemovedOffer)).all()
    assert len(tombstones) == 1
    assert tombstones[0].offer_id == 19958

    updated = await restore_stream_offer(db, client, campaign_id, stream.id, 19958)
    assert {item.offer_id for item in updated.offers} == {10184, 24800, 19958}
    assert sum(item.share for item in updated.offers) == 100
    assert db.scalars(select(RemovedOffer)).all() == []

    stream_after = next(
        item for item in client.streams.values() if item["id"] == stream.id
    )
    assert len(stream_after["offers"]) == 3
    assert sum(item["share"] for item in stream_after["offers"]) == 100
