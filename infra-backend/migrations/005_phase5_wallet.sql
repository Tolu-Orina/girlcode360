-- Phase 5 schema for Aurora DSQL (apply when enable_dsql=true)
-- Server stores ciphertext + wrapped keys only — never plaintext.

CREATE TABLE IF NOT EXISTS wallet_docs (
  id               TEXT PRIMARY KEY,
  user_sub         TEXT NOT NULL,
  filename         TEXT NOT NULL,
  content_type     TEXT NOT NULL,
  size_bytes       INTEGER NOT NULL,
  category         TEXT NOT NULL,
  note_ciphertext  TEXT,
  note_iv          TEXT,
  wrapped_dek      TEXT NOT NULL,
  wrapped_dek_iv   TEXT NOT NULL,
  file_iv          TEXT NOT NULL,
  s3_key           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  purge_after      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallet_docs_user_idx ON wallet_docs (user_sub);

CREATE TABLE IF NOT EXISTS wallet_shares (
  token       TEXT PRIMARY KEY,
  doc_id      TEXT NOT NULL,
  user_sub    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_shares_doc_idx ON wallet_shares (doc_id);

-- Purge policy (FR-050): soft-delete sets deleted_at; purge_after = deleted_at + 30 days.
-- Async worker deletes S3 object + row when NOW() >= purge_after.
