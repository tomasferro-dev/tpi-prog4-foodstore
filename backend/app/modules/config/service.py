from datetime import datetime, timezone
from sqlmodel import Session

from app.modules.config.models import ConfigPrecio
from app.modules.config.schemas import ConfigPrecioPublic, ConfigPrecioUpdate, CostosPublic
from app.modules.config.unit_of_work import ConfigUnitOfWork


def _to_public(cfg: ConfigPrecio) -> ConfigPrecioPublic:
    return ConfigPrecioPublic(
        porcentaje_ganancia=cfg.porcentaje_ganancia,
        unidades_mes_estimadas=cfg.unidades_mes_estimadas,
        costos=CostosPublic(
            salario=cfg.costos_salario,
            gas=cfg.costos_gas,
            luz=cfg.costos_luz,
            alquiler=cfg.costos_alquiler,
            otros=cfg.costos_otros,
        ),
        costo_envio=cfg.costo_envio,
    )


class ConfigService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self) -> ConfigPrecioPublic:
        with ConfigUnitOfWork(self._session) as uow:
            cfg = uow.config.get_or_create()
            return _to_public(cfg)

    def update(self, data: ConfigPrecioUpdate) -> ConfigPrecioPublic:
        with ConfigUnitOfWork(self._session) as uow:
            cfg = uow.config.get_or_create()
            if data.porcentaje_ganancia is not None:
                cfg.porcentaje_ganancia = data.porcentaje_ganancia
            if data.unidades_mes_estimadas is not None:
                cfg.unidades_mes_estimadas = data.unidades_mes_estimadas
            if data.costos is not None:
                if data.costos.salario is not None:
                    cfg.costos_salario = data.costos.salario
                if data.costos.gas is not None:
                    cfg.costos_gas = data.costos.gas
                if data.costos.luz is not None:
                    cfg.costos_luz = data.costos.luz
                if data.costos.alquiler is not None:
                    cfg.costos_alquiler = data.costos.alquiler
                if data.costos.otros is not None:
                    cfg.costos_otros = data.costos.otros
            if data.costo_envio is not None:
                cfg.costo_envio = data.costo_envio
            cfg.updated_at = datetime.now(timezone.utc)
            uow.config.add(cfg)
            result = _to_public(cfg)
        return result
