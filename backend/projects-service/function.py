"""
Projects service: project CRUD with RBAC.

Routes (relative to this Lambda's Function URL, e.g. /api/projects-service/...):
    GET    /projects       ?status=&manager_id=&department=&date_from=&date_to=
                           &budget_min=&budget_max=&q=
    POST   /projects        { name, description?, manager_id, department?, start_date?, end_date? }
    GET    /projects/{id}
    PUT    /projects/{id}    { name?, description?, manager_id?, department?, start_date?, end_date?, status? }
    DELETE /projects/{id}   -> archive (soft delete)

Rules:
    - Every project must have exactly one manager (an active admin or project_manager user).
    - Create: Admin or Project Manager.
    - Update: Admin, or the project's own manager.
    - Archive (DELETE): Admin, or the project's own manager. Contributors/viewers cannot archive or delete.
"""

import json
import logging
import os
from decimal import Decimal, InvalidOperation

from auth_lib import authenticate, require_role
from postgres_service import (
    VALID_STATUSES,
    archive_project,
    create_project,
    get_active_manager,
    get_project,
    list_projects,
    update_project,
)

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


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _parse_path(path):
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "projects":
        try:
            return int(parts[1])
        except ValueError:
            return None
    return None


def _validate_manager(manager_id):
    manager = get_active_manager(PG_CONFIG, manager_id)
    if not manager or not manager["is_active"] or manager["role"] not in MANAGER_ROLES:
        return "manager_id must reference an active Admin or Project Manager"
    return None


def _decimal_param(qs, key):
    """Parse an optional numeric query parameter, or None if absent/blank."""
    raw = qs.get(key)
    if raw is None or str(raw).strip() == "":
        return None
    return Decimal(str(raw))


def _list(event):
    qs = event.get("queryStringParameters") or {}
    try:
        budget_min = _decimal_param(qs, "budget_min")
        budget_max = _decimal_param(qs, "budget_max")
    except (InvalidOperation, ValueError):
        return _response(400, {"error": "budget_min and budget_max must be numbers"})

    if budget_min is not None and budget_max is not None and budget_min > budget_max:
        return _response(400, {"error": "budget_min cannot be greater than budget_max"})

    filters = {
        "status": qs.get("status"),
        "manager_id": int(qs["manager_id"]) if qs.get("manager_id") else None,
        "department": qs.get("department"),
        "date_from": qs.get("date_from"),
        "date_to": qs.get("date_to"),
        "budget_min": budget_min,
        "budget_max": budget_max,
        "q": qs.get("q"),
    }
    return _response(200, {"projects": list_projects(PG_CONFIG, filters)})


def _create(event, claims):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    name = (body.get("name") or "").strip()
    manager_id = body.get("manager_id")
    if not name or not manager_id:
        return _response(400, {"error": "name and manager_id are required"})

    error = _validate_manager(manager_id)
    if error:
        return _response(400, {"error": error})

    project = create_project(
        PG_CONFIG,
        name,
        body.get("description"),
        manager_id,
        body.get("department"),
        body.get("start_date"),
        body.get("end_date"),
    )
    return _response(201, {"project": project})


def _get(project_id):
    project = get_project(PG_CONFIG, project_id)
    if not project:
        return _response(404, {"error": "Project not found"})
    return _response(200, {"project": project})


def _can_manage(claims, project):
    if claims.get("role") == "admin":
        return True
    return claims.get("role") == "project_manager" and int(claims["sub"]) == project["manager_id"]


def _update(event, claims, project_id):
    project = get_project(PG_CONFIG, project_id)
    if not project:
        return _response(404, {"error": "Project not found"})
    if not _can_manage(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can edit this project"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    fields = {}
    for key in ("name", "description", "department", "start_date", "end_date"):
        if key in body:
            fields[key] = body[key]
    if "manager_id" in body:
        error = _validate_manager(body["manager_id"])
        if error:
            return _response(400, {"error": error})
        fields["manager_id"] = body["manager_id"]
    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            return _response(400, {"error": f"status must be one of {sorted(VALID_STATUSES)}"})
        fields["status"] = body["status"]

    updated = update_project(PG_CONFIG, project_id, fields)
    return _response(200, {"project": updated})


def _archive(claims, project_id):
    project = get_project(PG_CONFIG, project_id)
    if not project:
        return _response(404, {"error": "Project not found"})
    if not _can_manage(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can archive this project"})

    archived = archive_project(PG_CONFIG, project_id)
    return _response(200, {"project": archived})


def handler(event=None, context=None):
    logger.debug("Received event: %s", event)
    event = event or {}
    http_ctx = (event.get("requestContext") or {}).get("http") or {}
    method = http_ctx.get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", "/")

    claims = authenticate(event)
    if not claims:
        return _response(401, {"error": "Missing or invalid token"})

    try:
        project_id = _parse_path(path)

        if method == "GET" and project_id is None:
            return _list(event)
        if method == "POST" and project_id is None:
            return _create(event, claims)
        if method == "GET" and project_id is not None:
            return _get(project_id)
        if method == "PUT" and project_id is not None:
            return _update(event, claims, project_id)
        if method == "DELETE" and project_id is not None:
            return _archive(claims, project_id)

        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/projects", "headers": {}}))
