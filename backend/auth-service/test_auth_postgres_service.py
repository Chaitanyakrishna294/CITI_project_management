"""
Direct tests for postgres_service.py against the real local Postgres DB.
"""
from postgres_service import get_user_by_email, get_user_by_id


def test_get_user_by_email_found(pg_config, make_user):
    user = make_user(role="finance", email="hank@example.com", password_hash="hashed-pw")

    result = get_user_by_email(pg_config, "hank@example.com")

    assert result is not None
    assert result["id"] == user["id"]
    assert result["email"] == "hank@example.com"
    assert result["name"] == user["name"]
    assert result["role"] == "finance"
    assert result["is_active"] is True
    assert result["password_hash"] == "hashed-pw"


def test_get_user_by_email_not_found(pg_config):
    result = get_user_by_email(pg_config, "nobody@example.com")
    assert result is None


def test_get_user_by_email_includes_inactive_users(pg_config, make_user):
    """get_user_by_email must return inactive users too -- the caller
    (function.py's _login) is responsible for rejecting them."""
    make_user(email="inactive@example.com", is_active=False)

    result = get_user_by_email(pg_config, "inactive@example.com")

    assert result is not None
    assert result["is_active"] is False


def test_get_user_by_id_found(pg_config, make_user):
    user = make_user(role="admin", email="ivy@example.com")

    result = get_user_by_id(pg_config, user["id"])

    assert result is not None
    assert result["id"] == user["id"]
    assert result["email"] == "ivy@example.com"
    assert result["role"] == "admin"
    assert result["is_active"] is True


def test_get_user_by_id_not_found(pg_config):
    result = get_user_by_id(pg_config, 999999)
    assert result is None


def test_get_user_by_id_does_not_return_password_hash(pg_config, make_user):
    """get_user_by_id is used for /me lookups and should not select password_hash."""
    make_user(email="jill@example.com", password_hash="super-secret-hash")
    user = get_user_by_email(pg_config, "jill@example.com")

    result = get_user_by_id(pg_config, user["id"])

    assert "password_hash" not in result
