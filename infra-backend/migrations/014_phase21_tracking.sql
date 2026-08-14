-- Phase 2.1 tracking depth (DSQL: one DDL per statement)

ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS period_lead_days INTEGER NOT NULL DEFAULT 1;

ALTER TABLE pregnancy_profiles ADD COLUMN IF NOT EXISTS pre_pregnancy_weight_kg DOUBLE PRECISION;

ALTER TABLE pregnancy_profiles ADD COLUMN IF NOT EXISTS height_cm DOUBLE PRECISION;

ALTER TABLE pregnancy_days ADD COLUMN IF NOT EXISTS kick_session_minutes INTEGER;

ALTER TABLE ttc_days ADD COLUMN IF NOT EXISTS intimacy_ciphertext TEXT;

ALTER TABLE ttc_days ADD COLUMN IF NOT EXISTS intimacy_iv TEXT;
