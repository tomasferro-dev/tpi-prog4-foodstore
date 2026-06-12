"""pago.mp_payment_id INTEGER -> BIGINT

Los payment IDs de Mercado Pago superan el rango de INTEGER (2^31), por eso la
columna debe ser BIGINT. Antes de este cambio, persistir un pago aprobado
lanzaba NumericValueOutOfRange (HTTP 500 al volver de MP).

Revision ID: 0002_pago_bigint
Revises: 0001_initial
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_pago_bigint"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "pagos",
        "mp_payment_id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "pagos",
        "mp_payment_id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True,
    )
