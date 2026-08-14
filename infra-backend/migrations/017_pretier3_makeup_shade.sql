-- P3.1 Makeup Studio + Shade Match foundations (DSQL: one DDL per statement)
-- No FOREIGN KEY. source_scan_id is API-enforced against skin_scans.id.

CREATE TABLE IF NOT EXISTS makeup_looks (
  id              TEXT PRIMARY KEY,
  user_sub        TEXT NOT NULL,
  youcam_task_id  TEXT NOT NULL,
  categories      TEXT NOT NULL,
  source_kind     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  result_s3_key   TEXT NOT NULL,
  saved           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS makeup_looks_user_sub_idx
  ON makeup_looks (user_sub);

CREATE TABLE IF NOT EXISTS shade_matches (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  source_scan_id     TEXT NOT NULL,
  fitzpatrick_type   TEXT,
  matches            TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS shade_matches_user_sub_idx
  ON shade_matches (user_sub);
