"""
PostgreSQL access for the users service (Admin-only user management).
"""

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None

VALID_ROLES = {"admin", "project_manager", "team_member", "finance", "viewer"}


def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def list_users(config):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, is_active, created_at, updated_at "
                "FROM users ORDER BY created_at DESC"
            )
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_user(config, user_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, is_active, created_at, updated_at "
                "FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_user_by_email(config, email):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_user(config, name, email, password_hash, role):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES (%s, %s, %s, %s) "
                "RETURNING id, name, email, role, is_active, created_at, updated_at",
                (name, email, password_hash, role),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def update_user(config, user_id, fields):
    """fields: dict subset of {name, role, is_active}"""
    global PG_CONN
    if not fields:
        return get_user(config, user_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [user_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE users SET {set_clause}, updated_at = now() WHERE id = %s "
                "RETURNING id, name, email, role, is_active, created_at, updated_at",
                values,
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def deactivate_user(config, user_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = FALSE, updated_at = now() WHERE id = %s "
                "RETURNING id, name, email, role, is_active, created_at, updated_at",
                (user_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise
