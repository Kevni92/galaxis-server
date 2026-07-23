CREATE TABLE campaigns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE,
  owner_account_id TEXT NOT NULL REFERENCES accounts (account_id),
  campaign_type TEXT NOT NULL CHECK (campaign_type = 'singleplayer'),
  status TEXT NOT NULL CHECK (status = 'running'),
  seed BIGINT NOT NULL CHECK (seed >= 0),
  time_profile TEXT NOT NULL CHECK (length(trim(time_profile)) > 0),
  balancing_version TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  balancing_hash TEXT NOT NULL,
  state_version BIGINT NOT NULL CHECK (state_version >= 1),
  campaign_time_ms BIGINT NOT NULL DEFAULT 0 CHECK (campaign_time_ms >= 0),
  idempotency_key TEXT NOT NULL,
  creation_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (owner_account_id, idempotency_key)
);

CREATE TABLE campaign_participants (
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts (account_id),
  participant_role TEXT NOT NULL CHECK (participant_role = 'owner'),
  can_read BOOLEAN NOT NULL DEFAULT TRUE,
  can_control BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (campaign_id, account_id)
);

CREATE INDEX campaigns_owner_created_idx
  ON campaigns (owner_account_id, created_at DESC, campaign_id DESC);

CREATE INDEX campaign_participants_account_idx
  ON campaign_participants (account_id, campaign_id);
