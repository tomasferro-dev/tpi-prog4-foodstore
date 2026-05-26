import hashlib
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import EmailStr


class Rol(SQLModel, table=True):
    __tablename__ = "roles"

    codigo: str = Field(max_length=20, primary_key=True)
    nombre: str = Field(max_length=50, unique=True, nullable=False)
    descripcion: Optional[str] = Field(default=None)


class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=80, nullable=False)
    apellido: Optional[str] = Field(default=None, max_length=80)
    email: str = Field(unique=True, index=True, nullable=False)
    celular: Optional[str] = Field(default=None, max_length=20)
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None)


class UsuarioRol(SQLModel, table=True):
    __tablename__ = "usuario_roles"

    usuario_id: int = Field(foreign_key="usuarios.id", primary_key=True)
    rol_codigo: str = Field(foreign_key="roles.codigo", primary_key=True, max_length=20)
    asignado_por_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    expires_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", nullable=False)
    token_hash: str = Field(max_length=64, unique=True, nullable=False)
    expires_at: datetime = Field(nullable=False)
    revoked_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode()).hexdigest()

    def is_valid(self) -> bool:
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > now and self.revoked_at is None


# --- Schemas de entrada ---

class UsuarioCreate(SQLModel):
    nombre: str
    apellido: Optional[str] = None
    email: EmailStr
    celular: Optional[str] = None
    password: str = Field(min_length=8)


class LoginRequest(SQLModel):
    email: EmailStr
    password: str


class RefreshRequest(SQLModel):
    refresh_token: str


class LogoutRequest(SQLModel):
    refresh_token: str


# --- Schemas de salida ---

class UsuarioPublic(SQLModel):
    id: int
    nombre: str
    apellido: Optional[str] = None
    email: str
    celular: Optional[str] = None
    roles: list[str] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class LoginResponse(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UsuarioPublic


class RefreshResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RolPublic(SQLModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None


class AsignarRolRequest(SQLModel):
    rol_codigo: str
    expires_at: Optional[datetime] = None
