"""Importa todos los modelos SQLModel para que queden registrados en
`SQLModel.metadata`.

Lo usan tanto Alembic (env.py y la migración inicial) como cualquier punto que
necesite el metadata completo. Importar este módulo tiene como único efecto
poblar el registro de tablas; no abre conexiones ni toca la base.
"""
from app.modules.usuarios import models as _usuarios          # noqa: F401
from app.modules.direcciones import models as _direcciones    # noqa: F401
from app.modules.unidad_medida import models as _unidad        # noqa: F401
from app.modules.categorias import models as _categorias       # noqa: F401
from app.modules.ingredientes import models as _ingredientes   # noqa: F401
from app.modules.productos import models as _productos          # noqa: F401
from app.modules.pedidos import models as _pedidos             # noqa: F401
from app.modules.config import models as _config               # noqa: F401
