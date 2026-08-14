-- Phase 1.8 content reports / moderation queue (DSQL — no FKs)

CREATE TABLE IF NOT EXISTS content_reports (
  id            TEXT PRIMARY KEY,
  reporter_sub  TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  details       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS content_reports_reporter_idx
  ON content_reports (reporter_sub);

CREATE INDEX ASYNC IF NOT EXISTS content_reports_status_idx
  ON content_reports (status);

CREATE INDEX ASYNC IF NOT EXISTS content_reports_target_idx
  ON content_reports (target_type, target_id);
