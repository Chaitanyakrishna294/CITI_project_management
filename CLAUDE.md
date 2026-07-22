# CLAUDE.md

Guidance for working on the **ACME Project Management Platform**, derived from the planning docs in `req/`.

## Project Overview

A centralized project management platform replacing spreadsheets/email-based tracking. Core capabilities: project management, deliverables, resource allocation, budget tracking, dashboards, search/filters, and reporting. See `req/PRD.md` for full business objectives and requirements.

**Out of scope:** email notifications, mobile app, AI forecasting, external ERP integrations, payroll, time tracking, chat.

## Tech Stack

| Layer          | Technology                         |
| -------------- | ----------------------------------- |
| Frontend       | React.js + Material UI              |
| Backend        | Python REST APIs                    |
| Database       | PostgreSQL (Amazon Aurora in prod)  |
| Auth           | JWT + bcrypt password hashing       |
| Infra          | Terraform, AWS Lambda, S3, CloudFront |
| Version Control| Git / GitHub                        |

Architecture is layered and stateless: `API Routes → Controllers → Services → Repositories → PostgreSQL`. Frontend is component-based with routing, hooks, contexts, and a services layer for API calls. See `req/TRD.md` for full details.

## Roles & Permissions (RBAC)

| Role             | Access                                  |
| ---------------- | ---------------------------------------- |
| Admin            | Full system access                       |
| Project Manager  | Manage assigned projects                 |
| Team Member      | Update assigned deliverables             |
| Finance Team     | Budget visibility and updates            |
| Viewer           | Read-only access                         |

Key business rules: every project has exactly one manager; a deliverable belongs to exactly one project; budgets cannot be negative; only managers archive projects; contributors cannot delete projects; viewers cannot modify data; closed projects cannot receive new deliverables.

## Module Build Order

Follow this dependency order when implementing or extending features (see `req/Implementation_plan.md`):

1. Authentication & RBAC
2. User Management
3. Project Management
4. Deliverables
5. Resource Management
6. Budget Management
7. Dashboard & Reports
8. Search & Filters
9. Testing & Optimization
10. Deployment

## Non-Functional Requirements

- Dashboard loads in <2s; API responses <500ms
- 99.9% uptime target
- WCAG-compliant, responsive across desktop/tablet/mobile
- Security: JWT auth, bcrypt hashing, RBAC, HTTPS, input validation, SQL injection prevention, CORS, secrets in env vars

## UI/UX Conventions

- Use Material UI components consistently; 8px spacing grid
- Every form: validate before submit, inline errors, disable submit while processing, success confirmation on completion
- Every list/table: support sort, search, filter, pagination
- Destructive actions require a confirmation dialog
- Provide loading (skeleton), empty, and error states for all data views

See `req/UI_UX_Design&UserFlow.md` and `req/Application_Flow.md` for full navigation flows and screen specs.

### Reuse these before writing new ones

| Need | Use |
| ---- | --- |
| Colours, typography, 8px grid | `frontend/src/theme.js` — never hardcode hex; `STATUS_COLORS` for state, `CHART_COLORS` for series |
| A table | `components/DataTable.jsx` — declarative columns, sorting, pagination, CSV export |
| Loading / empty / error | `components/PageState.jsx` — `LoadingState`, `EmptyState`, `ErrorState` |
| Confirming a destructive action | `components/ConfirmDialog.jsx` — never `window.confirm` |
| A chart | `components/charts/` — `BarChart`, `DonutChart`, `LineChart` wrapped in `ChartFrame` (legend + data-table fallback) |
| CSV output | `utils/csv.js` |

Numeric columns from Postgres (`NUMERIC`) arrive as **strings** — wrap in `Number()` before any arithmetic or comparison.

Data screens derive `loading` from a request key rather than calling `setState` synchronously inside an effect; the `react-hooks/set-state-in-effect` lint rule enforces this. Follow the pattern in `pages/Projects.jsx`.

### Commands

```sh
./backend/run-tests.sh        # backend: one pytest process per service
cd frontend && npm test       # frontend: Vitest + React Testing Library
cd frontend && npm run lint   # must stay at zero errors
```

---

## Model Selection Guide

This project uses React, FastAPI, PostgreSQL, and AWS. Use the following model/effort split when working on tasks here:

**Opus 4.8 (High effort)** — planning and architecture work:
- PRDs, TRDs
- System architecture, database design, ER diagrams
- Security design/review
- Complex backend logic
- Code review
- Refactoring large projects
- Performance optimization

**Sonnet 5 (Medium effort)** — everyday implementation work:
- React components, FastAPI endpoints, Express.js/REST APIs
- SQL queries, CRUD operations
- Authentication, API integration
- Bug fixing, unit tests
- Documentation updates

**Haiku (Low effort)** — small mechanical tasks:
- Git commands, shell scripts, PowerShell
- Docker commands, YAML/JSON
- Markdown formatting, regex
- Linux commands

### Recommended workflow order

Planning → Architecture → Database Design (Opus, High)
→ Backend Development → Frontend Development → Testing (Sonnet, Medium)
→ Deployment Scripts, Git/Shell/Docker (Haiku, Low)
→ Documentation Updates (Sonnet, Medium)
→ Final Architecture Review (Opus, High)
