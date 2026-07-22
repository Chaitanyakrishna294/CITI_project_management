"""
API-level tests for the resources-service Lambda handler.
"""
import json

from function import handler
from conftest import make_event


def _make_project(db_conn, manager_id, name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, manager_id) VALUES (%s, %s) RETURNING *",
            (name, manager_id),
        )
        return cur.fetchone()


def _make_resource(db_conn, user_id, title="Engineer", department="Eng", weekly_capacity=100.00):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO resources (user_id, title, department, weekly_capacity) "
            "VALUES (%s, %s, %s, %s) RETURNING *",
            (user_id, title, department, weekly_capacity),
        )
        return cur.fetchone()


def _make_allocation(db_conn, resource_id, project_id, allocation_pct):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO resource_allocations (resource_id, project_id, allocation_pct) "
            "VALUES (%s, %s, %s) RETURNING *",
            (resource_id, project_id, allocation_pct),
        )
        return cur.fetchone()


def body_of(resp):
    return json.loads(resp["body"])


# ---- Auth ---------------------------------------------------------------

def test_unauthenticated_returns_401():
    event = make_event("GET", "/resources")
    resp = handler(event)
    assert resp["statusCode"] == 401


# ---- POST /resources ------------------------------------------------------

def test_admin_can_create_resource(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    target = make_user(role="team_member")
    event = make_event(
        "POST",
        "/resources",
        body={"user_id": target["id"], "title": "Dev", "department": "Eng", "weekly_capacity": 80},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201
    resource = body_of(resp)["resource"]
    assert resource["user_id"] == target["id"]
    assert resource["title"] == "Dev"


def test_pm_can_create_resource(make_user, auth_headers):
    pm = make_user(role="project_manager")
    target = make_user(role="team_member")
    event = make_event(
        "POST",
        "/resources",
        body={"user_id": target["id"]},
        headers=auth_headers(pm),
    )
    resp = handler(event)
    assert resp["statusCode"] == 201


def test_non_manager_forbidden_to_create_resource(make_user, auth_headers):
    viewer = make_user(role="viewer")
    target = make_user(role="team_member")
    event = make_event(
        "POST",
        "/resources",
        body={"user_id": target["id"]},
        headers=auth_headers(viewer),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_resource_missing_user_id(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event("POST", "/resources", body={}, headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_resource_inactive_user(make_user, auth_headers):
    admin = make_user(role="admin")
    inactive = make_user(role="team_member", is_active=False)
    event = make_event(
        "POST", "/resources", body={"user_id": inactive["id"]}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_resource_nonexistent_user(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event("POST", "/resources", body={"user_id": 999999}, headers=auth_headers(admin))
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_resource_duplicate_for_user_conflicts(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="team_member")
    event = make_event(
        "POST", "/resources", body={"user_id": target["id"]}, headers=auth_headers(admin)
    )
    resp1 = handler(event)
    assert resp1["statusCode"] == 201

    event2 = make_event(
        "POST", "/resources", body={"user_id": target["id"]}, headers=auth_headers(admin)
    )
    resp2 = handler(event2)
    assert resp2["statusCode"] == 409


# ---- GET /resources & /resources/{id} -------------------------------------

def test_list_resources_any_role(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    user1 = make_user(role="team_member", name="Alice")
    _make_resource(db_conn, user1["id"], title="Analyst", department="Finance")

    event = make_event("GET", "/resources", headers=auth_headers(viewer))
    resp = handler(event)
    assert resp["statusCode"] == 200
    resources = body_of(resp)["resources"]
    assert len(resources) == 1
    assert resources[0]["user_name"] == "Alice"


def test_list_resources_filter_by_q(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    user1 = make_user(role="team_member", name="Alice Smith")
    user2 = make_user(role="team_member", name="Bob Jones")
    _make_resource(db_conn, user1["id"])
    _make_resource(db_conn, user2["id"])

    event = make_event("GET", "/resources", query={"q": "Alice"}, headers=auth_headers(viewer))
    resp = handler(event)
    assert resp["statusCode"] == 200
    resources = body_of(resp)["resources"]
    assert len(resources) == 1
    assert resources[0]["user_name"] == "Alice Smith"


def test_list_resources_filter_by_department(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    user1 = make_user(role="team_member")
    user2 = make_user(role="team_member")
    _make_resource(db_conn, user1["id"], department="Finance")
    _make_resource(db_conn, user2["id"], department="Engineering")

    event = make_event(
        "GET", "/resources", query={"department": "Engineering"}, headers=auth_headers(viewer)
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    resources = body_of(resp)["resources"]
    assert len(resources) == 1
    assert resources[0]["department"] == "Engineering"


def test_get_resource_by_id(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    user1 = make_user(role="team_member")
    resource = _make_resource(db_conn, user1["id"])

    event = make_event("GET", f"/resources/{resource['id']}", headers=auth_headers(viewer))
    resp = handler(event)
    assert resp["statusCode"] == 200
    assert body_of(resp)["resource"]["id"] == resource["id"]


def test_get_resource_not_found(make_user, auth_headers):
    viewer = make_user(role="viewer")
    event = make_event("GET", "/resources/999999", headers=auth_headers(viewer))
    resp = handler(event)
    assert resp["statusCode"] == 404


# ---- PUT /resources/{id} ---------------------------------------------------

def test_update_resource_forbidden_for_non_manager(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    user1 = make_user(role="team_member")
    resource = _make_resource(db_conn, user1["id"])

    event = make_event(
        "PUT",
        f"/resources/{resource['id']}",
        body={"title": "New Title"},
        headers=auth_headers(viewer),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_update_resource_not_found(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        "PUT", "/resources/999999", body={"title": "X"}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 404


def test_update_resource_partial_fields(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    user1 = make_user(role="team_member")
    resource = _make_resource(db_conn, user1["id"], title="Old Title", department="Old Dept")

    event = make_event(
        "PUT",
        f"/resources/{resource['id']}",
        body={"title": "New Title", "weekly_capacity": 50},
        headers=auth_headers(admin),
    )
    resp = handler(event)
    assert resp["statusCode"] == 200
    updated = body_of(resp)["resource"]
    assert updated["title"] == "New Title"
    assert updated["department"] == "Old Dept"
    assert float(updated["weekly_capacity"]) == 50.0


# ---- POST /allocations ------------------------------------------------------

def test_create_allocation_forbidden_for_non_manager(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"])

    event = make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project["id"], "allocation_pct": 50},
        headers=auth_headers(viewer),
    )
    resp = handler(event)
    assert resp["statusCode"] == 403


def test_create_allocation_missing_fields(make_user, auth_headers):
    admin = make_user(role="admin")
    event = make_event(
        "POST", "/allocations", body={"resource_id": 1}, headers=auth_headers(admin)
    )
    resp = handler(event)
    assert resp["statusCode"] == 400


def test_create_allocation_success_within_capacity(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project1 = _make_project(db_conn, pm_user["id"], name="Project A")
    project2 = _make_project(db_conn, pm_user["id"], name="Project B")
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)

    # allocate 60% to project1
    resp1 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project1["id"], "allocation_pct": 60},
        headers=auth_headers(admin),
    ))
    assert resp1["statusCode"] == 201

    # 40% more to project2 should succeed (total 100)
    resp2 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project2["id"], "allocation_pct": 40},
        headers=auth_headers(admin),
    ))
    assert resp2["statusCode"] == 201


def test_create_allocation_exceeds_capacity(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project1 = _make_project(db_conn, pm_user["id"], name="Project A")
    project2 = _make_project(db_conn, pm_user["id"], name="Project B")
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)

    resp1 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project1["id"], "allocation_pct": 60},
        headers=auth_headers(admin),
    ))
    assert resp1["statusCode"] == 201

    # 50% more on a different project would push total to 110 -> should fail
    resp2 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project2["id"], "allocation_pct": 50},
        headers=auth_headers(admin),
    ))
    assert resp2["statusCode"] == 400


def test_create_allocation_duplicate_resource_project(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)

    resp1 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project["id"], "allocation_pct": 20},
        headers=auth_headers(admin),
    ))
    assert resp1["statusCode"] == 201

    resp2 = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": project["id"], "allocation_pct": 10},
        headers=auth_headers(admin),
    ))
    assert resp2["statusCode"] == 409


