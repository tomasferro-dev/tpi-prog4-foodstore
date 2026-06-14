from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.models import UsuarioPublic
from app.modules.pedidos.schemas import (
    PedidoCreate, PedidoPublic, PedidoConDetalle, PedidoList,
    PedidoUpdate, AvanzarEstadoRequest, CancelarPedidoRequest,
    EstadoPedidoPublic, FormaPagoPublic, HistorialEstadoPublic, DashboardResumen,
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


# pedidos del usuario logeado
# El carrito vive solo en el cliente (RN-CR01): el pedido se crea acá, en el checkout.

@router.post("/", response_model=PedidoConDetalle, status_code=status.HTTP_201_CREATED)
def create_pedido(
    data: PedidoCreate,
    svc: Annotated[PedidoService, Depends(get_service)],
    user: Annotated[UsuarioPublic, Depends(require_role(["CLIENT"]))],
):
    """Crea un pedido pendiente a partir de los items del carrito del cliente."""
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


@router.get("/{pedido_id}/historial", response_model=list[HistorialEstadoPublic])
def get_historial(
    pedido_id: int,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(get_current_active_user),
):
    """Historial completo de transiciones del pedido (ORDER BY created_at ASC)."""
    return svc.get_by_id(pedido_id, usuario_id=user.id, roles=user.roles).historial


@router.patch("/{pedido_id}/estado", response_model=PedidoConDetalle)
def avanzar_estado(
    pedido_id: int,
    data: AvanzarEstadoRequest,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(require_role(["ADMIN", "PEDIDOS"])),
):
    """Avanza (o cancela) el estado de un pedido. Valida la FSM. Solo ADMIN/PEDIDOS."""
    return svc.avanzar_estado(pedido_id, data, usuario_id=user.id, roles=user.roles)


@router.delete("/{pedido_id}", response_model=PedidoConDetalle)
def cancelar_pedido_propio(
    pedido_id: int,
    data: CancelarPedidoRequest,
    svc: PedidoService = Depends(get_service),
    user: UsuarioPublic = Depends(require_role(["CLIENT"])),
):
    """Cancela un pedido propio (solo PENDIENTE o CONFIRMADO). Requiere motivo."""
    return svc.avanzar_estado(
        pedido_id,
        AvanzarEstadoRequest(nuevo_estado="cancelado", motivo=data.motivo),
        usuario_id=user.id,
        roles=user.roles,
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
