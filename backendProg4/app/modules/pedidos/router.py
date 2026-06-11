from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.models import UsuarioPublic
from app.modules.pedidos.schemas import (
    PedidoCreate, PedidoPublic, PedidoConDetalle, PedidoList,
    PedidoUpdate, AvanzarEstadoRequest, EstadoPedidoPublic, FormaPagoPublic,
    ItemPedidoRequest, ConfirmarCompraRequest, DashboardResumen,
)
from app.modules.pedidos.service import PedidoService

router = APIRouter()


def get_service(session: Annotated[Session, Depends(get_session)]) -> PedidoService:
    return PedidoService(session)


# catalogos - estados, formas de pago, etc

@router.get("/estados", response_model=list[EstadoPedidoPublic])
def list_estados(
    svc: Annotated[PedidoService, Depends(get_service)],
    _user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    return svc.list_estados()


@router.get("/formas-pago", response_model=list[FormaPagoPublic])
def list_formas_pago(
    svc: Annotated[PedidoService, Depends(get_service)],
    _user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    return svc.list_formas_pago()


# carrito del usuario logueado (solo CLIENT)

@router.get("/actual", response_model=PedidoConDetalle | None)
def get_carrito_activo(
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Obtiene el carrito activo del usuario. Retorna null si no existe."""
    return svc.get_carrito_activo(user.id)


@router.post("/items", response_model=PedidoConDetalle)
def agregar_al_carrito(
    item: ItemPedidoRequest,
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Agrega o actualiza un producto en el carrito del usuario."""
    return svc.agregar_al_carrito(
        usuario_id=user.id,
        producto_id=item.producto_id,
        cantidad=item.cantidad,
        personalizacion=item.personalizacion,
    )


@router.delete("/items/{producto_id}", response_model=PedidoConDetalle | None)
def eliminar_del_carrito(
    producto_id: int,
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Elimina un producto del carrito. Retorna null si no hay carrito."""
    return svc.eliminar_del_carrito(user.id, producto_id)


@router.post("/confirmar", response_model=PedidoConDetalle)
def confirmar_compra(
    data: ConfirmarCompraRequest,
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Confirma el carrito, transicionando a estado 'confirmado'."""
    return svc.confirmar_carrito(
        usuario_id=user.id,
        forma_pago_codigo=data.forma_pago_codigo,
        direccion_id=data.direccion_id,
        notas=data.notas,
    )


# pedidos del usuario logeado

@router.post("/", response_model=PedidoConDetalle, status_code=status.HTTP_201_CREATED)
def create_pedido(
    data: PedidoCreate,
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(get_current_active_user)],
):
    return svc.create(data, usuario_id=user.id)


@router.get("/", response_model=PedidoList)
def list_pedidos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(get_current_active_user),
):
    return svc.list_mis_pedidos(user.id, offset=offset, limit=limit)


@router.put("/{pedido_id}", response_model=PedidoConDetalle)
def update_pedido(
    pedido_id: int,
    data: PedidoUpdate,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(get_current_active_user),
):
    return svc.update(pedido_id, data, usuario_id=user.id, roles=user.roles)


@router.get("/mis-pedidos", response_model=PedidoList)
def list_mis_pedidos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(get_current_active_user),
):
    return svc.list_mis_pedidos(user.id, offset=offset, limit=limit)


@router.get("/{pedido_id}", response_model=PedidoConDetalle)
def get_pedido(
    pedido_id: int,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(get_current_active_user),
):
    return svc.get_by_id(pedido_id, usuario_id=user.id, roles=user.roles)


@router.post("/{pedido_id}/estado", response_model=PedidoConDetalle)
def avanzar_estado(
    pedido_id: int,
    data: AvanzarEstadoRequest,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(require_role(["ADMIN", "PEDIDOS", "CLIENT"])),
):
    return svc.avanzar_estado(
        pedido_id, data, usuario_id=user.id, roles=user.roles
    )


@router.post("/{pedido_id}/revertir", response_model=PedidoConDetalle)
def revertir_estado(
    pedido_id: int,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(require_role(["ADMIN", "PEDIDOS"])),
):
    """Deshace la última transición de estado, volviendo el pedido a su estado previo."""
    return svc.revertir_estado(pedido_id, usuario_id=user.id)


# admin - dashboard / resumen (solo ADMIN)

@router.get("/admin/dashboard", response_model=DashboardResumen)
def admin_dashboard(
    svc: PedidoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    """Resumen de pedidos generados e ingresos para el panel de administrador."""
    return svc.dashboard_resumen()


# admin - ve todos los pedidos

@router.get("/admin/todos", response_model=PedidoList)
def list_all_pedidos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: Annotated[str | None, Query()] = None,
    svc: PedidoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN", "PEDIDOS"])),
):
    return svc.list_all(offset=offset, limit=limit, estado=estado)
