from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.modules.productos.models import ProductoIngrediente


class Ingrediente(SQLModel, table=True):
    __tablename__ = "ingredientes"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, unique=True, nullable=False, index=True)
    descripcion: Optional[str] = Field(default=None)
    es_alergeno: bool = Field(default=False, nullable=False)
    precio_por_unidad: float = Field(default=0.0, ge=0, nullable=False)
    stock_cantidad: float = Field(default=0.0, ge=0, nullable=False)
    unidad_medida_id: Optional[int] = Field(default=None, foreign_key="unidades_medida.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None)

    producto_ingredientes: List["ProductoIngrediente"] = Relationship(
        back_populates="ingrediente"
    )
