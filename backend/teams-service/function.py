"""
Teams service: self-service team management (workshop brief).

Routes (relative to this Lambda's Function URL, e.g. /api/teams-service/...):
    GET    /individuals                       ?search=          -> list individuals
    POST   /individuals                        { name, location, email?, is_direct_staff?, is_org_leader?, metadata? }
    GET    /individuals/{id}
    PUT    /individuals/{id}
    DELETE /individuals/{id}

    GET    /teams                             ?search=          -> list teams (with leader/member rollups)
    POST   /teams                              { name, location, leader_id?, reports_to_id?, metadata? }
    GET    /teams/{id}                                          -> team + members + achievements
    PUT    /teams/{id}
    DELETE /teams/{id}
    POST   /teams/{id}/members                 { individual_id } -> add member, returns roster
    DELETE /teams/{id}/members/{individual_id}                  -> remove member, returns roster
    GET    /teams/{id}/achievements           ?month=YYYY-MM
    POST   /teams/{id}/achievements            { month: YYYY-MM, title, description? }

    PUT    /achievements/{id}                  { month?, title?, description? }
    DELETE /achievements/{id}

    GET    /insights                                            -> the workshop metrics

Reads require any authenticated user; writes require admin or project_manager.
"""

import json
import logging
import os
import re

import postgres_service as db
from auth_lib import authenticate, require_role

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def _pg_config():
    """Connection string from the environment; no built-in fallback credentials."""
    required = ("POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASS", "POSTGRES_NAME")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )
    return (
        f"host={os.environ['POSTGRES_HOST']} "
        f"port={os.environ['POSTGRES_PORT']} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASS']} "
        f"dbname={os.environ['POSTGRES_NAME']} "
        f"connect_timeout=15"
    )


PG_CONFIG = _pg_config()

MANAGER_ROLES = {"admin", "project_manager"}

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _body(event):
    try:
        return json.loads(event.get("body") or "{}"), None
    except json.JSONDecodeError:
        return None, _response(400, {"error": "Invalid JSON body"})


def _query(event):
    return event.get("queryStringParameters") or {}


def _month_to_date(value):
    """'2026-07' -> '2026-07-01', or None if the format is wrong."""
    if not isinstance(value, str) or not MONTH_RE.match(value):
        return None
    return f"{value}-01"


def _validate_metadata(body):
    """Metadata must be a flat JSON object when present. Returns (value, error)."""
    if "metadata" not in body:
        return None, None
    metadata = body["metadata"]
    if metadata is None:
        return {}, None
    if not isinstance(metadata, dict):
        return None, _response(400, {"error": "metadata must be an object"})
    return metadata, None


# --- Individuals -----------------------------------------------------------


def _create_individual(event):
    body, err = _body(event)
    if err:
        return err

    name = (body.get("name") or "").strip()
    location = (body.get("location") or "").strip()
    email = (body.get("email") or "").strip().lower() or None
    if not name or not location:
        return _response(400, {"error": "name and location are required"})
    if email and db.get_individual_by_email(PG_CONFIG, email):
        return _response(409, {"error": "An individual with this email already exists"})
    metadata, err = _validate_metadata(body)
    if err:
        return err

    individual = db.create_individual(
        PG_CONFIG,
        {
            "name": name,
            "email": email,
            "location": location,
            "is_direct_staff": bool(body.get("is_direct_staff", True)),
            "is_org_leader": bool(body.get("is_org_leader", False)),
            "metadata": metadata or {},
        },
    )
    return _response(201, {"individual": individual})


def _update_individual(event, individual_id):
    body, err = _body(event)
    if err:
        return err
    if not db.get_individual(PG_CONFIG, individual_id):
        return _response(404, {"error": "Individual not found"})

    fields = {}
    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return _response(400, {"error": "name cannot be empty"})
        fields["name"] = name
    if "location" in body:
        location = (body["location"] or "").strip()
        if not location:
            return _response(400, {"error": "location cannot be empty"})
        fields["location"] = location
    if "email" in body:
        email = (body["email"] or "").strip().lower() or None
        if email:
            existing = db.get_individual_by_email(PG_CONFIG, email)
            if existing and existing["id"] != individual_id:
                return _response(409, {"error": "An individual with this email already exists"})
        fields["email"] = email
    if "is_direct_staff" in body:
        fields["is_direct_staff"] = bool(body["is_direct_staff"])
    if "is_org_leader" in body:
        fields["is_org_leader"] = bool(body["is_org_leader"])
    metadata, err = _validate_metadata(body)
    if err:
        return err
    if metadata is not None:
        fields["metadata"] = metadata

    individual = db.update_individual(PG_CONFIG, individual_id, fields)
    return _response(200, {"individual": individual})


def _delete_individual(individual_id):
    if not db.get_individual(PG_CONFIG, individual_id):
        return _response(404, {"error": "Individual not found"})
    db.delete_individual(PG_CONFIG, individual_id)
    return _response(200, {"deleted": True})


