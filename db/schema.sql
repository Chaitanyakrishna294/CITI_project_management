-- HEX Project Management Platform — PostgreSQL schema
-- Apply with: psql "$POSTGRES_CONN" -f db/schema.sql

CREATE TYPE user_role AS ENUM ('admin', 'project_manager', 'team_member', 'finance', 'viewer');
CREATE TYPE project_status AS ENUM ('active', 'completed', 'delayed', 'archived');
CREATE TYPE deliverable_status AS ENUM ('not_started', 'in_progress', 'blocked', 'completed');

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    status              project_status NOT NULL DEFAULT 'active',
    manager_id          INTEGER NOT NULL REFERENCES users(id),
    department          VARCHAR(255),
    start_date          DATE,
    end_date            DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deliverables (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    owner_id        INTEGER REFERENCES users(id),
    status          deliverable_status NOT NULL DEFAULT 'not_started',
    due_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deliverable_dependencies (
    id                      SERIAL PRIMARY KEY,
    deliverable_id          INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
    depends_on_deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
    CHECK (deliverable_id <> depends_on_deliverable_id),
    UNIQUE (deliverable_id, depends_on_deliverable_id)
);

CREATE TABLE resources (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    title           VARCHAR(255),
    department      VARCHAR(255),
    weekly_capacity NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resource_allocations (
    id              SERIAL PRIMARY KEY,
    resource_id     INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    allocation_pct  NUMERIC(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
    start_date      DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (resource_id, project_id)
);

CREATE TABLE budgets (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    planned_amount  NUMERIC(14,2) NOT NULL CHECK (planned_amount >= 0),
    actual_spend    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (actual_spend >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_manager_id ON projects(manager_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX idx_deliverables_owner_id ON deliverables(owner_id);
CREATE INDEX idx_resource_allocations_resource_id ON resource_allocations(resource_id);
CREATE INDEX idx_resource_allocations_project_id ON resource_allocations(project_id);

-- ---------------------------------------------------------------------------
-- Team management module (workshop brief: teams, individuals, achievements).
-- Individuals are org people, deliberately separate from login `users` — the
-- brief rules out integration with an Employee Directory, so team rosters are
-- self-service data, not accounts.
-- ---------------------------------------------------------------------------

CREATE TABLE individuals (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    location        VARCHAR(255) NOT NULL,
    -- Direct staff are employees; non-direct covers contractors/vendors.
    is_direct_staff BOOLEAN NOT NULL DEFAULT TRUE,
    is_org_leader   BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL UNIQUE,
    location        VARCHAR(255) NOT NULL,
    leader_id       INTEGER REFERENCES individuals(id) ON DELETE SET NULL,
    -- The individual this team reports to (who may be an org leader).
    reports_to_id   INTEGER REFERENCES individuals(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
    id              SERIAL PRIMARY KEY,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    individual_id   INTEGER NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, individual_id)
);

CREATE TABLE achievements (
    id              SERIAL PRIMARY KEY,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    -- Normalized to the first day of the month by the service layer.
    month           DATE NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_leader_id ON teams(leader_id);
CREATE INDEX idx_teams_reports_to_id ON teams(reports_to_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_individual_id ON team_members(individual_id);
CREATE INDEX idx_achievements_team_id ON achievements(team_id);
CREATE INDEX idx_achievements_month ON achievements(month);
