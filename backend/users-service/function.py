"""
Users service: admin-only user management (RBAC-gated CRUD).

Routes (relative to this Lambda's Function URL, e.g. /api/users-service/...):
    GET    /users        -> list users
    POST   /users         { name, email, password, role } -> create user
    GET    /users/{id}    -> get one user
    PUT    /users/{id}     { name?, role?, is_active? } -> update user
    DELETE /users/{id}    -> deactivate user (soft delete)

All routes require an authenticated Admin.
"""

import json
import logging
import os

from auth_lib import authenticate, hash_password, require_role
from postgres_service import (
    VALID_ROLES,
    create_user,
    deactivate_user,
    get_user,
    get_user_by_email,
    list_users,
    update_user,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'test')} "
    f"password={os.getenv('POSTGRES_PASS', 'test')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'test')} "
    f"connect_timeout=15"
)


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _parse_path(path):
    """/users -> (None,); /users/5 -> (5,)"""
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "users":
        try:
            return int(parts[1])
        except ValueError:
            return None
    return None


def _list(event):
    return _response(200, {"users": list_users(PG_CONFIG)})


def _create(event):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = body.get("role") or "viewer"

    if not name or not email or not password:
        return _response(400, {"error": "name, email and password are required"})
    if role not in VALID_ROLES:
        return _response(400, {"error": f"role must be one of {sorted(VALID_ROLES)}"})
    if get_user_by_email(PG_CONFIG, email):
        return _response(409, {"error": "A user with this email already exists"})

    user = create_user(PG_CONFIG, name, email, hash_password(password), role)
    return _response(201, {"user": user})


def _get(user_id):
    user = get_user(PG_CONFIG, user_id)
    if not user:
        return _response(404, {"error": "User not found"})
    return _response(200, {"user": user})


def _update(event, user_id):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    fields = {}
    if "name" in body:
        fields["name"] = (body["name"] or "").strip()
    if "role" in body:
        if body["role"] not in VALID_ROLES:
            return _response(400, {"error": f"role must be one of {sorted(VALID_ROLES)}"})
        fields["role"] = body["role"]
    if "is_active" in body:
        fields["is_active"] = bool(body["is_active"])

    if not get_user(PG_CONFIG, user_id):
        return _response(404, {"error": "User not found"})

    user = update_user(PG_CONFIG, user_id, fields)
    return _response(200, {"user": user})


def _deactivate(user_id):
    if not get_user(PG_CONFIG, user_id):
        return _response(404, {"error": "User not found"})
    user = deactivate_user(PG_CONFIG, user_id)
    return _response(200, {"user": user})


def handler(event=None, context=None):
    logger.debug("Received event: %s", event)
    event = event or {}
    http_ctx = (event.get("requestContext") or {}).get("http") or {}
    method = http_ctx.get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", "/")

    claims = authenticate(event)
    if not require_role(claims, {"admin"}):
        return _response(403, {"error": "Admin role required"})

    try:
        user_id = _parse_path(path)

        if method == "GET" and user_id is None:
            return _list(event)
        if method == "POST" and user_id is None:
            return _create(event)
        if method == "GET" and user_id is not None:
            return _get(user_id)
        if method == "PUT" and user_id is not None:
            return _update(event, user_id)
        if method == "DELETE" and user_id is not None:
            return _deactivate(user_id)

        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/users", "headers": {}}))
