"""
Direct tests of postgres_service.py functions against the real test DB.
"""
from postgres_service import (
    create_user,
    deactivate_user,
    get_user,
    get_user_by_email,
    list_users,
    update_user,
)


def test_create_user(pg_config):
    user = create_user(pg_config, "Alice", "alice@example.com", "hashedpw", "admin")
    assert user["id"] is not None
    assert user["name"] == "Alice"
    assert user["email"] == "alice@example.com"
    assert user["role"] == "admin"
    assert user["is_active"] is True
    assert "password_hash" not in user


def test_list_users_empty(pg_config):
    assert list_users(pg_config) == []


def test_list_users_returns_all_ordered_by_created_at_desc(pg_config, make_user):
    first = make_user(role="viewer")
    second = make_user(role="admin")
    third = make_user(role="finance")

    users = list_users(pg_config)
    ids = [u["id"] for u in users]
    assert set(ids) == {first["id"], second["id"], third["id"]}
    # most recently created first
    assert ids[0] == third["id"]
    assert ids[-1] == first["id"]


def test_get_user_existing(pg_config, make_user):
    target = make_user(role="team_member")
    user = get_user(pg_config, target["id"])
    assert user["id"] == target["id"]
    assert user["email"] == target["email"]


def test_get_user_missing(pg_config):
    assert get_user(pg_config, 999999) is None


def test_get_user_by_email_existing(pg_config, make_user):
    target = make_user(role="viewer", email="findme@example.com")
    found = get_user_by_email(pg_config, "findme@example.com")
    assert found is not None
    assert found["id"] == target["id"]


def test_get_user_by_email_missing(pg_config):
    assert get_user_by_email(pg_config, "nobody@example.com") is None


def test_update_user_single_field(pg_config, make_user):
    target = make_user(role="viewer", name="Original")
    updated = update_user(pg_config, target["id"], {"name": "Updated"})
    assert updated["name"] == "Updated"
    assert updated["role"] == "viewer"


def test_update_user_multiple_fields(pg_config, make_user):
    target = make_user(role="viewer", is_active=True)
    updated = update_user(pg_config, target["id"], {"role": "finance", "is_active": False})
    assert updated["role"] == "finance"
    assert updated["is_active"] is False


def test_update_user_no_fields_returns_current(pg_config, make_user):
    target = make_user(role="viewer", name="Unchanged")
    result = update_user(pg_config, target["id"], {})
    assert result["id"] == target["id"]
    assert result["name"] == "Unchanged"


def test_deactivate_user(pg_config, make_user):
    target = make_user(role="viewer", is_active=True)
    result = deactivate_user(pg_config, target["id"])
    assert result["is_active"] is False

    refetched = get_user(pg_config, target["id"])
    assert refetched["is_active"] is False