def test_create_allocation_nonexistent_project(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)

    resp = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": resource["id"], "project_id": 999999, "allocation_pct": 20},
        headers=auth_headers(admin),
    ))
    assert resp["statusCode"] == 404


def test_create_allocation_nonexistent_resource(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])

    resp = handler(make_event(
        "POST",
        "/allocations",
        body={"resource_id": 999999, "project_id": project["id"], "allocation_pct": 20},
        headers=auth_headers(admin),
    ))
    assert resp["statusCode"] == 404


# ---- PUT /allocations/{id} -------------------------------------------------

def test_update_allocation_forbidden_for_non_manager(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)
    allocation = _make_allocation(db_conn, resource["id"], project["id"], 30)

    resp = handler(make_event(
        "PUT",
        f"/allocations/{allocation['id']}",
        body={"allocation_pct": 40},
        headers=auth_headers(viewer),
    ))
    assert resp["statusCode"] == 403


def test_update_allocation_not_found(make_user, auth_headers):
    admin = make_user(role="admin")
    resp = handler(make_event(
        "PUT", "/allocations/999999", body={"allocation_pct": 40}, headers=auth_headers(admin)
    ))
    assert resp["statusCode"] == 404


def test_update_allocation_excludes_self_from_capacity_check(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)
    allocation = _make_allocation(db_conn, resource["id"], project["id"], 60)

    # updating this allocation to 80% should succeed: only this allocation counts,
    # and 80 <= 100 capacity
    resp = handler(make_event(
        "PUT",
        f"/allocations/{allocation['id']}",
        body={"allocation_pct": 80},
        headers=auth_headers(admin),
    ))
    assert resp["statusCode"] == 200
    assert float(body_of(resp)["allocation"]["allocation_pct"]) == 80.0


