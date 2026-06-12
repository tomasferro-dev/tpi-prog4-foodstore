from typing import Annotated
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import require_role
from app.modules.usuarios.models import UsuarioPublic
from app.modules.config.schemas import ConfigPrecioPublic, ConfigPrecioUpdate
from app.modules.config.service import ConfigService

router = APIRouter()


def get_service(session: Annotated[Session, Depends(get_session)]) -> ConfigService:
    return ConfigService(session)


@router.get("/", response_model=ConfigPrecioPublic)
def get_config(
    svc: Annotated[ConfigService, Depends(get_service)],
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
):
    return svc.get()


@router.patch("/", response_model=ConfigPrecioPublic)
def update_config(
    data: ConfigPrecioUpdate,
    svc: Annotated[ConfigService, Depends(get_service)],
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
):
    return svc.update(data)
