from typing import Optional
from sqlmodel import SQLModel


class CostosUpdate(SQLModel):
    salario: Optional[float] = None
    gas: Optional[float] = None
    luz: Optional[float] = None
    alquiler: Optional[float] = None
    otros: Optional[float] = None


class CostosPublic(SQLModel):
    salario: float
    gas: float
    luz: float
    alquiler: float
    otros: float


class ConfigPrecioPublic(SQLModel):
    porcentaje_ganancia: float
    unidades_mes_estimadas: int
    costos: CostosPublic
    costo_envio: float


class ConfigPrecioUpdate(SQLModel):
    porcentaje_ganancia: Optional[float] = None
    unidades_mes_estimadas: Optional[int] = None
    costos: Optional[CostosUpdate] = None
    costo_envio: Optional[float] = None
