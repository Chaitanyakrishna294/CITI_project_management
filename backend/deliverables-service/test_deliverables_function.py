"""
API-level tests for the deliverables-service Lambda handler (function.py).
"""
import json

from conftest import make_event
from function import handler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_project(db_conn, manager_id, status="active", name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES (%s, %s, %s) RETURNING *",
            (name, status, manager_id),
        )
        return cur.fetchone()


def _make_deliverable(db_conn, project_id, title="Deliverable", owner_id=None, status="not_started"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO deliverables (project_id, title, owner_id, status) "
            "VALUES (%s, %s, %s, %s) RETURNING *",
            (project_id, title, owner_id, status),
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

ROUTES = [
    ("GET", "/deliverables"),
    ("POST", "/deliverables"),
    ("GET", "/deliverables/1"),
    ("PUT", "/deliverables/1"),
    ("DELETE", "/deliverables/1"),
    ("GET", "/deliverables/1/dependencies"),
    ("POST", "/deliverables/1/dependencies"),
    ("DELETE", "/deliverables/1/dependencies/1"),
]


def test_all_routes_reject_unauthenticated():
    for method, path in ROUTES:
        resp = handler(make_event(method=method, path=path))
        assert resp["statusCode"] == 401, f"{method} {path} did not return 401"
        body = json.loads(resp["body"])
        assert "error" in body


# ---------------------------------------------------------------------------
# POST /deliverables
# ---------------------------------------------------------------------------

def test_create_deliverable_as_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Design doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 201
    data = json.loads(resp["body"])
    assert data["deliverable"]["title"] == "Design doc"
    assert data["deliverable"]["project_id"] == project["id"]
    assert data["deliverable"]["status"] == "not_started"


def test_create_deliverable_as_admin(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    admin = make_user(role="admin")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(admin)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 201


def test_create_deliverable_forbidden_for_non_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    other_manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(other_manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 403


def test_create_deliverable_forbidden_for_team_member(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    member = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(member)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 403


def test_create_deliverable_missing_project_id(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_create_deliverable_missing_title(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_create_deliverable_nonexistent_project(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": 999999, "title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 404


def test_create_deliverable_archived_project_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"], status="archived")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc"},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_create_deliverable_invalid_owner_id(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc", "owner_id": 999999},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_create_deliverable_inactive_owner_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    inactive_owner = make_user(role="team_member", is_active=False)
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc", "owner_id": inactive_owner["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_create_deliverable_valid_owner_id(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path="/deliverables",
        body={"project_id": project["id"], "title": "Doc", "owner_id": owner["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 201
    data = json.loads(resp["body"])
    assert data["deliverable"]["owner_id"] == owner["id"]


# ---------------------------------------------------------------------------
# GET /deliverables
# ---------------------------------------------------------------------------

def test_list_deliverables_filters(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project1 = _make_project(db_conn, manager["id"], name="P1")
    project2 = _make_project(db_conn, manager["id"], name="P2")

    d1 = _make_deliverable(db_conn, project1["id"], title="Alpha report", owner_id=owner["id"], status="in_progress")
    _make_deliverable(db_conn, project1["id"], title="Beta plan", status="not_started")
    _make_deliverable(db_conn, project2["id"], title="Gamma spec", status="in_progress")

    headers = auth_headers(manager)

    # filter by project_id
    resp = handler(make_event(method="GET", path="/deliverables", query={"project_id": str(project1["id"])}, headers=headers))
    data = json.loads(resp["body"])
    assert resp["statusCode"] == 200
    assert len(data["deliverables"]) == 2

    # filter by status
    resp = handler(make_event(method="GET", path="/deliverables", query={"status": "in_progress"}, headers=headers))
    data = json.loads(resp["body"])
    assert len(data["deliverables"]) == 2

    # filter by owner_id
    resp = handler(make_event(method="GET", path="/deliverables", query={"owner_id": str(owner["id"])}, headers=headers))
    data = json.loads(resp["body"])
    assert len(data["deliverables"]) == 1
    assert data["deliverables"][0]["id"] == d1["id"]

    # filter by q
    resp = handler(make_event(method="GET", path="/deliverables", query={"q": "beta"}, headers=headers))
    data = json.loads(resp["body"])
    assert len(data["deliverables"]) == 1
    assert data["deliverables"][0]["title"] == "Beta plan"


def test_get_deliverable_existing(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], title="Doc")
    headers = auth_headers(manager)

    resp = handler(make_event(method="GET", path=f"/deliverables/{deliverable['id']}", headers=headers))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["deliverable"]["id"] == deliverable["id"]


def test_get_deliverable_missing(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(make_event(method="GET", path="/deliverables/999999", headers=headers))
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# PUT /deliverables/{id}
# ---------------------------------------------------------------------------

def test_update_deliverable_as_manager_full_edit(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], title="Old title")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"title": "New title", "status": "in_progress"},
        headers=headers,
    ))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["deliverable"]["title"] == "New title"
    assert data["deliverable"]["status"] == "in_progress"


def test_update_deliverable_as_admin(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    admin = make_user(role="admin")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], title="Old title")
    headers = auth_headers(admin)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"title": "Admin edited"},
        headers=headers,
    ))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["deliverable"]["title"] == "Admin edited"


def test_update_deliverable_owner_can_only_update_status(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], title="Original title", owner_id=owner["id"])
    headers = auth_headers(owner)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"title": "Owner attempted title change", "status": "in_progress"},
        headers=headers,
    ))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["deliverable"]["status"] == "in_progress"
    # title must remain unchanged -- owner is not permitted to edit it
    assert data["deliverable"]["title"] == "Original title"


