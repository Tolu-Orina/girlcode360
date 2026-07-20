-- Phase 6: Zara quota + HealthLens reports + population learning consent

CREATE TABLE IF NOT EXISTS zara_quota (
  user_sub   TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_sub, day_key)
);

CREATE TABLE IF NOT EXISTS healthlens_reports (
  id           TEXT PRIMARY KEY,
  user_sub     TEXT NOT NULL,
  narrative    TEXT NOT NULL,
  confidence   TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS healthlens_reports_user_idx ON healthlens_reports (user_sub);

CREATE TABLE IF NOT EXISTS healthlens_prefs (
  user_sub TEXT PRIMARY KEY,
  population_learning_consent BOOLEAN NOT NULL DEFAULT FALSE,
  last_ondemand_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
