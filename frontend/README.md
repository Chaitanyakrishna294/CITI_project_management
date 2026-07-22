# ACME Project Management Platform — Frontend

React + Material UI single-page application for the ACME Project Management
Platform. Requirements and design specs live in [`../req/`](../req); this
README covers only how the frontend is put together and how to run it.

## Stack

| Concern      | Choice                                             |
| ------------ | -------------------------------------------------- |
| Framework    | React 19                                           |
| UI kit       | Material UI 6 (`@mui/material`, `@mui/icons-material`) |
| Routing      | React Router 6                                     |
| Build tool   | Vite 7                                             |
| Tests        | Vitest + React Testing Library                     |

## Structure

```
frontend/src/
├── components/         # Reusable UI: DataTable, ConfirmDialog, PageState,
│   └── charts/         #   and dependency-free themed SVG charts
├── contexts/           # AuthContext — session, current user, login/logout
├── pages/              # One component per screen (UI-01 … UI-10 in req/)
├── services/           # Thin API layer, one module per backend service
├── test/               # Vitest setup + render helpers with providers
├── theme.js            # MUI design tokens (req/UI_UX_Design&UserFlow.md §9)
├── App.jsx             # Route table + role guards
└── main.jsx            # Entry point: ThemeProvider + CssBaseline + App
```

Every page is reachable through `App.jsx`, wrapped in `ProtectedRoute` (which
enforces authentication and, where specified, role) and rendered inside
`AppLayout` (top bar, search, responsive navigation drawer).

## Screens

| ID    | Screen            | Route                | Roles                          |
| ----- | ----------------- | -------------------- | ------------------------------ |
| UI-01 | Login             | `/login`             | All                            |
| UI-02 | Dashboard         | `/dashboard`         | All                            |
| UI-03 | Projects List     | `/projects`          | All (create: admin, PM)        |
| UI-05 | Project Details   | `/projects/:id`      | All                            |
| UI-06 | Deliverables      | `/deliverables`      | All (edit: admin, PM, owner)   |
| UI-07 | Resources         | `/resources`         | All (edit: admin, PM)          |
| UI-08 | Budget Management | `/budgets`           | admin, PM, finance             |
| UI-09 | Reports           | `/reports`           | All                            |
| UI-10 | User Management   | `/users`             | admin                          |
| —     | Search Results    | `/search?q=`         | All                            |

## Configuration

| Variable       | Default                 | Purpose                          |
| -------------- | ----------------------- | -------------------------------- |
| `VITE_API_URL` | `http://localhost:3001` | Base URL of the backend gateway  |

Requests are issued as `${VITE_API_URL}/api/<service>/<path>` — see
[`src/services/apiClient.js`](src/services/apiClient.js).

## Commands

Run the app locally (starts the backend services and Postgres too):

```sh
./bin/start-dev.sh
```

Then open <http://localhost:3000>.

Frontend-only commands, from this directory:

```sh
npm run dev
```

```sh
npm test
```

```sh
npm run lint
```

```sh
npm run build
```

## Deployment

Build and publish to S3/CloudFront:

```sh
./bin/deploy-frontend.sh
```

To tear down every deployed resource (backend included):

```sh
./bin/cleanup-environment.sh
```

**Warning:** cleanup removes all infrastructure and cannot be undone.
