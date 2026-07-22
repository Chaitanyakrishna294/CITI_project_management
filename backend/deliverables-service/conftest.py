"""
Shared pytest fixtures for this service's test suite.

Tests run against the real local Postgres 'test' database (see db/schema.sql),
the same one the service connects to by default (host=localhost user=test
password=test dbname=test). Each test gets a clean slate via TRUNCATE.
"""
import os

import psycopg
import pytest
from psycopg.rows import dict_row

os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASS", "test")
os.environ.setdefault("POSTGRES_NAME", "test")
os.environ.setdefault("JWT_SECRET", "dev-secret-change-me")

PG_CONFIG = (
    f"host={os.environ['POSTGRES_HOST']} "
    f"port={os.environ['POSTGRES_PORT']} "
    f"user={os.environ['POSTGRES_USER']} "
    f"password={os.environ['POSTGRES_PASS']} "
    f"dbname={os.environ['POSTGRES_NAME']} "
    f"connect_timeout=15"
)

# Order matters for FK dependencies when not using CASCADE, but RESTART IDENTITY CASCADE
# handles it regardless -- listed leaf-first for readability.
TABLES = (
    "deliverable_dependencies",
    "resource_allocations",
    "budgets",
    "deliverables",
    "resources",
    "projects",
    "users",
)


@pytest.fixture
def pg_config():
    return PG_CONFIG


@pytest.fixture(autouse=True)
def clean_db():
    """Truncate all tables before every test so each test starts from an empty DB."""
    conn = psycopg.connect(PG_CONFIG, row_factory=dict_row, autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
        yield
    finally:
        conn.close()


@pytest.fixture
def db_conn():
    """A direct connection for tests to set up fixture rows or assert DB state."""
    conn = psycopg.connect(PG_CONFIG, row_factory=dict_row, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def _insert_user(conn, name, email, role, password_hash="x", is_active=True):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, is_active) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING *",
            (name, email, password_hash, role, is_active),
        )
        return cur.fetchone()


@pytest.fixture
def make_user(db_conn):
    """Factory fixture: make_user(role='admin', name=..., email=..., is_active=True) -> user row."""
    counter = {"n": 0}

    def _make(role="viewer", name=None, email=None, is_active=True, password_hash="x"):
        counter["n"] += 1
        name = name or f"{role.title()} {counter['n']}"
        email = email or f"{role}{counter['n']}@example.com"
        return _insert_user(db_conn, name, email, role, password_hash, is_active)

    return _make


@pytest.fixture
def token_for():
    """Factory fixture: token_for(user_row) -> JWT bearer token string for that user."""
    from auth_lib import issue_token

    def _token(user):
        return issue_token(user)

    return _token


@pytest.fixture
def auth_headers(token_for):
    """Factory fixture: auth_headers(user_row) -> headers dict with Authorization set."""

    def _headers(user):
        return {"authorization": f"Bearer {token_for(user)}"}

    return _headers


def make_event(method="GET", path="/", body=None, query=None, headers=None):
    """Build a Lambda Function-URL-style event dict for calling handler() directly."""
    import json as _json

    return {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "queryStringParameters": query or None,
        "headers": headers or {},
        "body": _json.dumps(body) if body is not None else None,
    }
