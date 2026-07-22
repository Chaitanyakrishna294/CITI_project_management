"""
API-level tests for budgets-service function.handler().
"""
import json

import pytest
from conftest import make_event

from function import handler


def make_project(db_conn, manager_id, status="active", name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES (%s, %s, %s) RETURNING *",
            (name, status, manager_id),
        )
        return cur.fetchone()


def body_of(resp):
    return json.loads(resp["body"])


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def test_unauthenticated_returns_401():
    event = make_event(method="GET", path="/budgets")
    resp = handler(event)
    assert resp["statusCode"] == 401


def test_unauthenticated_post_returns_401():
    event = make_event(method="POST", path="/budgets", body={"project_id": 1, "planned_amount": 100})
    resp = handler(event)
    assert resp["statusCode"] == 401


# ---------------------------------------------------------------------------
# POST /budgets (create)
# ---------------------------------------------------------------------------

def test_create_budget_as_admin(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 1000},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    budget = body_of(resp)["budget"]
    assert budget["project_id"] == project["id"]
    assert float(budget["planned_amount"]) == 1000


def test_create_budget_as_finance(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    finance = make_user(role="finance")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 500},
        headers=auth_headers(finance),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201


def test_create_budget_as_own_project_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 750},
        headers=auth_headers(manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201


def test_create_budget_as_different_project_manager_forbidden(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    other_manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 750},
        headers=auth_headers(other_manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_budget_as_team_member_forbidden(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    team_member = make_user(role="team_member")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 750},
        headers=auth_headers(team_member),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_budget_as_viewer_forbidden(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    viewer = make_user(role="viewer")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 750},
        headers=auth_headers(viewer),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_budget_missing_project_id(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        method="POST",
        path="/budgets",
        body={"planned_amount": 100},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_budget_missing_planned_amount(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": 1},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_budget_negative_planned_amount_rejected_before_db(db_conn, make_user, auth_headers):
    """Negative planned_amount must be rejected at the app-validation level (400),
    before it would ever reach the DB CHECK constraint."""
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": -50},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400
    # confirm no budget row was actually created
    with db_conn.cursor() as cur:
        cur.execute("SELECT count(*) AS c FROM budgets WHERE project_id = %s", (project["id"],))
        assert cur.fetchone()["c"] == 0


def test_create_budget_nonexistent_project(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": 999999, "planned_amount": 100},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 404


def test_create_budget_duplicate_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 100},
        headers=auth_headers(admin),
    )
    resp1 = handler(event)
    assert resp1["statusCode"] == 201

    event2 = make_event(
        method="POST",
        path="/budgets",
        body={"project_id": project["id"], "planned_amount": 200},
        headers=auth_headers(admin),
    )
    resp2 = handler(event2)
    assert resp2["statusCode"] == 409


# ---------------------------------------------------------------------------
# GET /budgets, GET /budgets/{project_id}
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("role", ["admin", "finance", "project_manager", "team_member", "viewer"])
def test_list_budgets_any_role(db_conn, make_user, auth_headers, role):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, %s)",
            (project["id"], 100),
        )
    user = make_user(role=role)
    event = make_event(method="GET", path="/budgets", headers=auth_headers(user))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert len(body_of(resp)["budgets"]) == 1


@pytest.mark.parametrize("role", ["admin", "finance", "project_manager", "team_member", "viewer"])
def test_get_budget_any_role(db_conn, make_user, auth_headers, role):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, %s)",
            (project["id"], 100),
        )
    user = make_user(role=role)
    event = make_event(method="GET", path=f"/budgets/{project['id']}", headers=auth_headers(user))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert body_of(resp)["budget"]["project_id"] == project["id"]


def test_get_budget_404_when_absent(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    viewer = make_user(role="viewer")
    event = make_event(method="GET", path=f"/budgets/{project['id']}", headers=auth_headers(viewer))
    resp = handler(event)
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# PUT /budgets/{project_id}
# ---------------------------------------------------------------------------

def _create_budget_row(db_conn, project_id, planned_amount=100):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, %s) RETURNING *",
            (project_id, planned_amount),
        )
        return cur.fetchone()


def test_update_budget_as_admin(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert float(body_of(resp)["budget"]["planned_amount"]) == 500


def test_update_budget_as_own_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200


def test_update_budget_as_finance(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])
    finance = make_user(role="finance")

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(finance),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200


@pytest.mark.parametrize("role", ["team_member", "viewer"])
def test_update_budget_forbidden_for_readonly_roles(db_conn, make_user, auth_headers, role):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])
    user = make_user(role=role)

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(user),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_update_budget_forbidden_for_other_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    other_manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(other_manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_update_budget_negative_planned_amount_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": -1},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_update_budget_404_when_no_budget_exists(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"planned_amount": 500},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 404


def test_update_budget_currency(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="PUT",
        path=f"/budgets/{project['id']}",
        body={"currency": "EUR"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert body_of(resp)["budget"]["currency"] == "EUR"


# ---------------------------------------------------------------------------
# POST /budgets/{project_id}/expenses
# ---------------------------------------------------------------------------

def test_record_expense_as_admin(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert float(body_of(resp)["budget"]["actual_spend"]) == 100


def test_record_expense_as_own_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200


def test_record_expense_as_finance(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    finance = make_user(role="finance")

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(finance),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200


@pytest.mark.parametrize("role", ["team_member", "viewer"])
def test_record_expense_forbidden_for_readonly_roles(db_conn, make_user, auth_headers, role):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    user = make_user(role=role)

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(user),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_record_expense_forbidden_for_other_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    other_manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(other_manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_record_expense_zero_amount_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 0},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_record_expense_negative_amount_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": -25},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_record_expense_404_when_no_budget_exists(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    admin = make_user(role="admin")

    event = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 404


def test_record_expense_accumulates_across_multiple_calls(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = make_project(db_conn, manager["id"])
    _create_budget_row(db_conn, project["id"], planned_amount=1000)
    admin = make_user(role="admin")

    event1 = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 100},
        headers=auth_headers(admin),
    )
    resp1 = handler(event1)
    assert resp1["statusCode"] == 200
    assert float(body_of(resp1)["budget"]["actual_spend"]) == 100

    event2 = make_event(
        method="POST",
        path=f"/budgets/{project['id']}/expenses",
        body={"amount": 50},
        headers=auth_headers(admin),
    )
    resp2 = handler(event2)
    assert resp2["statusCode"] == 200
    budget2 = body_of(resp2)["budget"]
    assert float(budget2["actual_spend"]) == 150
    assert float(budget2["remaining_amount"]) == 850
