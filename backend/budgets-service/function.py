"""
Budgets service: planned budget, expense recording, and remaining-budget tracking.

Routes (relative to this Lambda's Function URL, e.g. /api/budgets-service/...):
    GET    /budgets                         -> list all project budgets
    POST   /budgets                          { project_id, planned_amount, currency? } -> create
    GET    /budgets/{project_id}            -> get one project's budget
    PUT    /budgets/{project_id}             { planned_amount?, currency? } -> update planned budget
    POST   /budgets/{project_id}/expenses    { amount, description? } -> record actual spend

Rules:
    - Budget amounts can never be negative (enforced by DB CHECK constraints).
    - Managing a project's budget: Admin, Finance, or that project's own manager.
    - Everyone else (Team Member, Viewer, other managers) is read-only.
"""

import json
import logging
import os

from auth_lib import authenticate
from postgres_service import (
    create_budget,
    get_budget_by_project,
    get_project,
    list_budgets,
    record_expense,
    update_budget,
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


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _parse_path(path):
    """Returns (project_id, sub_resource)."""
    parts = [p for p in path.split("/") if p]
    project_id = None
    sub_resource = None
    if len(parts) >= 2 and parts[0] == "budgets":
        try:
            project_id = int(parts[1])
        except ValueError:
            return None, None
    if len(parts) >= 3:
        sub_resource = parts[2]
    return project_id, sub_resource


def _can_manage_budget(claims, project):
    if claims.get("role") in ("admin", "finance"):
        return True
    return claims.get("role") == "project_manager" and int(claims["sub"]) == project["manager_id"]


def _list(event):
    return _response(200, {"budgets": list_budgets(PG_CONFIG)})


def _create(event, claims):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    project_id = body.get("project_id")
    planned_amount = body.get("planned_amount")
    if not project_id or planned_amount is None:
        return _response(400, {"error": "project_id and planned_amount are required"})
    if float(planned_amount) < 0:
        return _response(400, {"error": "planned_amount cannot be negative"})

    project = get_project(PG_CONFIG, project_id)
    if not project:
        return _response(404, {"error": "Project not found"})
    if not _can_manage_budget(claims, project):
        return _response(403, {"error": "Only Admin, Finance, or the project's manager can create a budget"})
    if get_budget_by_project(PG_CONFIG, project_id):
        return _response(409, {"error": "This project already has a budget"})

    budget = create_budget(PG_CONFIG, project_id, planned_amount, body.get("currency", "USD"))
    return _response(201, {"budget": budget})


def _get(project_id):
    budget = get_budget_by_project(PG_CONFIG, project_id)
    if not budget:
        return _response(404, {"error": "Budget not found"})
    return _response(200, {"budget": budget})


def _update(event, claims, project_id):
    budget = get_budget_by_project(PG_CONFIG, project_id)
    if not budget:
        return _response(404, {"error": "Budget not found"})
    project = get_project(PG_CONFIG, project_id)
    if not _can_manage_budget(claims, project):
        return _response(403, {"error": "Only Admin, Finance, or the project's manager can edit this budget"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    fields = {}
    if "planned_amount" in body:
        if float(body["planned_amount"]) < 0:
            return _response(400, {"error": "planned_amount cannot be negative"})
        fields["planned_amount"] = body["planned_amount"]
    if "currency" in body:
        fields["currency"] = body["currency"]

    updated = update_budget(PG_CONFIG, project_id, fields)
    return _response(200, {"budget": updated})


def _record_expense(event, claims, project_id):
    budget = get_budget_by_project(PG_CONFIG, project_id)
    if not budget:
        return _response(404, {"error": "Budget not found"})
    project = get_project(PG_CONFIG, project_id)
    if not _can_manage_budget(claims, project):
        return _response(403, {"error": "Only Admin, Finance, or the project's manager can record expenses"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    amount = body.get("amount")
    if amount is None or float(amount) <= 0:
        return _response(400, {"error": "amount must be a positive number"})

    updated = record_expense(PG_CONFIG, project_id, amount)
    return _response(200, {"budget": updated})


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
        project_id, sub_resource = _parse_path(path)

        if sub_resource == "expenses" and method == "POST":
            return _record_expense(event, claims, project_id)

        if method == "GET" and project_id is None:
            return _list(event)
        if method == "POST" and project_id is None:
            return _create(event, claims)
        if method == "GET" and project_id is not None:
            return _get(project_id)
        if method == "PUT" and project_id is not None:
            return _update(event, claims, project_id)

        return _response(404, {"error": f"No route for {method} {path}"})
    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return _response(500, {"error": "Internal server error", "message": str(e)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/budgets", "headers": {}}))
