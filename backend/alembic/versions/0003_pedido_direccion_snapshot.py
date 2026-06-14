"""pedido.direccion_snapshot (RN-PE03)

Agrega la columna direccion_snapshot (TEXT nullable) a pedidos: copia inmutable
de la dirección de entrega al fijarla, para preservar el dato histórico aunque
luego se edite o elimine la dirección original.

Revision ID: 0003_direccion_snapshot
Revises: 0002_pago_bigint
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_direccion_snapshot"
down_revision: Union[str, None] = "0002_pago_bigint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pedidos", sa.Column("direccion_snapshot", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pedidos", "direccion_snapshot")
