"""
Utilidades de resiliencia y concurrencia de base de datos para Animigos.
- Configura PRAGMAs óptimos para SQLite (WAL, busy_timeout, synchronous=NORMAL)
  en cada nueva conexión para evitar errores 'database is locked' bajo concurrencia.
- Provee `run_with_db_retry` con backoff exponencial para escrituras resilientes.
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Callable, TypeVar

from django.db.backends.signals import connection_created
from django.db.utils import OperationalError

logger = logging.getLogger(__name__)

T = TypeVar('T')


def configure_sqlite_connection(sender: Any, connection: Any, **kwargs: Any) -> None:
    """Activa modo WAL y busy_timeout en toda conexión SQLite creada por Django."""
    if getattr(connection, 'vendor', None) != 'sqlite':
        return

    try:
        with connection.cursor() as cursor:
            cursor.execute('PRAGMA journal_mode=WAL;')
            cursor.execute('PRAGMA synchronous=NORMAL;')
            cursor.execute('PRAGMA busy_timeout=30000;')
            cursor.execute('PRAGMA cache_size=-16000;')
            cursor.execute('PRAGMA temp_store=MEMORY;')
    except Exception as exc:
        logger.warning('No se pudieron aplicar PRAGMAs de concurrencia en SQLite: %s', exc)


def register_sqlite_pragmas() -> None:
    """Registra el receptor `connection_created` de forma idempotente."""
    connection_created.connect(
        configure_sqlite_connection,
        dispatch_uid='animigos_sqlite_wal_pragmas',
    )


def _is_db_locked_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return 'locked' in msg or 'busy' in msg


def run_with_db_retry(
    operation: Callable[[], T],
    *,
    max_retries: int = 4,
    base_delay: float = 0.08,
) -> T:
    """
    Ejecuta una operación de BD reintentando automáticamente con backoff exponencial
    si ocurre un bloqueo transitorio (`database is locked` / `database is busy`).
    """
    attempt = 0
    while True:
        try:
            return operation()
        except OperationalError as exc:
            if not _is_db_locked_error(exc) or attempt >= max_retries:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0.01, 0.05)
            attempt += 1
            logger.warning(
                'Bloqueo transitorio de BD (%s). Reintentando (%d/%d) en %.2fs...',
                exc,
                attempt,
                max_retries,
                delay,
            )
            time.sleep(delay)
