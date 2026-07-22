CREATE TABLE sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts (account_id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX sessions_active_token_hash_idx
  ON sessions (token_hash)
  WHERE revoked_at IS NULL;
