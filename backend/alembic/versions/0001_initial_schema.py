"""initial schema — crea todas las tablas del ERD v5

Esta primera migración materializa el esquema completo a partir de
`SQLModel.metadata` (todos los modelos), en lugar de enumerar tabla por tabla.
Es 100% reversible y garantiza que el esquema coincida exactamente con los
modelos. Las siguientes migraciones sí pueden usar autogenerate.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
from sqlmodel import SQLModel

import app.db.all_models  # noqa: F401  (puebla SQLModel.metadata)

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    SQLModel.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    SQLModel.metadata.drop_all(bind=op.get_bind())
