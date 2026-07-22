"""
PostgreSQL access for the deliverables service.
"""

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None

VALID_STATUSES = {"not_started", "in_progress", "blocked", "completed"}


def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def get_project(config, project_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, status, manager_id FROM projects WHERE id = %s",
                (project_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_active_user(config, user_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("SELECT id, is_active FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def list_deliverables(config, filters):
    """filters: dict subset of {project_id, status, owner_id, q}"""
    global PG_CONN
    where = []
    params = []
    if filters.get("project_id"):
        where.append("d.project_id = %s")
        params.append(filters["project_id"])
    if filters.get("status"):
        where.append("d.status = %s")
        params.append(filters["status"])
    if filters.get("owner_id"):
        where.append("d.owner_id = %s")
        params.append(filters["owner_id"])
    if filters.get("q"):
        where.append("(d.title ILIKE %s OR d.description ILIKE %s)")
        like = f"%{filters['q']}%"
        params.extend([like, like])

    query = (
        "SELECT d.id, d.project_id, d.title, d.description, d.owner_id, "
        "u.name AS owner_name, d.status, d.due_date, d.created_at, d.updated_at "
        "FROM deliverables d LEFT JOIN users u ON u.id = d.owner_id"
    )
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY d.created_at DESC"

    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_deliverable(config, deliverable_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT d.id, d.project_id, d.title, d.description, d.owner_id, "
                "u.name AS owner_name, d.status, d.due_date, d.created_at, d.updated_at "
                "FROM deliverables d LEFT JOIN users u ON u.id = d.owner_id "
                "WHERE d.id = %s",
                (deliverable_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_deliverable(config, project_id, title, description, owner_id, due_date):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO deliverables (project_id, title, description, owner_id, due_date) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (project_id, title, description, owner_id, due_date),
            )
            new_id = cur.fetchone()["id"]
            return get_deliverable(config, new_id)
    except Exception:
        PG_CONN = None
        raise


def update_deliverable(config, deliverable_id, fields):
    """fields: dict subset of {title, description, owner_id, status, due_date}"""
    global PG_CONN
    if not fields:
        return get_deliverable(config, deliverable_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [deliverable_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE deliverables SET {set_clause}, updated_at = now() WHERE id = %s",  # nosec B608 - keys come from a hardcoded allowlist; values use %s
                values,
            )
        return get_deliverable(config, deliverable_id)
    except Exception:
        PG_CONN = None
        raise


def delete_deliverable(config, deliverable_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deliverables WHERE id = %s", (deliverable_id,))
            return cur.rowcount > 0
    except Exception:
        PG_CONN = None
        raise


def list_dependencies(config, deliverable_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dd.id, dd.depends_on_deliverable_id, d.title, d.status "
                "FROM deliverable_dependencies dd "
                "JOIN deliverables d ON d.id = dd.depends_on_deliverable_id "
                "WHERE dd.deliverable_id = %s",
                (deliverable_id,),
            )
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def add_dependency(config, deliverable_id, depends_on_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO deliverable_dependencies (deliverable_id, depends_on_deliverable_id) "
                "VALUES (%s, %s) RETURNING id",
                (deliverable_id, depends_on_id),
            )
            return cur.fetchone()["id"]
    except Exception:
        PG_CONN = None
        raise


def remove_dependency(config, deliverable_id, dependency_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM deliverable_dependencies WHERE id = %s AND deliverable_id = %s",
                (dependency_id, deliverable_id),
            )
            return cur.rowcount > 0
    except Exception:
        PG_CONN = None
        raise
