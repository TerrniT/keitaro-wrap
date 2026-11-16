from __future__ import annotations

import re

import pycountry


def distribute_shares(offer_ids: list[int]) -> dict[int, int]:
    """Split 100% equally, giving the remainder to the first offers.

    Examples: 1 -> [100], 2 -> [50, 50], 3 -> [34, 33, 33],
    7 -> [15, 15, 14, 14, 14, 14, 14]. The result always sums to 100.
    """
    count = len(offer_ids)
    if count == 0:
        return {}
    base, remainder = divmod(100, count)
    return {
        offer_id: base + (1 if index < remainder else 0)
        for index, offer_id in enumerate(offer_ids)
    }


def rebalance_offers(offers: list[dict], active_key: str = "state") -> list[dict]:
    """Return a copy of offers with shares distributed among active entries."""
    active_ids = [int(item["offer_id"]) for item in offers if item.get(active_key) == "active"]
    shares = distribute_shares(active_ids)
    result = []
    for item in offers:
        copy = dict(item)
        offer_id = int(copy["offer_id"])
        if copy.get(active_key) == "active":
            copy["share"] = shares.get(offer_id, 0)
        else:
            copy["share"] = 0
        result.append(copy)
    return result


def normalize_geo(codes: list[str]) -> list[str]:
    """Validate and normalize ISO-3166 alpha-2 country codes."""
    normalized: list[str] = []
    invalid: list[str] = []
    for code in codes:
        code = code.strip().upper()
        if not code:
            continue
        if pycountry.countries.get(alpha_2=code) is None:
            invalid.append(code)
            continue
        if code not in normalized:
            normalized.append(code)
    if invalid:
        raise ValueError(f"Unknown country code(s): {', '.join(invalid)}")
    if not normalized:
        raise ValueError("At least one valid geo code is required")
    return normalized


def country_name(code: str) -> str:
    country = pycountry.countries.get(alpha_2=code.upper())
    return country.name if country else code.upper()


def country_flag(code: str) -> str:
    code = code.upper()
    if len(code) != 2 or not code.isalpha():
        return ""
    return "".join(chr(0x1F1E6 + ord(char) - ord("A")) for char in code)


def ensure_prefix(name: str, prefix: str) -> str:
    name = name.strip()
    prefix = prefix.strip()
    if not prefix.startswith("test_"):
        prefix = "test_" + prefix.lstrip("_")
    if not prefix.endswith("_"):
        prefix += "_"

    if not name:
        raise ValueError("Campaign name is required")
    if name.startswith(prefix):
        return name

    # If the user already typed some test_ prefix, strip it before applying ours.
    cleaned = re.sub(r"^test_[a-zA-Z0-9]+_", "", name)
    cleaned = cleaned.lstrip("_").strip()
    if not cleaned:
        raise ValueError("Campaign name must contain at least one meaningful character")
    return f"{prefix}{cleaned}"


def slugify_alias(name: str) -> str:
    alias = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    alias = re.sub(r"-{2,}", "-", alias)
    return alias[:80] or "campaign"


def to_float(value: object, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
