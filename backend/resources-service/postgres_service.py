"""
PostgreSQL access for the resources service (resources + resource allocations).
"""

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None


def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def get_active_user(config, user_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, is_active FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_project(config, project_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("SELECT id, status, manager_id FROM projects WHERE id = %s", (project_id,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def list_resources(config, filters=None):
    """filters: dict subset of {q, department}"""
    global PG_CONN
    filters = filters or {}
    where = []
    params = []
    if filters.get("q"):
        where.append("(u.name ILIKE %s OR r.title ILIKE %s)")
        like = f"%{filters['q']}%"
        params.extend([like, like])
    if filters.get("department"):
        where.append("r.department = %s")
        params.append(filters["department"])

    query = (
        "SELECT r.id, r.user_id, u.name AS user_name, r.title, r.department, "
        "r.weekly_capacity, "
        "COALESCE(SUM(ra.allocation_pct), 0) AS total_allocation_pct, "
        "r.created_at, r.updated_at "
        "FROM resources r "
        "JOIN users u ON u.id = r.user_id "
        "LEFT JOIN resource_allocations ra ON ra.resource_id = r.id"
    )
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " GROUP BY r.id, u.name ORDER BY r.created_at DESC"

    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_resource(config, resource_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT r.id, r.user_id, u.name AS user_name, r.title, r.department, "
                "r.weekly_capacity, "
                "COALESCE(SUM(ra.allocation_pct), 0) AS total_allocation_pct, "
                "r.created_at, r.updated_at "
                "FROM resources r "
                "JOIN users u ON u.id = r.user_id "
                "LEFT JOIN resource_allocations ra ON ra.resource_id = r.id "
                "WHERE r.id = %s "
                "GROUP BY r.id, u.name",
                (resource_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_resource_by_user(config, user_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM resources WHERE user_id = %s", (user_id,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_resource(config, user_id, title, department, weekly_capacity):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO resources (user_id, title, department, weekly_capacity) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (user_id, title, department, weekly_capacity),
            )
            new_id = cur.fetchone()["id"]
            return get_resource(config, new_id)
    except Exception:
        PG_CONN = None
        raise


def update_resource(config, resource_id, fields):
    global PG_CONN
    if not fields:
        return get_resource(config, resource_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [resource_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE resources SET {set_clause}, updated_at = now() WHERE id = %s",  # nosec B608 - keys come from a hardcoded allowlist; values use %s
                values,
            )
        return get_resource(config, resource_id)
    except Exception:
        PG_CONN = None
        raise


def get_resource_allocation_total(config, resource_id, exclude_allocation_id=None):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            if exclude_allocation_id:
                cur.execute(
                    "SELECT COALESCE(SUM(allocation_pct), 0) AS total FROM resource_allocations "
                    "WHERE resource_id = %s AND id <> %s",
                    (resource_id, exclude_allocation_id),
                )
            else:
                cur.execute(
                    "SELECT COALESCE(SUM(allocation_pct), 0) AS total FROM resource_allocations "
                    "WHERE resource_id = %s",
                    (resource_id,),
                )
            return cur.fetchone()["total"]
    except Exception:
        PG_CONN = None
        raise


def list_allocations(config, filters):
    """filters: dict subset of {resource_id, project_id}"""
    global PG_CONN
    where = []
    params = []
    if filters.get("resource_id"):
        where.append("ra.resource_id = %s")
        params.append(filters["resource_id"])
    if filters.get("project_id"):
        where.append("ra.project_id = %s")
        params.append(filters["project_id"])

    query = (
        "SELECT ra.id, ra.resource_id, u.name AS resource_name, ra.project_id, p.name AS project_name, "
        "ra.allocation_pct, ra.start_date, ra.end_date, ra.created_at, ra.updated_at "
        "FROM resource_allocations ra "
        "JOIN resources r ON r.id = ra.resource_id "
        "JOIN users u ON u.id = r.user_id "
        "JOIN projects p ON p.id = ra.project_id"
    )
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY ra.created_at DESC"

    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_allocation(config, allocation_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, resource_id, project_id, allocation_pct, start_date, end_date "
                "FROM resource_allocations WHERE id = %s",
                (allocation_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_allocation(config, resource_id, project_id, allocation_pct, start_date, end_date):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO resource_allocations (resource_id, project_id, allocation_pct, start_date, end_date) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (resource_id, project_id, allocation_pct, start_date, end_date),
            )
            new_id = cur.fetchone()["id"]
        return list_allocations(config, {"resource_id": resource_id})[0] if new_id else None
    except Exception:
        PG_CONN = None
        raise


def update_allocation(config, allocation_id, fields):
    global PG_CONN
    if not fields:
        return get_allocation(config, allocation_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [allocation_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE resource_allocations SET {set_clause}, updated_at = now() WHERE id = %s",  # nosec B608 - keys come from a hardcoded allowlist; values use %s
                values,
            )
        return get_allocation(config, allocation_id)
    except Exception:
        PG_CONN = None
        raise


def delete_allocation(config, allocation_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM resource_allocations WHERE id = %s", (allocation_id,))
            return cur.rowcount > 0
    except Exception:
        PG_CONN = None
        raise