def test_update_allocation_exceeds_capacity_with_other_allocations(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project1 = _make_project(db_conn, pm_user["id"], name="P1")
    project2 = _make_project(db_conn, pm_user["id"], name="P2")
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"], weekly_capacity=100)

    allocation1 = _make_allocation(db_conn, resource["id"], project1["id"], 60)
    allocation2 = _make_allocation(db_conn, resource["id"], project2["id"], 20)

    # allocation1 (currently 60) + other_total (20 from allocation2) = 80 baseline.
    # Trying to bump allocation1 to 90 -> other_total(20) + 90 = 110 > 100 -> fail
    resp = handler(make_event(
        "PUT",
        f"/allocations/{allocation1['id']}",
        body={"allocation_pct": 90},
        headers=auth_headers(admin),
    ))
    assert resp["statusCode"] == 400


# ---- DELETE /allocations/{id} ----------------------------------------------

def test_delete_allocation_forbidden_for_non_manager(make_user, auth_headers, db_conn):
    viewer = make_user(role="viewer")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"])
    allocation = _make_allocation(db_conn, resource["id"], project["id"], 30)

    resp = handler(make_event(
        "DELETE", f"/allocations/{allocation['id']}", headers=auth_headers(viewer)
    ))
    assert resp["statusCode"] == 403


def test_delete_allocation_not_found(make_user, auth_headers):
    admin = make_user(role="admin")
    resp = handler(make_event(
        "DELETE", "/allocations/999999", headers=auth_headers(admin)
    ))
    assert resp["statusCode"] == 404


def test_delete_allocation_success_and_removed_from_list(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project = _make_project(db_conn, pm_user["id"])
    resource_user = make_user(role="team_member")
    resource = _make_resource(db_conn, resource_user["id"])
    allocation = _make_allocation(db_conn, resource["id"], project["id"], 30)

    resp = handler(make_event(
        "DELETE", f"/allocations/{allocation['id']}", headers=auth_headers(admin)
    ))
    assert resp["statusCode"] == 200

    list_resp = handler(make_event(
        "GET", "/allocations", query={"resource_id": resource["id"]}, headers=auth_headers(admin)
    ))
    assert list_resp["statusCode"] == 200
    assert body_of(list_resp)["allocations"] == []


# ---- GET /allocations -------------------------------------------------------

def test_list_allocations_filters(make_user, auth_headers, db_conn):
    admin = make_user(role="admin")
    pm_user = make_user(role="project_manager")
    project1 = _make_project(db_conn, pm_user["id"], name="P1")
    project2 = _make_project(db_conn, pm_user["id"], name="P2")
    resource_user1 = make_user(role="team_member")
    resource_user2 = make_user(role="team_member")
    resource1 = _make_resource(db_conn, resource_user1["id"])
    resource2 = _make_resource(db_conn, resource_user2["id"])

    _make_allocation(db_conn, resource1["id"], project1["id"], 30)
    _make_allocation(db_conn, resource2["id"], project2["id"], 40)

    resp = handler(make_event(
        "GET", "/allocations", query={"resource_id": resource1["id"]}, headers=auth_headers(admin)
    ))
    assert resp["statusCode"] == 200
    allocations = body_of(resp)["allocations"]
    assert len(allocations) == 1
    assert allocations[0]["resource_id"] == resource1["id"]

    resp2 = handler(make_event(
        "GET", "/allocations", query={"project_id": project2["id"]}, headers=auth_headers(admin)
    ))
    assert resp2["statusCode"] == 200
    allocations2 = body_of(resp2)["allocations"]
    assert len(allocations2) == 1
    assert allocations2[0]["project_id"] == project2["id"]
