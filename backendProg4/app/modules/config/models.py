from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class ConfigPrecio(SQLModel, table=True):
    __tablename__ = "config_precio"

    id: int = Field(default=1, primary_key=True)
    porcentaje_ganancia: float = Field(default=50.0)
    unidades_mes_estimadas: int = Field(default=300)
    costos_salario: float = Field(default=350000.0)
    costos_gas: float = Field(default=25000.0)
    costos_luz: float = Field(default=20000.0)
    costos_alquiler: float = Field(default=200000.0)
    costos_otros: float = Field(default=30000.0)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
