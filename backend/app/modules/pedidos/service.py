import json
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlmodel import Session

from app.modules.pedidos.models import (
    Pedido, DetallePedido, HistorialEstadoPedido,
)
from app.modules.direcciones.models import DireccionEntrega
from app.modules.pedidos.schemas import (
    PedidoCreate, PedidoPublic, PedidoConDetalle, PedidoList,
    DetallePedidoPublic, HistorialEstadoPublic,
    AvanzarEstadoRequest, EstadoPedidoPublic, FormaPagoPublic,
    DashboardResumen, DashboardPedidoItem,
)
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.config.service import ConfigService

# mapa de transiciones válidas de la FSM
# OJO: pendiente→confirmado NO está acá a propósito (RN-FS02): esa transición es
# exclusivamente automática y la dispara el pago aprobado (PagoService →
# confirmar_pago_aprobado), nunca un usuario vía avanzar_estado.
FSM: dict[str, list[str]] = {
    "pendiente":      ["cancelado"],
    "confirmado":     ["en_preparacion", "cancelado"],
    "en_preparacion": ["en_camino", "cancelado"],
    "en_camino":      ["entregado"],
    "entregado":      [],
    "cancelado":      [],
}

# cancelar desde en_preparacion requiere rol especial
CANCELACION_RESTRINGIDA = {"en_preparacion"}

# estados en los que el stock del pedido está descontado.
# El stock se reserva al confirmar y se mantiene descontado mientras el pedido
# avanza; vuelve al inventario al cancelar (o al revertir una confirmación).
ESTADOS_STOCK_DESCONTADO = {"confirmado", "en_preparacion", "en_camino", "entregado"}


