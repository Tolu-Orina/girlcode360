-- Rename AI companion Zara → Alena (quota table + consent purpose)

CREATE TABLE IF NOT EXISTS alena_quota (
  user_sub   TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_sub, day_key)
);

INSERT INTO alena_quota (user_sub, day_key, used)
SELECT z.user_sub, z.day_key, z.used
FROM zara_quota z
LEFT JOIN alena_quota a
  ON a.user_sub = z.user_sub AND a.day_key = z.day_key
WHERE a.user_sub IS NULL;

UPDATE consents SET purpose = 'ai_alena' WHERE purpose = 'ai_zara';
