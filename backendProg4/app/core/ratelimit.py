"""Limiter compartido para rate limiting por IP (slowapi).

Vive en su propio módulo para que tanto `main.py` como los routers puedan
importarlo sin generar imports circulares.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# NOTA: headers_enabled debe quedar en False. Con True, slowapi intenta inyectar
# los headers en el valor de retorno del endpoint y exige que sea un Response;
# como nuestros endpoints devuelven modelos, rompería el camino exitoso (500).
# El header Retry-After se agrega manualmente en el handler de 429 (main.py).
limiter = Limiter(key_func=get_remote_address)
