"""
Data-layer tests for the teams service: rollup queries, cascades, and the
insights flags computed in SQL.
"""
import postgres_service as db


def test_team_rollup_resolves_names_and_member_count(
    pg_config, make_individual, make_team, add_members
):
    leader = make_individual(name="Lead", location="London")
    boss = make_individual(name="Boss", location="New York", is_org_leader=True)
    member = make_individual(name="M1")
    team = make_team(name="Atlas", leader=leader, reports_to=boss)
    add_members(team, member)

    row = db.get_team(pg_config, team["id"])
    assert row["leader_name"] == "Lead"
    assert row["reports_to_name"] == "Boss"
    assert row["member_count"] == 1


def test_deleting_individual_nulls_leadership_and_cascades_membership(
    pg_config, make_individual, make_team, add_members
):
    leader = make_individual(name="Leaving Lead")
    team = make_team(name="Atlas", leader=leader)
    add_members(team, leader)

    db.delete_individual(pg_config, leader["id"])

    row = db.get_team(pg_config, team["id"])
    assert row["leader_id"] is None
    assert row["member_count"] == 0


def test_deleting_team_cascades_achievements(pg_config, make_team):
    team = make_team()
    db.create_achievement(pg_config, team["id"], "2026-07-01", "Win", None)
    db.delete_team(pg_config, team["id"])
    assert db.list_achievements(pg_config, team_id=team["id"]) == []


def test_list_teams_search_matches_name_or_location(pg_config, make_team):
    make_team(name="Atlas", location="Austin")
    make_team(name="Nimbus", location="Berlin")

    assert [t["name"] for t in db.list_teams(pg_config, search="berl")] == ["Nimbus"]
    assert [t["name"] for t in db.list_teams(pg_config, search="atl")] == ["Atlas"]


def test_insights_flags(pg_config, make_individual, make_team, add_members):
    org_leader = make_individual(name="OL", location="NY", is_org_leader=True)
    remote_lead = make_individual(name="RL", location="London")
    direct = make_individual(location="Austin")
    contractor = make_individual(location="Austin", is_direct_staff=False)

    team = make_team(name="Atlas", location="Austin", leader=remote_lead, reports_to=org_leader)
    add_members(team, direct, contractor)

    rows = db.team_insights(pg_config)
    assert len(rows) == 1
    row = rows[0]
    assert row["leader_not_colocated"] is True
    assert row["leader_non_direct"] is False
    assert row["reports_to_org_leader"] is True
    assert row["member_count"] == 2
    assert row["non_direct_count"] == 1


def test_insights_team_without_leader_is_not_flagged(pg_config, make_team):
    make_team(name="Leaderless")
    row = db.team_insights(pg_config)[0]
    assert row["leader_not_colocated"] is False
    assert row["leader_non_direct"] is False
    assert row["reports_to_org_leader"] is False
