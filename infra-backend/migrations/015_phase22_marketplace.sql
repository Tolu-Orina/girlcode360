-- Phase 2.2 marketplace richness + wallet meds (DSQL: one DDL per statement)

CREATE TABLE IF NOT EXISTS listing_reviews (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL,
  user_sub    TEXT NOT NULL,
  stars       INTEGER NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS listing_reviews_user_listing_idx
  ON listing_reviews (listing_id, user_sub);

CREATE INDEX ASYNC IF NOT EXISTS listing_reviews_listing_idx
  ON listing_reviews (listing_id);

CREATE TABLE IF NOT EXISTS marketplace_favourites (
  user_sub    TEXT NOT NULL,
  listing_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, listing_id)
);

CREATE INDEX ASYNC IF NOT EXISTS marketplace_favourites_user_idx
  ON marketplace_favourites (user_sub);

CREATE TABLE IF NOT EXISTS wallet_medications (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  name_ciphertext    TEXT NOT NULL,
  name_iv            TEXT NOT NULL,
  dose_ciphertext    TEXT,
  dose_iv            TEXT,
  time_local         TEXT NOT NULL,
  frequency          TEXT NOT NULL DEFAULT 'daily',
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS wallet_medications_user_idx
  ON wallet_medications (user_sub);
