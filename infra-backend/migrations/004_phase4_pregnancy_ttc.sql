-- Phase 4 schema for Aurora DSQL (apply when enable_dsql=true)
-- No foreign keys — enforce in API. UUIDs as TEXT.

CREATE TABLE IF NOT EXISTS pregnancy_profiles (
  user_sub     TEXT PRIMARY KEY,
  method       TEXT NOT NULL,
  anchor_date  TEXT NOT NULL,
  edd          TEXT NOT NULL,
  edd_early    TEXT NOT NULL,
  edd_late     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pregnancy_days (
  user_sub   TEXT NOT NULL,
  day_date   TEXT NOT NULL,
  symptoms   TEXT NOT NULL DEFAULT '[]',
  wellbeing  INTEGER,
  weight_kg  DOUBLE PRECISION,
  kicks      INTEGER,
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, day_date)
);

CREATE TABLE IF NOT EXISTS appointments (
  id                  TEXT PRIMARY KEY,
  user_sub            TEXT NOT NULL,
  appt_date           TEXT NOT NULL,
  time_local          TEXT,
  location            TEXT,
  appt_type           TEXT NOT NULL,
  notes               TEXT,
  remind_day_before   BOOLEAN NOT NULL DEFAULT TRUE,
  remind_hour_before  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointments_user_idx ON appointments (user_sub);

CREATE TABLE IF NOT EXISTS ttc_profiles (
  user_sub    TEXT PRIMARY KEY,
  started_on  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ttc_days (
  user_sub   TEXT NOT NULL,
  day_date   TEXT NOT NULL,
  bbt_c      DOUBLE PRECISION,
  mucus      TEXT,
  intimacy   BOOLEAN NOT NULL DEFAULT FALSE,
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_sub, day_date)
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_sub            TEXT PRIMARY KEY,
  master_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  period_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  ovulation_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  appointments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  medication_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_insights_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start   TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end     TEXT NOT NULL DEFAULT '07:00',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