# --- Teams -----------------------------------------------------------------


def _resolve_individual_ref(body, key):
    """Validate an optional FK to individuals. Returns (value, error)."""
    if key not in body:
        return None, None
    value = body[key]
    if value is None:
        return None, None
    if not isinstance(value, int):
        return None, _response(400, {"error": f"{key} must be an individual id or null"})
    if not db.get_individual(PG_CONFIG, value):
        return None, _response(400, {"error": f"{key} does not reference a known individual"})
    return value, None


def _create_team(event):
    body, err = _body(event)
    if err:
        return err

    name = (body.get("name") or "").strip()
    location = (body.get("location") or "").strip()
    if not name or not location:
        return _response(400, {"error": "name and location are required"})
    if db.get_team_by_name(PG_CONFIG, name):
        return _response(409, {"error": "A team with this name already exists"})

    leader_id, err = _resolve_individual_ref(body, "leader_id")
    if err:
        return err
    reports_to_id, err = _resolve_individual_ref(body, "reports_to_id")
    if err:
        return err
    metadata, err = _validate_metadata(body)
    if err:
        return err

    team = db.create_team(
        PG_CONFIG,
        {
            "name": name,
            "location": location,
            "leader_id": leader_id,
            "reports_to_id": reports_to_id,
            "metadata": metadata or {},
        },
    )
    return _response(201, {"team": team})


def _get_team(team_id):
    team = db.get_team(PG_CONFIG, team_id)
    if not team:
        return _response(404, {"error": "Team not found"})
    team["members"] = db.list_members(PG_CONFIG, team_id)
    team["achievements"] = db.list_achievements(PG_CONFIG, team_id=team_id)
    return _response(200, {"team": team})


def _update_team(event, team_id):
    body, err = _body(event)
    if err:
        return err
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})

    fields = {}
    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return _response(400, {"error": "name cannot be empty"})
        existing = db.get_team_by_name(PG_CONFIG, name)
        if existing and existing["id"] != team_id:
            return _response(409, {"error": "A team with this name already exists"})
        fields["name"] = name
    if "location" in body:
        location = (body["location"] or "").strip()
        if not location:
            return _response(400, {"error": "location cannot be empty"})
        fields["location"] = location
    for key in ("leader_id", "reports_to_id"):
        if key in body:
            value, err = _resolve_individual_ref(body, key)
            if err:
                return err
            fields[key] = value
    metadata, err = _validate_metadata(body)
    if err:
        return err
    if metadata is not None:
        fields["metadata"] = metadata

    team = db.update_team(PG_CONFIG, team_id, fields)
    return _response(200, {"team": team})


def _delete_team(team_id):
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})
    db.delete_team(PG_CONFIG, team_id)
    return _response(200, {"deleted": True})


def _add_member(event, team_id):
    body, err = _body(event)
    if err:
        return err
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})
    individual_id = body.get("individual_id")
    if not isinstance(individual_id, int):
        return _response(400, {"error": "individual_id is required"})
    if not db.get_individual(PG_CONFIG, individual_id):
        return _response(400, {"error": "individual_id does not reference a known individual"})
    members = db.add_member(PG_CONFIG, team_id, individual_id)
    return _response(200, {"members": members})


def _remove_member(team_id, individual_id):
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})
    members = db.remove_member(PG_CONFIG, team_id, individual_id)
    return _response(200, {"members": members})


# --- Achievements ----------------------------------------------------------


def _list_team_achievements(event, team_id):
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})
    month = None
    raw_month = _query(event).get("month")
    if raw_month:
        month = _month_to_date(raw_month)
        if not month:
            return _response(400, {"error": "month must look like YYYY-MM"})
    achievements = db.list_achievements(PG_CONFIG, team_id=team_id, month=month)
    return _response(200, {"achievements": achievements})


def _create_achievement(event, team_id):
    body, err = _body(event)
    if err:
        return err
    if not db.get_team(PG_CONFIG, team_id):
        return _response(404, {"error": "Team not found"})

    title = (body.get("title") or "").strip()
    month = _month_to_date(body.get("month"))
    if not title or not month:
        return _response(400, {"error": "title and month (YYYY-MM) are required"})

    achievement = db.create_achievement(
        PG_CONFIG, team_id, month, title, (body.get("description") or "").strip() or None
    )
    return _response(201, {"achievement": achievement})


def _update_achievement(event, achievement_id):
    body, err = _body(event)
    if err:
        return err
    if not db.get_achievement(PG_CONFIG, achievement_id):
        return _response(404, {"error": "Achievement not found"})

    fields = {}
    if "title" in body:
        title = (body["title"] or "").strip()
        if not title:
            return _response(400, {"error": "title cannot be empty"})
        fields["title"] = title
    if "month" in body:
        month = _month_to_date(body["month"])
        if not month:
            return _response(400, {"error": "month must look like YYYY-MM"})
        fields["month"] = month
    if "description" in body:
        fields["description"] = (body["description"] or "").strip() or None

    achievement = db.update_achievement(PG_CONFIG, achievement_id, fields)
    return _response(200, {"achievement": achievement})


