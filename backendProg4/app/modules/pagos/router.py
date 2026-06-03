"""
Módulo de pagos con Mercado Pago.

Flujo completo:
  1. El cliente tiene un carrito activo (pedido en estado "pendiente").
  2. El front llama a POST /pagos/preferencia → el back crea una preferencia en MP
     y devuelve el init_point (URL de pago).
  3. El front redirige al usuario a esa URL.
  4. Cuando el usuario termina de pagar, MP lo manda de vuelta al front:
       - /pago/success  → aprobado
       - /pago/failure  → rechazado
       - /pago/pending  → pendiente de acreditación
  5. El front en /pago/success llama a POST /pedidos/confirmar para cerrar el carrito.
  6. En paralelo, MP envía notificaciones al webhook POST /pagos/webhook.
"""

import mercadopago
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlmodel import Session
from typing import Annotated

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_active_user
from app.modules.usuarios.models import UsuarioPublic
from app.modules.pedidos.service import PedidoService


router = APIRouter()


def _get_sdk() -> mercadopago.SDK:
    """Devuelve una instancia del SDK de Mercado Pago configurada con el access token."""
    if not settings.MP_ACCESS_TOKEN or settings.MP_ACCESS_TOKEN == "TU_ACCESS_TOKEN_AQUI":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mercado Pago no está configurado. Definí MP_ACCESS_TOKEN en el .env.",
        )
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


# ── POST /pagos/preferencia ────────────────────────────────────────────────────

@router.post("/preferencia")
def crear_preferencia(
    session: Annotated[Session, Depends(get_session)],
    user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    """
    Crea una preferencia de pago en Mercado Pago a partir del carrito activo
    del usuario y devuelve el init_point al que el front debe redirigir.
    """
    svc = PedidoService(session)
    carrito = svc.get_carrito_activo(user.id)

    if not carrito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tenés un carrito activo. Agregá productos primero.",
        )
    if not carrito.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El carrito está vacío.",
        )

    sdk = _get_sdk()

    # Armamos los ítems de la preferencia con los datos del carrito
    items_mp = [
        {
            "id": str(item.producto_id),
            "title": item.nombre_snapshot,
            "quantity": item.cantidad,
            "unit_price": float(item.precio_snapshot),
            "currency_id": "ARS",
        }
        for item in carrito.items
    ]

    # Agregamos el costo de envío como ítem separado si es mayor a 0
    if carrito.costo_envio and float(carrito.costo_envio) > 0:
        items_mp.append({
            "id": "envio",
            "title": "Costo de envío",
            "quantity": 1,
            "unit_price": float(carrito.costo_envio),
            "currency_id": "ARS",
        })

    is_localhost = "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL

    preference_data = {
        "items": items_mp,
        "back_urls": {
            "success": f"{settings.FRONTEND_URL}/pago/success",
            "failure": f"{settings.FRONTEND_URL}/pago/failure",
            "pending": f"{settings.FRONTEND_URL}/pago/pending",
        },
        # auto_return solo funciona con URLs públicas (no localhost)
        # En producción con dominio real, MP redirige automáticamente al success URL
        **({"auto_return": "approved"} if not is_localhost else {}),
        # Guardamos el ID del pedido como referencia externa para el webhook
        "external_reference": str(carrito.id),
        # El webhook solo funciona con URLs públicas; en dev se puede omitir
        **({"notification_url": f"{settings.BACKEND_URL}/pagos/webhook"} if not is_localhost else {}),
    }

    result = sdk.preference().create(preference_data)

    if result["status"] not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al crear preferencia en Mercado Pago: {result.get('response')}",
        )

    init_point = result["response"]["init_point"]
    return {"init_point": init_point}


# ── POST /pagos/webhook ────────────────────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Endpoint que Mercado Pago llama para notificar cambios de estado de un pago.
    Debe responder 200 inmediatamente; el procesamiento se hace en background.

    MP envía dos tipos de notificaciones:
      - IPN (Legacy): body con {topic, id}
      - Webhooks (Nuevo): body con {type, data: {id}}
    """
    # Respondemos 200 de inmediato (MP requiere respuesta rápida)
    try:
        body = await request.json()
    except Exception:
        body = {}

    background_tasks.add_task(_procesar_notificacion_mp, body, dict(request.query_params))
    return {"status": "ok"}


def _procesar_notificacion_mp(body: dict, query_params: dict) -> None:
    """Procesa la notificación de MP en background y loguea la info del pago."""
    try:
        # Soporte para ambos formatos de notificación de MP
        notification_type = body.get("type") or query_params.get("topic")
        payment_id = (
            body.get("data", {}).get("id")
            or query_params.get("id")
            or query_params.get("payment_id")
        )

        if notification_type not in ("payment", "payment_id") or not payment_id:
            # No es una notificación de pago (puede ser de suscripción, etc.)
            return

        if not settings.MP_ACCESS_TOKEN or settings.MP_ACCESS_TOKEN == "TU_ACCESS_TOKEN_AQUI":
            return

        sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)
        result = sdk.payment().get(str(payment_id))

        if result["status"] != 200:
            print(f"[MP Webhook] Error al obtener pago {payment_id}: {result}")
            return

        pago = result["response"]
        print(
            f"[MP Webhook] Pago {pago['id']} | "
            f"Estado: {pago['status']} | "
            f"Detalle: {pago.get('status_detail')} | "
            f"Pedido ref: {pago.get('external_reference')} | "
            f"Monto: ${pago.get('transaction_amount')}"
        )

    except Exception as e:
        print(f"[MP Webhook] Error procesando notificación: {e}")
