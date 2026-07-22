"""
Resources service: resource records and project allocations, with capacity checks.

Routes (relative to this Lambda's Function URL, e.g. /api/resources-service/...):
    GET    /resources                  -> list resources with total allocation %
    POST   /resources                   { user_id, title?, department?, weekly_capacity? }
    GET    /resources/{id}
    PUT    /resources/{id}              { title?, department?, weekly_capacity? }

    GET    /allocations                ?resource_id=&project_id=
    POST   /allocations                 { resource_id, project_id, allocation_pct, start_date?, end_date? }
    PUT    /allocations/{id}            { allocation_pct?, start_date?, end_date? }
    DELETE /allocations/{id}

Rules:
    - Managing resources/allocations: Admin or Project Manager. Everyone else is read-only.
    - A resource cannot be allocated beyond its weekly_capacity across all projects (over-allocation guard).
    - A resource cannot be assigned to the same project twice (enforced by a DB unique constraint).
"""

import json
import logging
import os

from auth_lib import authenticate, require_role
from postgres_service import (
    create_allocation,
    create_resource,
    delete_allocation,
    get_active_user,
    get_allocation,
    get_resource,
    get_resource_allocation_total,
    get_resource_by_user,
    list_allocations,
    list_resources,
    update_allocation,
    update_resource,
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

MANAGER_ROLES = {"admin", "project_manager"}


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _parse_path(path):
    """Returns (resource, resource_id)."""
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None, None
    resource_id = None
    if len(parts) >= 2:
        try:
            resource_id = int(parts[1])
        except ValueError:
            resource_id = None
    return parts[0], resource_id


# ---- Resources ---------------------------------------------------------

def _list_resources(event):
    qs = event.get("queryStringParameters") or {}
    filters = {"q": qs.get("q"), "department": qs.get("department")}
    return _response(200, {"resources": list_resources(PG_CONFIG, filters)})


def _create_resource(event, claims):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    user_id = body.get("user_id")
    if not user_id:
        return _response(400, {"error": "user_id is required"})
    user = get_active_user(PG_CONFIG, user_id)
    if not user or not user["is_active"]:
        return _response(400, {"error": "user_id must reference an active user"})
    if get_resource_by_user(PG_CONFIG, user_id):
        return _response(409, {"error": "This user already has a resource record"})

    resource = create_resource(
        PG_CONFIG, user_id, body.get("title"), body.get("department"), body.get("weekly_capacity", 100.00)
    )
    return _response(201, {"resource": resource})


def _get_resource(resource_id):
    resource = get_resource(PG_CONFIG, resource_id)
    if not resource:
        return _response(404, {"error": "Resource not found"})
    return _response(200, {"resource": resource})


def _update_resource(event, claims, resource_id):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})
    if not get_resource(PG_CONFIG, resource_id):
        return _response(404, {"error": "Resource not found"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    fields = {k: body[k] for k in ("title", "department", "weekly_capacity") if k in body}
    resource = update_resource(PG_CONFIG, resource_id, fields)
    return _response(200, {"resource": resource})


# ---- Allocations --------------------------------------------------------

def _list_allocations(event):
    qs = event.get("queryStringParameters") or {}
    filters = {
        "resource_id": int(qs["resource_id"]) if qs.get("resource_id") else None,
        "project_id": int(qs["project_id"]) if qs.get("project_id") else None,
    }
    return _response(200, {"allocations": list_allocations(PG_CONFIG, filters)})


def _create_allocation(event, claims):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    resource_id = body.get("resource_id")
    project_id = body.get("project_id")
    allocation_pct = body.get("allocation_pct")
    if not resource_id or not project_id or not allocation_pct:
        return _response(400, {"error": "resource_id, project_id and allocation_pct are required"})

    resource = get_resource(PG_CONFIG, resource_id)
    if not resource:
        return _response(404, {"error": "Resource not found"})

    existing_total = get_resource_allocation_total(PG_CONFIG, resource_id)
    if float(existing_total) + float(allocation_pct) > float(resource["weekly_capacity"]):
        return _response(400, {
            "error": "Allocation exceeds resource capacity",
            "current_allocation_pct": float(existing_total),
            "weekly_capacity": float(resource["weekly_capacity"]),
        })

    try:
        allocation = create_allocation(
            PG_CONFIG, resource_id, project_id, allocation_pct, body.get("start_date"), body.get("end_date")
        )
    except Exception as e:
        if "unique" in str(e).lower():
            return _response(409, {"error": "This resource is already allocated to this project"})
        if "foreign key" in str(e).lower():
            return _response(404, {"error": "project_id does not reference an existing project"})
        raise
    return _response(201, {"allocation": allocation})


def _update_allocation(event, claims, allocation_id):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})

    allocation = get_allocation(PG_CONFIG, allocation_id)
    if not allocation:
        return _response(404, {"error": "Allocation not found"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    fields = {}
    if "allocation_pct" in body:
        resource = get_resource(PG_CONFIG, allocation["resource_id"])
        other_total = get_resource_allocation_total(PG_CONFIG, allocation["resource_id"], exclude_allocation_id=allocation_id)
        if float(other_total) + float(body["allocation_pct"]) > float(resource["weekly_capacity"]):
            return _response(400, {
                "error": "Allocation exceeds resource capacity",
                "current_allocation_pct": float(other_total),
                "weekly_capacity": float(resource["weekly_capacity"]),
            })
        fields["allocation_pct"] = body["allocation_pct"]
    for key in ("start_date", "end_date"):
        if key in body:
            fields[key] = body[key]

    updated = update_allocation(PG_CONFIG, allocation_id, fields)
    return _response(200, {"allocation": updated})


def _delete_allocation(claims, allocation_id):
    if not require_role(claims, MANAGER_ROLES):
        return _response(403, {"error": "Admin or Project Manager role required"})
    if not delete_allocation(PG_CONFIG, allocation_id):
        return _response(404, {"error": "Allocation not found"})
    return _response(200, {"message": "Allocation removed"})


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
        resource_name, item_id = _parse_path(path)

        if resource_name == "resources":
            if method == "GET" and item_id is None:
                return _list_resources(event)
            if method == "POST" and item_id is None:
                return _create_resource(event, claims)
            if method == "GET" and item_id is not None:
                return _get_resource(item_id)
            if method == "PUT" and item_id is not None:
                return _update_resource(event, claims, item_id)

        if resource_name == "allocations":
            if method == "GET" and item_id is None:
                return _list_allocations(event)
            if method == "POST" and item_id is None:
                return _create_allocation(event, claims)
            if method == "PUT" and item_id is not None:
                return _update_allocation(event, claims, item_id)
            if method == "DELETE" and item_id is not None:
                return _delete_allocation(claims, item_id)

        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/resources", "headers": {}}))
