-- Add durable share id for revoke/list without exposing token hashes.
-- token column remains SHA-256 hex of the plaintext share token (PK).
-- App always sets id (UUID) on create; legacy rows may have NULL until recreated.

ALTER TABLE wallet_shares ADD COLUMN IF NOT EXISTS id TEXT;

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS wallet_shares_id_uidx ON wallet_shares (id);