def _delete_achievement(achievement_id):
    if not db.get_achievement(PG_CONFIG, achievement_id):
        return _response(404, {"error": "Achievement not found"})
    db.delete_achievement(PG_CONFIG, achievement_id)
    return _response(200, {"deleted": True})


# --- Insights --------------------------------------------------------------


def _insights():
    """
    The workshop's counting questions, computed from the per-team rollup:
    leader co-location, non-direct leaders, non-direct ratio > 20%, and
    reporting lines into org leaders.
    """
    teams = db.team_insights(PG_CONFIG)
    ratio_threshold = 0.2
    for team in teams:
        count = team["member_count"]
        team["non_direct_ratio"] = round(team["non_direct_count"] / count, 4) if count else 0.0
        team["non_direct_ratio_above_20pct"] = team["non_direct_ratio"] > ratio_threshold

    summary = {
        "team_count": len(teams),
        "leader_not_colocated": sum(1 for t in teams if t["leader_not_colocated"]),
        "leader_non_direct": sum(1 for t in teams if t["leader_non_direct"]),
        "non_direct_ratio_above_20pct": sum(1 for t in teams if t["non_direct_ratio_above_20pct"]),
        "reporting_to_org_leader": sum(1 for t in teams if t["reports_to_org_leader"]),
    }
    return _response(200, {"summary": summary, "teams": teams})


# --- Routing ---------------------------------------------------------------


def _route(method, path, event):
    parts = [p for p in path.split("/") if p]

    def int_part(index):
        try:
            return int(parts[index])
        except (IndexError, ValueError):
            return None

    if parts[:1] == ["individuals"]:
        individual_id = int_part(1)
        if len(parts) == 1:
            if method == "GET":
                return _response(200, {"individuals": db.list_individuals(PG_CONFIG, _query(event).get("search"))})
            if method == "POST":
                return "write", lambda: _create_individual(event)
        if len(parts) == 2 and individual_id is not None:
            if method == "GET":
                individual = db.get_individual(PG_CONFIG, individual_id)
                if not individual:
                    return _response(404, {"error": "Individual not found"})
                return _response(200, {"individual": individual})
            if method == "PUT":
                return "write", lambda: _update_individual(event, individual_id)
            if method == "DELETE":
                return "write", lambda: _delete_individual(individual_id)

    if parts[:1] == ["teams"]:
        team_id = int_part(1)
        if len(parts) == 1:
            if method == "GET":
                return _response(200, {"teams": db.list_teams(PG_CONFIG, _query(event).get("search"))})
            if method == "POST":
                return "write", lambda: _create_team(event)
        if len(parts) == 2 and team_id is not None:
            if method == "GET":
                return _get_team(team_id)
            if method == "PUT":
                return "write", lambda: _update_team(event, team_id)
            if method == "DELETE":
                return "write", lambda: _delete_team(team_id)
        if len(parts) >= 3 and team_id is not None and parts[2] == "members":
            if method == "POST" and len(parts) == 3:
                return "write", lambda: _add_member(event, team_id)
            member_id = int_part(3)
            if method == "DELETE" and len(parts) == 4 and member_id is not None:
                return "write", lambda: _remove_member(team_id, member_id)
        if len(parts) == 3 and team_id is not None and parts[2] == "achievements":
            if method == "GET":
                return _list_team_achievements(event, team_id)
            if method == "POST":
                return "write", lambda: _create_achievement(event, team_id)

    if parts[:1] == ["achievements"]:
        achievement_id = int_part(1)
        if len(parts) == 2 and achievement_id is not None:
            if method == "PUT":
                return "write", lambda: _update_achievement(event, achievement_id)
            if method == "DELETE":
                return "write", lambda: _delete_achievement(achievement_id)

    if parts == ["insights"] and method == "GET":
        return _insights()

    return None


def handler(event=None, context=None):
    logger.debug("Received event: %s", event)
    event = event or {}
    http_ctx = (event.get("requestContext") or {}).get("http") or {}
    method = http_ctx.get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", "/")

    claims = authenticate(event)
    if not claims:
        return _response(401, {"error": "Authentication required"})

    try:
        outcome = _route(method, path, event)
        if outcome is None:
            return _response(404, {"error": f"No route for {method} {path}"})
        # Writes come back as ("write", thunk) so the role check lives in
        # exactly one place; reads were already executed for any valid token.
        if isinstance(outcome, tuple):
            if not require_role(claims, MANAGER_ROLES):
                return _response(403, {"error": "Admin or project manager role required"})
            return outcome[1]()
        return outcome
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/teams", "headers": {}}))
