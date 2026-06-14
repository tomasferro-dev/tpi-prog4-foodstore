from sqlmodel import Session
from app.core.repository import BaseRepository
from app.modules.config.models import ConfigPrecio


class ConfigRepository(BaseRepository[ConfigPrecio]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, ConfigPrecio)

    def get_or_create(self) -> ConfigPrecio:
        """Config es una fila única (id=1). Si todavía no existe, la crea con
        los defaults del modelo. El commit lo hace el UoW al cerrar el bloque."""
        cfg = self.session.get(ConfigPrecio, 1)
        if not cfg:
            cfg = self.add(ConfigPrecio())
        return cfg
