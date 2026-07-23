"""
Handler-level tests for the teams service: auth gating, CRUD flows for
individuals/teams/members/achievements, and the insights rollup.
"""
import json

from conftest import make_event
from function import handler


def _call(method, path, user=None, auth_headers=None, body=None, query=None):
    headers = auth_headers(user) if user is not None else {}
    event = make_event(method=method, path=path, body=body, query=query, headers=headers)
    response = handler(event)
    return response["statusCode"], json.loads(response["body"])


# --- Auth ------------------------------------------------------------------


def test_unauthenticated_requests_are_rejected():
    status, body = _call("GET", "/teams")
    assert status == 401
    assert "error" in body


def test_any_authenticated_role_can_read(make_user, auth_headers):
    viewer = make_user(role="viewer")
    status, body = _call("GET", "/teams", viewer, auth_headers)
    assert status == 200
    assert body == {"teams": []}


def test_viewer_cannot_write(make_user, auth_headers):
    viewer = make_user(role="viewer")
    status, body = _call(
        "POST", "/teams", viewer, auth_headers, body={"name": "X", "location": "Austin"}
    )
    assert status == 403


def test_project_manager_can_write(make_user, auth_headers):
    pm = make_user(role="project_manager")
    status, body = _call(
        "POST", "/teams", pm, auth_headers, body={"name": "X", "location": "Austin"}
    )
    assert status == 201


def test_unknown_route_404s(make_user, auth_headers):
    admin = make_user(role="admin")
    status, _ = _call("GET", "/nonsense", admin, auth_headers)
    assert status == 404


# --- Individuals -----------------------------------------------------------


def test_individual_crud_roundtrip(make_user, auth_headers):
    admin = make_user(role="admin")

    status, body = _call(
        "POST",
        "/individuals",
        admin,
        auth_headers,
        body={
            "name": "Nia Park",
            "email": "Nia@Example.com",
            "location": "Austin",
            "is_direct_staff": False,
            "metadata": {"skills": "SQL"},
        },
    )
    assert status == 201
    individual = body["individual"]
    assert individual["email"] == "nia@example.com"  # normalized
    assert individual["is_direct_staff"] is False
    assert individual["metadata"] == {"skills": "SQL"}

    status, body = _call("GET", f"/individuals/{individual['id']}", admin, auth_headers)
    assert status == 200

    status, body = _call(
        "PUT",
        f"/individuals/{individual['id']}",
        admin,
        auth_headers,
        body={"location": "Berlin", "is_org_leader": True},
    )
    assert status == 200
    assert body["individual"]["location"] == "Berlin"
    assert body["individual"]["is_org_leader"] is True

    status, body = _call("DELETE", f"/individuals/{individual['id']}", admin, auth_headers)
    assert status == 200
    status, _ = _call("GET", f"/individuals/{individual['id']}", admin, auth_headers)
    assert status == 404


def test_individual_requires_name_and_location(make_user, auth_headers):
    admin = make_user(role="admin")
    status, body = _call("POST", "/individuals", admin, auth_headers, body={"name": "X"})
    assert status == 400


def test_individual_duplicate_email_conflicts(make_user, auth_headers, make_individual):
    admin = make_user(role="admin")
    make_individual(email="taken@example.com")
    status, body = _call(
        "POST",
        "/individuals",
        admin,
        auth_headers,
        body={"name": "Dup", "email": "taken@example.com", "location": "Austin"},
    )
    assert status == 409


def test_individual_search_filters_by_name_and_location(
    make_user, auth_headers, make_individual
):
    admin = make_user(role="admin")
    make_individual(name="Alice Berlin", location="Berlin")
    make_individual(name="Bob Austin", location="Austin")

    status, body = _call(
        "GET", "/individuals", admin, auth_headers, query={"search": "berlin"}
    )
    assert status == 200
    assert [i["name"] for i in body["individuals"]] == ["Alice Berlin"]


