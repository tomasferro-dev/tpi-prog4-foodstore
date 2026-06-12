from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.models import UsuarioPublic
from app.modules.productos.schemas import (
    ProductoCreate, ProductoCreateCompleto, ProductoPublic, ProductoUpdate, ProductoList,
    ProductoConDetalle, ProductoCategoriaCreate, ProductoIngredienteCreate, ProductoStockAjuste,
)
from app.modules.productos.service import ProductoService

public_router = APIRouter()
admin_router = APIRouter()


def get_service(session: Annotated[Session, Depends(get_session)]) -> ProductoService:
    return ProductoService(session)


# ── Rutas públicas (/productos) ──────────────────────────────────────────────

@public_router.get("/", response_model=ProductoList)
def list_productos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 20,
    busqueda: Annotated[Optional[str], Query()] = None,
    categoria_id: Annotated[Optional[int], Query()] = None,
    precio_min: Annotated[Optional[float], Query(ge=0)] = None,
    precio_max: Annotated[Optional[float], Query(ge=0)] = None,
    disponible: Annotated[Optional[bool], Query()] = None,
    sin_alergenos: Annotated[Optional[bool], Query()] = None,
    svc: ProductoService = Depends(get_service),
):
    return svc.get_all(
        offset=offset, limit=limit,
        busqueda=busqueda, categoria_id=categoria_id,
        precio_min=precio_min, precio_max=precio_max,
        disponible=disponible, sin_alergenos=sin_alergenos,
    )


@public_router.get("/{producto_id}", response_model=ProductoConDetalle)
def get_producto(
    producto_id: int,
    svc: ProductoService = Depends(get_service),
):
    return svc.get_by_id(producto_id)


# ── Rutas admin (/admin/productos) ───────────────────────────────────────────

@admin_router.get("/", response_model=ProductoList)
def list_productos_admin(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 20,
    busqueda: Annotated[Optional[str], Query()] = None,
    categoria_id: Annotated[Optional[int], Query()] = None,
    precio_min: Annotated[Optional[float], Query(ge=0)] = None,
    precio_max: Annotated[Optional[float], Query(ge=0)] = None,
    disponible: Annotated[Optional[bool], Query()] = None,
    sin_alergenos: Annotated[Optional[bool], Query()] = None,
    include_deleted: Annotated[bool, Query()] = False,
    svc: ProductoService = Depends(get_service),
    _user: UsuarioPublic = Depends(require_role(["ADMIN", "STOCK"])),
):
    return svc.get_all(
        offset=offset, limit=limit,
        busqueda=busqueda, categoria_id=categoria_id,
        precio_min=precio_min, precio_max=precio_max,
        disponible=disponible, sin_alergenos=sin_alergenos,
        include_deleted=include_deleted,
    )


@admin_router.post("/", response_model=ProductoPublic, status_code=status.HTTP_201_CREATED)
def create_producto(
    data: ProductoCreate,
    svc: Annotated[ProductoService, Depends(get_service)],
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN", "STOCK"]))],
):
    return svc.create(data)


@admin_router.post("/completo", response_model=ProductoConDetalle, status_code=status.HTTP_201_CREATED)
def create_producto_completo(
    data: ProductoCreateCompleto,
    svc: Annotated[ProductoService, Depends(get_service)],
    _admin: Annotated[UsuarioPublic, Depends(require_role(["ADMIN", "STOCK"]))],
):
    """Crea un producto con categorías e ingredientes en una sola transacción.
    Para productos elaborados, se requiere al menos un ingrediente."""
    return svc.create_completo(data)


@admin_router.patch("/{producto_id}/stock", response_model=ProductoPublic)
def ajustar_stock(
    producto_id: int,
    data: ProductoStockAjuste,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN", "STOCK"])),
):
    """Establece el stock de un producto terminado.
    No aplica a elaborados (su stock se calcula desde ingredientes)."""
    return svc.ajustar_stock(producto_id, data)


@admin_router.patch("/{producto_id}", response_model=ProductoPublic)
def update_producto(
    producto_id: int,
    data: ProductoUpdate,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN", "STOCK"])),
):
    return svc.update(producto_id, data)


@admin_router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_producto(
    producto_id: int,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    svc.delete(producto_id)


@admin_router.post("/{producto_id}/reactivar", response_model=ProductoPublic)
def reactivar_producto(
    producto_id: int,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN", "STOCK"])),
):
    return svc.reactivar(producto_id)


@admin_router.post("/{producto_id}/categorias", response_model=ProductoConDetalle)
def agregar_categoria(
    producto_id: int,
    data: ProductoCategoriaCreate,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    return svc.agregar_categoria(producto_id, data)


@admin_router.delete("/{producto_id}/categorias/{categoria_id}", response_model=ProductoConDetalle)
def quitar_categoria(
    producto_id: int,
    categoria_id: int,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    return svc.quitar_categoria(producto_id, categoria_id)


@admin_router.post("/{producto_id}/ingredientes", response_model=ProductoConDetalle)
def agregar_ingrediente(
    producto_id: int,
    data: ProductoIngredienteCreate,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    return svc.agregar_ingrediente(producto_id, data)


@admin_router.delete("/{producto_id}/ingredientes/{ingrediente_id}", response_model=ProductoConDetalle)
def quitar_ingrediente(
    producto_id: int,
    ingrediente_id: int,
    svc: ProductoService = Depends(get_service),
    _admin: UsuarioPublic = Depends(require_role(["ADMIN"])),
):
    return svc.quitar_ingrediente(producto_id, ingrediente_id)
