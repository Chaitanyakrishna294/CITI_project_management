# Database & API Mapping

## 1. Purpose

This document is the traceability layer between the planning documents and the
implementation. It connects each module to the tables it owns, the REST
endpoints that expose them, the UI screens that consume them, and the business
rules enforced along the way.

Read it alongside:

* [`PRD.md`](PRD.md) — business objectives, roles, business rules
* [`TRD.md`](TRD.md) — architecture, technology stack, security requirements
* [`Application_Flow.md`](Application_Flow.md) — functional flows
* [`UI_UX_Design&UserFlow.md`](UI_UX_Design&UserFlow.md) — screens UI-01 … UI-10
* [`Implementation_plan.md`](Implementation_plan.md) — phases 1 … 10

---

## 2. Module Traceability Matrix

| Phase | Module              | Tables                                      | Service (Lambda)       | UI Screens                        |
| ----- | ------------------- | ------------------------------------------- | ---------------------- | --------------------------------- |
| 1     | Authentication      | `users`                                     | `auth-service`         | UI-01 Login                       |
| 2     | User Management     | `users`                                     | `users-service`        | UI-10 User Management             |
| 3     | Project Management  | `projects`                                  | `projects-service`     | UI-03, UI-04, UI-05               |
| 4     | Deliverables        | `deliverables`, `deliverable_dependencies`  | `deliverables-service` | UI-05 (tab), UI-06 Deliverables   |
| 5     | Resource Management | `resources`, `resource_allocations`         | `resources-service`    | UI-05 (tab), UI-07 Resources      |
| 6     | Budget Management   | `budgets`                                   | `budgets-service`      | UI-05 (tab), UI-08 Budgets        |
| 7     | Dashboard & Reports | derived queries across all tables           | all services           | UI-02 Dashboard, UI-09 Reports    |
| 8     | Search & Filters    | derived queries across all tables           | all services           | Search Results, list filter bars  |

---

## 3. Entity Relationship Overview

```text
users 1───┬──< projects            (projects.manager_id — exactly one manager)
          ├──< deliverables        (deliverables.owner_id — nullable)
          └──1 resources           (resources.user_id)

projects 1──< deliverables         (ON DELETE CASCADE)
projects 1──< resource_allocations (ON DELETE CASCADE)
projects 1──1 budgets              (UNIQUE project_id, ON DELETE CASCADE)

resources 1──< resource_allocations
deliverables >──< deliverables     (via deliverable_dependencies)
```

Schema of record: [`../db/schema.sql`](../db/schema.sql). Sample data:
[`../db/seed.sql`](../db/seed.sql).

---

## 4. Table Reference

### `users`

| Column          | Type           | Notes                                                   |
| --------------- | -------------- | ------------------------------------------------------- |
| `id`            | SERIAL PK      |                                                         |
| `name`          | VARCHAR(255)   | Required                                                |
| `email`         | VARCHAR(255)   | Required, **UNIQUE** — the login identifier             |
| `password_hash` | VARCHAR(255)   | bcrypt; plaintext is never stored or logged             |
| `role`          | `user_role`    | `admin`, `project_manager`, `team_member`, `finance`, `viewer` |
| `is_active`     | BOOLEAN        | Deactivation is a soft delete; rows are never removed   |

### `projects`

| Column       | Type              | Notes                                                |
| ------------ | ----------------- | ---------------------------------------------------- |
| `id`         | SERIAL PK         |                                                      |
| `name`       | VARCHAR(255)      | Required                                             |
| `status`     | `project_status`  | `active`, `completed`, `delayed`, `archived`         |
| `manager_id` | FK → `users.id`   | **NOT NULL** — enforces "every project has one manager" |
| `department` | VARCHAR(255)      | Drives the department filter                         |
| `start_date` / `end_date` | DATE | Drive the date-range filter and the at-risk rule     |

Indexes: `manager_id`, `status`.

### `deliverables`

| Column       | Type                  | Notes                                              |
| ------------ | --------------------- | -------------------------------------------------- |
| `project_id` | FK → `projects.id`    | **NOT NULL**, `ON DELETE CASCADE` — a deliverable belongs to exactly one project |
| `owner_id`   | FK → `users.id`       | Nullable — unassigned deliverables are allowed      |
| `status`     | `deliverable_status`  | `not_started`, `in_progress`, `blocked`, `completed` |
| `due_date`   | DATE                  | Drives upcoming-deadline and overdue views          |

Indexes: `project_id`, `owner_id`.

### `deliverable_dependencies`

Join table for BO-06. `CHECK (deliverable_id <> depends_on_deliverable_id)`
blocks self-dependency; `UNIQUE (deliverable_id, depends_on_deliverable_id)`
blocks duplicates.