def test_update_deliverable_owner_title_only_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], title="Original title", owner_id=owner["id"])
    headers = auth_headers(owner)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"title": "Owner attempted title change"},
        headers=headers,
    ))
    assert resp["statusCode"] == 400
    data = json.loads(resp["body"])
    assert data["error"] == "No permitted fields to update"


def test_update_deliverable_forbidden_for_non_owner_non_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    stranger = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], owner_id=owner["id"])
    headers = auth_headers(stranger)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"status": "in_progress"},
        headers=headers,
    ))
    assert resp["statusCode"] == 403


def test_update_deliverable_invalid_status(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="PUT", path=f"/deliverables/{deliverable['id']}",
        body={"status": "not_a_real_status"},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_update_deliverable_missing(make_user, auth_headers):
    manager = make_user(role="project_manager")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="PUT", path="/deliverables/999999",
        body={"status": "in_progress"},
        headers=headers,
    ))
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# DELETE /deliverables/{id}
# ---------------------------------------------------------------------------

def test_delete_deliverable_forbidden_for_non_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"], owner_id=owner["id"])
    headers = auth_headers(owner)

    resp = handler(make_event(method="DELETE", path=f"/deliverables/{deliverable['id']}", headers=headers))
    assert resp["statusCode"] == 403


def test_delete_deliverable_missing(make_user, auth_headers):
    manager = make_user(role="project_manager")
    headers = auth_headers(manager)

    resp = handler(make_event(method="DELETE", path="/deliverables/999999", headers=headers))
    assert resp["statusCode"] == 404


def test_delete_deliverable_success(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable(db_conn, project["id"])
    headers = auth_headers(manager)

    resp = handler(make_event(method="DELETE", path=f"/deliverables/{deliverable['id']}", headers=headers))
    assert resp["statusCode"] == 200

    resp2 = handler(make_event(method="GET", path=f"/deliverables/{deliverable['id']}", headers=headers))
    assert resp2["statusCode"] == 404


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def test_add_dependency_success(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    d2 = _make_deliverable(db_conn, project["id"], title="D2")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 201
    data = json.loads(resp["body"])
    assert "id" in data


def test_add_dependency_self_reference_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d1["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 400


def test_add_dependency_nonexistent_target(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": 999999},
        headers=headers,
    ))
    assert resp["statusCode"] == 404


def test_add_dependency_duplicate_rejected(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    d2 = _make_deliverable(db_conn, project["id"], title="D2")
    headers = auth_headers(manager)

    resp1 = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]},
        headers=headers,
    ))
    assert resp1["statusCode"] == 201

    resp2 = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]},
        headers=headers,
    ))
    assert resp2["statusCode"] == 409


def test_add_dependency_forbidden_for_non_manager(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    stranger = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    d2 = _make_deliverable(db_conn, project["id"], title="D2")
    headers = auth_headers(stranger)

    resp = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]},
        headers=headers,
    ))
    assert resp["statusCode"] == 403


def test_list_dependencies(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    d2 = _make_deliverable(db_conn, project["id"], title="D2")
    d3 = _make_deliverable(db_conn, project["id"], title="D3")
    headers = auth_headers(manager)

    handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]}, headers=headers,
    ))
    handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d3["id"]}, headers=headers,
    ))

    resp = handler(make_event(method="GET", path=f"/deliverables/{d1['id']}/dependencies", headers=headers))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert len(data["dependencies"]) == 2


def test_list_dependencies_missing_deliverable(make_user, auth_headers):
    manager = make_user(role="project_manager")
    headers = auth_headers(manager)

    resp = handler(make_event(method="GET", path="/deliverables/999999/dependencies", headers=headers))
    assert resp["statusCode"] == 404


def test_remove_dependency_success(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    d2 = _make_deliverable(db_conn, project["id"], title="D2")
    headers = auth_headers(manager)

    add_resp = handler(make_event(
        method="POST", path=f"/deliverables/{d1['id']}/dependencies",
        body={"depends_on_deliverable_id": d2["id"]}, headers=headers,
    ))
    dep_id = json.loads(add_resp["body"])["id"]

    resp = handler(make_event(
        method="DELETE", path=f"/deliverables/{d1['id']}/dependencies/{dep_id}", headers=headers,
    ))
    assert resp["statusCode"] == 200

    list_resp = handler(make_event(method="GET", path=f"/deliverables/{d1['id']}/dependencies", headers=headers))
    assert json.loads(list_resp["body"])["dependencies"] == []


def test_remove_dependency_not_found(db_conn, make_user, auth_headers):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable(db_conn, project["id"], title="D1")
    headers = auth_headers(manager)

    resp = handler(make_event(
        method="DELETE", path=f"/deliverables/{d1['id']}/dependencies/999999", headers=headers,
    ))
    assert resp["statusCode"] == 404
