"""
core.py
Infraestrutura da API: variáveis de ambiente, pool de conexões com o
Postgres e validação da API Key. Consolidado em um único módulo por
simplicidade (projeto pequeno) — se a API crescer, vale voltar a
separar em config.py / db.py / auth.py.
"""

import os
from contextlib import contextmanager

from fastapi import Header, HTTPException, status
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

# ---------------------------------------------------------------------
# Configuração (env vars)
# ---------------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://driva:driva_pass@localhost:5432/driva_dw",
)

API_KEY = os.getenv("API_KEY", "driva_test_key_abc123xyz789")

# Probabilidade de simular um 429 Too Many Requests no endpoint de fonte
RATE_LIMIT_CHANCE = float(os.getenv("RATE_LIMIT_CHANCE", "0.08"))

# Quantidade de registros gerados no seed (apenas se a tabela estiver vazia)
SEED_TOTAL_RECORDS = int(os.getenv("SEED_TOTAL_RECORDS", "6000"))


# ---------------------------------------------------------------------
# Conexão com o Postgres (pool)
# ---------------------------------------------------------------------
_pool = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = pool.SimpleConnectionPool(1, 10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def get_conn():
    p = init_pool()
    conn = p.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


@contextmanager
def get_cursor():
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()


# ---------------------------------------------------------------------
# Autenticação (API Key via Bearer token)
# ---------------------------------------------------------------------
async def verify_api_key(authorization: str = Header(default=None)):
    """
    Valida o header:
        Authorization: Bearer {API_KEY}
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header 'Authorization: Bearer {API_KEY}' ausente ou inválido.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    if token != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida.",
        )