from typing import Optional
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.core.repository import BaseRepository
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Producto)

    def _base_stmt(self, include_deleted: bool = False):
        stmt = (
            select(Producto)
            .options(
                selectinload(Producto.producto_categorias).selectinload(ProductoCategoria.categoria),
                selectinload(Producto.producto_ingredientes).selectinload(ProductoIngrediente.ingrediente),
            )
        )
        if not include_deleted:
            stmt = stmt.where(Producto.deleted_at == None)
        return stmt

    def get_filtered(
        self,
        offset: int = 0,
        limit: int = 20,
        busqueda: Optional[str] = None,
        categoria_id: Optional[int] = None,
        precio_min: Optional[float] = None,
        precio_max: Optional[float] = None,
        disponible: Optional[bool] = None,
        include_deleted: bool = False,
    ) -> list[Producto]:
        stmt = self._base_stmt(include_deleted)
        if busqueda:
            stmt = stmt.where(Producto.nombre.ilike(f"%{busqueda}%"))
        if precio_min is not None:
            stmt = stmt.where(Producto.precio_base >= precio_min)
        if precio_max is not None:
            stmt = stmt.where(Producto.precio_base <= precio_max)
        if disponible is not None:
            stmt = stmt.where(Producto.disponible == disponible)
        if categoria_id is not None:
            stmt = stmt.join(ProductoCategoria, Producto.id == ProductoCategoria.producto_id).where(
                ProductoCategoria.categoria_id == categoria_id
            )
        return list(self.session.exec(stmt.offset(offset).limit(limit)).all())

    def count_filtered(
        self,
        busqueda: Optional[str] = None,
        categoria_id: Optional[int] = None,
        precio_min: Optional[float] = None,
        precio_max: Optional[float] = None,
        disponible: Optional[bool] = None,
        include_deleted: bool = False,
    ) -> int:
        stmt = select(Producto)
        if not include_deleted:
            stmt = stmt.where(Producto.deleted_at == None)
        if busqueda:
            stmt = stmt.where(Producto.nombre.ilike(f"%{busqueda}%"))
        if precio_min is not None:
            stmt = stmt.where(Producto.precio_base >= precio_min)
        if precio_max is not None:
            stmt = stmt.where(Producto.precio_base <= precio_max)
        if disponible is not None:
            stmt = stmt.where(Producto.disponible == disponible)
        if categoria_id is not None:
            stmt = stmt.join(ProductoCategoria, Producto.id == ProductoCategoria.producto_id).where(
                ProductoCategoria.categoria_id == categoria_id
            )
        return len(self.session.exec(stmt).all())

    def get_by_id_con_detalle(self, producto_id: int) -> Producto | None:
        return self.session.exec(
            select(Producto)
            .where(Producto.id == producto_id)
            .options(
                selectinload(Producto.producto_categorias).selectinload(ProductoCategoria.categoria),
                selectinload(Producto.producto_ingredientes).selectinload(ProductoIngrediente.ingrediente),
            )
        ).first()

    def count(self) -> int:
        return len(self.session.exec(
            select(Producto).where(Producto.deleted_at == None)
        ).all())


class ProductoCategoriaRepository(BaseRepository[ProductoCategoria]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, ProductoCategoria)

    def get_by_ids(self, producto_id: int, categoria_id: int) -> ProductoCategoria | None:
        return self.session.exec(
            select(ProductoCategoria)
            .where(ProductoCategoria.producto_id == producto_id)
            .where(ProductoCategoria.categoria_id == categoria_id)
        ).first()

    def get_principal(self, producto_id: int) -> ProductoCategoria | None:
        return self.session.exec(
            select(ProductoCategoria)
            .where(ProductoCategoria.producto_id == producto_id)
            .where(ProductoCategoria.es_principal == True)
        ).first()


class ProductoIngredienteRepository(BaseRepository[ProductoIngrediente]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, ProductoIngrediente)

    def get_by_ids(self, producto_id: int, ingrediente_id: int) -> ProductoIngrediente | None:
        return self.session.exec(
            select(ProductoIngrediente)
            .where(ProductoIngrediente.producto_id == producto_id)
            .where(ProductoIngrediente.ingrediente_id == ingrediente_id)
        ).first()

    def get_by_producto(self, producto_id: int) -> list[ProductoIngrediente]:
        # trae todos los ingredientes de un producto para descontar su stock
        return list(self.session.exec(
            select(ProductoIngrediente)
            .where(ProductoIngrediente.producto_id == producto_id)
        ).all())
