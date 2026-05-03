-- Single-row config table for password policy.
-- Clients override defaults by updating this row in Supabase Studio.
CREATE TABLE IF NOT EXISTS password_policy (
  id         integer PRIMARY KEY DEFAULT 1,
  min_length integer NOT NULL DEFAULT 8,
  require_number    boolean NOT NULL DEFAULT true,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_lowercase boolean NOT NULL DEFAULT false,
  require_special   boolean NOT NULL DEFAULT false,
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE password_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "password_policy_public_read"
  ON password_policy FOR SELECT USING (true);

INSERT INTO password_policy (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
