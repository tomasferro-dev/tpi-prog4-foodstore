from typing import Optional
from sqlmodel import Session, select
from app.core.repository import BaseRepository
from app.modules.ingredientes.models import Ingrediente


class IngredienteRepository(BaseRepository[Ingrediente]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Ingrediente)

    def get_by_nombre(self, nombre: str) -> Ingrediente | None:
        return self.session.exec(
            select(Ingrediente).where(Ingrediente.nombre == nombre)
        ).first()

    def _filtered_stmt(
        self,
        busqueda: Optional[str] = None,
        es_alergeno: Optional[bool] = None,
        include_deleted: bool = False,
    ):
        stmt = select(Ingrediente)
        if not include_deleted:
            stmt = stmt.where(Ingrediente.deleted_at == None)
        if busqueda:
            stmt = stmt.where(Ingrediente.nombre.ilike(f"%{busqueda}%"))
        if es_alergeno is not None:
            stmt = stmt.where(Ingrediente.es_alergeno == es_alergeno)
        return stmt

    def get_filtered(
        self,
        offset: int = 0,
        limit: int = 20,
        busqueda: Optional[str] = None,
        es_alergeno: Optional[bool] = None,
        include_deleted: bool = False,
    ) -> list[Ingrediente]:
        stmt = self._filtered_stmt(busqueda, es_alergeno, include_deleted)
        return list(self.session.exec(stmt.offset(offset).limit(limit)).all())

    def count_filtered(
        self,
        busqueda: Optional[str] = None,
        es_alergeno: Optional[bool] = None,
        include_deleted: bool = False,
    ) -> int:
        return len(self.session.exec(
            self._filtered_stmt(busqueda, es_alergeno, include_deleted)
        ).all())

    def count(self) -> int:
        return len(self.session.exec(
            select(Ingrediente).where(Ingrediente.deleted_at == None)
        ).all())
