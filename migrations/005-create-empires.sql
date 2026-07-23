CREATE TABLE empires (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empire_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  status TEXT NOT NULL CHECK (status IN ('vorbereitet', 'aktiv')),
  known_system_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  known_planet_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  CHECK (jsonb_typeof(known_system_ids) = 'array'),
  CHECK (jsonb_typeof(known_planet_ids) = 'array'),
  UNIQUE (campaign_id, empire_id)
);

CREATE TABLE empire_controllers (
  empire_id TEXT NOT NULL PRIMARY KEY REFERENCES empires (empire_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts (account_id),
  controller_type TEXT NOT NULL CHECK (controller_type IN ('player', 'ai')),
  can_read BOOLEAN NOT NULL,
  can_control BOOLEAN NOT NULL
);

CREATE INDEX empires_campaign_idx ON empires (campaign_id, empire_id);
CREATE INDEX empire_controllers_account_idx ON empire_controllers (account_id, empire_id);
