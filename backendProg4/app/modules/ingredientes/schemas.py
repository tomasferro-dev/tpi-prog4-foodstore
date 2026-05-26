from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field


class IngredienteCreate(SQLModel):
    nombre: str = Field(max_length=100)
    descripcion: Optional[str] = None
    es_alergeno: bool = False
    precio_por_unidad: float = Field(default=0.0, ge=0)
    stock_cantidad: float = Field(default=0.0, ge=0)
    unidad_medida_id: Optional[int] = None


class IngredienteUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, max_length=100)
    descripcion: Optional[str] = None
    es_alergeno: Optional[bool] = None
    precio_por_unidad: Optional[float] = Field(default=None, ge=0)
    stock_cantidad: Optional[float] = Field(default=None, ge=0)
    unidad_medida_id: Optional[int] = None


class IngredientePublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    es_alergeno: bool
    precio_por_unidad: float
    stock_cantidad: float
    unidad_medida_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class IngredienteList(SQLModel):
    items: List[IngredientePublic]
    total: int
    skip: int
    limit: int
