"""
API-level tests for the users-service Lambda handler (function.py).
"""
import json

from conftest import make_event
from function import handler


# ---------------------------------------------------------------------------
# Access control: every route requires an authenticated admin.
# ---------------------------------------------------------------------------

ROUTES = [
    ("GET", "/users"),
    ("POST", "/users"),
    ("GET", "/users/1"),
    ("PUT", "/users/1"),
    ("DELETE", "/users/1"),
]


def test_all_routes_reject_unauthenticated():
    for method, path in ROUTES:
        resp = handler(make_event(method=method, path=path))
        assert resp["statusCode"] == 403, f"{method} {path} did not return 403"
        body = json.loads(resp["body"])
        assert "error" in body


def test_all_routes_reject_viewer(make_user, auth_headers):
    viewer = make_user(role="viewer")
    headers = auth_headers(viewer)
    for method, path in ROUTES:
        resp = handler(make_event(method=method, path=path, headers=headers))
        assert resp["statusCode"] == 403, f"{method} {path} did not return 403 for viewer"


def test_all_routes_reject_project_manager(make_user, auth_headers):
    pm = make_user(role="project_manager")
    headers = auth_headers(pm)
    for method, path in ROUTES:
        resp = handler(make_event(method=method, path=path, headers=headers))
        assert resp["statusCode"] == 403, f"{method} {path} did not return 403 for project_manager"


# ---------------------------------------------------------------------------
# POST /users
# ---------------------------------------------------------------------------

def test_create_user_success(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)
    body = {
        "name": "New Person",
        "email": "newperson@example.com",
        "password": "secret123",
        "role": "team_member",
    }
    resp = handler(make_event(method="POST", path="/users", body=body, headers=headers))
    assert resp["statusCode"] == 201
    data = json.loads(resp["body"])
    user = data["user"]
    assert user["name"] == "New Person"
    assert user["email"] == "newperson@example.com"
    assert user["role"] == "team_member"
    assert user["is_active"] is True
    assert "password" not in user
    assert "password_hash" not in user


def test_create_user_missing_field(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)
    body = {"name": "No Email", "password": "secret123", "role": "viewer"}
    resp = handler(make_event(method="POST", path="/users", body=body, headers=headers))
    assert resp["statusCode"] == 400
    data = json.loads(resp["body"])
    assert "error" in data


def test_create_user_invalid_role(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)
    body = {
        "name": "Bad Role",
        "email": "badrole@example.com",
        "password": "secret123",
        "role": "superuser",
    }
    resp = handler(make_event(method="POST", path="/users", body=body, headers=headers))
    assert resp["statusCode"] == 400


def test_create_user_duplicate_email(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)
    make_user(role="viewer", email="dupe@example.com")

    body = {
        "name": "Dupe",
        "email": "dupe@example.com",
        "password": "secret123",
        "role": "viewer",
    }
    resp = handler(make_event(method="POST", path="/users", body=body, headers=headers))
    assert resp["statusCode"] == 409


# ---------------------------------------------------------------------------
# GET /users
# ---------------------------------------------------------------------------

def test_list_users_as_admin(make_user, auth_headers):
    admin = make_user(role="admin")
    make_user(role="viewer")
    make_user(role="finance")
    headers = auth_headers(admin)

    resp = handler(make_event(method="GET", path="/users", headers=headers))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert isinstance(data["users"], list)
    assert len(data["users"]) == 3


# ---------------------------------------------------------------------------
# GET /users/{id}
# ---------------------------------------------------------------------------

def test_get_user_existing(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="viewer")
    headers = auth_headers(admin)

    resp = handler(make_event(method="GET", path=f"/users/{target['id']}", headers=headers))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["user"]["id"] == target["id"]
    assert data["user"]["email"] == target["email"]


def test_get_user_missing(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(make_event(method="GET", path="/users/999999", headers=headers))
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# PUT /users/{id}
# ---------------------------------------------------------------------------

def test_update_user_partial(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="viewer", name="Old Name")
    headers = auth_headers(admin)

    resp = handler(
        make_event(
            method="PUT",
            path=f"/users/{target['id']}",
            body={"name": "New Name"},
            headers=headers,
        )
    )
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["user"]["name"] == "New Name"
    assert data["user"]["role"] == "viewer"


def test_update_user_role_and_is_active(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="viewer", is_active=True)
    headers = auth_headers(admin)

    resp = handler(
        make_event(
            method="PUT",
            path=f"/users/{target['id']}",
            body={"role": "finance", "is_active": False},
            headers=headers,
        )
    )
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["user"]["role"] == "finance"
    assert data["user"]["is_active"] is False


def test_update_user_invalid_role(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="viewer")
    headers = auth_headers(admin)

    resp = handler(
        make_event(
            method="PUT",
            path=f"/users/{target['id']}",
            body={"role": "superuser"},
            headers=headers,
        )
    )
    assert resp["statusCode"] == 400


def test_update_user_missing(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(
        make_event(
            method="PUT",
            path="/users/999999",
            body={"name": "Nope"},
            headers=headers,
        )
    )
    assert resp["statusCode"] == 404


# ---------------------------------------------------------------------------
# DELETE /users/{id}
# ---------------------------------------------------------------------------

def test_deactivate_user(make_user, auth_headers):
    admin = make_user(role="admin")
    target = make_user(role="viewer", is_active=True)
    headers = auth_headers(admin)

    resp = handler(make_event(method="DELETE", path=f"/users/{target['id']}", headers=headers))
    assert resp["statusCode"] == 200
    data = json.loads(resp["body"])
    assert data["user"]["is_active"] is False

    # Re-fetch to confirm persisted
    resp2 = handler(make_event(method="GET", path=f"/users/{target['id']}", headers=headers))
    data2 = json.loads(resp2["body"])
    assert data2["user"]["is_active"] is False


def test_deactivate_user_missing(make_user, auth_headers):
    admin = make_user(role="admin")
    headers = auth_headers(admin)

    resp = handler(make_event(method="DELETE", path="/users/999999", headers=headers))
    assert resp["statusCode"] == 404
