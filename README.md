# Food Store — E-commerce de alimentos

Monorepo con dos proyectos:

- **`backendProg4/`** — API REST en FastAPI + SQLModel + PostgreSQL (capas
  router / service / Unit of Work / repository / model).
- **`tpi-prog4-front/`** — SPA en React + TypeScript + Vite + Zustand +
  TanStack Query + Tailwind.

Todos los endpoints de negocio cuelgan del prefijo **`/api/v1`**.

---

## Requisitos

- Python 3.12+
- Node 18+
- PostgreSQL 14+ (o Docker para levantarlo)

---

## 1. Backend

```bash
cd backendProg4

# entorno virtual
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# dependencias
pip install -r requirements.txt
```

### Variables de entorno

Creá un archivo **`backendProg4/.env`** (copialo de `backendProg4/.env.example`)
con este contenido:

```env
# PostgreSQL (la DATABASE_URL se arma a partir de estas variables)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=parcial_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# JWT — SECRET_KEY es obligatoria. Generala con:
#   python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=cambiame_por_una_clave_larga_de_al_menos_32_chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# MercadoPago (Checkout Pro). Si MP_ACCESS_TOKEN queda vacío, /pagos responde
# 503 y el flujo de pago queda deshabilitado (modo dev sin MP).
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```

### Crear las tablas y cargar datos

```bash
# 1. crear la base (si no existe)
#    psql:  CREATE DATABASE parcial_db;

# 2. aplicar migraciones (crea TODAS las tablas del ERD v5)
alembic upgrade head

# 3. cargar datos iniciales (roles, estados, formas de pago, usuarios demo,
#    catálogo). Es idempotente: se puede correr varias veces.
python -m app.db.seed
```

### Levantar el servidor

```bash
uvicorn main:app --reload
```

- API: http://localhost:8000/api/v1
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Usuarios que crea el seed

| Rol     | Email               | Password      |
|---------|---------------------|---------------|
| ADMIN   | admin@admin.com     | admin1234     |
| STOCK   | stock@admin.com     | stock1234     |
| PEDIDOS | pedidos@admin.com   | pedidos1234   |
| CLIENT  | cliente@admin.com   | cliente1234   |

---

## 2. Frontend

```bash
cd tpi-prog4-front
npm install
npm run dev
```

- App: http://localhost:5173

En desarrollo no hace falta configurar `.env`: el cliente usa rutas relativas a
`/api/v1` y el **proxy de Vite** (`vite.config.ts`) las redirige al backend en
`http://localhost:8000`. Para builds contra un backend remoto, copiá
`tpi-prog4-front/.env.example` a `.env` y completá `VITE_API_URL`.

---

## Notas

- **Rate limiting:** el login admite máximo 5 intentos por IP cada 15 minutos
  (HTTP 429 con `Retry-After`).
- **Errores:** todas las respuestas de error siguen el formato
  `{ "detail": "...", "code": "ERROR_CODE", "field": "opcional" }`.
- **Pagos:** el flujo es MercadoPago **Checkout Pro** (redirección a MP). El
  pedido pasa a `confirmado` solo cuando el pago está aprobado (verificado vía
  webhook IPN o consulta server-side al volver de MP). En localhost, donde el
  webhook no llega, la confirmación se valida al retornar a `/pago/success`.
- Para probar pagos se necesita una cuenta de prueba de MercadoPago y completar
  `MP_ACCESS_TOKEN` en el `.env`.
