from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.config import settings
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_refresh_token,
)
from app.modules.usuarios.models import (
    Usuario, RefreshToken, UsuarioRol,
    UsuarioCreate, UsuarioPublic, LoginResponse, RefreshResponse,
    RolPublic, AsignarRolRequest,
)
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork


class UsuarioService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _build_usuario_public(self, uow: UsuarioUnitOfWork, user: Usuario) -> UsuarioPublic:
        roles = uow.usuario_roles.get_roles_de_usuario(user.id)
        return UsuarioPublic(
            id=user.id,
            nombre=user.nombre,
            apellido=user.apellido,
            email=user.email,
            celular=user.celular,
            roles=roles,
            created_at=user.created_at,
            updated_at=user.updated_at,
            deleted_at=user.deleted_at,
        )

    def _make_tokens(self, uow: UsuarioUnitOfWork, user: Usuario) -> tuple[str, str, list[str]]:
        roles = uow.usuario_roles.get_roles_de_usuario(user.id)
        access_token = create_access_token(data={"sub": user.email, "roles": roles})
        raw_refresh = create_refresh_token(data={"sub": user.email})
        uow.refresh_tokens.add(RefreshToken(
            usuario_id=user.id,
            token_hash=RefreshToken.hash_token(raw_refresh),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ))
        return access_token, raw_refresh, roles

    def register(self, data: UsuarioCreate) -> LoginResponse:
        with UsuarioUnitOfWork(self._session) as uow:
            if uow.usuarios.get_by_email(data.email):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="El email ya está registrado")

            user = Usuario(
                nombre=data.nombre,
                apellido=data.apellido,
                email=data.email,
                celular=data.celular,
                hashed_password=hash_password(data.password),
            )
            uow.usuarios.add(user)

            if uow.roles.get_by_codigo("CLIENT"):
                uow.usuario_roles.add(UsuarioRol(
                    usuario_id=user.id,
                    rol_codigo="CLIENT",
                ))

            access_token, raw_refresh, roles = self._make_tokens(uow, user)
            user_public = UsuarioPublic(
                id=user.id,
                nombre=user.nombre,
                apellido=user.apellido,
                email=user.email,
                celular=user.celular,
                roles=roles,
                created_at=user.created_at,
                updated_at=user.updated_at,
                deleted_at=user.deleted_at,
            )

        return LoginResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_public,
        )

    def authenticate(self, email: str, password: str) -> LoginResponse:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_email(email)
            if not user or not verify_password(password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if user.deleted_at is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Cuenta de usuario eliminada")

            access_token, raw_refresh, roles = self._make_tokens(uow, user)
            user_public = UsuarioPublic(
                id=user.id,
                nombre=user.nombre,
                apellido=user.apellido,
                email=user.email,
                celular=user.celular,
                roles=roles,
                created_at=user.created_at,
                updated_at=user.updated_at,
                deleted_at=user.deleted_at,
            )

        return LoginResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_public,
        )

    def refresh(self, raw_refresh_token: str) -> RefreshResponse:
        with UsuarioUnitOfWork(self._session) as uow:
            payload = decode_refresh_token(raw_refresh_token)
            if payload is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail="Refresh token inválido o expirado")

            stored = uow.refresh_tokens.get_by_hash(RefreshToken.hash_token(raw_refresh_token))
            if not stored or not stored.is_valid():
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail="Refresh token inválido o revocado")

            user = uow.usuarios.get_by_id(stored.usuario_id)
            if not user or user.deleted_at is not None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail="Usuario no válido")

            roles = uow.usuario_roles.get_roles_de_usuario(user.id)
            uow.refresh_tokens.revoke(stored)
            new_access = create_access_token(data={"sub": user.email, "roles": roles})
            new_raw_refresh = create_refresh_token(data={"sub": user.email})
            uow.refresh_tokens.add(RefreshToken(
                usuario_id=user.id,
                token_hash=RefreshToken.hash_token(new_raw_refresh),
                expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ))

        return RefreshResponse(
            access_token=new_access,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    def logout(self, raw_refresh_token: str | None) -> None:
        with UsuarioUnitOfWork(self._session) as uow:
            if raw_refresh_token:
                stored = uow.refresh_tokens.get_by_hash(RefreshToken.hash_token(raw_refresh_token))
                if stored:
                    uow.refresh_tokens.revoke(stored)

    def get_by_id(self, usuario_id: int) -> UsuarioPublic:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_id(usuario_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Usuario no encontrado")
            result = self._build_usuario_public(uow, user)
        return result

    def list_all(self) -> list[UsuarioPublic]:
        with UsuarioUnitOfWork(self._session) as uow:
            usuarios = uow.usuarios.get_all()
            result = [self._build_usuario_public(uow, u) for u in usuarios]
        return result

    def soft_delete(self, user_id: int) -> UsuarioPublic:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_id(user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Usuario no encontrado")
            uow.refresh_tokens.revoke_all_for_user(user_id)
            user.deleted_at = datetime.now(timezone.utc)
            user.updated_at = datetime.now(timezone.utc)
            uow.usuarios.add(user)
            result = self._build_usuario_public(uow, user)
        return result

    def restore(self, user_id: int) -> UsuarioPublic:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_id(user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Usuario no encontrado")
            user.deleted_at = None
            user.updated_at = datetime.now(timezone.utc)
            uow.usuarios.add(user)
            result = self._build_usuario_public(uow, user)
        return result

    def asignar_rol(self, usuario_id: int, data: AsignarRolRequest, asignado_por_id: int) -> UsuarioPublic:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_id(usuario_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Usuario no encontrado")
            if not uow.roles.get_by_codigo(data.rol_codigo):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Rol '{data.rol_codigo}' no existe")
            if uow.usuario_roles.get_asignacion(usuario_id, data.rol_codigo):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail=f"El usuario ya tiene el rol '{data.rol_codigo}'")
            uow.usuario_roles.add(UsuarioRol(
                usuario_id=usuario_id,
                rol_codigo=data.rol_codigo,
                asignado_por_id=asignado_por_id,
                expires_at=data.expires_at,
            ))
            result = self._build_usuario_public(uow, user)
        return result

    def quitar_rol(self, usuario_id: int, rol_codigo: str) -> UsuarioPublic:
        with UsuarioUnitOfWork(self._session) as uow:
            user = uow.usuarios.get_by_id(usuario_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Usuario no encontrado")
            asignacion = uow.usuario_roles.get_asignacion(usuario_id, rol_codigo)
            if not asignacion:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"El usuario no tiene el rol '{rol_codigo}'")
            uow.usuario_roles.remove_asignacion(asignacion)
            result = self._build_usuario_public(uow, user)
        return result

    def list_roles(self) -> list[RolPublic]:
        with UsuarioUnitOfWork(self._session) as uow:
            roles = uow.roles.get_all_roles()
            result = [RolPublic.model_validate(r) for r in roles]
        return result
