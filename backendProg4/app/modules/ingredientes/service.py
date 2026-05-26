from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session

from app.modules.ingredientes.models import Ingrediente
from app.modules.ingredientes.schemas import (
    IngredienteCreate, IngredientePublic, IngredienteUpdate, IngredienteList,
)
from app.modules.ingredientes.unit_of_work import IngredienteUnitOfWork


class IngredienteService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_or_404(self, uow, ing_id: int) -> Ingrediente:
        ing = uow.ingredientes.get_by_id(ing_id)
        if not ing or ing.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Ingrediente id={ing_id} no encontrado")
        return ing

    def _assert_nombre_unico(self, uow, nombre: str) -> None:
        if uow.ingredientes.get_by_nombre(nombre):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail=f"Ya existe un ingrediente con el nombre '{nombre}'")

    def create(self, data: IngredienteCreate) -> IngredientePublic:
        with IngredienteUnitOfWork(self._session) as uow:
            self._assert_nombre_unico(uow, data.nombre)
            ing = Ingrediente.model_validate(data)
            uow.ingredientes.add(ing)
            result = IngredientePublic.model_validate(ing)
        return result

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        busqueda: str | None = None,
        es_alergeno: bool | None = None,
        include_deleted: bool = False,
    ) -> IngredienteList:
        with IngredienteUnitOfWork(self._session) as uow:
            ings = uow.ingredientes.get_filtered(
                offset=offset, limit=limit,
                busqueda=busqueda, es_alergeno=es_alergeno,
                include_deleted=include_deleted,
            )
            total = uow.ingredientes.count_filtered(
                busqueda=busqueda, es_alergeno=es_alergeno,
                include_deleted=include_deleted,
            )
        return IngredienteList(
            items=[IngredientePublic.model_validate(i) for i in ings],
            total=total,
            skip=offset,
            limit=limit,
        )

    def get_by_id(self, ing_id: int) -> IngredientePublic:
        with IngredienteUnitOfWork(self._session) as uow:
            ing = self._get_or_404(uow, ing_id)
            result = IngredientePublic.model_validate(ing)
        return result

    def update(self, ing_id: int, data: IngredienteUpdate) -> IngredientePublic:
        with IngredienteUnitOfWork(self._session) as uow:
            ing = self._get_or_404(uow, ing_id)
            if data.nombre and data.nombre != ing.nombre:
                self._assert_nombre_unico(uow, data.nombre)
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(ing, field, value)
            ing.updated_at = datetime.now(timezone.utc)
            uow.ingredientes.add(ing)
            result = IngredientePublic.model_validate(ing)
        return result

    def delete(self, ing_id: int) -> None:
        with IngredienteUnitOfWork(self._session) as uow:
            ing = self._get_or_404(uow, ing_id)
            ing.deleted_at = datetime.now(timezone.utc)
            ing.updated_at = datetime.now(timezone.utc)
            uow.ingredientes.add(ing)

    def reactivar(self, ing_id: int) -> IngredientePublic:
        with IngredienteUnitOfWork(self._session) as uow:
            ing = uow.ingredientes.get_by_id(ing_id)
            if not ing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Ingrediente id={ing_id} no encontrado")
            ing.deleted_at = None
            ing.updated_at = datetime.now(timezone.utc)
            uow.ingredientes.add(ing)
            result = IngredientePublic.model_validate(ing)
        return result
