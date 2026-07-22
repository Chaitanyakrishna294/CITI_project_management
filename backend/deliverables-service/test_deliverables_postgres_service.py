"""
Direct tests of postgres_service.py functions against the real database.
"""
import pytest

from postgres_service import (
    add_dependency,
    create_deliverable,
    delete_deliverable,
    get_active_user,
    get_deliverable,
    get_project,
    list_dependencies,
    list_deliverables,
    remove_dependency,
    update_deliverable,
)


def _make_project(db_conn, manager_id, status="active", name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, status, manager_id) VALUES (%s, %s, %s) RETURNING *",
            (name, status, manager_id),
        )
        return cur.fetchone()


def _make_deliverable_row(db_conn, project_id, title="Deliverable", owner_id=None, status="not_started"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO deliverables (project_id, title, owner_id, status) "
            "VALUES (%s, %s, %s, %s) RETURNING *",
            (project_id, title, owner_id, status),
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# get_project / get_active_user
# ---------------------------------------------------------------------------

def test_get_project_found(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])

    result = get_project(pg_config, project["id"])
    assert result["id"] == project["id"]
    assert result["manager_id"] == manager["id"]
    assert result["status"] == "active"


def test_get_project_not_found(pg_config):
    assert get_project(pg_config, 999999) is None


def test_get_active_user_found(pg_config, make_user):
    user = make_user(role="team_member", is_active=True)
    result = get_active_user(pg_config, user["id"])
    assert result["id"] == user["id"]
    assert result["is_active"] is True


def test_get_active_user_inactive(pg_config, make_user):
    user = make_user(role="team_member", is_active=False)
    result = get_active_user(pg_config, user["id"])
    assert result["id"] == user["id"]
    assert result["is_active"] is False


def test_get_active_user_not_found(pg_config):
    assert get_active_user(pg_config, 999999) is None


# ---------------------------------------------------------------------------
# create_deliverable / get_deliverable
# ---------------------------------------------------------------------------

def test_create_and_get_deliverable(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])

    created = create_deliverable(pg_config, project["id"], "New deliverable", "desc", owner["id"], None)
    assert created["title"] == "New deliverable"
    assert created["description"] == "desc"
    assert created["owner_id"] == owner["id"]
    assert created["owner_name"] == owner["name"]
    assert created["status"] == "not_started"

    fetched = get_deliverable(pg_config, created["id"])
    assert fetched["id"] == created["id"]


def test_get_deliverable_not_found(pg_config):
    assert get_deliverable(pg_config, 999999) is None


# ---------------------------------------------------------------------------
# list_deliverables filters
# ---------------------------------------------------------------------------

def test_list_deliverables_no_filters(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    _make_deliverable_row(db_conn, project["id"], title="A")
    _make_deliverable_row(db_conn, project["id"], title="B")

    result = list_deliverables(pg_config, {})
    assert len(result) == 2


def test_list_deliverables_by_project_id(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project1 = _make_project(db_conn, manager["id"], name="P1")
    project2 = _make_project(db_conn, manager["id"], name="P2")
    _make_deliverable_row(db_conn, project1["id"], title="A")
    _make_deliverable_row(db_conn, project2["id"], title="B")

    result = list_deliverables(pg_config, {"project_id": project1["id"]})
    assert len(result) == 1
    assert result[0]["title"] == "A"


def test_list_deliverables_by_status(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    _make_deliverable_row(db_conn, project["id"], title="A", status="in_progress")
    _make_deliverable_row(db_conn, project["id"], title="B", status="blocked")

    result = list_deliverables(pg_config, {"status": "blocked"})
    assert len(result) == 1
    assert result[0]["title"] == "B"


def test_list_deliverables_by_owner_id(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    owner = make_user(role="team_member")
    project = _make_project(db_conn, manager["id"])
    _make_deliverable_row(db_conn, project["id"], title="A", owner_id=owner["id"])
    _make_deliverable_row(db_conn, project["id"], title="B")

    result = list_deliverables(pg_config, {"owner_id": owner["id"]})
    assert len(result) == 1
    assert result[0]["title"] == "A"


def test_list_deliverables_by_q(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    _make_deliverable_row(db_conn, project["id"], title="Alpha report")
    _make_deliverable_row(db_conn, project["id"], title="Beta plan")

    result = list_deliverables(pg_config, {"q": "alpha"})
    assert len(result) == 1
    assert result[0]["title"] == "Alpha report"


# ---------------------------------------------------------------------------
# update_deliverable
# ---------------------------------------------------------------------------

def test_update_deliverable_fields(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable_row(db_conn, project["id"], title="Old")

    updated = update_deliverable(pg_config, deliverable["id"], {"title": "New", "status": "in_progress"})
    assert updated["title"] == "New"
    assert updated["status"] == "in_progress"


def test_update_deliverable_no_fields_returns_current(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable_row(db_conn, project["id"], title="Unchanged")

    result = update_deliverable(pg_config, deliverable["id"], {})
    assert result["title"] == "Unchanged"


# ---------------------------------------------------------------------------
# delete_deliverable
# ---------------------------------------------------------------------------

def test_delete_deliverable(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    deliverable = _make_deliverable_row(db_conn, project["id"])

    assert delete_deliverable(pg_config, deliverable["id"]) is True
    assert get_deliverable(pg_config, deliverable["id"]) is None


def test_delete_deliverable_not_found(pg_config):
    assert delete_deliverable(pg_config, 999999) is False


# ---------------------------------------------------------------------------
# dependencies
# ---------------------------------------------------------------------------

def test_add_and_list_dependencies(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable_row(db_conn, project["id"], title="D1")
    d2 = _make_deliverable_row(db_conn, project["id"], title="D2")

    dep_id = add_dependency(pg_config, d1["id"], d2["id"])
    assert dep_id is not None

    deps = list_dependencies(pg_config, d1["id"])
    assert len(deps) == 1
    assert deps[0]["depends_on_deliverable_id"] == d2["id"]
    assert deps[0]["title"] == "D2"


def test_add_dependency_duplicate_raises(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable_row(db_conn, project["id"], title="D1")
    d2 = _make_deliverable_row(db_conn, project["id"], title="D2")

    add_dependency(pg_config, d1["id"], d2["id"])
    with pytest.raises(Exception):
        add_dependency(pg_config, d1["id"], d2["id"])


def test_remove_dependency(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable_row(db_conn, project["id"], title="D1")
    d2 = _make_deliverable_row(db_conn, project["id"], title="D2")
    dep_id = add_dependency(pg_config, d1["id"], d2["id"])

    assert remove_dependency(pg_config, d1["id"], dep_id) is True
    assert list_dependencies(pg_config, d1["id"]) == []


def test_remove_dependency_not_found(pg_config, db_conn, make_user):
    manager = make_user(role="project_manager")
    project = _make_project(db_conn, manager["id"])
    d1 = _make_deliverable_row(db_conn, project["id"], title="D1")

    assert remove_dependency(pg_config, d1["id"], 999999) is False
