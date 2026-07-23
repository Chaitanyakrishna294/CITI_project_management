"""
API-level tests for the projects-service Lambda handler.
"""
import json

from function import handler
from conftest import make_event


def _body(resp):
    return json.loads(resp["body"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_unauthenticated_request_returns_401():
    event = make_event("GET", "/projects")
    resp = handler(event)
    assert resp["statusCode"] == 401


# ---------------------------------------------------------------------------
# POST /projects (create)
# ---------------------------------------------------------------------------

def test_create_project_success_by_admin(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "New Project", "manager_id": manager["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    project = _body(resp)["project"]
    assert project["name"] == "New Project"
    assert project["manager_id"] == manager["id"]


def test_create_project_success_by_project_manager(make_user, auth_headers):
    pm = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "PM Project", "manager_id": pm["id"]},
        headers=auth_headers(pm),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    project = _body(resp)["project"]
    assert project["name"] == "PM Project"


def test_create_project_rejected_for_team_member(make_user, auth_headers):
    team_member = make_user(role="team_member")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Nope", "manager_id": manager["id"]},
        headers=auth_headers(team_member),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_project_rejected_for_viewer(make_user, auth_headers):
    viewer = make_user(role="viewer")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Nope", "manager_id": manager["id"]},
        headers=auth_headers(viewer),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_project_rejected_for_finance(make_user, auth_headers):
    finance = make_user(role="finance")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Nope", "manager_id": manager["id"]},
        headers=auth_headers(finance),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_project_missing_name(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"manager_id": manager["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_project_missing_manager_id(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "No Manager"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_project_manager_id_non_manager_role(make_user, auth_headers):
    admin = make_user(role="admin")
    viewer = make_user(role="viewer")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Bad Manager", "manager_id": viewer["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_project_manager_id_inactive_admin(make_user, auth_headers):
    admin = make_user(role="admin")
    inactive_admin = make_user(role="admin", is_active=False)
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Inactive Manager", "manager_id": inactive_admin["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_project_manager_id_nonexistent_user(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Ghost Manager", "manager_id": 999999},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_project_with_metadata_round_trips(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    metadata = {"Client Contact": "bob@client.com", "original_status": "In Progress"}
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Imported", "manager_id": manager["id"], "metadata": metadata},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    project = _body(resp)["project"]
    assert project["metadata"] == metadata

    resp = handler(make_event("GET", f"/projects/{project['id']}", headers=auth_headers(admin)))
    assert _body(resp)["project"]["metadata"] == metadata


def test_create_project_without_metadata_defaults_to_empty(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "No Meta", "manager_id": manager["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    assert _body(resp)["project"]["metadata"] == {}


def test_create_project_non_object_metadata_rejected(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    for bad in ("a string", [1, 2], 42):
        event = make_event(
            "POST",
            "/projects",
            body={"name": "Bad Meta", "manager_id": manager["id"], "metadata": bad},
            headers=auth_headers(admin),
        )
        resp = handler(event)
        assert resp["statusCode"] == 400
        assert "metadata" in _body(resp)["error"]


# ---------------------------------------------------------------------------
# GET /projects (list + filters)
# ---------------------------------------------------------------------------

def _create(admin_headers, name, manager_id, department=None):
    event = make_event(
        "POST",
        "/projects",
        body={"name": name, "manager_id": manager_id, "department": department},
        headers=admin_headers,
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    return _body(resp)["project"]


def test_list_projects_returns_200(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    _create(auth_headers(admin), "Alpha", manager["id"])

    event = make_event("GET", "/projects", headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 200
    projects = _body(resp)["projects"]
    assert len(projects) == 1
    assert projects[0]["name"] == "Alpha"


def test_list_projects_filter_by_status(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p1 = _create(auth_headers(admin), "Active Proj", manager["id"])
    p2 = _create(auth_headers(admin), "To Archive", manager["id"])

    # archive p2 directly
    with db_conn.cursor() as cur:
        cur.execute("UPDATE projects SET status = 'archived' WHERE id = %s", (p2["id"],))

    event = make_event(
        "GET", "/projects", query={"status": "archived"}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    projects = _body(resp)["projects"]
    assert len(projects) == 1
    assert projects[0]["id"] == p2["id"]

    event = make_event(
        "GET", "/projects", query={"status": "active"}, headers=auth_headers(admin)
    )
    resp = handler(event)
    projects = _body(resp)["projects"]
    assert len(projects) == 1
    assert projects[0]["id"] == p1["id"]


def test_list_projects_includes_metadata(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    event = make_event(
        "POST",
        "/projects",
        body={"name": "Meta List", "manager_id": manager["id"], "metadata": {"Region": "EMEA"}},
        headers=auth_headers(admin),
    )
    assert handler(event)["statusCode"] == 201

    projects = _body(handler(make_event("GET", "/projects", headers=auth_headers(admin))))["projects"]
    assert projects[0]["metadata"] == {"Region": "EMEA"}


def test_list_projects_filter_by_q(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p1 = _create(auth_headers(admin), "Website Redesign", manager["id"])
    _create(auth_headers(admin), "Mobile App", manager["id"])

    event = make_event(
        "GET", "/projects", query={"q": "website"}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    projects = _body(resp)["projects"]
    assert len(projects) == 1
    assert projects[0]["id"] == p1["id"]


def test_list_projects_filter_by_date_range(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    early = _create(auth_headers(admin), "Early", manager["id"])
    late = _create(auth_headers(admin), "Late", manager["id"])

    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE projects SET start_date = '2026-01-01', end_date = '2026-03-31' WHERE id = %s",
            (early["id"],),
        )
        cur.execute(
            "UPDATE projects SET start_date = '2026-06-01', end_date = '2026-12-31' WHERE id = %s",
            (late["id"],),
        )

    event = make_event(
        "GET",
        "/projects",
        query={"date_from": "2026-05-01", "date_to": "2026-12-31"},
        headers=auth_headers(admin),
    )
    projects = _body(handler(event))["projects"]
    assert [p["id"] for p in projects] == [late["id"]]


def _set_budget(db_conn, project_id, planned):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, %s)",
            (project_id, planned),
        )


def test_list_projects_filter_by_budget_range(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    small = _create(auth_headers(admin), "Small Budget", manager["id"])
    large = _create(auth_headers(admin), "Large Budget", manager["id"])
    _set_budget(db_conn, small["id"], 5000)
    _set_budget(db_conn, large["id"], 250000)

    event = make_event(
        "GET", "/projects", query={"budget_min": "100000"}, headers=auth_headers(admin)
    )
    projects = _body(handler(event))["projects"]
    assert [p["id"] for p in projects] == [large["id"]]

    event = make_event(
        "GET", "/projects", query={"budget_max": "100000"}, headers=auth_headers(admin)
    )
    projects = _body(handler(event))["projects"]
    assert [p["id"] for p in projects] == [small["id"]]

    event = make_event(
        "GET",
        "/projects",
        query={"budget_min": "1000", "budget_max": "10000"},
        headers=auth_headers(admin),
    )
    projects = _body(handler(event))["projects"]
    assert [p["id"] for p in projects] == [small["id"]]


def test_list_projects_budget_filter_excludes_unbudgeted_projects(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    budgeted = _create(auth_headers(admin), "Budgeted", manager["id"])
    _create(auth_headers(admin), "No Budget Yet", manager["id"])
    _set_budget(db_conn, budgeted["id"], 5000)

    event = make_event(
        "GET", "/projects", query={"budget_min": "0"}, headers=auth_headers(admin)
    )
    projects = _body(handler(event))["projects"]
    assert [p["id"] for p in projects] == [budgeted["id"]]


def test_list_projects_includes_budget_amounts(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    project = _create(auth_headers(admin), "With Budget", manager["id"])
    _set_budget(db_conn, project["id"], 1234)

    projects = _body(handler(make_event("GET", "/projects", headers=auth_headers(admin))))["projects"]
    assert projects[0]["planned_amount"] == "1234.00"
    assert projects[0]["actual_spend"] == "0.00"


def test_list_projects_unbudgeted_project_has_null_amounts(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    _create(auth_headers(admin), "No Budget", manager["id"])

    projects = _body(handler(make_event("GET", "/projects", headers=auth_headers(admin))))["projects"]
    assert projects[0]["planned_amount"] is None


def test_list_projects_non_numeric_budget_filter_returns_400(make_user, auth_headers):
    admin = make_user(role="admin")

    event = make_event(
        "GET", "/projects", query={"budget_min": "abc"}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 400
    assert "number" in _body(resp)["error"]


def test_list_projects_inverted_budget_range_returns_400(make_user, auth_headers):
    admin = make_user(role="admin")

    event = make_event(
        "GET",
        "/projects",
        query={"budget_min": "500", "budget_max": "100"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_list_projects_blank_budget_filter_is_ignored(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    _create(auth_headers(admin), "Unbudgeted", manager["id"])

    # An empty form field must not be treated as "budget >= 0" and filter out
    # every project that has no budget row yet.
    event = make_event(
        "GET",
        "/projects",
        query={"budget_min": "", "budget_max": ""},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert len(_body(resp)["projects"]) == 1


# ---------------------------------------------------------------------------
# GET /projects/{id}
# ---------------------------------------------------------------------------

def test_get_project_existing(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Gettable", manager["id"])

    event = make_event("GET", f"/projects/{p['id']}", headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["id"] == p["id"]


def test_get_project_missing_returns_404(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event("GET", "/projects/999999", headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# PUT /projects/{id}
# ---------------------------------------------------------------------------

def test_update_project_by_own_manager(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Editable", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"name": "Renamed"},
        headers=auth_headers(manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["name"] == "Renamed"


def test_update_project_by_different_manager_forbidden(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    other_manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Not Yours", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"name": "Hijacked"},
        headers=auth_headers(other_manager),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_update_project_by_admin_always_allowed(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Admin Editable", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"name": "Admin Renamed"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["name"] == "Admin Renamed"


def test_update_project_invalid_status_rejected(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Status Test", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"status": "not_a_real_status"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_update_project_manager_id_to_invalid_manager_rejected(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    viewer = make_user(role="viewer")
    p = _create(auth_headers(admin), "Manager Change", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"manager_id": viewer["id"]},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_update_project_metadata(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Meta Edit", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"metadata": {"Region": "APAC"}},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["metadata"] == {"Region": "APAC"}


def test_update_project_non_object_metadata_rejected(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Meta Reject", manager["id"])

    event = make_event(
        "PUT",
        f"/projects/{p['id']}",
        body={"metadata": "not an object"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_update_project_missing_returns_404(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        "PUT",
        "/projects/999999",
        body={"name": "Nope"},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# DELETE /projects/{id} (archive)
# ---------------------------------------------------------------------------

def test_archive_project_by_manager(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Archive Me", manager["id"])

    event = make_event("DELETE", f"/projects/{p['id']}", headers=auth_headers(manager))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["status"] == "archived"


def test_archive_project_by_admin(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    p = _create(auth_headers(admin), "Archive Me Too", manager["id"])

    event = make_event("DELETE", f"/projects/{p['id']}", headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert _body(resp)["project"]["status"] == "archived"


def test_archive_project_forbidden_for_other_roles(make_user, auth_headers):
    admin = make_user(role="admin")
    manager = make_user(role="project_manager")
    team_member = make_user(role="team_member")
    p = _create(auth_headers(admin), "Protected", manager["id"])

    event = make_event("DELETE", f"/projects/{p['id']}", headers=auth_headers(team_member))
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_archive_project_missing_returns_404(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event("DELETE", "/projects/999999", headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 404
