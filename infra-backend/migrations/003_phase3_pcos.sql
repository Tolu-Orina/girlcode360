-- Phase 3 schema for Aurora DSQL (apply when enable_dsql=true)
-- No foreign keys — enforce in API. UUIDs as TEXT.

CREATE TABLE IF NOT EXISTS pcos_biometrics (
  user_sub    TEXT NOT NULL,
  day_date    TEXT NOT NULL,
  weight_kg   DOUBLE PRECISION,
  sleep_hours DOUBLE PRECISION,
  water_glasses INTEGER,
  stress      INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, day_date)
);

CREATE TABLE IF NOT EXISTS pcos_medications (
  id          TEXT PRIMARY KEY,
  user_sub    TEXT NOT NULL,
  name        TEXT NOT NULL,
  dosage      TEXT,
  time_local  TEXT NOT NULL,
  frequency   TEXT NOT NULL DEFAULT 'daily',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pcos_meds_user_idx ON pcos_medications (user_sub);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,
  user_sub    TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subscriptions (user_sub);
