from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --------------------------------------------------------------------- common
class StatMetrics(BaseModel):
    clicks: float = 0
    conversions: float = 0
    revenue: float = 0
    cost: float = 0
    profit: float = 0
    roi: float = 0
    cr: float = 0
    epc: float = 0


class TrendPoint(BaseModel):
    date: str
    clicks: float = 0
    conversions: float = 0
    profit: float = 0


class CountryOut(BaseModel):
    code: str
    name: str
    flag: str


class OfferOut(BaseModel):
    id: int
    name: str
    country: list[str] = Field(default_factory=list)
    group_id: int | None = None
    state: str = "active"


class DomainOut(BaseModel):
    id: int
    name: str
    state: str = "active"
    is_ssl: bool = False
    campaigns_count: int = 0


class GroupOut(BaseModel):
    id: int
    name: str
    position: int = 0
    type: str = "campaigns"


class SourceOut(BaseModel):
    id: int
    name: str
    state: str = "active"


# ------------------------------------------------------------------- settings
class SettingsOut(BaseModel):
    campaign_prefix: str
    default_domain_id: int | None = None
    default_group_id: int | None = None
    default_traffic_source_id: int | None = None
    offers_synced_at: datetime | None = None
    offers_cached: int = 0
    keitaro_base_url: str = ""
    api_key_configured: bool = False


class SettingsUpdate(BaseModel):
    campaign_prefix: str | None = Field(default=None, max_length=80)
    default_domain_id: int | None = None
    default_group_id: int | None = None
    default_traffic_source_id: int | None = None

    @field_validator("campaign_prefix")
    @classmethod
    def normalize_prefix(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not value.startswith("test_"):
            value = "test_" + value.lstrip("_")
        if not value.endswith("_"):
            value += "_"
        return value


class MetaOut(BaseModel):
    settings: SettingsOut
    domains: list[DomainOut]
    groups: list[GroupOut]
    sources: list[SourceOut]
    countries: list[CountryOut]
    keitaro_base_url: str
    api_key_configured: bool
    connection_ok: bool
    connection_error: str | None = None


# ------------------------------------------------------------------ campaigns
class CampaignCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    geo: list[str] | str
    offer_id: int
    domain_id: int | None = None
    group_id: int | None = None
    traffic_source_id: int | None = None
    notes: str | None = None

    @field_validator("geo", mode="before")
    @classmethod
    def parse_geo(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            items = [item.strip() for item in value.replace(";", ",").split(",")]
        elif isinstance(value, (list, tuple, set)):
            items = [str(item).strip() for item in value]
        else:
            raise ValueError("geo must be a comma-separated string or a list")
        result: list[str] = []
        for item in items:
            if not item:
                continue
            code = item.upper()
            if code not in result:
                result.append(code)
        if not result:
            raise ValueError("At least one geo code is required")
        return result


class CampaignSummaryOut(BaseModel):
    id: int
    name: str
    alias: str
    state: str = "active"
    type: str = "position"
    group_id: int | None = None
    group: str | None = None
    domain_id: int | None = None
    domain: str | None = None
    traffic_source_id: int | None = None
    traffic_source: str | None = None
    streams_count: int = 0
    currency: str = "USD"
    clicks: float = 0
    conversions: float = 0
    revenue: float = 0
    cost: float = 0
    profit: float = 0
    roi: float = 0
    cr: float = 0
    created_at: str | None = None
    updated_at: str | None = None
    geo: list[str] = Field(default_factory=list)
    offer_id: int | None = None
    test_url: str | None = None
    admin_url: str | None = None


class CampaignListOut(BaseModel):
    items: list[CampaignSummaryOut]
    total: int
    interval: str
    totals: StatMetrics


class StreamOfferOut(BaseModel):
    offer_id: int
    name: str
    share: int = 0
    state: Literal["active", "disabled", "removed"] = "active"
    country: list[str] = Field(default_factory=list)
    stats: StatMetrics = Field(default_factory=StatMetrics)
    trend: list[TrendPoint] = Field(default_factory=list)


class StreamOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    name: str
    position: int = 0
    type: str = "regular"
    schema_type: str = Field(default="landings", alias="schema", serialization_alias="schema")
    state: str = "active"
    action_type: str | None = None
    action_payload: str | None = None
    filters: list[dict[str, Any]] = Field(default_factory=list)
    country_filter: list[str] = Field(default_factory=list)
    clicks_today: float = 0
    stats: StatMetrics = Field(default_factory=StatMetrics)
    offers: list[StreamOfferOut] = Field(default_factory=list)
    removed_offers: list[StreamOfferOut] = Field(default_factory=list)


class CampaignDetailOut(BaseModel):
    campaign: CampaignSummaryOut
    streams: list[StreamOut]
    interval: str
    totals: StatMetrics
    has_removed_offers: bool = False


class StreamOfferUpdate(BaseModel):
    offer_id: int
    share: int = Field(ge=0, le=100)
    state: Literal["active", "disabled"] = "active"


class StreamOffersUpdateIn(BaseModel):
    offers: list[StreamOfferUpdate]


class OfferAddIn(BaseModel):
    offer_id: int = Field(gt=0)


class CampaignStatsOut(BaseModel):
    campaign_id: int
    interval: str
    totals: StatMetrics
    streams: dict[str, StatMetrics]
    offers: dict[str, StatMetrics]
    trends: dict[str, list[TrendPoint]]
    clicks_today: dict[str, float] = Field(default_factory=dict)
    trend_dates: list[str] = Field(default_factory=list)


class OfferSearchOut(BaseModel):
    items: list[OfferOut]
    total: int
    cached: bool


class OfferSyncOut(BaseModel):
    synced: int
    synced_at: datetime


class HealthOut(BaseModel):
    status: str
    app: str
    keitaro_connected: bool
    keitaro_error: str | None = None
