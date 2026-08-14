-- Phase 2.3 community + in-app marketing inbox (DSQL: one DDL per statement)

CREATE TABLE IF NOT EXISTS community_memberships (
  group_id      TEXT NOT NULL,
  user_sub      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_sub)
);

CREATE INDEX ASYNC IF NOT EXISTS community_memberships_user_idx
  ON community_memberships (user_sub);

CREATE TABLE IF NOT EXISTS community_posts (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL,
  author_sub      TEXT NOT NULL,
  author_display  TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS community_posts_group_status_idx
  ON community_posts (group_id, status);

CREATE INDEX ASYNC IF NOT EXISTS community_posts_author_idx
  ON community_posts (author_sub);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          TEXT PRIMARY KEY,
  user_sub    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  listing_id  TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS in_app_notifications_user_idx
  ON in_app_notifications (user_sub, created_at);
