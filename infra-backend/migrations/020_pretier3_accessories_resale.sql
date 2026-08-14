-- P3.6 Accessories Studio persist + Wardrobe Resale Bridge (DSQL: one DDL per statement)
-- No FOREIGN KEY. accessory_looks is the try-on persist table (illustrative plan listed resale only).
-- status for resale: pending_moderation | live | rejected.

CREATE TABLE IF NOT EXISTS accessory_looks (
  id                   TEXT PRIMARY KEY,
  user_sub             TEXT NOT NULL,
  youcam_task_id       TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  accessory_category   TEXT,
  catalogue_item_id    TEXT NOT NULL,
  asset_3d_id          TEXT,
  nail_color           TEXT,
  frame_id             TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  result_s3_key        TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS accessory_looks_user_sub_idx
  ON accessory_looks (user_sub);

CREATE TABLE IF NOT EXISTS resale_listings (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  wardrobe_item_id   TEXT NOT NULL,
  price_minor        INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending_moderation',
  title              TEXT NOT NULL,
  details            TEXT NOT NULL,
  market             TEXT NOT NULL,
  moderation_ref     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS resale_listings_user_sub_idx
  ON resale_listings (user_sub);
