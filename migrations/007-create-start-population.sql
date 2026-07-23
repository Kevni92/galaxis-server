CREATE TABLE population_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  population_group_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  colony_id TEXT NOT NULL REFERENCES colonies (colony_id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('neutral')),
  total BIGINT NOT NULL CHECK (total >= 0),
  employable BIGINT NOT NULL CHECK (employable >= 0),
  employed BIGINT NOT NULL CHECK (employed >= 0),
  -- Mengenerhaltung: geschachtelte Teilmengen ohne Doppelzählung (siehe bevoelkerung-und-arbeit.md).
  CHECK (employable <= total),
  CHECK (employed <= employable),
  UNIQUE (campaign_id, population_group_id)
);

CREATE TABLE colony_stocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id) ON DELETE CASCADE,
  colony_id TEXT NOT NULL REFERENCES colonies (colony_id) ON DELETE CASCADE,
  resource_category TEXT NOT NULL CHECK (resource_category IN ('essential')),
  quantity BIGINT NOT NULL CHECK (quantity >= 0),
  reserved BIGINT NOT NULL CHECK (reserved >= 0),
  coverage_days INTEGER NOT NULL CHECK (coverage_days >= 0),
  -- Reservierte Menge bleibt getrennt und übersteigt den Bestand nie (siehe wirtschaft-und-versorgung.md).
  CHECK (reserved <= quantity),
  UNIQUE (campaign_id, colony_id, resource_category)
);

CREATE INDEX population_groups_colony_idx ON population_groups (colony_id, population_group_id);
CREATE INDEX colony_stocks_colony_idx ON colony_stocks (colony_id, resource_category);
