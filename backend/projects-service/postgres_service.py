"""
PostgreSQL access for the projects service.
"""

import json

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None

VALID_STATUSES = {"active", "completed", "delayed", "archived"}


def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def list_projects(config, filters):
    """filters: dict subset of
    {status, manager_id, department, date_from, date_to, budget_min, budget_max, q}

    Every filter in req/Application_Flow.md §9 is supported here: status,
    department, project manager, budget and date range, plus free-text search.
    """
    global PG_CONN
    where = []
    params = []

    if filters.get("status"):
        where.append("p.status = %s")
        params.append(filters["status"])
    if filters.get("manager_id"):
        where.append("p.manager_id = %s")
        params.append(filters["manager_id"])
    if filters.get("department"):
        where.append("p.department = %s")
        params.append(filters["department"])
    if filters.get("date_from"):
        where.append("p.start_date >= %s")
        params.append(filters["date_from"])
    if filters.get("date_to"):
        where.append("p.end_date <= %s")
        params.append(filters["date_to"])
    # Budget bounds read from the joined budget row. A project with no budget
    # yet has a NULL planned_amount, so it is excluded once a bound is set --
    # "projects budgeted over 100k" should not surface unbudgeted projects.
    if filters.get("budget_min") is not None:
        where.append("b.planned_amount >= %s")
        params.append(filters["budget_min"])
    if filters.get("budget_max") is not None:
        where.append("b.planned_amount <= %s")
        params.append(filters["budget_max"])
    if filters.get("q"):
        where.append("(p.name ILIKE %s OR p.description ILIKE %s)")
        like = f"%{filters['q']}%"
        params.extend([like, like])

    query = (
        "SELECT p.id, p.name, p.description, p.status, p.manager_id, "
        "u.name AS manager_name, p.department, p.start_date, p.end_date, "
        "b.planned_amount, b.actual_spend, p.metadata, "
        "p.created_at, p.updated_at "
        "FROM projects p "
        "JOIN users u ON u.id = p.manager_id "
        "LEFT JOIN budgets b ON b.project_id = p.id"
    )
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY p.created_at DESC"

    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_project(config, project_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT p.id, p.name, p.description, p.status, p.manager_id, "
                "u.name AS manager_name, p.department, p.start_date, p.end_date, "
                "p.metadata, p.created_at, p.updated_at "
                "FROM projects p JOIN users u ON u.id = p.manager_id "
                "WHERE p.id = %s",
                (project_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def get_active_manager(config, user_id):
    """A valid project manager is an active admin or project_manager user."""
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, role, is_active FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_project(config, name, description, manager_id, department, start_date, end_date, metadata=None):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO projects (name, description, manager_id, department, start_date, end_date, metadata) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) "
                "RETURNING id, name, description, status, manager_id, department, start_date, end_date, metadata, created_at, updated_at",
                (name, description, manager_id, department, start_date, end_date, json.dumps(metadata or {})),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def update_project(config, project_id, fields):
    """fields: dict subset of {name, description, manager_id, department, start_date, end_date, status, metadata}"""
    global PG_CONN
    if not fields:
        return get_project(config, project_id)
    if "metadata" in fields:
        fields = {**fields, "metadata": json.dumps(fields["metadata"] or {})}
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [project_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE projects SET {set_clause}, updated_at = now() WHERE id = %s RETURNING id",  # nosec B608 - keys come from a hardcoded allowlist; values use %s
                values,
            )
            updated = cur.fetchone()
            return get_project(config, updated["id"]) if updated else None
    except Exception:
        PG_CONN = None
        raise


def archive_project(config, project_id):
    return update_project(config, project_id, {"status": "archived"})
