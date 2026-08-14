-- P3.4 My Wardrobe (DSQL: one DDL per statement)
-- No FOREIGN KEY. colour_tags / item_ids / tag_suggestions are JSON TEXT.
-- worn_on is ISO date TEXT (plan DATE; TEXT matches cycle dates and avoids DSQL DATE surprises).

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id                   TEXT PRIMARY KEY,
  user_sub             TEXT NOT NULL,
  name                 TEXT,
  category             TEXT,
  colour_tags          TEXT NOT NULL,
  tag_suggestions      TEXT NOT NULL,
  purchase_price_minor INTEGER,
  image_s3_key         TEXT NOT NULL,
  youcam_file_id       TEXT,
  worn_count           INTEGER NOT NULL DEFAULT 0,
  archived             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS wardrobe_items_user_sub_idx
  ON wardrobe_items (user_sub);

CREATE TABLE IF NOT EXISTS wardrobe_outfits (
  id                    TEXT PRIMARY KEY,
  user_sub              TEXT NOT NULL,
  item_ids              TEXT NOT NULL,
  occasion              TEXT,
  worn_on               TEXT,
  status                TEXT NOT NULL DEFAULT 'ready',
  youcam_task_id        TEXT,
  tryon_result_s3_key   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS wardrobe_outfits_user_sub_idx
  ON wardrobe_outfits (user_sub);
