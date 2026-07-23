-- Seed data for local/dev use. Apply after schema.sql:
--     psql "$POSTGRES_CONN" -f db/schema.sql
--     psql "$POSTGRES_CONN" -f db/seed.sql
--
-- req/Implementation_plan.md §5 calls for initial sample data so the dashboard,
-- reports and search screens have something real to render. This file covers
-- every role, every project status, deliverables with dependencies, an
-- over-allocated resource, and budgets both under and over plan.
--
-- Re-runnable: every statement is guarded, so applying it twice is a no-op.
--
-- Demo logins — all accounts share the password below.
--     admin@citi.com      Admin
--     priya@citi.com      Project Manager
--     marco@citi.com      Project Manager
--     sam@citi.com        Team Member
--     dana@citi.com       Team Member
--     lee@citi.com        Team Member
--     fin@citi.com        Finance Team
--     view@citi.com       Viewer
--
-- Password for every seeded account: Workshop123!
-- These are development credentials only. Never load this file into a shared
-- or production environment.

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

INSERT INTO users (name, email, password_hash, role) VALUES
    ('citi Admin',   'admin@citi.com', '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'admin'),
    ('Priya Raman',  'priya@citi.com', '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'project_manager'),
    ('Marco Silva',  'marco@citi.com', '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'project_manager'),
    ('Sam Okafor',   'sam@citi.com',   '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'team_member'),
    ('Dana Whitley', 'dana@citi.com',  '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'team_member'),
    ('Lee Nakamura', 'lee@citi.com',   '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'team_member'),
    ('Fin Adeyemi',  'fin@citi.com',   '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'finance'),
    ('Val Ortiz',    'view@citi.com',  '$2b$12$SQnHSv7mw4Wn/OF7RZar.ujA8H2kt0Aib/7mcehXoBuw6Ag7LxOcG', 'viewer')
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Projects — one in each status so the dashboard's health widgets have data.
-- "Partner Portal" is deliberately active with an end date in the past, which
-- is what the at-risk rule looks for beyond the explicit 'delayed' status.
-- ---------------------------------------------------------------------------

INSERT INTO projects (name, description, status, manager_id, department, start_date, end_date)
SELECT v.name, v.description, v.status::project_status, u.id, v.department, v.start_date, v.end_date
FROM (VALUES
    ('Customer Portal Redesign',
     'Rebuild the self-service portal on the new design system.',
     'active', 'priya@citi.com', 'Engineering', DATE '2026-03-02', DATE '2026-09-30'),
    ('Warehouse Automation',
     'Automate inbound receiving across the three regional warehouses.',
     'active', 'marco@citi.com', 'Operations', DATE '2026-05-11', DATE '2026-12-18'),
    ('Partner Portal',
     'Self-service onboarding for channel partners. Slipped past its planned close.',
     'active', 'priya@citi.com', 'Engineering', DATE '2026-01-05', DATE '2026-06-30'),
    ('Payroll Migration',
     'Move payroll reporting onto the shared finance data warehouse.',
     'delayed', 'marco@citi.com', 'Finance', DATE '2026-02-16', DATE '2026-08-31'),
    ('Mobile Field App',
     'Offline-capable inspection app for field engineers.',
     'completed', 'priya@citi.com', 'Engineering', DATE '2025-09-01', DATE '2026-02-27'),
    ('Legacy CRM Sunset',
     'Decommission the legacy CRM. Archived after the scope moved to IT.',
     'archived', 'marco@citi.com', 'IT', DATE '2025-06-02', DATE '2025-12-19')
) AS v(name, description, status, manager_email, department, start_date, end_date)
JOIN users u ON u.email = v.manager_email
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.name = v.name);

-- ---------------------------------------------------------------------------
-- Deliverables — spread across all four statuses, with due dates on both sides
-- of "today" so upcoming-deadline and overdue views both have rows.
-- ---------------------------------------------------------------------------

INSERT INTO deliverables (project_id, title, description, owner_id, status, due_date)
SELECT p.id, v.title, v.description, o.id, v.status::deliverable_status, v.due_date
FROM (VALUES
    ('Customer Portal Redesign', 'Design system audit',        'Catalogue every component the portal needs.',     'sam@citi.com',  'completed',   DATE '2026-04-10'),
    ('Customer Portal Redesign', 'Account dashboard rebuild',  'Rebuild the landing dashboard on the new kit.',   'dana@citi.com', 'in_progress', DATE '2026-08-14'),
    ('Customer Portal Redesign', 'Billing history screen',     'Paginated invoice history with export.',          'sam@citi.com',  'not_started', DATE '2026-09-11'),
    ('Customer Portal Redesign', 'Accessibility remediation',  'Close the WCAG findings from the design audit.',  'lee@citi.com',  'blocked',     DATE '2026-07-31'),
    ('Warehouse Automation',     'Receiving hardware spec',    'Scanner and printer specification per site.',     'lee@citi.com',  'completed',   DATE '2026-06-05'),
    ('Warehouse Automation',     'Inbound API integration',    'Wire the WMS inbound API to the scanners.',       'dana@citi.com', 'in_progress', DATE '2026-08-28'),
    ('Warehouse Automation',     'Site rollout playbook',      'Runbook for the per-site cutover.',               'sam@citi.com',  'not_started', DATE '2026-10-16'),
    ('Partner Portal',           'Partner onboarding flow',    'Self-service signup and verification.',           'dana@citi.com', 'in_progress', DATE '2026-06-12'),
    ('Partner Portal',           'Commission statements',      'Monthly partner commission statements.',          'lee@citi.com',  'blocked',     DATE '2026-07-03'),
    ('Payroll Migration',        'Data mapping workbook',      'Map legacy payroll fields to the warehouse.',     'sam@citi.com',  'completed',   DATE '2026-05-22'),
    ('Payroll Migration',        'Historical load validation', 'Reconcile three years of loaded history.',        'lee@citi.com',  'blocked',     DATE '2026-07-10'),
    ('Payroll Migration',        'Finance sign-off pack',      'Evidence pack for the finance controller.',       'dana@citi.com', 'not_started', DATE '2026-09-04'),
    ('Mobile Field App',         'Offline sync engine',        'Conflict-free sync for offline inspections.',     'dana@citi.com', 'completed',   DATE '2026-01-16'),
    ('Mobile Field App',         'App store release',          'Ship 1.0 to both app stores.',                    'sam@citi.com',  'completed',   DATE '2026-02-20')
) AS v(project_name, title, description, owner_email, status, due_date)
JOIN projects p ON p.name = v.project_name
JOIN users o ON o.email = v.owner_email
WHERE NOT EXISTS (
    SELECT 1 FROM deliverables d WHERE d.project_id = p.id AND d.title = v.title
);

-- ---------------------------------------------------------------------------
-- Dependencies — BO-06 needs a visible chain: the billing screen waits on the
-- dashboard rebuild, which waits on the design audit.
-- ---------------------------------------------------------------------------

INSERT INTO deliverable_dependencies (deliverable_id, depends_on_deliverable_id)
SELECT d.id, dep.id
FROM (VALUES
    ('Account dashboard rebuild', 'Design system audit'),
    ('Billing history screen',    'Account dashboard rebuild'),
    ('Accessibility remediation', 'Design system audit'),
    ('Inbound API integration',   'Receiving hardware spec'),
    ('Site rollout playbook',     'Inbound API integration'),
    ('Historical load validation', 'Data mapping workbook'),
    ('Finance sign-off pack',     'Historical load validation')
) AS v(title, depends_on_title)
JOIN deliverables d ON d.title = v.title
JOIN deliverables dep ON dep.title = v.depends_on_title
ON CONFLICT (deliverable_id, depends_on_deliverable_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Resources — one row per person who does project work.
-- ---------------------------------------------------------------------------

INSERT INTO resources (user_id, title, department, weekly_capacity)
SELECT u.id, v.title, v.department, v.weekly_capacity
FROM (VALUES
    ('sam@citi.com',   'Senior Engineer',   'Engineering', 100.00),
    ('dana@citi.com',  'Staff Engineer',    'Engineering', 100.00),
    ('lee@citi.com',   'Systems Analyst',   'Operations',   80.00),
    ('priya@citi.com', 'Delivery Manager',  'Engineering', 100.00),
    ('marco@citi.com', 'Programme Manager', 'Operations',  100.00)
) AS v(email, title, department, weekly_capacity)
JOIN users u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM resources r WHERE r.user_id = u.id);

-- ---------------------------------------------------------------------------
-- Allocations — Lee is deliberately over capacity (90% against an 80% weekly
-- capacity) so BO-05 over-allocation detection has something to flag.
-- ---------------------------------------------------------------------------

INSERT INTO resource_allocations (resource_id, project_id, allocation_pct, start_date, end_date)
SELECT r.id, p.id, v.allocation_pct, v.start_date, v.end_date
FROM (VALUES
    ('sam@citi.com',   'Customer Portal Redesign', 60.00, DATE '2026-03-02', DATE '2026-09-30'),
    ('sam@citi.com',   'Payroll Migration',        30.00, DATE '2026-02-16', DATE '2026-08-31'),
    ('dana@citi.com',  'Customer Portal Redesign', 50.00, DATE '2026-03-02', DATE '2026-09-30'),
    ('dana@citi.com',  'Warehouse Automation',     40.00, DATE '2026-05-11', DATE '2026-12-18'),
    ('lee@citi.com',   'Warehouse Automation',     50.00, DATE '2026-05-11', DATE '2026-12-18'),
    ('lee@citi.com',   'Partner Portal',           40.00, DATE '2026-01-05', DATE '2026-06-30'),
    ('priya@citi.com', 'Customer Portal Redesign', 40.00, DATE '2026-03-02', DATE '2026-09-30'),
    ('marco@citi.com', 'Warehouse Automation',     45.00, DATE '2026-05-11', DATE '2026-12-18')
) AS v(email, project_name, allocation_pct, start_date, end_date)
JOIN users u ON u.email = v.email
JOIN resources r ON r.user_id = u.id
JOIN projects p ON p.name = v.project_name
ON CONFLICT (resource_id, project_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Budgets — Payroll Migration is over plan, so BO-07 has an overrun to surface.
-- ---------------------------------------------------------------------------

INSERT INTO budgets (project_id, planned_amount, actual_spend, currency)
SELECT p.id, v.planned_amount, v.actual_spend, v.currency
FROM (VALUES
    ('Customer Portal Redesign', 480000.00, 271500.00, 'USD'),
    ('Warehouse Automation',     725000.00, 198000.00, 'USD'),
    ('Partner Portal',           190000.00, 176400.00, 'USD'),
    ('Payroll Migration',        260000.00, 288750.00, 'USD'),
    ('Mobile Field App',         310000.00, 297300.00, 'USD'),
    ('Legacy CRM Sunset',         95000.00,  94100.00, 'USD')
) AS v(project_name, planned_amount, actual_spend, currency)
JOIN projects p ON p.name = v.project_name
ON CONFLICT (project_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Team management module — individuals, teams, members, achievements.
-- Shaped so every workshop insight has a non-trivial answer:
--   * Atlas: leader in another city (not co-located), reports to an org leader
--   * Nimbus: non-direct leader, 2/4 non-direct members (ratio 50%)
--   * Quartz: fully co-located direct team, reports to a non-org-leader
-- ---------------------------------------------------------------------------

INSERT INTO individuals (name, email, location, is_direct_staff, is_org_leader) VALUES
    ('Olive Grant',   'olive.grant@citi.com',   'New York',  TRUE,  TRUE),
    ('Hector Bloom',  'hector.bloom@citi.com',  'Austin',    TRUE,  FALSE),
    ('Lena Frost',    'lena.frost@citi.com',    'London',    TRUE,  FALSE),
    ('Ravi Chandra',  'ravi.chandra@citi.com',  'Bengaluru', TRUE,  FALSE),
    ('Mia Torres',    'mia.torres@citi.com',    'Austin',    TRUE,  FALSE),
    ('Jonas Weber',   'jonas.weber@citi.com',   'Berlin',    FALSE, FALSE),
    ('Aiko Tanaka',   'aiko.tanaka@citi.com',   'Tokyo',     FALSE, FALSE),
    ('Peter Novak',   'peter.novak@citi.com',   'Berlin',    TRUE,  FALSE),
    ('Sara Lindqvist','sara.lindqvist@citi.com','Berlin',    FALSE, FALSE),
    ('Tom Reilly',    'tom.reilly@citi.com',    'Austin',    TRUE,  FALSE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO teams (name, location, leader_id, reports_to_id)
SELECT v.name, v.location, l.id, r.id
FROM (VALUES
    ('Atlas',  'Austin', 'lena.frost@citi.com',   'olive.grant@citi.com'),
    ('Nimbus', 'Berlin', 'jonas.weber@citi.com',  'hector.bloom@citi.com'),
    ('Quartz', 'Austin', 'hector.bloom@citi.com', 'lena.frost@citi.com')
) AS v(name, location, leader_email, reports_to_email)
JOIN individuals l ON l.email = v.leader_email
JOIN individuals r ON r.email = v.reports_to_email
ON CONFLICT (name) DO NOTHING;

INSERT INTO team_members (team_id, individual_id)
SELECT t.id, i.id
FROM (VALUES
    ('Atlas',  'mia.torres@citi.com'),
    ('Atlas',  'tom.reilly@citi.com'),
    ('Atlas',  'ravi.chandra@citi.com'),
    ('Nimbus', 'jonas.weber@citi.com'),
    ('Nimbus', 'peter.novak@citi.com'),
    ('Nimbus', 'sara.lindqvist@citi.com'),
    ('Nimbus', 'aiko.tanaka@citi.com'),
    ('Quartz', 'hector.bloom@citi.com'),
    ('Quartz', 'mia.torres@citi.com'),
    ('Quartz', 'tom.reilly@citi.com')
) AS v(team_name, email)
JOIN teams t ON t.name = v.team_name
JOIN individuals i ON i.email = v.email
ON CONFLICT (team_id, individual_id) DO NOTHING;

INSERT INTO achievements (team_id, month, title, description)
SELECT t.id, v.month::date, v.title, v.description
FROM (VALUES
    ('Atlas',  '2026-05-01', 'Shipped billing v2',        'Migrated all invoicing to the new billing engine.'),
    ('Atlas',  '2026-06-01', 'Cut API latency 40%',       'Query tuning and connection pooling across services.'),
    ('Nimbus', '2026-06-01', 'Zero-downtime DB upgrade',  'Postgres 15 to 16 with logical replication.'),
    ('Nimbus', '2026-07-01', 'Launched partner sandbox',  'Self-serve API sandbox for integration partners.'),
    ('Quartz', '2026-07-01', 'Closed Q2 audit',           'All findings resolved ahead of the deadline.')
) AS v(team_name, month, title, description)
JOIN teams t ON t.name = v.team_name
WHERE NOT EXISTS (
    SELECT 1 FROM achievements a WHERE a.team_id = t.id AND a.month = v.month::date AND a.title = v.title
);
