from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app import models  # noqa: F401

pytest_plugins = ("pytest_asyncio.plugin",)


@pytest.fixture()
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


class FakeKeitaroClient:
    def __init__(self) -> None:
        self.campaigns: dict[int, dict[str, Any]] = {}
        self.streams: dict[int, dict[str, Any]] = {}
        self.offers: dict[int, dict[str, Any]] = {
            10184: {
                "id": 10184,
                "name": "10184 Test offer",
                "group_id": 1,
                "country": ["PE"],
                "state": "active",
            },
            24800: {
                "id": 24800,
                "name": "24800 Second offer",
                "group_id": 1,
                "country": ["PE"],
                "state": "active",
            },
            19958: {
                "id": 19958,
                "name": "19958 Third offer",
                "group_id": 1,
                "country": ["PE"],
                "state": "active",
            },
        }
        self._campaign_seq = 1000
        self._stream_seq = 2000
        self.calls: list[tuple[str, Any]] = []

    async def list_domains(self):
        return [{"id": 1, "name": "example.com", "state": "active", "is_ssl": True}]

    async def list_groups(self, group_type: str = "campaigns"):
        return [{"id": 1, "name": "Test group", "position": 1, "type": group_type}]

    async def list_traffic_sources(self):
        return [{"id": 1, "name": "Test source", "state": "active"}]

    async def list_campaigns(self, limit: int = 1000, offset: int = 0):
        return list(self.campaigns.values())

    async def get_campaign(self, campaign_id: int):
        return copy.deepcopy(self.campaigns[campaign_id])

    async def create_campaign(self, payload: dict):
        self._campaign_seq += 1
        campaign = {
            "id": self._campaign_seq,
            "name": payload["name"],
            "alias": payload["alias"],
            "group_id": payload.get("group_id"),
            "domain_id": payload.get("domain_id"),
            "traffic_source_id": payload.get("traffic_source_id"),
            "state": payload.get("state", "active"),
            "type": payload.get("type", "position"),
            "domain": "https://example.com/",
            "group": "Test group",
            "created_at": "2026-01-01 00:00:00",
            "updated_at": "2026-01-01 00:00:00",
        }
        self.campaigns[campaign["id"]] = campaign
        self.calls.append(("create_campaign", payload))
        return copy.deepcopy(campaign)

    async def archive_campaign(self, campaign_id: int):
        self.campaigns[campaign_id]["state"] = "deleted"
        return {"ok": True}

    async def create_stream(self, payload: dict):
        self._stream_seq += 1
        stream = {
            "id": self._stream_seq,
            "campaign_id": payload["campaign_id"],
            "name": payload["name"],
            "position": payload.get("position", 0),
            "type": payload.get("type", "regular"),
            "schema": payload.get("schema", "landings"),
            "action_type": payload.get("action_type", "http"),
            "action_payload": payload.get("action_payload", ""),
            "collect_clicks": payload.get("collect_clicks", True),
            "state": "active",
            "filters": copy.deepcopy(payload.get("filters") or []),
            "offers": [
                {
                    "offer_id": item["offer_id"],
                    "share": item.get("share", 100),
                    "state": item.get("state", "active"),
                }
                for item in (payload.get("offers") or [])
            ],
        }
        self.streams[stream["id"]] = stream
        self.calls.append(("create_stream", payload))
        return copy.deepcopy(stream)

    async def list_streams(self, campaign_id: int):
        return [
            copy.deepcopy(stream)
            for stream in self.streams.values()
            if stream["campaign_id"] == campaign_id
        ]

    async def update_stream(self, stream_id: int, payload: dict):
        stream = self.streams[stream_id]
        if "offers" in payload:
            stream["offers"] = copy.deepcopy(payload["offers"])
        self.calls.append(("update_stream", payload))
        return copy.deepcopy(stream)

    async def list_offers(self):
        return [copy.deepcopy(item) for item in self.offers.values()]

    async def get_offer(self, offer_id: int):
        return copy.deepcopy(self.offers[offer_id])

    async def build_report(self, payload: dict):
        return {"rows": [], "total": 0}

    def campaign_test_url(self, alias: str) -> str:
        return f"https://example.com/{alias}"

    def admin_campaign_url(self, campaign_id: int) -> str:
        return f"https://example.com/admin/#!/campaign/{campaign_id}/main"
