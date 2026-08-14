-- Phase 2.1 tracking depth (DSQL: one DDL per statement)
-- ADD COLUMN cannot include NOT NULL / DEFAULT (Aurora DSQL ALTER TABLE).
-- SET DEFAULT is a separate action. Column stays nullable; app clamps to 1.

ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS period_lead_days INTEGER;

ALTER TABLE notification_prefs ALTER COLUMN period_lead_days SET DEFAULT 1;

UPDATE notification_prefs SET period_lead_days = 1 WHERE period_lead_days IS NULL;

ALTER TABLE pregnancy_profiles ADD COLUMN IF NOT EXISTS pre_pregnancy_weight_kg DOUBLE PRECISION;

ALTER TABLE pregnancy_profiles ADD COLUMN IF NOT EXISTS height_cm DOUBLE PRECISION;

ALTER TABLE pregnancy_days ADD COLUMN IF NOT EXISTS kick_session_minutes INTEGER;

ALTER TABLE ttc_days ADD COLUMN IF NOT EXISTS intimacy_ciphertext TEXT;

ALTER TABLE ttc_days ADD COLUMN IF NOT EXISTS intimacy_iv TEXT;