class PedidoService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_or_404(self, uow, pedido_id: int) -> Pedido:
        p = uow.pedidos.get_by_id(pedido_id)
        if not p or p.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Pedido id={pedido_id} no encontrado")
        return p

    def _build_detalle(self, uow, pedido: Pedido) -> PedidoConDetalle:
        items = uow.detalles.get_by_pedido(pedido.id)
        historial_entries = uow.historial.get_by_pedido(pedido.id)

        # Batch lookup de nombres — un solo get por usuario único, sin N+1
        user_ids = {h.usuario_id for h in historial_entries if h.usuario_id is not None}
        nombre_por_id: dict[int, str] = {}
        for uid in user_ids:
            u = uow.usuarios.get_by_id(uid)
            if u:
                nombre_por_id[uid] = (
                    f"{u.nombre} {u.apellido}".strip() if u.apellido else u.nombre
                )

        historial = [
            HistorialEstadoPublic(
                id=h.id,
                estado_desde=h.estado_desde,
                estado_hacia=h.estado_hacia,
                usuario_id=h.usuario_id,
                usuario_nombre=nombre_por_id.get(h.usuario_id) if h.usuario_id is not None else None,
                motivo=h.motivo,
                created_at=h.created_at,
            )
            for h in historial_entries
        ]

        return PedidoConDetalle(
            id=pedido.id,
            usuario_id=pedido.usuario_id,
            direccion_id=pedido.direccion_id,
            direccion_snapshot=pedido.direccion_snapshot,
            estado_codigo=pedido.estado_codigo,
            forma_pago_codigo=pedido.forma_pago_codigo,
            subtotal=pedido.subtotal,
            descuento=pedido.descuento,
            costo_envio=pedido.costo_envio,
            total=pedido.total,
            notas=pedido.notas,
            created_at=pedido.created_at,
            items=[DetallePedidoPublic.model_validate(i) for i in items],
            historial=historial,
        )

    def _descontar_stock_ingredientes(self, uow, producto_id: int, cantidad_productos: int) -> None:
        """
        Por cada ingrediente del producto, descontamos del stock del ingrediente
        la cantidad usada multiplicada por cuántas unidades del producto se pidieron.

        Ej: pizza usa 200g de harina, se piden 3 pizzas → descontamos 600g de harina
        """
        ingredientes_del_producto = uow.producto_ingredientes.get_by_producto(producto_id)

        for pi in ingredientes_del_producto:
            ingrediente = uow.ingredientes.get_by_id(pi.ingrediente_id)
            if not ingrediente:
                continue

            cantidad_a_descontar = pi.cantidad * cantidad_productos

            if ingrediente.stock_cantidad < cantidad_a_descontar:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Stock insuficiente del ingrediente '{ingrediente.nombre}'. "
                        f"Disponible: {ingrediente.stock_cantidad}, "
                        f"necesario: {cantidad_a_descontar}"
                    ),
                )

            ingrediente.stock_cantidad -= cantidad_a_descontar
            uow.ingredientes.add(ingrediente)

    def _restaurar_stock_ingredientes(self, uow, producto_id: int, cantidad_productos: int) -> None:
        """Devuelve al inventario el stock de ingredientes consumido por el producto.

        Es la operación inversa de `_descontar_stock_ingredientes`: por cada
        ingrediente del producto, suma la cantidad usada * unidades del producto.
        """
        ingredientes_del_producto = uow.producto_ingredientes.get_by_producto(producto_id)

        for pi in ingredientes_del_producto:
            ingrediente = uow.ingredientes.get_by_id(pi.ingrediente_id)
            if not ingrediente:
                continue
            ingrediente.stock_cantidad += pi.cantidad * cantidad_productos
            uow.ingredientes.add(ingrediente)

    def _descontar_stock_pedido(self, uow, pedido_id: int) -> None:
        """Descuenta el stock de todo el pedido en un único punto (al confirmar).

        - terminado: descuenta producto.stock_cantidad y valida que alcance (RN-CA05:
          el stock nunca queda negativo).
        - elaborado: su stock de producto es derivado de los ingredientes, así que NO
          se toca producto.stock_cantidad; se descuenta solo el stock de ingredientes
          (que ya valida insuficiencia internamente).
        """
        for detalle in uow.detalles.get_by_pedido(pedido_id):
            producto = uow.productos.get_by_id(detalle.producto_id)
            if not producto:
                continue
            if producto.tipo_producto == "terminado":
                if producto.stock_cantidad < detalle.cantidad:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Stock insuficiente para '{producto.nombre}'",
                    )
                producto.stock_cantidad -= detalle.cantidad
                uow.productos.add(producto)
            else:
                self._descontar_stock_ingredientes(uow, detalle.producto_id, detalle.cantidad)

    def _restaurar_stock_pedido(self, uow, pedido_id: int) -> None:
        """Devuelve el stock al inventario (inverso de _descontar_stock_pedido)."""
        for detalle in uow.detalles.get_by_pedido(pedido_id):
            producto = uow.productos.get_by_id(detalle.producto_id)
            if not producto:
                continue
            if producto.tipo_producto == "terminado":
                producto.stock_cantidad += detalle.cantidad
                uow.productos.add(producto)
            else:
                self._restaurar_stock_ingredientes(uow, detalle.producto_id, detalle.cantidad)

    def _ajustar_stock_por_transicion(
        self, uow, pedido_id: int, estado_desde: str, estado_hacia: str
    ) -> None:
        """Ajusta el inventario según el cambio de estado, usando el invariante
        de `ESTADOS_STOCK_DESCONTADO`:

        - entra a un estado con stock descontado  → descuenta (ej: confirmar)
        - sale  de un estado con stock descontado  → restaura (ej: cancelar)
        - transición entre estados del mismo grupo → sin cambios
        """
        antes = estado_desde in ESTADOS_STOCK_DESCONTADO
        despues = estado_hacia in ESTADOS_STOCK_DESCONTADO
        if not antes and despues:
            self._descontar_stock_pedido(uow, pedido_id)
        elif antes and not despues:
            self._restaurar_stock_pedido(uow, pedido_id)

    def create(self, data: PedidoCreate, usuario_id: int) -> PedidoConDetalle:
        with PedidoUnitOfWork(self._session) as uow:
            forma = uow.formas_pago.get_by_codigo(data.forma_pago_codigo)
            if not forma or not forma.habilitado:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Forma de pago '{data.forma_pago_codigo}' no disponible")

            subtotal = Decimal("0.00")
            detalles = []

            for item in data.items:
                producto = uow.productos.get_by_id(item.producto_id)
                if not producto or producto.deleted_at is not None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"Producto id={item.producto_id} no encontrado")
                if not producto.disponible:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Producto '{producto.nombre}' no está disponible")

                precio = Decimal(str(producto.precio_base))
                subtotal_item = precio * item.cantidad
                subtotal += subtotal_item

                # guardamos el snapshot del precio y nombre al momento de la compra
                detalles.append(DetallePedido(
                    producto_id=item.producto_id,
                    cantidad=item.cantidad,
                    nombre_snapshot=producto.nombre,
                    precio_snapshot=precio,
                    subtotal_snap=subtotal_item,
                    personalizacion=item.personalizacion,
                ))
                # El stock NO se descuenta acá: el pedido nace en 'pendiente' y el
                # descuento ocurre en un único punto al confirmar el pago (RN-FS03).

            # Dirección de entrega: validar ownership y guardar snapshot inmutable (RN-PE03)
            direccion_snapshot = None
            costo_envio = Decimal("0.00")
            if data.direccion_id is not None:
                dire = self._session.get(DireccionEntrega, data.direccion_id)
                if not dire or dire.deleted_at is not None or dire.usuario_id != usuario_id:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail="Dirección no encontrada o no te pertenece")
                direccion_snapshot = json.dumps({
                    "alias": dire.alias, "linea1": dire.linea1, "linea2": dire.linea2,
                    "ciudad": dire.ciudad, "provincia": dire.provincia,
                    "codigo_postal": dire.codigo_postal,
                }, ensure_ascii=False)
                costo_envio = self._get_costo_envio(uow)
            total = subtotal + costo_envio

            pedido = Pedido(
                usuario_id=usuario_id,
                direccion_id=data.direccion_id,
                direccion_snapshot=direccion_snapshot,
                estado_codigo="pendiente",
                forma_pago_codigo=data.forma_pago_codigo,
                subtotal=subtotal,
                descuento=Decimal("0.00"),
                costo_envio=costo_envio,
                total=total,
                notas=data.notas,
            )
            uow.pedidos.add(pedido)

            for detalle in detalles:
                detalle.pedido_id = pedido.id
                uow.detalles.add(detalle)

            # primer registro del historial, estado_desde=None porque es la creación
            uow.historial.add(HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde=None,
                estado_hacia="pendiente",
                usuario_id=usuario_id,
            ))

            result = self._build_detalle(uow, pedido)
        return result

    def get_by_id(self, pedido_id: int, usuario_id: int, roles: list[str]) -> PedidoConDetalle:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_or_404(uow, pedido_id)
            # un cliente solo puede ver sus propios pedidos
            if "CLIENT" in roles and "ADMIN" not in roles and "PEDIDOS" not in roles:
                if pedido.usuario_id != usuario_id:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                        detail="No tenés permisos para ver este pedido")
            result = self._build_detalle(uow, pedido)
        return result

    def update(self, pedido_id: int, data: "PedidoUpdate", usuario_id: int, roles: list[str]) -> PedidoConDetalle:
        if data.nuevo_estado:
            return self.avanzar_estado(pedido_id, data, usuario_id=usuario_id, roles=roles)

        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_or_404(uow, pedido_id)
            if data.notas is not None:
                if pedido.usuario_id != usuario_id and "ADMIN" not in roles and "PEDIDOS" not in roles:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="No tenés permisos para modificar este pedido",
                    )
                pedido.notas = data.notas
                pedido.updated_at = datetime.now(timezone.utc)
                uow.pedidos.add(pedido)
            result = self._build_detalle(uow, pedido)
        return result

    def list_mis_pedidos(self, usuario_id: int, offset: int, limit: int) -> PedidoList:
        with PedidoUnitOfWork(self._session) as uow:
            pedidos = uow.pedidos.get_by_usuario(usuario_id, offset=offset, limit=limit)
            total = uow.pedidos.count_by_usuario(usuario_id)
        return PedidoList(
            data=[PedidoPublic.model_validate(p) for p in pedidos],
            total=total,
        )

    def list_all(self, offset: int, limit: int, estado: str | None = None) -> PedidoList:
        with PedidoUnitOfWork(self._session) as uow:
            pedidos = uow.pedidos.get_active(offset=offset, limit=limit, estado=estado)
            total = uow.pedidos.count(estado=estado)
        return PedidoList(
            data=[PedidoPublic.model_validate(p) for p in pedidos],
            total=total,
        )

    def avanzar_estado(
        self,
        pedido_id: int,
        data: AvanzarEstadoRequest,
        usuario_id: int,
        roles: list[str],
    ) -> PedidoConDetalle:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_or_404(uow, pedido_id)

            # RN-RB05: un CLIENT solo puede operar sobre sus propios pedidos
            es_staff = "ADMIN" in roles or "PEDIDOS" in roles
            if not es_staff and pedido.usuario_id != usuario_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tenés permisos para modificar este pedido",
                )

            estado_actual = pedido.estado_codigo
            estado_hacia = data.nuevo_estado

            # validamos que la transición sea válida en la FSM
            transiciones = FSM.get(estado_actual, [])
            if estado_hacia not in transiciones:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Transición inválida: '{estado_actual}' → '{estado_hacia}'. "
                        f"Transiciones permitidas: {transiciones}"
                    ),
                )

            # cancelar desde en_preparacion requiere rol especial
            if estado_actual in CANCELACION_RESTRINGIDA and estado_hacia == "cancelado":
                if "ADMIN" not in roles and "PEDIDOS" not in roles:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Solo ADMIN o PEDIDOS pueden cancelar un pedido en preparación",
                    )

            # siempre pedimos motivo al cancelar
            if estado_hacia == "cancelado" and not data.motivo:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Se requiere un motivo para cancelar el pedido",
                )

            # ajustamos el inventario según la transición (ej: cancelar restaura stock)
            self._ajustar_stock_por_transicion(uow, pedido.id, estado_actual, estado_hacia)

            pedido.estado_codigo = estado_hacia
            pedido.updated_at = datetime.now(timezone.utc)
            uow.pedidos.add(pedido)

            # registramos el cambio en el historial, que es append-only
            uow.historial.add(HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde=estado_actual,
                estado_hacia=estado_hacia,
                usuario_id=usuario_id,
                motivo=data.motivo,
            ))

            result = self._build_detalle(uow, pedido)
        return result

    def revertir_estado(
        self,
        pedido_id: int,
        usuario_id: int,
        motivo: str | None = None,
    ) -> PedidoConDetalle:
        """Deshace la última transición de estado, volviendo el pedido a su estado previo.

        Solo revierte el último cambio registrado en el historial (no transiciones
        arbitrarias). El historial es append-only: la reversión se registra como una
        nueva entrada que documenta el cambio inverso.
        """
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_or_404(uow, pedido_id)

            ultima = uow.historial.get_ultima(pedido.id)
            if ultima is None or ultima.estado_desde is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No hay un cambio de estado previo para deshacer",
                )

            # solo permitimos deshacer la última acción: el estado actual debe
            # coincidir con el destino de la última transición registrada
            if ultima.estado_hacia != pedido.estado_codigo:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El estado del pedido cambió; ya no se puede deshacer la última acción",
                )

            estado_actual = pedido.estado_codigo
            estado_previo = ultima.estado_desde

            # ajustamos el inventario de forma simétrica al deshacer:
            # deshacer una cancelación vuelve a descontar; deshacer una confirmación restaura
            self._ajustar_stock_por_transicion(uow, pedido.id, estado_actual, estado_previo)

            pedido.estado_codigo = estado_previo
            pedido.updated_at = datetime.now(timezone.utc)
            uow.pedidos.add(pedido)

            uow.historial.add(HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde=estado_actual,
                estado_hacia=estado_previo,
                usuario_id=usuario_id,
                motivo=motivo or f"Reversión: '{estado_actual}' → '{estado_previo}'",
            ))

            result = self._build_detalle(uow, pedido)
        return result

    def dashboard_resumen(self) -> DashboardResumen:
        """Resumen para el panel de administrador: cantidad de pedidos generados,
        ingresos totales y el detalle de cada pedido con su ingreso."""
        with PedidoUnitOfWork(self._session) as uow:
            pedidos = uow.pedidos.get_reales()
            ingresos_total = sum((p.total for p in pedidos), Decimal("0.00"))
            items = [
                DashboardPedidoItem(
                    id=p.id,
                    usuario_id=p.usuario_id,
                    estado_codigo=p.estado_codigo,
                    forma_pago_codigo=p.forma_pago_codigo,
                    total=p.total,
                    created_at=p.created_at,
                )
                for p in pedidos
            ]
            result = DashboardResumen(
                total_pedidos=len(pedidos),
                ingresos_total=ingresos_total,
                pedidos=items,
            )
        return result

    def list_estados(self) -> list[EstadoPedidoPublic]:
        with PedidoUnitOfWork(self._session) as uow:
            estados = uow.estados.get_all_estados()
            result = [EstadoPedidoPublic.model_validate(e) for e in estados]
        return result

    def list_formas_pago(self) -> list[FormaPagoPublic]:
        with PedidoUnitOfWork(self._session) as uow:
            formas = uow.formas_pago.get_habilitadas()
            result = [FormaPagoPublic.model_validate(f) for f in formas]
        return result

    def _get_costo_envio(self, uow) -> Decimal:
        """Obtiene el costo de envío desde la configuración."""
        config_svc = ConfigService(self._session)
        config = config_svc.get()
        return Decimal(str(config.costo_envio))

    def confirmar_pago_aprobado(self, pedido_id: int) -> None:
        """Confirma un pedido tras un pago aprobado. Actor = SISTEMA (webhook /
        verificación de pago), por eso usuario_id=None en el historial (RN-FS09).

        Idempotente: si el pedido no existe, ya no está en 'pendiente' o está
        vacío, no hace nada. Es la ÚNICA vía de transición pendiente→confirmado
        (RN-FS02) y descuenta el stock atómicamente (RN-FS03)."""
        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id(pedido_id)
            if not pedido or pedido.deleted_at is not None:
                return
            if pedido.estado_codigo != "pendiente":
                return  # ya confirmado/avanzado → no repetir (idempotencia)
            if len(uow.detalles.get_by_pedido(pedido.id)) == 0:
                return

            pedido.forma_pago_codigo = "MERCADOPAGO"
            pedido.estado_codigo = "confirmado"
            pedido.updated_at = datetime.now(timezone.utc)
            uow.pedidos.add(pedido)

            uow.historial.add(HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde="pendiente",
                estado_hacia="confirmado",
                usuario_id=None,  # sistema (pago aprobado)
                motivo="Pago aprobado en Mercado Pago",
            ))

            # Descontar stock (producto terminado + ingredientes) de todo el pedido
            self._descontar_stock_pedido(uow, pedido.id)
