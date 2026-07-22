"""
PostgreSQL access for the budgets service.
"""

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None


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
            cur.execute("SELECT id, name, status, manager_id FROM projects WHERE id = %s", (project_id,))
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def list_budgets(config):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT b.id, b.project_id, p.name AS project_name, p.status AS project_status, "
                "p.manager_id, b.planned_amount, b.actual_spend, "
                "(b.planned_amount - b.actual_spend) AS remaining_amount, b.currency, "
                "b.created_at, b.updated_at "
                "FROM budgets b JOIN projects p ON p.id = b.project_id "
                "ORDER BY b.created_at DESC"
            )
            return cur.fetchall()
    except Exception:
        PG_CONN = None
        raise


def get_budget_by_project(config, project_id):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT b.id, b.project_id, p.name AS project_name, p.status AS project_status, "
                "p.manager_id, b.planned_amount, b.actual_spend, "
                "(b.planned_amount - b.actual_spend) AS remaining_amount, b.currency, "
                "b.created_at, b.updated_at "
                "FROM budgets b JOIN projects p ON p.id = b.project_id "
                "WHERE b.project_id = %s",
                (project_id,),
            )
            return cur.fetchone()
    except Exception:
        PG_CONN = None
        raise


def create_budget(config, project_id, planned_amount, currency):
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO budgets (project_id, planned_amount, currency) "
                "VALUES (%s, %s, %s) RETURNING id",
                (project_id, planned_amount, currency),
            )
        return get_budget_by_project(config, project_id)
    except Exception:
        PG_CONN = None
        raise


def update_budget(config, project_id, fields):
    """fields: dict subset of {planned_amount, currency}"""
    global PG_CONN
    if not fields:
        return get_budget_by_project(config, project_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [project_id]
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE budgets SET {set_clause}, updated_at = now() WHERE project_id = %s",
                values,
            )
        return get_budget_by_project(config, project_id)
    except Exception:
        PG_CONN = None
        raise


def record_expense(config, project_id, amount):
    """Increments actual_spend by amount (amount must be > 0)."""
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE budgets SET actual_spend = actual_spend + %s, updated_at = now() "
                "WHERE project_id = %s",
                (amount, project_id),
            )
        return get_budget_by_project(config, project_id)
    except Exception:
        PG_CONN = None
        raise
