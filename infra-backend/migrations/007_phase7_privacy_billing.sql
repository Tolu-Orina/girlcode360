-- Phase 7: privacy export/deletion + subscriptions

CREATE TABLE IF NOT EXISTS export_jobs (
  id          TEXT PRIMARY KEY,
  user_sub    TEXT NOT NULL,
  status      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at    TIMESTAMPTZ,
  payload_uri TEXT
);

CREATE INDEX ASYNC IF NOT EXISTS export_jobs_user_idx ON export_jobs (user_sub);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id           TEXT PRIMARY KEY,
  user_sub     TEXT NOT NULL UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_after  TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  purged_at    TIMESTAMPTZ,
  status       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_sub   TEXT PRIMARY KEY,
  premium    BOOLEAN NOT NULL DEFAULT FALSE,
  provider   TEXT,
  renews_at  TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
