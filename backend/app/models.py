from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    campaign_prefix: Mapped[str] = mapped_column(String(80), default="test_kotovsky_")
    default_domain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_traffic_source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offers_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class CampaignRecord(Base):
    """Extra metadata for campaigns created through the wrapper.

    Keitaro remains the source of truth. This table keeps things Keitaro does
    not expose conveniently (for example the geo list used at creation time).
    """

    __tablename__ = "campaign_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # Keitaro campaign ID
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    alias: Mapped[str] = mapped_column(String(255), nullable=False)
    geo: Mapped[list[str]] = mapped_column(JSON, default=list)
    offer_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    domain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    traffic_source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class RemovedOffer(Base):
    """An offer that was removed from a stream through the editor.

    Keitaro deletes the stream-offer link, so the wrapper remembers the offer
    locally. It can then be shown as "removed" and restored with one click.
    """

    __tablename__ = "removed_offers"
    __table_args__ = (
        UniqueConstraint("campaign_id", "stream_id", "offer_id", name="uq_removed_offer"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campaign_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    stream_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    offer_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    offer_name: Mapped[str] = mapped_column(String(500), default="")
    last_share: Mapped[int] = mapped_column(Integer, default=0)
    removed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OfferCache(Base):
    __tablename__ = "offers_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, default="")
    group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    country: Mapped[list[str]] = mapped_column(JSON, default=list)
    state: Mapped[str] = mapped_column(String(32), default="active")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class StatCache(Base):
    """Short-lived cache for report responses to avoid hammering Keitaro."""

    __tablename__ = "stats_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
