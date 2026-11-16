from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import Settings, get_settings


class KeitaroAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class KeitaroClient:
    """Small async client for the Keitaro Admin API.

    Only the endpoints used by the wrapper are implemented. Keitaro remains the
    source of truth for campaigns, streams, offers and statistics.
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.base_url = self.settings.keitaro_base_url.rstrip("/")
        self.api_url = f"{self.base_url}/admin_api/v1"
        self.headers = {
            "Api-Key": self.settings.keitaro_api_key,
            "Accept": "application/json",
            "User-Agent": self.settings.keitaro_user_agent,
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.api_url,
            headers=self.headers,
            timeout=self.settings.keitaro_timeout,
            follow_redirects=True,
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
    ) -> Any:
        if not self.settings.keitaro_api_key:
            raise KeitaroAPIError(
                "KEITARO_API_KEY is not configured. Add it to .env (Profile → API keys in Keitaro)."
            )

        retryable = method.upper() == "GET" or path == "/report/build"
        attempts = 3 if retryable else 1
        response: httpx.Response | None = None
        last_error: httpx.HTTPError | None = None
        for attempt in range(attempts):
            try:
                async with self._client() as client:
                    candidate = await client.request(
                        method, path, params=params, json=json
                    )
            except httpx.HTTPError as exc:
                last_error = exc
                if retryable and attempt < attempts - 1:
                    await asyncio.sleep(0.4 * (attempt + 1))
                    continue
                raise KeitaroAPIError(f"Keitaro request failed: {exc}") from exc

            if (
                candidate.status_code in {429, 502, 503, 504}
                and retryable
                and attempt < attempts - 1
            ):
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            response = candidate
            break

        if response is None:
            raise KeitaroAPIError(
                f"Keitaro request failed: {last_error or 'no response'}"
            )

        content_type = response.headers.get("content-type", "")
        body = response.text

        if response.status_code >= 400:
            details: Any = body[:2000]
            if "json" in content_type:
                try:
                    details = response.json()
                except ValueError:
                    pass
            if response.status_code == 403 and "cloudflare" in body.lower():
                raise KeitaroAPIError(
                    "Cloudflare blocked the request. Check KEITARO_USER_AGENT or the API key.",
                    status_code=response.status_code,
                    details=details,
                )
            message = f"Keitaro API error ({response.status_code})"
            if isinstance(details, dict):
                message = str(details.get("error") or details.get("detail") or message)
            raise KeitaroAPIError(message, status_code=response.status_code, details=details)

        if not body.strip():
            return None
        if "json" not in content_type and body.lstrip().startswith("<"):
            raise KeitaroAPIError(
                "Keitaro returned HTML instead of JSON. Is KEITARO_BASE_URL correct?",
                details=body[:500],
            )
        try:
            return response.json()
        except ValueError as exc:
            raise KeitaroAPIError("Keitaro returned invalid JSON", details=body[:500]) from exc

    # ------------------------------------------------------------------ read
    async def list_campaigns(self, limit: int = 1000, offset: int = 0) -> list[dict]:
        data = await self._request(
            "GET", "/campaigns", params={"limit": limit, "offset": offset}
        )
        return data or []

    async def get_campaign(self, campaign_id: int) -> dict:
        return await self._request("GET", f"/campaigns/{campaign_id}")

    async def list_streams(self, campaign_id: int) -> list[dict]:
        data = await self._request("GET", f"/campaigns/{campaign_id}/streams")
        return data or []

    async def list_offers(self) -> list[dict]:
        data = await self._request("GET", "/offers")
        return data or []

    async def get_offer(self, offer_id: int) -> dict:
        return await self._request("GET", f"/offers/{offer_id}")

    async def list_domains(self) -> list[dict]:
        data = await self._request("GET", "/domains")
        return data or []

    async def list_groups(self, group_type: str = "campaigns") -> list[dict]:
        data = await self._request("GET", "/groups", params={"type": group_type})
        return data or []

    async def list_traffic_sources(self) -> list[dict]:
        data = await self._request("GET", "/traffic_sources")
        return data or []

    # ----------------------------------------------------------------- write
    async def create_campaign(self, payload: dict) -> dict:
        return await self._request("POST", "/campaigns", json=payload)

    async def archive_campaign(self, campaign_id: int) -> Any:
        return await self._request("DELETE", f"/campaigns/{campaign_id}")

    async def create_stream(self, payload: dict) -> dict:
        return await self._request("POST", "/streams", json=payload)

    async def update_stream(self, stream_id: int, payload: dict) -> dict:
        return await self._request("PUT", f"/streams/{stream_id}", json=payload)

    # ---------------------------------------------------------------- reports
    async def build_report(self, payload: dict) -> dict:
        return await self._request("POST", "/report/build", json=payload)

    # ------------------------------------------------------------------ links
    def admin_campaign_url(self, campaign_id: int) -> str:
        return f"{self.base_url}/admin/#!/campaign/{campaign_id}/main"

    def campaign_test_url(self, alias: str) -> str:
        """Public tracker URL using the tracker host.

        In this test environment a separate tracking domain may not resolve, but
        the tracker host itself serves the campaign alias, which is convenient
        for smoke tests.
        """
        host = urlparse(self.base_url).netloc or self.base_url
        scheme = urlparse(self.base_url).scheme or "https"
        return f"{scheme}://{host}/{alias}"
