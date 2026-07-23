"""
Direct tests of postgres_service.py functions against the real DB.
"""
from postgres_service import (
    archive_project,
    create_project,
    get_active_manager,
    get_project,
    list_projects,
    update_project,
)


def test_create_project(pg_config, make_user):
    manager = make_user(role="project_manager")
    project = create_project(
        pg_config, "New Proj", "desc", manager["id"], "Engineering", "2026-01-01", "2026-06-01"
    )
    assert project["name"] == "New Proj"
    assert project["description"] == "desc"
    assert project["manager_id"] == manager["id"]
    assert project["department"] == "Engineering"
    assert str(project["start_date"]) == "2026-01-01"
    assert str(project["end_date"]) == "2026-06-01"
    assert project["status"] == "active"


def test_create_project_with_metadata_round_trips(pg_config, make_user):
    manager = make_user(role="project_manager")
    metadata = {"Client Contact": "bob@client.com", "original_status": "In Progress"}
    created = create_project(
        pg_config, "Meta Proj", None, manager["id"], None, None, None, metadata
    )
    assert created["metadata"] == metadata
    assert get_project(pg_config, created["id"])["metadata"] == metadata


def test_create_project_without_metadata_defaults_to_empty(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(pg_config, "No Meta", None, manager["id"], None, None, None)
    assert created["metadata"] == {}


def test_get_project(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(pg_config, "Get Me", None, manager["id"], None, None, None)
    fetched = get_project(pg_config, created["id"])
    assert fetched["id"] == created["id"]
    assert fetched["name"] == "Get Me"
    assert fetched["manager_name"] == manager["name"]


def test_get_project_missing_returns_none(pg_config):
    assert get_project(pg_config, 999999) is None


def test_get_active_manager(pg_config, make_user):
    manager = make_user(role="project_manager")
    result = get_active_manager(pg_config, manager["id"])
    assert result["id"] == manager["id"]
    assert result["role"] == "project_manager"
    assert result["is_active"] is True


def test_get_active_manager_missing_returns_none(pg_config):
    assert get_active_manager(pg_config, 999999) is None


def test_update_project(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(pg_config, "Before", None, manager["id"], None, None, None)
    updated = update_project(pg_config, created["id"], {"name": "After", "department": "Sales"})
    assert updated["name"] == "After"
    assert updated["department"] == "Sales"


def test_update_project_metadata(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(
        pg_config, "Meta Update", None, manager["id"], None, None, None, {"Region": "EMEA"}
    )
    updated = update_project(pg_config, created["id"], {"metadata": {"Region": "APAC"}})
    assert updated["metadata"] == {"Region": "APAC"}


def test_update_project_no_fields_returns_current(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(pg_config, "Unchanged", None, manager["id"], None, None, None)
    result = update_project(pg_config, created["id"], {})
    assert result["name"] == "Unchanged"


def test_update_project_missing_returns_none(pg_config):
    assert update_project(pg_config, 999999, {"name": "Nope"}) is None


def test_archive_project(pg_config, make_user):
    manager = make_user(role="project_manager")
    created = create_project(pg_config, "To Archive", None, manager["id"], None, None, None)
    archived = archive_project(pg_config, created["id"])
    assert archived["status"] == "archived"


def test_list_projects_no_filters(pg_config, make_user):
    manager = make_user(role="project_manager")
    create_project(pg_config, "P1", None, manager["id"], None, None, None)
    create_project(pg_config, "P2", None, manager["id"], None, None, None)
    results = list_projects(pg_config, {})
    assert len(results) == 2


def test_list_projects_includes_metadata(pg_config, make_user):
    manager = make_user(role="project_manager")
    create_project(
        pg_config, "Meta List", None, manager["id"], None, None, None, {"Region": "EMEA"}
    )
    results = list_projects(pg_config, {})
    assert results[0]["metadata"] == {"Region": "EMEA"}


def test_list_projects_filter_by_status(pg_config, make_user):
    manager = make_user(role="project_manager")
    p1 = create_project(pg_config, "Active One", None, manager["id"], None, None, None)
    p2 = create_project(pg_config, "Will Archive", None, manager["id"], None, None, None)
    archive_project(pg_config, p2["id"])

    active_results = list_projects(pg_config, {"status": "active"})
    assert [p["id"] for p in active_results] == [p1["id"]]

    archived_results = list_projects(pg_config, {"status": "archived"})
    assert [p["id"] for p in archived_results] == [p2["id"]]


def test_list_projects_filter_by_manager_id(pg_config, make_user):
    manager1 = make_user(role="project_manager")
    manager2 = make_user(role="project_manager")
    p1 = create_project(pg_config, "M1 Proj", None, manager1["id"], None, None, None)
    create_project(pg_config, "M2 Proj", None, manager2["id"], None, None, None)

    results = list_projects(pg_config, {"manager_id": manager1["id"]})
    assert [p["id"] for p in results] == [p1["id"]]


def test_list_projects_filter_by_department(pg_config, make_user):
    manager = make_user(role="project_manager")
    p1 = create_project(pg_config, "Eng Proj", None, manager["id"], "Engineering", None, None)
    create_project(pg_config, "Sales Proj", None, manager["id"], "Sales", None, None)

    results = list_projects(pg_config, {"department": "Engineering"})
    assert [p["id"] for p in results] == [p1["id"]]


def test_list_projects_filter_by_date_from(pg_config, make_user):
    manager = make_user(role="project_manager")
    p1 = create_project(pg_config, "Late Start", None, manager["id"], None, "2026-06-01", None)
    create_project(pg_config, "Early Start", None, manager["id"], None, "2026-01-01", None)

    results = list_projects(pg_config, {"date_from": "2026-03-01"})
    assert [p["id"] for p in results] == [p1["id"]]


def test_list_projects_filter_by_date_to(pg_config, make_user):
    manager = make_user(role="project_manager")
    create_project(pg_config, "Late End", None, manager["id"], None, None, "2026-12-01")
    p2 = create_project(pg_config, "Early End", None, manager["id"], None, None, "2026-02-01")

    results = list_projects(pg_config, {"date_to": "2026-03-01"})
    assert [p["id"] for p in results] == [p2["id"]]


def test_list_projects_filter_by_q(pg_config, make_user):
    manager = make_user(role="project_manager")
    p1 = create_project(
        pg_config, "Website Redesign", "revamp the homepage", manager["id"], None, None, None
    )
    create_project(pg_config, "Mobile App", "build an app", manager["id"], None, None, None)

    by_name = list_projects(pg_config, {"q": "website"})
    assert [p["id"] for p in by_name] == [p1["id"]]

    by_description = list_projects(pg_config, {"q": "homepage"})
    assert [p["id"] for p in by_description] == [p1["id"]]