### `resources`

One row per person doing project work. `weekly_capacity NUMERIC(5,2)` is the
denominator for the over-allocation rule.

### `resource_allocations`

| Constraint                              | Purpose                                  |
| --------------------------------------- | ---------------------------------------- |
| `CHECK (allocation_pct > 0 AND <= 100)` | An allocation is a meaningful percentage |
| `UNIQUE (resource_id, project_id)`      | Blocks duplicate assignments             |
| `ON DELETE CASCADE` on both FKs         | Allocations never outlive their parents  |

### `budgets`

| Constraint                    | Business rule               |
| ----------------------------- | --------------------------- |
| `UNIQUE (project_id)`         | One budget per project      |
| `CHECK (planned_amount >= 0)` | "Budget cannot be negative" |
| `CHECK (actual_spend >= 0)`   | Spend cannot be negative    |

`remaining_amount` is **derived** (`planned_amount - actual_spend`) in the
query, never stored, so it cannot drift.

---

## 5. API Endpoint Mapping

All endpoints are served through the gateway as `/api/<service>/<path>` and
return JSON. Every route except `POST /login` requires an
`Authorization: Bearer <jwt>` header.

### Authentication — `auth-service` → `users`

| Method | Path      | Roles | Purpose                                   |
| ------ | --------- | ----- | ----------------------------------------- |
| POST   | `/login`  | —     | Verify credentials, issue a JWT           |
| POST   | `/logout` | Any   | Client discards the token (stateless JWT) |
| GET    | `/me`     | Any   | Resolve the current user from the token   |

### Users — `users-service` → `users`

| Method | Path          | Roles | Purpose                        |
| ------ | ------------- | ----- | ------------------------------ |
| GET    | `/users`      | Admin | List users                     |
| POST   | `/users`      | Admin | Create a user (bcrypt-hashed)  |
| GET    | `/users/{id}` | Admin | Fetch one user                 |
| PUT    | `/users/{id}` | Admin | Update name, role, active flag |
| DELETE | `/users/{id}` | Admin | Deactivate (soft delete)       |

### Projects — `projects-service` → `projects`

| Method | Path             | Roles                  | Purpose                 |
| ------ | ---------------- | ---------------------- | ----------------------- |
| GET    | `/projects`      | Any                    | List, filter and search |
| POST   | `/projects`      | Admin, Project Manager | Create                  |
| GET    | `/projects/{id}` | Any                    | Fetch one project       |
| PUT    | `/projects/{id}` | Admin, own manager     | Update                  |
| DELETE | `/projects/{id}` | Admin, own manager     | Archive (soft delete)   |

`GET /projects` query parameters — the complete filter set from
Application_Flow §9:

| Parameter                   | Maps to                                |
| --------------------------- | -------------------------------------- |
| `status`                    | `projects.status`                      |
| `manager_id`                | `projects.manager_id`                  |
| `department`                | `projects.department`                  |
| `date_from` / `date_to`     | `start_date >=` / `end_date <=`        |
| `budget_min` / `budget_max` | `budgets.planned_amount` via LEFT JOIN |
| `q`                         | `name ILIKE` OR `description ILIKE`    |

### Deliverables — `deliverables-service`

| Method | Path                                      | Roles                    |
| ------ | ----------------------------------------- | ------------------------ |
| GET    | `/deliverables`                           | Any                      |
| POST   | `/deliverables`                           | Admin, project's manager |
| GET    | `/deliverables/{id}`                      | Any                      |
| PUT    | `/deliverables/{id}`                      | Admin, manager, or owner |
| DELETE | `/deliverables/{id}`                      | Admin, project's manager |
| GET    | `/deliverables/{id}/dependencies`         | Any                      |
| POST   | `/deliverables/{id}/dependencies`         | Admin, project's manager |
| DELETE | `/deliverables/{id}/dependencies/{depId}` | Admin, project's manager |

Filters: `project_id`, `status`, `owner_id`, `q`.

### Resources — `resources-service`

| Method | Path                | Roles                    |
| ------ | ------------------- | ------------------------ |
| GET    | `/resources`        | Any                      |
| POST   | `/resources`        | Admin, Project Manager   |
| GET    | `/resources/{id}`   | Any                      |
| PUT    | `/resources/{id}`   | Admin, Project Manager   |
| GET    | `/allocations`      | Any                      |
| POST   | `/allocations`      | Admin, project's manager |
| PUT    | `/allocations/{id}` | Admin, project's manager |
| DELETE | `/allocations/{id}` | Admin, project's manager |

