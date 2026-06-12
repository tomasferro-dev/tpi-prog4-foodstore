"""
Handlers de excepciones centralizados.

Devuelven errores con un formato consistente alineado a la especificación de la
API (integrador.md §5 — Problem Details / RFC 7807 simplificado):

    { "detail": "mensaje", "code": "ERROR_CODE", "field": "campo_opcional" }

El campo `detail` se mantiene como principal porque el frontend ya lo consume
(src/api/client.ts), así que agregar `code`/`errors` no rompe el manejo actual.
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("foodstore.errors")

# Mapa status HTTP → código simbólico estable para que el front pueda discriminar
_STATUS_CODE: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_402_PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    status.HTTP_429_TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
    status.HTTP_502_BAD_GATEWAY: "BAD_GATEWAY",
    status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
}


def _code_for(status_code: int) -> str:
    return _STATUS_CODE.get(status_code, f"HTTP_{status_code}")


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": _code_for(exc.status_code)},
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errores = [
        {
            "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
            "message": err.get("msg", "Dato inválido"),
        }
        for err in exc.errors()
    ]
    primero = errores[0]["field"] if errores else None
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Error de validación en los datos enviados",
            "code": "VALIDATION_ERROR",
            "field": primero,
            "errors": errores,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Logueamos el stack completo en el servidor, pero nunca lo exponemos al cliente
    logger.exception("Error no manejado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor", "code": "INTERNAL_ERROR"},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
