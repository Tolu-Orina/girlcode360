-- Phase 1.7 marketplace, SheMatch prefs, notification send log (DSQL — no FKs)

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                    TEXT PRIMARY KEY,
  owner_sub             TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  market                TEXT NOT NULL,
  address               TEXT NOT NULL,
  phone                 TEXT,
  lat                   DOUBLE PRECISION NOT NULL,
  lng                   DOUBLE PRECISION NOT NULL,
  hours                 TEXT NOT NULL,
  rating                DOUBLE PRECISION NOT NULL DEFAULT 0,
  tags                  TEXT NOT NULL DEFAULT '[]',
  services              TEXT NOT NULL DEFAULT '[]',
  registration_number   TEXT,
  catalogue_item_id     TEXT,
  sponsored             BOOLEAN NOT NULL DEFAULT FALSE,
  seeded                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at          TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS marketplace_listings_status_idx
  ON marketplace_listings (status);
CREATE INDEX ASYNC IF NOT EXISTS marketplace_listings_owner_idx
  ON marketplace_listings (owner_sub);
CREATE INDEX ASYNC IF NOT EXISTS marketplace_listings_market_idx
  ON marketplace_listings (market);

CREATE TABLE IF NOT EXISTS shematch_module_prefs (
  user_sub    TEXT NOT NULL,
  module      TEXT NOT NULL,
  granted     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, module)
);

CREATE TABLE IF NOT EXISTS notification_sends (
  id          TEXT PRIMARY KEY,
  user_sub    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  slot_key    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS notification_sends_user_idx
  ON notification_sends (user_sub);
CREATE UNIQUE INDEX ASYNC IF NOT EXISTS notification_sends_slot_idx
  ON notification_sends (user_sub, kind, slot_key);

