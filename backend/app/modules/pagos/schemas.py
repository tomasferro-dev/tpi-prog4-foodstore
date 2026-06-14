from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlmodel import SQLModel


class PreferenciaRequest(SQLModel):
    pedido_id: int


class PreferenciaResponse(SQLModel):
    init_point: str


class ConfirmarPagoRequest(SQLModel):
    """El front envía el payment_id que MercadoPago adjunta como query param al
    redirigir a /pago/success. El backend lo verifica contra la API de MP."""
    payment_id: Optional[str] = None


class ConfirmarPagoResponse(SQLModel):
    pedido_id: int
    estado_codigo: str
    mp_status: str
    confirmado: bool


class PagoPublic(SQLModel):
    id: int
    pedido_id: int
    mp_payment_id: Optional[int] = None
    mp_status: str
    mp_status_detail: Optional[str] = None
    external_reference: str
    transaction_amount: Decimal
    payment_method_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
