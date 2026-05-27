from datetime import datetime
from typing import Optional, List, Literal
from sqlmodel import SQLModel, Field
from pydantic import model_validator

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
    tipo_producto: Literal["elaborado", "terminado"] = "terminado"


class ProductoCreateCompleto(ProductoCreate):
    """Crea el producto, sus categorías e ingredientes en una sola transacción atómica."""
    categoria_ids: List[int] = []
    ingredientes: List["ProductoIngredienteCreate"] = []

    @model_validator(mode="after")
    def validar_elaborado_requiere_ingredientes(self) -> "ProductoCreateCompleto":
        if self.tipo_producto == "elaborado" and len(self.ingredientes) == 0:
            raise ValueError(
                "Un producto elaborado debe tener al menos un ingrediente."
            )
        return self


class ProductoUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, max_length=150)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: Optional[float] = Field(default=None, ge=0)
    unidad_venta_id: Optional[int] = None
    stock_cantidad: Optional[int] = Field(default=None, ge=0)
    disponible: Optional[bool] = None
    tipo_producto: Optional[Literal["elaborado", "terminado"]] = None


class ProductoPublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: float
    stock_cantidad: int
    disponible: bool
    tipo_producto: Literal["elaborado", "terminado"] = "terminado"
    unidad_venta_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class ProductoList(SQLModel):
    items: List[ProductoPublic]
    total: int
    skip: int
    limit: int


class ProductoStockAjuste(SQLModel):
    """Establece el stock de un producto terminado (valor absoluto)."""
    stock_cantidad: int = Field(ge=0)


class ProductoConDetalle(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_base: float
    stock_cantidad: int
    disponible: bool
    tipo_producto: Literal["elaborado", "terminado"] = "terminado"
    unidad_venta_id: Optional[int] = None
    unidad_venta: Optional[UnidadMedidaPublic] = None
    categorias: List[ProductoCategoriaPublic] = []
    ingredientes: List[ProductoIngredientePublic] = []
    costo_estimado: float = 0.0
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
