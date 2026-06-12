"""
Módulo de pagos con Mercado Pago (Checkout Pro).

Flujo:
  1. El cliente tiene un carrito activo (pedido en estado "pendiente").
  2. POST /pagos/preferencia → el back crea la preferencia en MP, persiste un
     registro `Pago` (pending) y devuelve el init_point (URL de pago).
  3. El front redirige al usuario a esa URL.
  4. Al terminar, MP redirige al front:
       - /pago/success  → aprobado    - /pago/failure  → rechazado
       - /pago/pending  → pendiente
  5. El front en /pago/success llama a POST /pagos/confirmar con el payment_id:
     el back lo VERIFICA contra la API de MP y, si está approved, confirma el
     pedido. (Esto hace que el flujo ande en localhost, donde el webhook no llega.)
  6. En paralelo, MP llama a POST /pagos/webhook (IPN): misma verificación.

La confirmación del pedido es autoritativa: solo ocurre con pago `approved`
verificado contra MP, nunca a ciegas desde el front.
"""
import hashlib
import hmac
import json
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlmodel import Session

from app.core.config import settings
from app.core.database import get_session, SessionLocal
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.models import UsuarioPublic
from app.modules.pagos.service import PagoService
from app.modules.pagos.schemas import (
    PreferenciaResponse, ConfirmarPagoRequest, ConfirmarPagoResponse, PagoPublic,
)

router = APIRouter()


def get_service(session: Annotated[Session, Depends(get_session)]) -> PagoService:
    return PagoService(session)


# ── POST /pagos/preferencia ──────────────────────────────────────────────────
@router.post("/preferencia", response_model=PreferenciaResponse)
def crear_preferencia(
    svc: Annotated[PagoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Crea la preferencia de pago del carrito activo y registra el Pago (pending)."""
    init_point = svc.crear_preferencia(user.id)
    return PreferenciaResponse(init_point=init_point)


# ── POST /pagos/confirmar ────────────────────────────────────────────────────
@router.post("/confirmar", response_model=ConfirmarPagoResponse)
def confirmar_pago(
    data: ConfirmarPagoRequest,
    svc: Annotated[PagoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Verifica el pago contra MP y confirma el pedido si está aprobado.
    Lo llama el front al volver a /pago/success con el payment_id de MP."""
    if not data.payment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Falta el payment_id de Mercado Pago.")
    res = svc.procesar_pago(data.payment_id)
    return ConfirmarPagoResponse(**res)


# ── GET /pagos/pedido/{pedido_id} ────────────────────────────────────────────
@router.get("/pedido/{pedido_id}", response_model=list[PagoPublic])
def pagos_de_pedido(
    pedido_id: int,
    svc: Annotated[PagoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    """Historial de pagos de un pedido (propietario o ADMIN/PEDIDOS)."""
    return svc.get_pagos_de_pedido(pedido_id, usuario_id=user.id, roles=user.roles)


# ── POST /pagos/webhook (IPN) ────────────────────────────────────────────────
@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request, background_tasks: BackgroundTasks):
    """Notificación IPN de MP. Valida firma, responde 200 inmediato y procesa
    el pago en background (verificándolo contra la API de MP)."""
    raw = await request.body()
    try:
        body = json.loads(raw) if raw else {}
    except Exception:
        body = {}
    query_params = dict(request.query_params)

    if not _firma_valida(request, query_params, body):
        # Respondemos 200 igual (para que MP no reintente) pero no procesamos
        return {"status": "invalid_signature"}

    notification_type = body.get("type") or query_params.get("topic")
    payment_id = (
        (body.get("data", {}) or {}).get("id")
        or query_params.get("data.id")
        or query_params.get("id")
        or query_params.get("payment_id")
    )

    if notification_type in ("payment", "payment_id") and payment_id:
        background_tasks.add_task(_procesar_en_background, str(payment_id))

    return {"status": "ok"}


def _firma_valida(request: Request, query_params: dict, body: dict) -> bool:
    """Valida la firma x-signature de MP. Si no hay MP_WEBHOOK_SECRET configurado,
    se omite la validación (modo desarrollo)."""
    secret = settings.MP_WEBHOOK_SECRET
    if not secret:
        return True

    signature = request.headers.get("x-signature")
    if not signature:
        return False
    partes = dict(p.split("=", 1) for p in signature.split(",") if "=" in p)
    ts = partes.get("ts")
    v1 = partes.get("v1")
    data_id = (
        query_params.get("data.id")
        or (body.get("data", {}) or {}).get("id")
        or query_params.get("id")
    )
    if not (ts and v1 and data_id):
        return False

    request_id = request.headers.get("x-request-id", "")
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    computed = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, v1)


def _procesar_en_background(payment_id: str) -> None:
    """Procesa la notificación en background con su propia sesión de BD."""
    try:
        with SessionLocal() as session:
            PagoService(session).procesar_pago(payment_id)
    except Exception as e:  # nunca dejamos que reviente el background task
        print(f"[MP Webhook] Error procesando pago {payment_id}: {e}")
