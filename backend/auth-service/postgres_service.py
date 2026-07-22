"""
PostgreSQL connection management for the auth service.

Reuses a module-level connection across Lambda invocations (connection pooling
pattern), matching backend/_examples/python-service/postgres_service.py.
"""

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None


def get_connection(config):
    """Return a pooled PostgreSQL connection, reconnecting if needed."""
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def get_user_by_email(config, email):
    """Fetch a single active user row by email, or None if not found."""
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, password_hash, role, is_active "
                "FROM users WHERE email = %s",
                (email,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_user_by_id(config, user_id):
    """Fetch a single user row by id, or None if not found."""
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, is_active FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise
