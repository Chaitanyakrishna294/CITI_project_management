"""
Auth service: login, logout, and current-user lookup with JWT + RBAC.

Routes (relative to this Lambda's Function URL, e.g. /api/auth-service/...):
    POST /login   { email, password } -> { token, user }
    POST /logout  -> { message }
    GET  /me      (Authorization: Bearer <token>) -> { user }
"""

import json
import logging
import os

from auth_lib import authenticate, issue_token, verify_password
from postgres_service import get_user_by_email, get_user_by_id

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
        "body": json.dumps(payload),
    }


def _public_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }


def _login(event):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        return _response(400, {"error": "email and password are required"})

    user = get_user_by_email(PG_CONFIG, email)
    if not user or not user["is_active"] or not verify_password(password, user["password_hash"]):
        return _response(401, {"error": "Invalid email or password"})

    token = issue_token(user)
    return _response(200, {"token": token, "user": _public_user(user)})


def _logout():
    # JWTs are stateless; the client simply discards the token.
    return _response(200, {"message": "Logged out"})


def _me(event):
    claims = authenticate(event)
    if not claims:
        return _response(401, {"error": "Missing or invalid token"})

    user = get_user_by_id(PG_CONFIG, int(claims["sub"]))
    if not user or not user["is_active"]:
        return _response(401, {"error": "User not found or inactive"})

    return _response(200, {"user": _public_user(user)})


def handler(event=None, context=None):
    logger.debug("Received event: %s", event)
    event = event or {}
    http_ctx = (event.get("requestContext") or {}).get("http") or {}
    method = http_ctx.get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", "/")

    try:
        if method == "POST" and path.rstrip("/") == "/login":
            return _login(event)
        if method == "POST" and path.rstrip("/") == "/logout":
            return _logout()
        if method == "GET" and path.rstrip("/") == "/me":
            return _me(event)
        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    # Local smoke check only. The password below is deliberately invalid -- this
    # asserts that a bad credential is rejected, so it is not a secret.
    print(handler({"requestContext": {"http": {"method": "POST"}}, "rawPath": "/login",
                    "body": json.dumps({"email": "admin@acme.com",
                                        "password": "wrong"})}))  # nosec B105 - deliberately invalid credential
