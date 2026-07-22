"""
Direct tests of postgres_service functions against the real DB.
"""
import psycopg
import pytest

from postgres_service import (
    create_budget,
    get_budget_by_project,
    get_project,
    list_budgets,
    record_expense,
    update_budget,
)


def make_project(db_conn, manager_id, status="active", name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES (%s, %s, %s) RETURNING *",
            (name, status, manager_id),
        )
        return cur.fetchone()


def test_get_project_returns_row(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])

    result = get_project(pg_config, project["id"])
    assert result["id"] == project["id"]
    assert result["manager_id"] == manager["id"]


def test_get_project_returns_none_when_missing(pg_config):
    assert get_project(pg_config, 999999) is None


def test_list_budgets_empty(pg_config):
    assert list_budgets(pg_config) == []


def test_list_budgets_returns_all(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    p1 = make_project(db_conn, manager["id"], name="P1")
    p2 = make_project(db_conn, manager["id"], name="P2")
    create_budget(pg_config, p1["id"], 100, "USD")
    create_budget(pg_config, p2["id"], 200, "USD")

    budgets = list_budgets(pg_config)
    assert len(budgets) == 2
    project_ids = {b["project_id"] for b in budgets}
    assert project_ids == {p1["id"], p2["id"]}


def test_get_budget_by_project_none_when_missing(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    assert get_budget_by_project(pg_config, project["id"]) is None


def test_create_budget_and_fetch(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])

    budget = create_budget(pg_config, project["id"], 1500, "USD")
    assert budget["project_id"] == project["id"]
    assert float(budget["planned_amount"]) == 1500
    assert float(budget["actual_spend"]) == 0
    assert float(budget["remaining_amount"]) == 1500

    fetched = get_budget_by_project(pg_config, project["id"])
    assert fetched["id"] == budget["id"]


def test_update_budget_planned_amount(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    create_budget(pg_config, project["id"], 1000, "USD")

    updated = update_budget(pg_config, project["id"], {"planned_amount": 2000})
    assert float(updated["planned_amount"]) == 2000


def test_update_budget_currency(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    create_budget(pg_config, project["id"], 1000, "USD")

    updated = update_budget(pg_config, project["id"], {"currency": "GBP"})
    assert updated["currency"] == "GBP"


def test_update_budget_no_fields_returns_current(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    create_budget(pg_config, project["id"], 1000, "USD")

    updated = update_budget(pg_config, project["id"], {})
    assert float(updated["planned_amount"]) == 1000


def test_record_expense_is_additive(db_conn, pg_config, make_user):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    create_budget(pg_config, project["id"], 1000, "USD")

    record_expense(pg_config, project["id"], 100)
    budget = record_expense(pg_config, project["id"], 50)

    assert float(budget["actual_spend"]) == 150
    assert float(budget["remaining_amount"]) == 850


def test_direct_insert_negative_planned_amount_raises(db_conn):
    """DB CHECK constraint should reject negative planned_amount even via raw SQL,
    independent of any application-level validation."""
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, is_active) "
            "VALUES ('Mgr', 'mgr@example.com', 'x', 'project_manager', true) RETURNING id"
        )
        manager_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES ('P', 'active', %s) RETURNING id",
            (manager_id,),
        )
        project_id = cur.fetchone()["id"]

    with pytest.raises(psycopg.errors.CheckViolation):
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, %s)",
                (project_id, -100),
            )


def test_direct_insert_negative_actual_spend_raises(db_conn):
    """DB CHECK constraint should reject negative actual_spend even via raw SQL."""
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, is_active) "
            "VALUES ('Mgr2', 'mgr2@example.com', 'x', 'project_manager', true) RETURNING id"
        )
        manager_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES ('P2', 'active', %s) RETURNING id",
            (manager_id,),
        )
        project_id = cur.fetchone()["id"]

    with pytest.raises(psycopg.errors.CheckViolation):
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO budgets (project_id, planned_amount, actual_spend) VALUES (%s, %s, %s)",
                (project_id, 100, -50),
            )
