"""
Shared pytest fixtures for this service's test suite.

Tests run against the real local Postgres 'test' database (see db/schema.sql).
The service itself takes its connection settings and JWT secret strictly from
the environment, so the test-only values are set here before the service
modules are imported. Each test gets a clean slate via TRUNCATE.
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

# Listed leaf-first for readability; RESTART IDENTITY CASCADE handles FK order.
TABLES = (
    "achievements",
    "team_members",
    "teams",
    "individuals",
    "users",
)


@pytest.fixture
def pg_config():
    return PG_CONFIG


@pytest.fixture(autouse=True)
def clean_db():
    """Truncate this service's tables before every test."""
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
    """Factory fixture: make_user(role='admin', ...) -> user row (a login account)."""
    counter = {"n": 0}

    def _make(role="viewer", name=None, email=None, is_active=True, password_hash="x"):
        counter["n"] += 1
        name = name or f"{role.title()} {counter['n']}"
        email = email or f"{role}{counter['n']}@example.com"
        return _insert_user(db_conn, name, email, role, password_hash, is_active)

    return _make


@pytest.fixture
def make_individual(db_conn):
    """Factory fixture: make_individual(location='Austin', ...) -> individuals row."""
    counter = {"n": 0}

    def _make(name=None, email=None, location="Austin", is_direct_staff=True, is_org_leader=False):
        counter["n"] += 1
        name = name or f"Person {counter['n']}"
        email = email or f"person{counter['n']}@example.com"
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO individuals (name, email, location, is_direct_staff, is_org_leader) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING *",
                (name, email, location, is_direct_staff, is_org_leader),
            )
            return cur.fetchone()

    return _make


@pytest.fixture
def make_team(db_conn):
    """Factory fixture: make_team(location='Austin', leader=row, reports_to=row) -> teams row."""
    counter = {"n": 0}

    def _make(name=None, location="Austin", leader=None, reports_to=None):
        counter["n"] += 1
        name = name or f"Team {counter['n']}"
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO teams (name, location, leader_id, reports_to_id) "
                "VALUES (%s, %s, %s, %s) RETURNING *",
                (
                    name,
                    location,
                    leader["id"] if leader else None,
                    reports_to["id"] if reports_to else None,
                ),
            )
            return cur.fetchone()

    return _make


@pytest.fixture
def add_members(db_conn):
    """Factory fixture: add_members(team_row, individual_rows...) inserts memberships."""

    def _add(team, *individuals):
        with db_conn.cursor() as cur:
            for individual in individuals:
                cur.execute(
                    "INSERT INTO team_members (team_id, individual_id) VALUES (%s, %s)",
                    (team["id"], individual["id"]),
                )

    return _add


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
