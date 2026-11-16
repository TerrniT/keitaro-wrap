from __future__ import annotations

import pytest

from app.utils import (
    country_flag,
    distribute_shares,
    ensure_prefix,
    normalize_geo,
    rebalance_offers,
    slugify_alias,
)


@pytest.mark.parametrize(
    "count,expected",
    [
        (1, [100]),
        (2, [50, 50]),
        (3, [34, 33, 33]),
        (4, [25, 25, 25, 25]),
        (7, [15, 15, 14, 14, 14, 14, 14]),
    ],
)
def test_distribute_shares(count: int, expected: list[int]):
    ids = list(range(1, count + 1))
    shares = distribute_shares(ids)
    assert [shares[item] for item in ids] == expected
    assert sum(shares.values()) == 100


def test_rebalance_keeps_removed_at_zero():
    offers = [
        {"offer_id": 1, "state": "active", "share": 10},
        {"offer_id": 2, "state": "active", "share": 20},
        {"offer_id": 3, "state": "removed", "share": 70},
    ]
    result = rebalance_offers(offers)
    assert [item["share"] for item in result] == [50, 50, 0]
    assert sum(item["share"] for item in result) == 100


def test_ensure_prefix():
    assert ensure_prefix("campaign1", "test_kotovsky_") == "test_kotovsky_campaign1"
    assert (
        ensure_prefix("test_kotovsky_campaign1", "test_kotovsky_")
        == "test_kotovsky_campaign1"
    )
    assert ensure_prefix("test_other_campaign", "test_kotovsky_") == "test_kotovsky_campaign"
    assert ensure_prefix("  campaign  ", "test_") == "test_campaign"


def test_slugify_alias():
    assert slugify_alias("test_kotovsky_campaign 1") == "test-kotovsky-campaign-1"
    assert slugify_alias("!!!") == "campaign"


def test_normalize_geo():
    assert normalize_geo(["au", "AU", "us"]) == ["AU", "US"]
    with pytest.raises(ValueError):
        normalize_geo(["XX"])
    with pytest.raises(ValueError):
        normalize_geo([])


def test_country_flag():
    assert country_flag("US") == "🇺🇸"
    assert country_flag("AU") == "🇦🇺"
