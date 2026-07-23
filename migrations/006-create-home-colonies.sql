CREATE TABLE planets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  planet_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  system_id TEXT NOT NULL,
  owner_empire_id TEXT NOT NULL REFERENCES empires (empire_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('terrestrial', 'gas-giant', 'ice', 'barren')),
  size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large')),
  UNIQUE (campaign_id, planet_id)
);

CREATE TABLE colonies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colony_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  empire_id TEXT NOT NULL REFERENCES empires (empire_id) ON DELETE CASCADE,
  planet_id TEXT NOT NULL UNIQUE REFERENCES planets (planet_id) ON DELETE CASCADE,
  system_id TEXT NOT NULL,
  is_home_colony BOOLEAN NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('etabliert')),
  specialization TEXT NOT NULL CHECK (specialization IN ('neutral')),
  UNIQUE (campaign_id, colony_id)
);

-- Genau eine aktive Heimatkolonie je Reich (siehe planeten-und-kolonien.md).
CREATE UNIQUE INDEX colonies_home_per_empire_idx
  ON colonies (empire_id)
  WHERE is_home_colony;

CREATE INDEX planets_owner_idx ON planets (owner_empire_id, planet_id);
CREATE INDEX colonies_empire_idx ON colonies (empire_id, colony_id);
