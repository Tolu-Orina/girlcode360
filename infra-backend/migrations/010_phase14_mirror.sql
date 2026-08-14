-- Phase 1.4 Mirror — Aurora DSQL (no foreign keys)

CREATE TABLE IF NOT EXISTS skin_scans (
  id                  TEXT PRIMARY KEY,
  user_sub            TEXT NOT NULL,
  youcam_task_id      TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  cycle_day_at_scan   INT,
  cycle_phase_at_scan TEXT,
  overall_score       INT,
  scores              TEXT NOT NULL DEFAULT '{}',
  mask_overlay_s3_key TEXT,
  result_s3_key       TEXT,
  source_s3_key       TEXT,
  scan_quality        TEXT NOT NULL DEFAULT 'sd',
  insight_json        TEXT,
  seeded              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS skin_scans_user_sub_idx ON skin_scans (user_sub);

CREATE TABLE IF NOT EXISTS apparel_tryons (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  youcam_task_id     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  catalogue_item_id  TEXT NOT NULL,
  result_s3_key      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS apparel_tryons_user_sub_idx ON apparel_tryons (user_sub);