def test_individual_metadata_must_be_object(make_user, auth_headers):
    admin = make_user(role="admin")
    status, _ = _call(
        "POST",
        "/individuals",
        admin,
        auth_headers,
        body={"name": "X", "location": "Austin", "metadata": ["not", "an", "object"]},
    )
    assert status == 400


# --- Teams -----------------------------------------------------------------


def test_team_crud_roundtrip(make_user, auth_headers, make_individual):
    admin = make_user(role="admin")
    leader = make_individual(name="Lead", location="London")

    status, body = _call(
        "POST",
        "/teams",
        admin,
        auth_headers,
        body={"name": "Atlas", "location": "Austin", "leader_id": leader["id"]},
    )
    assert status == 201
    team = body["team"]
    assert team["leader_name"] == "Lead"
    assert team["member_count"] == 0

    status, body = _call(
        "PUT", f"/teams/{team['id']}", admin, auth_headers, body={"location": "Berlin"}
    )
    assert status == 200
    assert body["team"]["location"] == "Berlin"

    status, body = _call("DELETE", f"/teams/{team['id']}", admin, auth_headers)
    assert status == 200
    status, _ = _call("GET", f"/teams/{team['id']}", admin, auth_headers)
    assert status == 404


def test_team_duplicate_name_conflicts(make_user, auth_headers, make_team):
    admin = make_user(role="admin")
    make_team(name="Atlas")
    status, _ = _call(
        "POST", "/teams", admin, auth_headers, body={"name": "Atlas", "location": "X"}
    )
    assert status == 409


def test_team_leader_must_exist(make_user, auth_headers):
    admin = make_user(role="admin")
    status, body = _call(
        "POST",
        "/teams",
        admin,
        auth_headers,
        body={"name": "Atlas", "location": "Austin", "leader_id": 999},
    )
    assert status == 400
    assert "leader_id" in body["error"]


def test_get_team_includes_members_and_achievements(
    make_user, auth_headers, make_individual, make_team, add_members
):
    admin = make_user(role="admin")
    member = make_individual(name="Member One")
    team = make_team(name="Atlas")
    add_members(team, member)

    status, _ = _call(
        "POST",
        f"/teams/{team['id']}/achievements",
        admin,
        auth_headers,
        body={"month": "2026-06", "title": "Shipped it"},
    )
    assert status == 201

    status, body = _call("GET", f"/teams/{team['id']}", admin, auth_headers)
    assert status == 200
    assert [m["name"] for m in body["team"]["members"]] == ["Member One"]
    assert [a["title"] for a in body["team"]["achievements"]] == ["Shipped it"]


# --- Members ---------------------------------------------------------------


def test_add_and_remove_member(make_user, auth_headers, make_individual, make_team):
    admin = make_user(role="admin")
    person = make_individual(name="Joiner")
    team = make_team()

    status, body = _call(
        "POST",
        f"/teams/{team['id']}/members",
        admin,
        auth_headers,
        body={"individual_id": person["id"]},
    )
    assert status == 200
    assert [m["name"] for m in body["members"]] == ["Joiner"]

    # Adding again is a no-op, not an error.
    status, body = _call(
        "POST",
        f"/teams/{team['id']}/members",
        admin,
        auth_headers,
        body={"individual_id": person["id"]},
    )
    assert status == 200
    assert len(body["members"]) == 1

    status, body = _call(
        "DELETE", f"/teams/{team['id']}/members/{person['id']}", admin, auth_headers
    )
    assert status == 200
    assert body["members"] == []


def test_add_member_requires_known_individual(make_user, auth_headers, make_team):
    admin = make_user(role="admin")
    team = make_team()
    status, _ = _call(
        "POST",
        f"/teams/{team['id']}/members",
        admin,
        auth_headers,
        body={"individual_id": 999},
    )
    assert status == 400


# --- Achievements ----------------------------------------------------------


