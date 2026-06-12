FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Aplicamos migraciones (crea el esquema) antes de arrancar el servidor.
# El seed se ejecuta en el lifespan de la app (idempotente).
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"]
