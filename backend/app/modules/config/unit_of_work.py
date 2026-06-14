from sqlmodel import Session
from app.core.unit_of_work import UnitOfWork
from app.modules.config.repository import ConfigRepository


class ConfigUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.config = ConfigRepository(session)
