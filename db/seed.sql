-- Seed data for local/dev use. Apply after schema.sql.
-- Default admin login: admin@acme.com / ChangeMe123!  (change immediately in any shared environment)

INSERT INTO users (name, email, password_hash, role)
VALUES ('ACME Admin', 'admin@acme.com', '$2b$12$NwgFwFYkCru0/YwyMGz.6.qKMWqoYYaQDx/MSiKrptuxcJZYOLFEC', 'admin')
ON CONFLICT (email) DO NOTHING;
