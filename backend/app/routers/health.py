from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import get_settings
from ..keitaro import KeitaroAPIError, KeitaroClient
from ..schemas import HealthOut

router = APIRouter(tags=["health"])


def get_client() -> KeitaroClient:
    return KeitaroClient()


@router.get("/health", response_model=HealthOut)
async def health(client: KeitaroClient = Depends(get_client)) -> HealthOut:
    settings = get_settings()
    try:
        await client.list_campaigns(limit=1)
    except KeitaroAPIError as exc:
        return HealthOut(
            status="degraded",
            app=settings.app_name,
            keitaro_connected=False,
            keitaro_error=exc.message,
        )
    except Exception as exc:  # pragma: no cover - defensive
        return HealthOut(
            status="degraded",
            app=settings.app_name,
            keitaro_connected=False,
            keitaro_error=str(exc),
        )
    return HealthOut(
        status="ok",
        app=settings.app_name,
        keitaro_connected=True,
    )
