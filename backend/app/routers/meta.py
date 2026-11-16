from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..keitaro import KeitaroClient
from ..schemas import CountryOut, MetaOut, SettingsOut, SettingsUpdate
from ..services import app_settings as app_settings_service

router = APIRouter(tags=["meta"])


def get_client() -> KeitaroClient:
    return KeitaroClient()


@router.get("/meta", response_model=MetaOut)
async def get_meta(
    refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    client: KeitaroClient = Depends(get_client),
) -> MetaOut:
    return await app_settings_service.get_meta(db, client, force=refresh)


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)) -> SettingsOut:
    return app_settings_service.settings_out(db)


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate, db: Session = Depends(get_db)
) -> SettingsOut:
    return app_settings_service.update_settings(db, payload)


@router.get("/countries", response_model=list[CountryOut])
def get_countries() -> list[CountryOut]:
    return app_settings_service.countries()
