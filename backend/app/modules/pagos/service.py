"""
Servicio de pagos con Mercado Pago (Checkout Pro).

Hace que el pago sea la **fuente de verdad** de la confirmación del pedido:
- Al crear la preferencia se persiste un registro `Pago` (estado pending) con un
  `idempotency_key` y `external_reference = id del pedido`.
- El pedido pasa a `confirmado` SOLO cuando Mercado Pago reporta el pago como
  `approved`, verificado consultando la API de MP (nunca se confía en datos
  crudos del front o del webhook).
- La confirmación es idempotente: webhook + retorno a /pago/success pueden
  dispararla varias veces sin doble efecto.
"""
import uuid
from decimal import Decimal

import mercadopago
from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.config import settings
from app.modules.pedidos.models import Pago
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.pedidos.service import PedidoService


class PagoService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _sdk(self) -> mercadopago.SDK:
        if not settings.MP_ACCESS_TOKEN or settings.MP_ACCESS_TOKEN == "TU_ACCESS_TOKEN_AQUI":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Mercado Pago no está configurado. Definí MP_ACCESS_TOKEN en el .env.",
            )
        return mercadopago.SDK(settings.MP_ACCESS_TOKEN)

    # ── Crear preferencia + registrar Pago ──────────────────────────────────
    def crear_preferencia(self, usuario_id: int, pedido_id: int) -> str:
        """Crea la preferencia MP para un pedido pendiente ya existente (el
        checkout primero crea el pedido con POST /pedidos y luego pide su
        preferencia). El carrito vive solo en el cliente (RN-CR01)."""
        sdk = self._sdk()

        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id(pedido_id)
            if not pedido or pedido.deleted_at is not None or pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Pedido no encontrado")
            if pedido.estado_codigo != "pendiente":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="El pedido ya no está pendiente de pago")
            detalles = uow.detalles.get_by_pedido(pedido.id)
            if not detalles:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="El pedido no tiene items")
            items_mp = [
                {
                    "id": str(d.producto_id),
                    "title": d.nombre_snapshot,
                    "quantity": d.cantidad,
                    "unit_price": float(d.precio_snapshot),
                    "currency_id": "ARS",
                }
                for d in detalles
            ]
            costo_envio = pedido.costo_envio
            total = pedido.total

        if costo_envio and float(costo_envio) > 0:
            items_mp.append({
                "id": "envio", "title": "Costo de envío", "quantity": 1,
                "unit_price": float(costo_envio), "currency_id": "ARS",
            })

        is_localhost = "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL
        preference_data = {
            "items": items_mp,
            "back_urls": {
                "success": f"{settings.FRONTEND_URL}/pago/success",
                "failure": f"{settings.FRONTEND_URL}/pago/failure",
                "pending": f"{settings.FRONTEND_URL}/pago/pending",
            },
            **({"auto_return": "approved"} if not is_localhost else {}),
            "external_reference": str(pedido_id),
            **({"notification_url": f"{settings.BACKEND_URL}/api/v1/pagos/webhook"} if not is_localhost else {}),
        }

        result = sdk.preference().create(preference_data)
        if result["status"] not in (200, 201):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail=f"Error al crear preferencia en Mercado Pago: {result.get('response')}")

        init_point = result["response"]["init_point"]

        # Registro Pago (pending) — reutilizamos el existente si reintenta el checkout
        with PedidoUnitOfWork(self._session) as uow:
            existentes = uow.pagos.get_by_pedido(pedido_id)
            if not existentes:
                uow.pagos.add(Pago(
                    pedido_id=pedido_id,
                    mp_status="pending",
                    external_reference=str(pedido_id),
                    idempotency_key=str(uuid.uuid4()),
                    transaction_amount=Decimal(str(total)),
                ))

        return init_point

    # ── Verificar un pago en MP y confirmar el pedido si corresponde ─────────
    def procesar_pago(self, payment_id: str) -> dict:
        """Consulta el pago en MP, actualiza el registro `Pago` y, si está
        `approved`, confirma el pedido. Idempotente. Devuelve un resumen."""
        sdk = self._sdk()
        result = sdk.payment().get(str(payment_id))
        if result["status"] != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="No se pudo verificar el pago en Mercado Pago.")

        pago_mp = result["response"]
        external_reference = pago_mp.get("external_reference")
        mp_status = pago_mp.get("status") or "unknown"
        mp_status_detail = pago_mp.get("status_detail")
        mp_payment_id = pago_mp.get("id")
        payment_method_id = pago_mp.get("payment_method_id")
        transaction_amount = pago_mp.get("transaction_amount") or 0

        if not external_reference:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="El pago no tiene external_reference (pedido).")
        pedido_id = int(external_reference)

        # Upsert del registro de pago
        with PedidoUnitOfWork(self._session) as uow:
            existentes = uow.pagos.get_by_pedido(pedido_id)
            registro = existentes[0] if existentes else None
            if registro is None:
                registro = Pago(
                    pedido_id=pedido_id,
                    external_reference=external_reference,
                    idempotency_key=str(uuid.uuid4()),
                    transaction_amount=Decimal(str(transaction_amount)),
                    mp_status=mp_status,
                )
            registro.mp_status = mp_status
            registro.mp_status_detail = mp_status_detail
            registro.mp_payment_id = mp_payment_id
            registro.payment_method_id = payment_method_id
            uow.pagos.add(registro)

        # Confirmación autoritativa: solo si el pago está aprobado (idempotente)
        confirmado = False
        if mp_status == "approved":
            PedidoService(self._session).confirmar_pago_aprobado(pedido_id)
            confirmado = True

        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id(pedido_id)
            estado_codigo = pedido.estado_codigo if pedido else "desconocido"

        return {
            "pedido_id": pedido_id,
            "estado_codigo": estado_codigo,
            "mp_status": mp_status,
            "confirmado": confirmado,
        }

    def get_pagos_de_pedido(self, pedido_id: int, usuario_id: int, roles: list[str]) -> list[Pago]:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id(pedido_id)
            if not pedido or pedido.deleted_at is not None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Pedido id={pedido_id} no encontrado")
            es_staff = "ADMIN" in roles or "PEDIDOS" in roles
            if not es_staff and pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                    detail="No tenés permisos para ver los pagos de este pedido")
            return uow.pagos.get_by_pedido(pedido_id)
