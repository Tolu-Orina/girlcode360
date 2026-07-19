-- Phase 2 schema for Aurora DSQL (apply when enable_dsql=true)
-- No foreign keys (DSQL limitation) — enforce in API layer. Use UUIDs.

CREATE TABLE IF NOT EXISTS cycles (
  id                     TEXT PRIMARY KEY,
  user_sub               TEXT NOT NULL,
  start_date             TEXT NOT NULL,
  end_date               TEXT,
  cycle_length_override  INTEGER,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cycles_user_sub_idx ON cycles (user_sub);
CREATE INDEX IF NOT EXISTS cycles_user_start_idx ON cycles (user_sub, start_date);

CREATE TABLE IF NOT EXISTS cycle_days (
  user_sub     TEXT NOT NULL,
  day_date     TEXT NOT NULL,
  flow         TEXT NOT NULL DEFAULT 'none',
  mood         INTEGER,
  symptom_ids  TEXT NOT NULL DEFAULT '[]',
  note         TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, day_date)
);

CREATE INDEX IF NOT EXISTS cycle_days_user_idx ON cycle_days (user_sub);

CREATE TABLE IF NOT EXISTS sync_idempotency (
  user_sub         TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  response_json    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, idempotency_key)
);
