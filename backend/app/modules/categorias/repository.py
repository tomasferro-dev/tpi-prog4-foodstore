from sqlmodel import Session, select
from app.core.repository import BaseRepository
from app.modules.categorias.models import Categoria


class CategoriaRepository(BaseRepository[Categoria]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Categoria)

    def get_by_nombre(self, nombre: str) -> Categoria | None:
        return self.session.exec(
            select(Categoria).where(Categoria.nombre == nombre)
        ).first()

    # Legacy — kept for get_all (used internally)
    def get_active(self, offset: int = 0, limit: int = 20) -> list[Categoria]:
        return list(self.session.exec(
            select(Categoria)
            .where(Categoria.deleted_at == None)
            .offset(offset).limit(limit)
        ).all())

    def get_all(self, offset: int = 0, limit: int = 1000, include_deleted: bool = False) -> list[Categoria]:
        stmt = select(Categoria)
        if not include_deleted:
            stmt = stmt.where(Categoria.deleted_at == None)
        return list(self.session.exec(stmt.offset(offset).limit(limit)).all())

    def get_hijos_activos(self, parent_id: int) -> list[Categoria]:
        return list(self.session.exec(
            select(Categoria)
            .where(Categoria.parent_id == parent_id)
            .where(Categoria.deleted_at == None)
        ).all())

    def count(self) -> int:
        return len(self.session.exec(
            select(Categoria).where(Categoria.deleted_at == None)
        ).all())
