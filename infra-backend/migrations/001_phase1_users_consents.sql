-- Phase 1 schema for Aurora DSQL (apply when enable_dsql=true)
-- No foreign keys (DSQL limitation) — enforce in API layer. Use UUIDs.

CREATE TABLE IF NOT EXISTS users (
  sub            TEXT PRIMARY KEY,
  email          TEXT,
  market         TEXT NOT NULL DEFAULT 'UK',
  locale         TEXT NOT NULL DEFAULT 'en-GB',
  age_confirmed_18 BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  modules        TEXT NOT NULL DEFAULT '["period_tracker"]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consents (
  id             TEXT PRIMARY KEY,
  user_sub       TEXT NOT NULL,
  purpose        TEXT NOT NULL,
  granted        BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL,
  jurisdiction   TEXT NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consents_user_sub_idx ON consents (user_sub);
