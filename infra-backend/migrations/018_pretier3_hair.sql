-- P3.3 Hair Studio (DSQL: one DDL per statement)
-- No FOREIGN KEY. kind is analysis | tryon. type_score is JSON.

CREATE TABLE IF NOT EXISTS hair_scans (
  id                   TEXT PRIMARY KEY,
  user_sub             TEXT NOT NULL,
  youcam_task_id       TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  cycle_day_at_scan    INTEGER,
  cycle_phase_at_scan  TEXT,
  type_score           TEXT NOT NULL,
  result_s3_key        TEXT NOT NULL,
  hair_color           TEXT,
  hairstyle_id         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS hair_scans_user_sub_idx
  ON hair_scans (user_sub);
