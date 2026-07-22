"""
Deliverables service: deliverable CRUD, status tracking, and dependency management.

Routes (relative to this Lambda's Function URL, e.g. /api/deliverables-service/...):
    GET    /deliverables                  ?project_id=&status=&owner_id=
    POST   /deliverables                   { project_id, title, description?, owner_id?, due_date? }
    GET    /deliverables/{id}
    PUT    /deliverables/{id}              { title?, description?, owner_id?, status?, due_date? }
    DELETE /deliverables/{id}
    GET    /deliverables/{id}/dependencies
    POST   /deliverables/{id}/dependencies { depends_on_deliverable_id }
    DELETE /deliverables/{id}/dependencies/{dependency_id}

Rules:
    - A deliverable belongs to exactly one project; closed (archived) projects cannot receive new deliverables.
    - Create/full edit/delete: Admin, or the owning project's manager.
    - The assigned owner (any role) may update only the `status` field ("Update Status" per the PRD).
    - Dependencies are managed by Admin or the owning project's manager.
"""

import json
import logging
import os

from auth_lib import authenticate
from postgres_service import (
    VALID_STATUSES,
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

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'test')} "
    f"password={os.getenv('POSTGRES_PASS', 'test')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'test')} "
    f"connect_timeout=15"
)


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _parse_path(path):
    """Returns (deliverable_id, sub_resource, sub_id)."""
    parts = [p for p in path.split("/") if p]
    deliverable_id = None
    sub_resource = None
    sub_id = None
    if len(parts) >= 2 and parts[0] == "deliverables":
        try:
            deliverable_id = int(parts[1])
        except ValueError:
            return None, None, None
    if len(parts) >= 3:
        sub_resource = parts[2]
    if len(parts) >= 4:
        try:
            sub_id = int(parts[3])
        except ValueError:
            sub_id = None
    return deliverable_id, sub_resource, sub_id


def _can_manage_project(claims, project):
    if claims.get("role") == "admin":
        return True
    return claims.get("role") == "project_manager" and int(claims["sub"]) == project["manager_id"]


def _list(event):
    qs = event.get("queryStringParameters") or {}
    filters = {
        "project_id": int(qs["project_id"]) if qs.get("project_id") else None,
        "status": qs.get("status"),
        "owner_id": int(qs["owner_id"]) if qs.get("owner_id") else None,
        "q": qs.get("q"),
    }
    return _response(200, {"deliverables": list_deliverables(PG_CONFIG, filters)})


