"""
API-level tests for the auth-service Lambda handler (function.py).

Runs handler() directly against real HTTP-style event dicts and a real
local Postgres DB (see conftest.py).
"""
import json

from auth_lib import hash_password
from conftest import make_event
from function import handler


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------

def test_login_success(make_user):
    plain_password = "correct-horse-battery-staple"
    user = make_user(role="admin", email="alice@example.com",
                      password_hash=hash_password(plain_password))

    resp = handler(make_event("POST", "/login", body={
        "email": "alice@example.com",
        "password": plain_password,
    }))
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert "token" in body and body["token"]
    assert body["user"] == {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": "admin",
    }
    assert "password_hash" not in body["user"]


def test_login_wrong_password(make_user):
    make_user(email="bob@example.com", password_hash=hash_password("right-password"))

    resp = handler(make_event("POST", "/login", body={
        "email": "bob@example.com",
        "password": "wrong-password",
    }))
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 401
    assert "token" not in body


def test_login_unknown_email():
    resp = handler(make_event("POST", "/login", body={
        "email": "nobody@example.com",
        "password": "whatever",
    }))
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 401
    assert "token" not in body


def test_login_inactive_user(make_user):
    make_user(email="inactive@example.com",
              password_hash=hash_password("secret123"),
              is_active=False)

    resp = handler(make_event("POST", "/login", body={
        "email": "inactive@example.com",
        "password": "secret123",
    }))
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 401
    assert "token" not in body


def test_login_error_messages_do_not_leak_which_field_was_wrong(make_user):
    """Wrong password, unknown email, and inactive user should all produce
    the same 401 error message, so an attacker cannot distinguish cases."""
    make_user(email="carol@example.com",
              password_hash=hash_password("right-password"),
              is_active=True)
    make_user(email="dave@example.com",
              password_hash=hash_password("right-password"),
              is_active=False)

    wrong_password = handler(make_event("POST", "/login", body={
        "email": "carol@example.com", "password": "nope",
    }))
    unknown_email = handler(make_event("POST", "/login", body={
        "email": "nobody@example.com", "password": "nope",
    }))
    inactive_user = handler(make_event("POST", "/login", body={
        "email": "dave@example.com", "password": "right-password",
    }))

    bodies = [json.loads(r["body"]) for r in (wrong_password, unknown_email, inactive_user)]
    assert wrong_password["statusCode"] == unknown_email["statusCode"] == inactive_user["statusCode"] == 401
    assert bodies[0]["error"] == bodies[1]["error"] == bodies[2]["error"]


def test_login_missing_email():
    resp = handler(make_event("POST", "/login", body={"password": "secret123"}))
    assert resp["statusCode"] == 400


def test_login_missing_password():
    resp = handler(make_event("POST", "/login", body={"email": "eve@example.com"}))
    assert resp["statusCode"] == 400


def test_login_invalid_json_body():
    event = make_event("POST", "/login")
    event["body"] = "{not valid json"
    resp = handler(event)
    assert resp["statusCode"] == 400


# ---------------------------------------------------------------------------
# POST /logout
# ---------------------------------------------------------------------------

def test_logout_always_200():
    resp = handler(make_event("POST", "/logout"))
    body = json.loads(resp["body"])
    assert resp["statusCode"] == 200
    assert "message" in body


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

def test_me_valid_token(make_user, auth_headers):
    user = make_user(role="team_member", email="frank@example.com")

    resp = handler(make_event("GET", "/me", headers=auth_headers(user)))
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert body["user"] == {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": "team_member",
    }


def test_me_missing_authorization_header():
    resp = handler(make_event("GET", "/me"))
    assert resp["statusCode"] == 401


def test_me_malformed_token():
    resp = handler(make_event("GET", "/me", headers={"authorization": "Bearer garbage.token.value"}))
    assert resp["statusCode"] == 401


def test_me_deactivated_user(make_user, auth_headers, db_conn):
    user = make_user(role="viewer", email="grace@example.com", is_active=True)
    headers = auth_headers(user)

    with db_conn.cursor() as cur:
        cur.execute("UPDATE users SET is_active = false WHERE id = %s", (user["id"],))

    resp = handler(make_event("GET", "/me", headers=headers))
    assert resp["statusCode"] == 401


# ---------------------------------------------------------------------------
# Unknown routes
# ---------------------------------------------------------------------------

def test_unknown_route_returns_404():
    resp = handler(make_event("GET", "/does-not-exist"))
    assert resp["statusCode"] == 404


def test_unknown_method_returns_404():
    resp = handler(make_event("DELETE", "/login"))
    assert resp["statusCode"] == 404
