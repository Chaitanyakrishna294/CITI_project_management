"""
PostgreSQL access for the teams service: individuals, teams, team members,
monthly achievements, and the team insights rollup.
"""

import json

from psycopg import connect
from psycopg.rows import dict_row

PG_CONN = None


def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config, row_factory=dict_row, autocommit=True)
    return PG_CONN


def _run(config, query, params=None, fetch="all"):
    """Execute one statement, resetting the cached connection on failure."""
    global PG_CONN
    try:
        conn = get_connection(config)
        with conn.cursor() as cur:
            cur.execute(query, params)
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
            return None
    except Exception:
        PG_CONN = None
        raise


INDIVIDUAL_COLS = (
    "id, name, email, location, is_direct_staff, is_org_leader, metadata, created_at, updated_at"
)

# Teams are always returned with leader/reports-to names resolved and a member
# count, so list screens never need N+1 lookups.
TEAM_SELECT = """
SELECT t.id, t.name, t.location, t.leader_id, l.name AS leader_name,
       t.reports_to_id, r.name AS reports_to_name, t.metadata,
       t.created_at, t.updated_at,
       (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id)::int AS member_count
FROM teams t
LEFT JOIN individuals l ON l.id = t.leader_id
LEFT JOIN individuals r ON r.id = t.reports_to_id
"""


# --- Individuals -----------------------------------------------------------


def list_individuals(config, search=None):
    query = f"SELECT {INDIVIDUAL_COLS} FROM individuals"
    params = []
    if search:
        query += " WHERE name ILIKE %s OR email ILIKE %s OR location ILIKE %s"
        like = f"%{search}%"
        params = [like, like, like]
    query += " ORDER BY name"
    return _run(config, query, params)


def get_individual(config, individual_id):
    return _run(
        config,
        f"SELECT {INDIVIDUAL_COLS} FROM individuals WHERE id = %s",
        (individual_id,),
        fetch="one",
    )


def get_individual_by_email(config, email):
    return _run(config, "SELECT id FROM individuals WHERE email = %s", (email,), fetch="one")


def create_individual(config, fields):
    return _run(
        config,
        "INSERT INTO individuals (name, email, location, is_direct_staff, is_org_leader, metadata) "
        f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING {INDIVIDUAL_COLS}",
        (
            fields["name"],
            fields.get("email"),
            fields["location"],
            fields.get("is_direct_staff", True),
            fields.get("is_org_leader", False),
            json.dumps(fields.get("metadata") or {}),
        ),
        fetch="one",
    )


def update_individual(config, individual_id, fields):
    """fields: dict subset of {name, email, location, is_direct_staff, is_org_leader, metadata}"""
    if not fields:
        return get_individual(config, individual_id)
    if "metadata" in fields:
        fields = {**fields, "metadata": json.dumps(fields["metadata"] or {})}
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [individual_id]
    return _run(
        config,
        f"UPDATE individuals SET {set_clause}, updated_at = now() WHERE id = %s "  # nosec B608 - keys come from a hardcoded allowlist; values use %s
        f"RETURNING {INDIVIDUAL_COLS}",
        values,
        fetch="one",
    )


def delete_individual(config, individual_id):
    _run(config, "DELETE FROM individuals WHERE id = %s", (individual_id,), fetch=None)


# --- Teams -----------------------------------------------------------------


def list_teams(config, search=None):
    query = TEAM_SELECT
    params = []
    if search:
        query += " WHERE t.name ILIKE %s OR t.location ILIKE %s"
        like = f"%{search}%"
        params = [like, like]
    query += " ORDER BY t.name"
    return _run(config, query, params)


def get_team(config, team_id):
    return _run(config, TEAM_SELECT + " WHERE t.id = %s", (team_id,), fetch="one")


def get_team_by_name(config, name):
    return _run(config, "SELECT id FROM teams WHERE name = %s", (name,), fetch="one")


def create_team(config, fields):
    row = _run(
        config,
        "INSERT INTO teams (name, location, leader_id, reports_to_id, metadata) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (
            fields["name"],
            fields["location"],
            fields.get("leader_id"),
            fields.get("reports_to_id"),
            json.dumps(fields.get("metadata") or {}),
        ),
        fetch="one",
    )
    return get_team(config, row["id"])