`GET /resources` returns `total_allocation_pct` as a `SUM` over
`resource_allocations`, which is what the over-allocation indicator compares
against `weekly_capacity`.

Allocation writes are scoped to the manager of the project being allocated to,
matching PRD §9 ("Manage assigned projects") and the rule `projects-service` and
`deliverables-service` already apply. For `PUT`/`DELETE` the project is resolved
from the allocation's `project_id`. Admin is unrestricted.

Resource *records* are managed by Admin and Project Manager. A PM staffs their
own projects, so requiring an admin to add each person before they can be
allocated would block routine work. Note the consequence: `weekly_capacity` is
the ceiling the over-allocation guard compares against, and a resource is shared
across projects, so a PM raising it affects every other manager's view of that
person's availability. The guard still holds — allocations are rejected past
capacity — but the ceiling itself is not restricted to Admin.

The Resources page mirrors this: `canManage` covers Admin and Project Manager.
Because `GET /users` is Admin-only, the create dialog shows a name picker to an
Admin and a numeric **User ID** field to a Project Manager.

### Budgets — `budgets-service`

| Method | Path                            | Roles                             |
| ------ | ------------------------------- | --------------------------------- |
| GET    | `/budgets`                      | Any                               |
| POST   | `/budgets`                      | Admin, Finance, project's manager |
| GET    | `/budgets/{projectId}`          | Any                               |
| PUT    | `/budgets/{projectId}`          | Admin, Finance, project's manager |
| POST   | `/budgets/{projectId}/expenses` | Admin, Finance, project's manager |

---

## 6. Business Rule Enforcement

Each rule from PRD §13 is enforced at the lowest layer that can enforce it, and
re-checked above it.

| Business rule                                | Database                                | API                                       | UI                                  |
| -------------------------------------------- | --------------------------------------- | ----------------------------------------- | ----------------------------------- |
| Every project has exactly one manager         | `manager_id` NOT NULL + FK              | Manager must be an active admin/PM        | Manager field required on the form  |
| A deliverable belongs to exactly one project  | `project_id` NOT NULL + FK CASCADE      | `project_id` required on create           | Created from within a project       |
| Budget cannot be negative                     | `CHECK (planned_amount >= 0)`           | 400 "planned_amount cannot be negative"   | Inline error before submit          |
| Only managers archive projects                | —                                       | 403 unless admin or own manager           | Archive button hidden otherwise     |
| Contributors cannot delete projects           | —                                       | 403 for team_member/viewer/finance        | Action hidden                       |
| Viewers cannot modify data                    | —                                       | 403 on every write                        | All write controls hidden           |
| Closed projects take no new deliverables      | —                                       | 400 on create against an archived project | Add button disabled                 |
| No duplicate resource assignments             | `UNIQUE (resource_id, project_id)`      | 409 on conflict                           | Already-assigned resources filtered |
| Allocation is a valid percentage              | `CHECK (allocation_pct > 0 AND <= 100)` | 400 on out-of-range                       | Numeric input bounds                |
| A deliverable cannot depend on itself         | `CHECK (id <> depends_on_id)`           | 400                                       | Self excluded from the picker       |

---

## 7. Derived Values

Nothing below is stored; each is computed at read time so it cannot go stale.

| Value                  | Formula                                                          | Used by             |
| ---------------------- | ---------------------------------------------------------------- | ------------------- |
| `remaining_amount`     | `planned_amount - actual_spend`                                  | UI-08, UI-09        |
| Budget utilisation     | `actual_spend / planned_amount`                                  | UI-02, UI-08, UI-09 |
| `total_allocation_pct` | `SUM(resource_allocations.allocation_pct)` per resource          | UI-02, UI-07, UI-09 |
| Over-allocated         | `total_allocation_pct > weekly_capacity`                         | BO-05               |
| Project at risk        | `status = 'delayed' OR (status = 'active' AND end_date < today)` | BO-02               |
| Overdue deliverable    | `status <> 'completed' AND due_date < today`                     | BO-04               |
| Percent complete       | completed deliverables ÷ total deliverables, per project         | UI-09               |

---

## 8. Security Notes

Per TRD §17:

* Passwords are hashed with bcrypt; plaintext is never stored, logged or returned.
* JWTs are signed with `HS256` using the `JWT_SECRET` environment variable and
  expire after 8 hours. Secrets come from environment variables, never source.
* Every SQL statement uses parameterised placeholders (`%s`) — no string
  interpolation of user input — which is what prevents SQL injection.
* Authorisation is re-checked server-side on every request. Hidden UI controls
  are a convenience, never the control.
* No endpoint exposes `password_hash`.