def test_achievement_crud_and_month_normalization(make_user, auth_headers, make_team):
    admin = make_user(role="admin")
    team = make_team()

    status, body = _call(
        "POST",
        f"/teams/{team['id']}/achievements",
        admin,
        auth_headers,
        body={"month": "2026-07", "title": "Launch", "description": "Went live"},
    )
    assert status == 201
    achievement = body["achievement"]
    assert str(achievement["month"]) == "2026-07-01"

    status, body = _call(
        "PUT",
        f"/achievements/{achievement['id']}",
        admin,
        auth_headers,
        body={"title": "Launched v1", "month": "2026-08"},
    )
    assert status == 200
    assert body["achievement"]["title"] == "Launched v1"
    assert str(body["achievement"]["month"]) == "2026-08-01"

    status, _ = _call("DELETE", f"/achievements/{achievement['id']}", admin, auth_headers)
    assert status == 200


def test_achievement_rejects_bad_month(make_user, auth_headers, make_team):
    admin = make_user(role="admin")
    team = make_team()
    status, _ = _call(
        "POST",
        f"/teams/{team['id']}/achievements",
        admin,
        auth_headers,
        body={"month": "July 2026", "title": "X"},
    )
    assert status == 400


def test_achievements_filter_by_month(make_user, auth_headers, make_team):
    admin = make_user(role="admin")
    team = make_team()
    for month, title in (("2026-06", "June win"), ("2026-07", "July win")):
        _call(
            "POST",
            f"/teams/{team['id']}/achievements",
            admin,
            auth_headers,
            body={"month": month, "title": title},
        )

    status, body = _call(
        "GET",
        f"/teams/{team['id']}/achievements",
        admin,
        auth_headers,
        query={"month": "2026-07"},
    )
    assert status == 200
    assert [a["title"] for a in body["achievements"]] == ["July win"]


# --- Insights --------------------------------------------------------------


def test_insights_answer_the_workshop_questions(
    make_user, auth_headers, make_individual, make_team, add_members
):
    admin = make_user(role="admin")

    org_leader = make_individual(name="Org Leader", location="New York", is_org_leader=True)
    remote_lead = make_individual(name="Remote Lead", location="London")
    contractor_lead = make_individual(name="Contract Lead", location="Berlin", is_direct_staff=False)
    local_lead = make_individual(name="Local Lead", location="Austin")

    a = make_individual(location="Austin")
    b = make_individual(location="Austin")
    c = make_individual(location="Berlin", is_direct_staff=False)
    d = make_individual(location="Berlin")

    # Atlas: leader in London, team in Austin (not co-located), reports to org
    # leader, all-direct members -> ratio 0.
    atlas = make_team(name="Atlas", location="Austin", leader=remote_lead, reports_to=org_leader)
    add_members(atlas, a, b)

    # Nimbus: non-direct leader, co-located, 1/2 members non-direct -> ratio 0.5.
    nimbus = make_team(name="Nimbus", location="Berlin", leader=contractor_lead, reports_to=remote_lead)
    add_members(nimbus, c, d)

    # Quartz: co-located direct leader, no members, plain reporting line.
    make_team(name="Quartz", location="Austin", leader=local_lead, reports_to=local_lead)

    status, body = _call("GET", "/insights", admin, auth_headers)
    assert status == 200

    assert body["summary"] == {
        "team_count": 3,
        "leader_not_colocated": 1,
        "leader_non_direct": 1,
        "non_direct_ratio_above_20pct": 1,
        "reporting_to_org_leader": 1,
    }

    by_name = {t["name"]: t for t in body["teams"]}
    assert by_name["Atlas"]["leader_not_colocated"] is True
    assert by_name["Atlas"]["non_direct_ratio"] == 0.0
    assert by_name["Nimbus"]["leader_non_direct"] is True
    assert by_name["Nimbus"]["non_direct_ratio"] == 0.5
    assert by_name["Quartz"]["member_count"] == 0
    assert by_name["Quartz"]["non_direct_ratio_above_20pct"] is False