def update_team(config, team_id, fields):
    """fields: dict subset of {name, location, leader_id, reports_to_id, metadata}"""
    if not fields:
        return get_team(config, team_id)
    if "metadata" in fields:
        fields = {**fields, "metadata": json.dumps(fields["metadata"] or {})}
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [team_id]
    _run(
        config,
        f"UPDATE teams SET {set_clause}, updated_at = now() WHERE id = %s",  # nosec B608 - keys come from a hardcoded allowlist; values use %s
        values,
        fetch=None,
    )
    return get_team(config, team_id)


def delete_team(config, team_id):
    _run(config, "DELETE FROM teams WHERE id = %s", (team_id,), fetch=None)


# --- Team members ----------------------------------------------------------


def list_members(config, team_id):
    return _run(
        config,
        "SELECT i.id, i.name, i.email, i.location, i.is_direct_staff, i.is_org_leader "
        "FROM team_members m JOIN individuals i ON i.id = m.individual_id "
        "WHERE m.team_id = %s ORDER BY i.name",
        (team_id,),
    )


def add_member(config, team_id, individual_id):
    _run(
        config,
        "INSERT INTO team_members (team_id, individual_id) VALUES (%s, %s) "
        "ON CONFLICT (team_id, individual_id) DO NOTHING",
        (team_id, individual_id),
        fetch=None,
    )
    return list_members(config, team_id)


def remove_member(config, team_id, individual_id):
    _run(
        config,
        "DELETE FROM team_members WHERE team_id = %s AND individual_id = %s",
        (team_id, individual_id),
        fetch=None,
    )
    return list_members(config, team_id)


# --- Achievements ----------------------------------------------------------


ACHIEVEMENT_COLS = "id, team_id, month, title, description, created_at, updated_at"


def list_achievements(config, team_id=None, month=None):
    query = f"SELECT {ACHIEVEMENT_COLS} FROM achievements"
    clauses, params = [], []
    if team_id is not None:
        clauses.append("team_id = %s")
        params.append(team_id)
    if month is not None:
        clauses.append("month = %s")
        params.append(month)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY month DESC, title"
    return _run(config, query, params)


def get_achievement(config, achievement_id):
    return _run(
        config,
        f"SELECT {ACHIEVEMENT_COLS} FROM achievements WHERE id = %s",
        (achievement_id,),
        fetch="one",
    )


def create_achievement(config, team_id, month, title, description):
    return _run(
        config,
        "INSERT INTO achievements (team_id, month, title, description) "
        f"VALUES (%s, %s, %s, %s) RETURNING {ACHIEVEMENT_COLS}",
        (team_id, month, title, description),
        fetch="one",
    )


def update_achievement(config, achievement_id, fields):
    """fields: dict subset of {month, title, description}"""
    if not fields:
        return get_achievement(config, achievement_id)
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [achievement_id]
    return _run(
        config,
        f"UPDATE achievements SET {set_clause}, updated_at = now() WHERE id = %s "  # nosec B608 - keys come from a hardcoded allowlist; values use %s
        f"RETURNING {ACHIEVEMENT_COLS}",
        values,
        fetch="one",
    )


def delete_achievement(config, achievement_id):
    _run(config, "DELETE FROM achievements WHERE id = %s", (achievement_id,), fetch=None)


# --- Insights --------------------------------------------------------------


def team_insights(config):
    """
    Per-team flags behind the workshop's four counting questions.

    "Leader not co-located" compares the leader's own location to the team's
    location; teams without a leader don't count. The non-direct ratio is
    non-direct members / total members (leader counts only if also a member).
    """
    return _run(
        config,
        """
        SELECT t.id, t.name, t.location,
               l.name  AS leader_name,
               l.location AS leader_location,
               r.name  AS reports_to_name,
               (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id)::int AS member_count,
               (SELECT COUNT(*) FROM team_members m
                  JOIN individuals i ON i.id = m.individual_id
                 WHERE m.team_id = t.id AND NOT i.is_direct_staff)::int AS non_direct_count,
               (l.id IS NOT NULL AND l.location <> t.location) AS leader_not_colocated,
               (l.id IS NOT NULL AND NOT l.is_direct_staff)    AS leader_non_direct,
               COALESCE(r.is_org_leader, FALSE)                AS reports_to_org_leader
        FROM teams t
        LEFT JOIN individuals l ON l.id = t.leader_id
        LEFT JOIN individuals r ON r.id = t.reports_to_id
        ORDER BY t.name
        """,
    )
