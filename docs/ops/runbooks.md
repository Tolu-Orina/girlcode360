# GirlCode360 ops runbooks (Phase 7.13)

## Breach response (draft)

1. Contain: rotate Cognito app client secrets, invalidate active refresh tokens if supported, lock S3 wallet bucket policy to deny public.
2. Assess: which tables/objects were exposed; Health Wallet ciphertext without KEK is not plaintext.
3. Notify: follow UK ICO / NDPR / Ghana Data Protection timelines for the affected market.
4. Communicate: in-app banner + email without health details in subject/body.
5. Remediate: patch root cause, rotate KMS key material per runbook owner, document in incident ticket.

## Platform outage

1. Status page note (or social) — avoid health content.
2. API Gateway 5xx: check Lambda concurrency, DSQL connectivity, WAF blocks.
3. Web CloudFront: fail open to last good static shell (offline IndexedDB still holds cycle outbox).

## Bedrock / Nova outage

1. Set `BEDROCK_ENABLED=false` (or rely on automatic stub fallback in `packages/ai-provider`).
2. User-facing copy: “Zara is temporarily using a limited offline reply. Your logs are safe.”
3. Disable HealthLens on-demand generation if stubs are unacceptable; keep Prep Card rules text available.
4. Page CloudWatch Bedrock alarms (`bedrock_alarms.tf.example`) when live.

## Account deletion purge

1. User requests `POST /v1/privacy/delete` → 24h cooling-off.
2. Cancel via `POST /v1/privacy/delete/cancel`.
3. Worker: `POST /v1/privacy/purge-tick` with `x-internal-key` (EventBridge daily).
