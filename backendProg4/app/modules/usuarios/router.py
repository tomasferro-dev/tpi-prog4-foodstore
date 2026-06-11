from typing import Annotated
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.models import (
    UsuarioCreate, AdminUsuarioCreate, AdminUsuarioUpdate, UsuarioPublic,
    LoginRequest, LoginResponse,
    RefreshRequest, RefreshResponse, LogoutRequest,
    RolPublic, AsignarRolRequest,
)
from app.modules.usuarios.service import UsuarioService

router = APIRouter()


def get_service(session: Annotated[Session, Depends(get_session)]) -> UsuarioService:
    return UsuarioService(session)


@router.post("/registro", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(
    data: UsuarioCreate,
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.register(data)


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.authenticate(data.email, data.password)


@router.post("/token", response_model=LoginResponse, include_in_schema=False)
def login_oauth2_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    """Endpoint OAuth2 para el botón Authorize de Swagger. El campo 'username' recibe el email."""
    return svc.authenticate(form_data.username, form_data.password)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    data: RefreshRequest,
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    data: LogoutRequest,
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    svc.logout(data.refresh_token)


@router.get("/me", response_model=UsuarioPublic)
def read_me(
    current_user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    return current_user


@router.get("/roles", response_model=list[RolPublic])
def list_roles(
    _user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.list_roles()


@router.post("/admin/usuarios/{usuario_id}/roles", response_model=UsuarioPublic)
def asignar_rol(
    usuario_id: int,
    data: AsignarRolRequest,
    admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.asignar_rol(usuario_id, data, asignado_por_id=admin.id)


@router.delete("/admin/usuarios/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioPublic)
def quitar_rol(
    usuario_id: int,
    rol_codigo: str,
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.quitar_rol(usuario_id, rol_codigo)


@router.post("/admin/usuarios", response_model=UsuarioPublic, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    data: AdminUsuarioCreate,
    admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    """Crea un usuario con email/contraseña y le asigna roles. Solo ADMIN."""
    return svc.admin_create(data, creado_por_id=admin.id)


@router.get("/admin/usuarios", response_model=list[UsuarioPublic])
def list_users(
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.list_all()


@router.patch("/admin/usuarios/{user_id}", response_model=UsuarioPublic)
def admin_update_user(
    user_id: int,
    data: AdminUsuarioUpdate,
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    """Actualiza los datos y/o roles de un usuario. Solo ADMIN."""
    return svc.admin_update(user_id, data)


@router.post("/admin/usuarios/{user_id}/desactivar", response_model=UsuarioPublic)
def deactivate_user(
    user_id: int,
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.soft_delete(user_id)


@router.post("/admin/usuarios/{user_id}/activar", response_model=UsuarioPublic)
def activate_user(
    user_id: int,
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN"]))],
    svc: Annotated[UsuarioService, Depends(get_service)],
):
    return svc.restore(user_id)
