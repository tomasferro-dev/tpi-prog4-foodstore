from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field

from app.modules.categorias.schemas import CategoriaPublic
from app.modules.ingredientes.schemas import IngredientePublic
from app.modules.unidad_medida.schemas import UnidadMedidaPublic


class ProductoCategoriaCreate(SQLModel):
    categoria_id: int
    es_principal: bool = False


class ProductoCategoriaPublic(SQLModel):
    categoria_id: int
    es_principal: bool
    categoria: Optional[CategoriaPublic] = None


class ProductoIngredienteCreate(SQLModel):
    ingrediente_id: int
    cantidad: float = Field(gt=0)
    unidad_medida_id: int
    es_removible: bool = False


class ProductoIngredientePublic(SQLModel):
    ingrediente_id: int
    cantidad: float
    unidad_medida_id: int
    es_removible: bool
    costo_ingrediente: float = 0.0
    ingrediente: Optional[IngredientePublic] = None


class ProductoCreate(SQLModel):
    nombre: str = Field(max_length=150)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: float = Field(ge=0)
    unidad_venta_id: Optional[int] = None
    stock_cantidad: int = 0
    disponible: bool = True


class ProductoUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, max_length=150)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: Optional[float] = Field(default=None, ge=0)
    unidad_venta_id: Optional[int] = None
    stock_cantidad: Optional[int] = Field(default=None, ge=0)
    disponible: Optional[bool] = None


class ProductoPublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: float
    stock_cantidad: int
    disponible: bool
    unidad_venta_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class ProductoList(SQLModel):
    items: List[ProductoPublic]
    total: int
    skip: int
    limit: int


class ProductoConDetalle(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: float
    stock_cantidad: int
    disponible: bool
    unidad_venta_id: Optional[int] = None
    unidad_venta: Optional[UnidadMedidaPublic] = None
    categorias: List[ProductoCategoriaPublic] = []
    ingredientes: List[ProductoIngredientePublic] = []
    costo_estimado: float = 0.0
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
