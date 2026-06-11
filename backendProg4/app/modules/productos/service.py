from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.productos.schemas import (
    ProductoCreate, ProductoCreateCompleto, ProductoPublic, ProductoUpdate, ProductoList,
    ProductoConDetalle, ProductoCategoriaCreate, ProductoCategoriaPublic,
    ProductoIngredienteCreate, ProductoIngredientePublic, ProductoStockAjuste,
)
from app.modules.categorias.schemas import CategoriaPublic
from app.modules.ingredientes.schemas import IngredientePublic
from app.modules.unidad_medida.schemas import UnidadMedidaPublic
from app.modules.productos.unit_of_work import ProductoUnitOfWork


class ProductoService:
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _calc_stock(p: Producto) -> int:
        """Devuelve el stock efectivo según el tipo de producto.

        - elaborado: mínimo de (stock_ingrediente // cantidad_requerida) por ingrediente.
        - terminado: valor almacenado en stock_cantidad (gestionado manualmente).
        """
        if p.tipo_producto == "terminado":
            return p.stock_cantidad
        # elaborado: calculado desde ingredientes
        stocks = []
        for pi in p.producto_ingredientes:
            if pi.ingrediente and pi.cantidad > 0:
                stocks.append(int(pi.ingrediente.stock_cantidad // pi.cantidad))
        return min(stocks) if stocks else 0

    def _get_or_404(self, uow, producto_id: int) -> Producto:
        p = uow.productos.get_by_id(producto_id)
        if not p or p.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Producto id={producto_id} no encontrado")
        return p

    def _build_detalle(self, uow, producto_id: int) -> ProductoConDetalle:
        p = uow.productos.get_by_id_con_detalle(producto_id)
        if not p or p.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Producto id={producto_id} no encontrado")

        unidad_venta = None
        if p.unidad_venta_id:
            u = uow.unidades.get_by_id(p.unidad_venta_id)
            if u:
                unidad_venta = UnidadMedidaPublic.model_validate(u)

        categorias = [
            ProductoCategoriaPublic(
                categoria_id=pc.categoria_id,
                es_principal=pc.es_principal,
                categoria=CategoriaPublic.model_validate(pc.categoria) if pc.categoria else None,
            )
            for pc in p.producto_categorias
        ]

        # calculamos el costo de cada ingrediente y el total estimado
        # costo de un ingrediente = cantidad usada * precio_por_unidad del ingrediente
        ingredientes = []
        costo_estimado = 0.0

        for pi in p.producto_ingredientes:
            costo_ing = 0.0
            if pi.ingrediente:
                costo_ing = pi.cantidad * pi.ingrediente.precio_por_unidad
                costo_estimado += costo_ing

            ingredientes.append(ProductoIngredientePublic(
                ingrediente_id=pi.ingrediente_id,
                cantidad=pi.cantidad,
                unidad_medida_id=pi.unidad_medida_id,
                es_removible=pi.es_removible,
                costo_ingrediente=round(costo_ing, 2),
                ingrediente=IngredientePublic.model_validate(pi.ingrediente) if pi.ingrediente else None,
            ))

        return ProductoConDetalle(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            imagen_url=p.imagen_url,
            precio_base=p.precio_base,
            stock_cantidad=self._calc_stock(p),
            disponible=p.disponible,
            tipo_producto=p.tipo_producto,
            unidad_venta_id=p.unidad_venta_id,
            unidad_venta=unidad_venta,
            categorias=categorias,
            ingredientes=ingredientes,
            costo_estimado=round(costo_estimado, 2),
            created_at=p.created_at,
            updated_at=p.updated_at,
            deleted_at=p.deleted_at,
        )

    def create(self, data: ProductoCreate) -> ProductoPublic:
        with ProductoUnitOfWork(self._session) as uow:
            if data.unidad_venta_id:
                if not uow.unidades.get_by_id(data.unidad_venta_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"UnidadMedida id={data.unidad_venta_id} no encontrada")
            p = Producto.model_validate(data)
            uow.productos.add(p)
            result = ProductoPublic.model_validate(p)
        return result

    def create_completo(self, data: ProductoCreateCompleto) -> ProductoConDetalle:
        """Crea producto + categorías + ingredientes en una sola transacción atómica."""
        with ProductoUnitOfWork(self._session) as uow:
            if data.unidad_venta_id:
                if not uow.unidades.get_by_id(data.unidad_venta_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"UnidadMedida id={data.unidad_venta_id} no encontrada")

            # Crear el producto base (el repo hace flush → p.id queda disponible)
            p = Producto(
                nombre=data.nombre,
                descripcion=data.descripcion,
                imagen_url=data.imagen_url,
                precio_base=data.precio_base,
                unidad_venta_id=data.unidad_venta_id,
                stock_cantidad=data.stock_cantidad,
                disponible=data.disponible,
                tipo_producto=data.tipo_producto,
            )
            uow.productos.add(p)  # flush interno → p.id ya tiene valor

            # Agregar categorías
            for cat_id in data.categoria_ids:
                if not uow.categorias.get_by_id(cat_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"Categoria id={cat_id} no encontrada")
                uow.producto_categorias.add(ProductoCategoria(
                    producto_id=p.id,
                    categoria_id=cat_id,
                    es_principal=False,
                ))

            # Agregar ingredientes
            for ing_data in data.ingredientes:
                if not uow.ingredientes.get_by_id(ing_data.ingrediente_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"Ingrediente id={ing_data.ingrediente_id} no encontrado")
                if not uow.unidades.get_by_id(ing_data.unidad_medida_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"UnidadMedida id={ing_data.unidad_medida_id} no encontrada")
                uow.producto_ingredientes.add(ProductoIngrediente(
                    producto_id=p.id,
                    ingrediente_id=ing_data.ingrediente_id,
                    cantidad=ing_data.cantidad,
                    unidad_medida_id=ing_data.unidad_medida_id,
                    es_removible=ing_data.es_removible,
                ))

            result = self._build_detalle(uow, p.id)
        return result

    def ajustar_stock(self, producto_id: int, data: ProductoStockAjuste) -> ProductoPublic:
        """Establece el stock de un producto terminado (valor absoluto)."""
        with ProductoUnitOfWork(self._session) as uow:
            p = self._get_or_404(uow, producto_id)
            if p.tipo_producto != "terminado":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Solo se puede ajustar el stock manualmente de productos terminados. "
                           "El stock de productos elaborados se calcula automáticamente desde los ingredientes.",
                )
            p.stock_cantidad = data.stock_cantidad
            p.updated_at = datetime.now(timezone.utc)
            uow.productos.add(p)
            result = ProductoPublic.model_validate(p)
        return result

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        busqueda: str | None = None,
        categoria_id: int | None = None,
        precio_min: float | None = None,
        precio_max: float | None = None,
        disponible: bool | None = None,
        sin_alergenos: bool | None = None,
        include_deleted: bool = False,
    ) -> ProductoList:
        with ProductoUnitOfWork(self._session) as uow:
            productos = uow.productos.get_filtered(
                offset=offset, limit=limit,
                busqueda=busqueda, categoria_id=categoria_id,
                precio_min=precio_min, precio_max=precio_max,
                disponible=disponible, sin_alergenos=sin_alergenos,
                include_deleted=include_deleted,
            )
            total = uow.productos.count_filtered(
                busqueda=busqueda, categoria_id=categoria_id,
                precio_min=precio_min, precio_max=precio_max,
                disponible=disponible, sin_alergenos=sin_alergenos,
                include_deleted=include_deleted,
            )
            items = []
            for p in productos:
                pub = ProductoPublic.model_validate(p)
                pub.stock_cantidad = self._calc_stock(p)
                items.append(pub)
            result = ProductoList(items=items, total=total, skip=offset, limit=limit)
        return result

    def get_by_id(self, producto_id: int) -> ProductoConDetalle:
        with ProductoUnitOfWork(self._session) as uow:
            result = self._build_detalle(uow, producto_id)
        return result

    def update(self, producto_id: int, data: ProductoUpdate) -> ProductoPublic:
        with ProductoUnitOfWork(self._session) as uow:
            p = self._get_or_404(uow, producto_id)
            if data.unidad_venta_id and data.unidad_venta_id != p.unidad_venta_id:
                if not uow.unidades.get_by_id(data.unidad_venta_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                        detail=f"UnidadMedida id={data.unidad_venta_id} no encontrada")
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(p, field, value)
            p.updated_at = datetime.now(timezone.utc)
            uow.productos.add(p)
            result = ProductoPublic.model_validate(p)
        return result

    def reactivar(self, producto_id: int) -> ProductoPublic:
        with ProductoUnitOfWork(self._session) as uow:
            p = uow.productos.get_by_id(producto_id)
            if not p:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Producto id={producto_id} no encontrado")
            p.deleted_at = None
            p.disponible = True
            p.updated_at = datetime.now(timezone.utc)
            uow.productos.add(p)
            result = ProductoPublic.model_validate(p)
        return result

    def delete(self, producto_id: int) -> None:
        with ProductoUnitOfWork(self._session) as uow:
            p = self._get_or_404(uow, producto_id)
            p.deleted_at = datetime.now(timezone.utc)
            uow.productos.add(p)

    def agregar_categoria(self, producto_id: int, data: ProductoCategoriaCreate) -> ProductoConDetalle:
        with ProductoUnitOfWork(self._session) as uow:
            self._get_or_404(uow, producto_id)
            if not uow.categorias.get_by_id(data.categoria_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Categoria id={data.categoria_id} no encontrada")
            if uow.producto_categorias.get_by_ids(producto_id, data.categoria_id):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="El producto ya tiene esa categoría")
            if data.es_principal:
                principal = uow.producto_categorias.get_principal(producto_id)
                if principal:
                    principal.es_principal = False
                    uow.producto_categorias.add(principal)
            uow.producto_categorias.add(ProductoCategoria(
                producto_id=producto_id,
                categoria_id=data.categoria_id,
                es_principal=data.es_principal,
            ))
            result = self._build_detalle(uow, producto_id)
        return result

    def quitar_categoria(self, producto_id: int, categoria_id: int) -> ProductoConDetalle:
        with ProductoUnitOfWork(self._session) as uow:
            self._get_or_404(uow, producto_id)
            pc = uow.producto_categorias.get_by_ids(producto_id, categoria_id)
            if not pc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="El producto no tiene esa categoría")
            uow.producto_categorias.delete(pc)
            result = self._build_detalle(uow, producto_id)
        return result

    def agregar_ingrediente(self, producto_id: int, data: ProductoIngredienteCreate) -> ProductoConDetalle:
        with ProductoUnitOfWork(self._session) as uow:
            self._get_or_404(uow, producto_id)
            if not uow.ingredientes.get_by_id(data.ingrediente_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Ingrediente id={data.ingrediente_id} no encontrado")
            if not uow.unidades.get_by_id(data.unidad_medida_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"UnidadMedida id={data.unidad_medida_id} no encontrada")
            if uow.producto_ingredientes.get_by_ids(producto_id, data.ingrediente_id):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="El ingrediente ya está asociado al producto")
            uow.producto_ingredientes.add(ProductoIngrediente(
                producto_id=producto_id,
                ingrediente_id=data.ingrediente_id,
                cantidad=data.cantidad,
                unidad_medida_id=data.unidad_medida_id,
                es_removible=data.es_removible,
            ))
            result = self._build_detalle(uow, producto_id)
        return result

    def quitar_ingrediente(self, producto_id: int, ingrediente_id: int) -> ProductoConDetalle:
        with ProductoUnitOfWork(self._session) as uow:
            p = self._get_or_404(uow, producto_id)
            # Los productos elaborados deben conservar al menos un ingrediente
            if p.tipo_producto == "elaborado" and len(p.producto_ingredientes) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Un producto elaborado debe tener al menos un ingrediente.",
                )
            pi = uow.producto_ingredientes.get_by_ids(producto_id, ingrediente_id)
            if not pi:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="El ingrediente no está asociado al producto")
            uow.producto_ingredientes.delete(pi)
            result = self._build_detalle(uow, producto_id)
        return result
