from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.errors import register_exception_handlers
from app.core.ratelimit import limiter
from app.db.seed import run_seed
from app.modules.health.router import router as health_router
from app.modules.usuarios.router import router as auth_router
from app.modules.direcciones.router import router as direcciones_router
from app.modules.unidad_medida.router import router as unidades_router
from app.modules.categorias.router import router as categorias_router
from app.modules.ingredientes.router import router as ingredientes_router
from app.modules.productos.router import public_router as productos_public_router, admin_router as productos_admin_router
from app.modules.pedidos.router import router as pedidos_router
from app.modules.config.router import router as config_router
from app.modules.pagos.router import router as pagos_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # El esquema lo gestiona Alembic (`alembic upgrade head`), no create_all.
    # En el arranque solo cargamos el seed (idempotente).
    run_seed()
    yield


app = FastAPI(title="Parcial Programación IV", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 con formato de error consistente + headers Retry-After / X-RateLimit-Limit."""
    retry_after = 900           # fallback: ventana de 15 min
    limit_amount: int | None = None
    try:
        view = getattr(request.state, "view_rate_limit", None)
        item = view[0].limit if view else None   # RateLimitItem del límite excedido
        if item is not None:
            retry_after = int(item.get_expiry())
            limit_amount = item.amount
    except Exception:
        pass

    headers = {"Retry-After": str(retry_after)}
    if limit_amount is not None:
        headers["X-RateLimit-Limit"] = str(limit_amount)

    return JSONResponse(
        status_code=429,
        content={
            "detail": "Demasiados intentos. Esperá unos minutos y volvé a probar.",
            "code": "TOO_MANY_REQUESTS",
        },
        headers=headers,
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
register_exception_handlers(app)

# Health check fuera del versionado (convención operativa)
app.include_router(health_router)

# Todos los endpoints de negocio cuelgan de /api/v1 (integrador.md §5)
api = APIRouter(prefix="/api/v1")
api.include_router(auth_router,         prefix="/auth",            tags=["auth"])
api.include_router(direcciones_router,  prefix="/direcciones",     tags=["direcciones"])
api.include_router(unidades_router,     prefix="/unidades-medida", tags=["unidades-medida"])
api.include_router(categorias_router,   prefix="/categorias",      tags=["categorias"])
api.include_router(ingredientes_router,       prefix="/admin/insumos",        tags=["admin/insumos"])
api.include_router(productos_public_router,   prefix="/productos",            tags=["productos"])
api.include_router(productos_admin_router,    prefix="/admin/productos",      tags=["admin/productos"])
api.include_router(config_router,            prefix="/admin/config/precios",  tags=["admin/config"])
api.include_router(pedidos_router,           prefix="/pedidos",               tags=["pedidos"])
api.include_router(pagos_router,             prefix="/pagos",                 tags=["pagos"])

app.include_router(api)
