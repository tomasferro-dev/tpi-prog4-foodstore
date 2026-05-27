from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session

from app.modules.categorias.models import Categoria
from app.modules.categorias.schemas import (
    CategoriaCreate, CategoriaPublic, CategoriaUpdate, CategoriaList,
)
from app.modules.categorias.unit_of_work import CategoriaUnitOfWork


class CategoriaService:
    def __init__(self, session: Session) -> None:
        self._session = session

    # ── helpers ────────────────────────────────────────────────────────

    def _get_or_404(self, uow, categoria_id: int) -> Categoria:
        cat = uow.categorias.get_by_id(categoria_id)
        if not cat or cat.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Categoria id={categoria_id} no encontrada",
            )
        return cat

    def _assert_nombre_unico(self, uow, nombre: str, exclude_id: int | None = None) -> None:
        existing = uow.categorias.get_by_nombre(nombre)
        if existing and (exclude_id is None or existing.id != exclude_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una categoría con el nombre '{nombre}'",
            )

    def _seria_circular(self, uow, categoria_id: int, nuevo_parent_id: int) -> bool:
        """True si asignar nuevo_parent_id como padre de categoria_id crearía un ciclo."""
        actual_id: int | None = nuevo_parent_id
        visited: set[int] = set()
        while actual_id is not None:
            if actual_id == categoria_id:
                return True
            if actual_id in visited:
                break
            visited.add(actual_id)
            c = uow.categorias.get_by_id(actual_id)
            actual_id = c.parent_id if c else None
        return False

    # ── CRUD ───────────────────────────────────────────────────────────

    def create(self, data: CategoriaCreate) -> CategoriaPublic:
        with CategoriaUnitOfWork(self._session) as uow:
            self._assert_nombre_unico(uow, data.nombre)
            if data.parent_id:
                self._get_or_404(uow, data.parent_id)
            cat = Categoria.model_validate(data)
            uow.categorias.add(cat)
            result = CategoriaPublic.model_validate(cat)
        return result

    def get_all_list(self, include_deleted: bool = False) -> list[CategoriaPublic]:
        with CategoriaUnitOfWork(self._session) as uow:
            cats = uow.categorias.get_all(include_deleted=include_deleted)
            return [CategoriaPublic.model_validate(c) for c in cats]

    def get_all(self, offset: int = 0, limit: int = 20) -> CategoriaList:
        with CategoriaUnitOfWork(self._session) as uow:
            cats = uow.categorias.get_active(offset=offset, limit=limit)
            total = uow.categorias.count()
            result = CategoriaList(
                data=[CategoriaPublic.model_validate(c) for c in cats],
                total=total,
            )
        return result

    def get_by_id(self, categoria_id: int) -> CategoriaPublic:
        with CategoriaUnitOfWork(self._session) as uow:
            cat = self._get_or_404(uow, categoria_id)
            result = CategoriaPublic.model_validate(cat)
        return result

    def update(self, categoria_id: int, data: CategoriaUpdate) -> CategoriaPublic:
        with CategoriaUnitOfWork(self._session) as uow:
            cat = self._get_or_404(uow, categoria_id)
            if data.nombre and data.nombre != cat.nombre:
                self._assert_nombre_unico(uow, data.nombre, exclude_id=categoria_id)
            if data.parent_id is not None and data.parent_id != cat.parent_id:
                self._get_or_404(uow, data.parent_id)
                if self._seria_circular(uow, categoria_id, data.parent_id):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Asignar ese padre crearía una referencia circular en la jerarquía.",
                    )
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(cat, field, value)
            cat.updated_at = datetime.now(timezone.utc)
            uow.categorias.add(cat)
            result = CategoriaPublic.model_validate(cat)
        return result

    def delete(self, categoria_id: int) -> None:
        with CategoriaUnitOfWork(self._session) as uow:
            cat = self._get_or_404(uow, categoria_id)
            hijos = uow.categorias.get_hijos_activos(categoria_id)
            if hijos:
                nombres = ", ".join(f'"{h.nombre}"' for h in hijos)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"No se puede dar de baja '{cat.nombre}': tiene subcategorías activas "
                        f"({nombres}). Primero dé de baja las subcategorías."
                    ),
                )
            cat.deleted_at = datetime.now(timezone.utc)
            uow.categorias.add(cat)

    def reactivar(self, categoria_id: int) -> CategoriaPublic:
        with CategoriaUnitOfWork(self._session) as uow:
            cat = uow.categorias.get_by_id(categoria_id)
            if not cat:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Categoria id={categoria_id} no encontrada",
                )
            cat.deleted_at = None
            cat.updated_at = datetime.now(timezone.utc)
            uow.categorias.add(cat)
            result = CategoriaPublic.model_validate(cat)
        return result