def _create(event, claims):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    project_id = body.get("project_id")
    title = (body.get("title") or "").strip()
    if not project_id or not title:
        return _response(400, {"error": "project_id and title are required"})

    project = get_project(PG_CONFIG, project_id)
    if not project:
        return _response(404, {"error": "Project not found"})
    if not _can_manage_project(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can add deliverables"})
    if project["status"] == "archived":
        return _response(400, {"error": "Closed projects cannot receive new deliverables"})

    owner_id = body.get("owner_id")
    if owner_id:
        owner = get_active_user(PG_CONFIG, owner_id)
        if not owner or not owner["is_active"]:
            return _response(400, {"error": "owner_id must reference an active user"})

    deliverable = create_deliverable(
        PG_CONFIG, project_id, title, body.get("description"), owner_id, body.get("due_date")
    )
    return _response(201, {"deliverable": deliverable})


def _get(deliverable_id):
    deliverable = get_deliverable(PG_CONFIG, deliverable_id)
    if not deliverable:
        return _response(404, {"error": "Deliverable not found"})
    return _response(200, {"deliverable": deliverable})


def _update(event, claims, deliverable_id):
    deliverable = get_deliverable(PG_CONFIG, deliverable_id)
    if not deliverable:
        return _response(404, {"error": "Deliverable not found"})
    project = get_project(PG_CONFIG, deliverable["project_id"])

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    is_manager = _can_manage_project(claims, project)
    is_owner = int(claims["sub"]) == deliverable["owner_id"] if deliverable["owner_id"] else False

    if not is_manager and not is_owner:
        return _response(403, {"error": "Only the assigned owner, the project's manager, or an Admin can update this deliverable"})

    fields = {}
    if is_manager:
        for key in ("title", "description", "due_date"):
            if key in body:
                fields[key] = body[key]
        if "owner_id" in body:
            if body["owner_id"]:
                owner = get_active_user(PG_CONFIG, body["owner_id"])
                if not owner or not owner["is_active"]:
                    return _response(400, {"error": "owner_id must reference an active user"})
            fields["owner_id"] = body["owner_id"]

    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            return _response(400, {"error": f"status must be one of {sorted(VALID_STATUSES)}"})
        fields["status"] = body["status"]

    if not fields:
        return _response(400, {"error": "No permitted fields to update"})

    updated = update_deliverable(PG_CONFIG, deliverable_id, fields)
    return _response(200, {"deliverable": updated})


def _delete(claims, deliverable_id):
    deliverable = get_deliverable(PG_CONFIG, deliverable_id)
    if not deliverable:
        return _response(404, {"error": "Deliverable not found"})
    project = get_project(PG_CONFIG, deliverable["project_id"])
    if not _can_manage_project(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can delete this deliverable"})

    delete_deliverable(PG_CONFIG, deliverable_id)
    return _response(200, {"message": "Deliverable deleted"})


def _list_dependencies(deliverable_id):
    if not get_deliverable(PG_CONFIG, deliverable_id):
        return _response(404, {"error": "Deliverable not found"})
    return _response(200, {"dependencies": list_dependencies(PG_CONFIG, deliverable_id)})


def _add_dependency(event, claims, deliverable_id):
    deliverable = get_deliverable(PG_CONFIG, deliverable_id)
    if not deliverable:
        return _response(404, {"error": "Deliverable not found"})
    project = get_project(PG_CONFIG, deliverable["project_id"])
    if not _can_manage_project(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can manage dependencies"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    depends_on_id = body.get("depends_on_deliverable_id")
    if not depends_on_id:
        return _response(400, {"error": "depends_on_deliverable_id is required"})
    if depends_on_id == deliverable_id:
        return _response(400, {"error": "A deliverable cannot depend on itself"})
    if not get_deliverable(PG_CONFIG, depends_on_id):
        return _response(404, {"error": "depends_on_deliverable_id does not reference an existing deliverable"})

    try:
        dependency_id = add_dependency(PG_CONFIG, deliverable_id, depends_on_id)
    except Exception as e:
        if "unique" in str(e).lower():
            return _response(409, {"error": "This dependency already exists"})
        raise
    return _response(201, {"id": dependency_id})


def _remove_dependency(claims, deliverable_id, dependency_id):
    deliverable = get_deliverable(PG_CONFIG, deliverable_id)
    if not deliverable:
        return _response(404, {"error": "Deliverable not found"})
    project = get_project(PG_CONFIG, deliverable["project_id"])
    if not _can_manage_project(claims, project):
        return _response(403, {"error": "Only the project's manager or an Admin can manage dependencies"})

    if not remove_dependency(PG_CONFIG, deliverable_id, dependency_id):
        return _response(404, {"error": "Dependency not found"})
    return _response(200, {"message": "Dependency removed"})


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
        deliverable_id, sub_resource, sub_id = _parse_path(path)

        if sub_resource == "dependencies":
            if method == "GET":
                return _list_dependencies(deliverable_id)
            if method == "POST":
                return _add_dependency(event, claims, deliverable_id)
            if method == "DELETE" and sub_id is not None:
                return _remove_dependency(claims, deliverable_id, sub_id)
            return _response(404, {"error": f"No route for {method} {path}"})

        if method == "GET" and deliverable_id is None:
            return _list(event)
        if method == "POST" and deliverable_id is None:
            return _create(event, claims)
        if method == "GET" and deliverable_id is not None:
            return _get(deliverable_id)
        if method == "PUT" and deliverable_id is not None:
            return _update(event, claims, deliverable_id)
        if method == "DELETE" and deliverable_id is not None:
            return _delete(claims, deliverable_id)

        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/deliverables", "headers": {}}))
