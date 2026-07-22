"""
JWT and password utilities shared by every backend service.

Any other service under backend/ that needs to authenticate/authorize a
request should copy this file into its own folder (each Lambda service is a
self-contained deployment unit — see backend/README.md).
"""

import os
import time
import bcrypt
import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_TTL_SECONDS = 8 * 60 * 60  # 8 hours


def hash_password(plain_password):
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password, password_hash):
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def issue_token(user):
    now = int(time.time())
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    """Return the decoded claims, or None if the token is missing/invalid/expired."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def get_bearer_token(event):
    headers = (event or {}).get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def authenticate(event):
    """Return decoded JWT claims for the request, or None if unauthenticated."""
    token = get_bearer_token(event)
    if not token:
        return None
    return decode_token(token)


def require_role(claims, allowed_roles):
    """Return True if the authenticated user's role is permitted."""
    return bool(claims) and claims.get("role") in allowed_roles
