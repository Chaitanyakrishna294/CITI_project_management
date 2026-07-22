"""
Direct tests of postgres_service functions against the real DB.
"""
from postgres_service import (
    create_allocation,
    create_resource,
    delete_allocation,
    get_allocation,
    get_resource,
    get_resource_allocation_total,
    get_resource_by_user,
    list_allocations,
    list_resources,
    update_allocation,
    update_resource,
)


def _make_user(db_conn, name="User", email=None, role="team_member", is_active=True):
    email = email or f"{name.lower().replace(' ', '.')}@example.com"
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, is_active) "
            "VALUES (%s, %s, 'x', %s, %s) RETURNING *",
            (name, email, role, is_active),
        )
        return cur.fetchone()


def _make_project(db_conn, manager_id, name="Project"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, manager_id) VALUES (%s, %s) RETURNING *",
            (name, manager_id),
        )
        return cur.fetchone()


# ---- resources --------------------------------------------------------

def test_create_and_get_resource(pg_config, db_conn):
    user = _make_user(db_conn, name="Alice")
    created = create_resource(pg_config, user["id"], "Engineer", "Eng", 90.00)
    assert created["user_id"] == user["id"]
    assert created["title"] == "Engineer"
    assert float(created["weekly_capacity"]) == 90.00
    assert float(created["total_allocation_pct"]) == 0.0

    fetched = get_resource(pg_config, created["id"])
    assert fetched["id"] == created["id"]
    assert fetched["user_name"] == "Alice"


def test_get_resource_not_found_returns_none(pg_config):
    assert get_resource(pg_config, 999999) is None


def test_get_resource_by_user(pg_config, db_conn):
    user = _make_user(db_conn)
    assert get_resource_by_user(pg_config, user["id"]) is None
    created = create_resource(pg_config, user["id"], "Title", "Dept", 100.00)
    found = get_resource_by_user(pg_config, user["id"])
    assert found["id"] == created["id"]


def test_list_resources_filters(pg_config, db_conn):
    u1 = _make_user(db_conn, name="Alice Smith")
    u2 = _make_user(db_conn, name="Bob Jones")
    create_resource(pg_config, u1["id"], "Dev", "Finance", 100.00)
    create_resource(pg_config, u2["id"], "Analyst", "Engineering", 100.00)

    all_resources = list_resources(pg_config, {})
    assert len(all_resources) == 2

    q_filtered = list_resources(pg_config, {"q": "Alice"})
    assert len(q_filtered) == 1
    assert q_filtered[0]["user_name"] == "Alice Smith"

    dept_filtered = list_resources(pg_config, {"department": "Engineering"})
    assert len(dept_filtered) == 1
    assert dept_filtered[0]["user_name"] == "Bob Jones"


def test_update_resource_partial_fields(pg_config, db_conn):
    user = _make_user(db_conn)
    resource = create_resource(pg_config, user["id"], "Old", "OldDept", 100.00)

    updated = update_resource(pg_config, resource["id"], {"title": "New"})
    assert updated["title"] == "New"
    assert updated["department"] == "OldDept"

    updated2 = update_resource(pg_config, resource["id"], {})
    assert updated2["title"] == "New"


# ---- allocations --------------------------------------------------------

def test_create_and_get_allocation(pg_config, db_conn):
    user = _make_user(db_conn)
    manager = _make_user(db_conn, name="Manager", role="project_manager")
    resource = create_resource(pg_config, user["id"], "Dev", "Eng", 100.00)
    project = _make_project(db_conn, manager["id"])

    allocation = create_allocation(pg_config, resource["id"], project["id"], 40, None, None)
    assert allocation["resource_id"] == resource["id"]
    assert allocation["project_id"] == project["id"]
    assert float(allocation["allocation_pct"]) == 40.0

    fetched = get_allocation(pg_config, allocation["id"])
    assert fetched["id"] == allocation["id"]


def test_get_allocation_not_found_returns_none(pg_config):
    assert get_allocation(pg_config, 999999) is None


def test_list_allocations_filters(pg_config, db_conn):
    user1 = _make_user(db_conn, name="U1")
    user2 = _make_user(db_conn, name="U2")
    manager = _make_user(db_conn, name="Manager", role="project_manager")
    resource1 = create_resource(pg_config, user1["id"], "R1", "Eng", 100.00)
    resource2 = create_resource(pg_config, user2["id"], "R2", "Eng", 100.00)
    project1 = _make_project(db_conn, manager["id"], "P1")
    project2 = _make_project(db_conn, manager["id"], "P2")

    create_allocation(pg_config, resource1["id"], project1["id"], 30, None, None)
    create_allocation(pg_config, resource2["id"], project2["id"], 20, None, None)

    by_resource = list_allocations(pg_config, {"resource_id": resource1["id"]})
    assert len(by_resource) == 1
    assert by_resource[0]["resource_id"] == resource1["id"]

    by_project = list_allocations(pg_config, {"project_id": project2["id"]})
    assert len(by_project) == 1
    assert by_project[0]["project_id"] == project2["id"]

    all_allocations = list_allocations(pg_config, {})
    assert len(all_allocations) == 2


def test_get_resource_allocation_total(pg_config, db_conn):
    user = _make_user(db_conn)
    manager = _make_user(db_conn, name="Manager", role="project_manager")
    resource = create_resource(pg_config, user["id"], "Dev", "Eng", 100.00)
    project1 = _make_project(db_conn, manager["id"], "P1")
    project2 = _make_project(db_conn, manager["id"], "P2")

    assert float(get_resource_allocation_total(pg_config, resource["id"])) == 0.0

    alloc1 = create_allocation(pg_config, resource["id"], project1["id"], 30, None, None)
    create_allocation(pg_config, resource["id"], project2["id"], 20, None, None)

    total = get_resource_allocation_total(pg_config, resource["id"])
    assert float(total) == 50.0

    # excluding alloc1 should only count the other allocation (20)
    total_excl = get_resource_allocation_total(
        pg_config, resource["id"], exclude_allocation_id=alloc1["id"]
    )
    assert float(total_excl) == 20.0


def test_update_allocation_fields(pg_config, db_conn):
    user = _make_user(db_conn)
    manager = _make_user(db_conn, name="Manager", role="project_manager")
    resource = create_resource(pg_config, user["id"], "Dev", "Eng", 100.00)
    project = _make_project(db_conn, manager["id"])
    allocation = create_allocation(pg_config, resource["id"], project["id"], 30, None, None)

    updated = update_allocation(pg_config, allocation["id"], {"allocation_pct": 55})
    assert float(updated["allocation_pct"]) == 55.0

    unchanged = update_allocation(pg_config, allocation["id"], {})
    assert float(unchanged["allocation_pct"]) == 55.0


def test_delete_allocation(pg_config, db_conn):
    user = _make_user(db_conn)
    manager = _make_user(db_conn, name="Manager", role="project_manager")
    resource = create_resource(pg_config, user["id"], "Dev", "Eng", 100.00)
    project = _make_project(db_conn, manager["id"])
    allocation = create_allocation(pg_config, resource["id"], project["id"], 30, None, None)

    assert delete_allocation(pg_config, allocation["id"]) is True
    assert get_allocation(pg_config, allocation["id"]) is None
    assert delete_allocation(pg_config, allocation["id"]) is False
