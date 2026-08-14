# GirlCode360 — Master Technical Implementation Plan

**Version 1.3 · Updated 13 August 2026 · UK · Nigeria · Ghana**  
**Supersedes:** v1.2 (13 August 2026 UI/UX plan), v1.0 (7 August 2026 clean-build RDS + CDK + Anthropic).  
**Stack (locked):** AWS Terraform · Aurora DSQL · Cognito custom auth · React PWA (mobile-shell) · Bedrock Nova 2 Lite · Perfect Corp. YouCam API  
**Target domain:** `girlcode.conquerorfoundation.com`  
**Primary region:** `eu-west-2` (London)

> **This is not a greenfield plan.** Terraform for `infra-web` and `infra-backend` is already applied. The health PWA, Cognito custom auth, Lambda API, DSQL schema/migrations, and Alena/HealthLens code already exist. New work **extends** that stack. Do not provision RDS, CDK, VPC/NAT, or Anthropic.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Guiding Principles](#2-guiding-principles)
3. [Current State (locked)](#3-current-state-locked)
4. [Reference Architecture](#4-reference-architecture)
5. [YouCam API Integration Architecture](#5-youcam-api-integration-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Security & Compliance Architecture](#7-security--compliance-architecture)
8. [PWA / Frontend Architecture](#8-pwa--frontend-architecture)
9. [CI/CD & DevOps](#9-cicd--devops)
10. [Testing Strategy](#10-testing-strategy)
11. [Wave Plan (hackathon calendar)](#11-wave-plan-hackathon-calendar)
12. [Tiered product plan](#12-tiered-product-plan)
    - [Carry-forward register](#121-carry-forward-register-read-before-starting-17)
13. [Cost Model (Indicative)](#13-cost-model-indicative)
14. [Technical Risk Register](#14-technical-risk-register)
15. [Appendix](#15-appendix)
16. [UI/UX production plan](#16-uiux-production-plan)

---

## 1. Executive Summary

GirlCode360 is a women's beauty and wellness platform for the UK, Nigeria, and Ghana. The product thesis is three things that do not exist together elsewhere: (1) menstrual and PMOS-aware health tracking that does not assume a 28-day cycle, (2) an AI layer — **Alena** (successor to Zara), HealthLens, and now Mirror — that reads the user's *own* longitudinal health data, and (3) later, SheMatch, a location-based marketplace bridge.

**Alena is the successor to Zara.** The companion was renamed in product, UI, APIs (`/v1/alena/*`), and migration `009_rename_zara_to_alena.sql`. Legacy `/v1/zara/*` and `/app/zara` remain aliases only. New code, copy, prompts, and this plan use **Alena** exclusively.

This document is the engineering translation of the expanded PRD / Mirror / AI specs **reconciled against the live repo**. The client is a **single React Progressive Web App**: on phone-width viewports it looks and behaves like a mobile app (fixed bottom tab bar, safe-area insets, standalone/installable); on desktop it is a responsive web app with top navigation. There is no native iOS/Android build in Tiers 1–2.

**Immediate forcing function:** YouCam API Skin AI & Apparel VTO Hackathon — submit by **17 August 2026, 11:45am EDT**. YouCam API access is redeemed and live. Wave 0 is Mirror on the existing stack, with a **curated demo catalogue** standing in for SheMatch / Business Portal.

---

## 2. Guiding Principles

| Principle | What it means in practice |
|---|---|
| **Extend, don't rebuild** | Terraform, Cognito custom pages, DSQL, Lambda router, PWA shell, Alena/HealthLens, wallet, privacy, billing stubs are locked. New features add routes, tables, and UI into that shape. |
| **PWA-first, native-app-feeling on mobile** | One React codebase (`apps/web`). Below the `lg` breakpoint: bottom tabs, no desktop chrome, no hover-only UI. At `lg+`: top nav. Native wrap is a Tier 3 decision point, not a default. |
| **Offline-first for health logging only** | Period/symptom/PMOS/pregnancy/TTC writes use IndexedDB + idempotent `POST /v1/cycles/sync` (already built). Mirror scans and YouCam calls are **online-only**. |
| **Consent is infrastructure** | Versioned, append-only `consents` rows already exist. Mirror adds a new purpose (`mirror_biometric`); it does not get a second consent system. |
| **YouCam never runs in the browser** | The PWA never holds a YouCam API key and never calls `yce-api-01.perfectcorp.com`. All calls go through GirlCode360 Lambda. Results are copied into our S3 before YouCam's 2-hour download URL expires. |
| **Alena, not Zara** | Product name, routes, prompts, quotas, and docs say Alena. Zara strings are compatibility shims only. |
| **Reuse over duplication** | MIR-F-04 / MIR-F-06 are extra *trigger types* (or, until SheMatch exists, curated catalogue rows) — not a second marketplace engine. Phase 1.7 builds the real SheMatch engine once. |
| **Special-category data, not a US HIPAA rebuild** | GirlCode360 is not a US HIPAA entity. UK GDPR Art. 9, Nigeria NDPA/GAID, and Ghana DPA apply. Controls: KMS, TLS, least-privilege IAM, consent ledger, no PHI in logs/env/keys. We do **not** force RDS/VPC solely to match the AWS HIPAA-eligible service list. Revisit DSQL if a hospital BAA or US PHI appears. |
| **Cost at idle** | Aurora DSQL (scale-to-zero, no NAT). No RDS Multi-AZ, no VPC NAT Gateway, no RDS Proxy. DynamoDB only if a hot counter later proves it; Alena quota already lives in DSQL. |
| **Single account, env-segmented** | `dev` / `test` / `prod` via Terraform workspaces/backends already in `ci-cd/`. Separate AWS accounts are a later compliance decision. |

### 2.1 Decisions superseded from v1.0

| v1.0 assumed | v1.1 (this document) | Why |
|---|---|---|
| Clean-build; founder reconciles later | Current repo + applied Terraform is the baseline | Avoids rebuilding working auth, health, and AI |
| AWS CDK (TypeScript) | Terraform (`infra-web`, `infra-backend`) | Already applied; pipelines exist |
| Amazon RDS PostgreSQL Multi-AZ | **Aurora DSQL** (PostgreSQL-compatible subset) | Idle cost; no VPC/NAT; schema already DSQL-shaped (no FKs) |
| Anthropic Claude for Alena / HealthLens / Mirror narrative | **Amazon Bedrock Nova 2 Lite** (`packages/ai-provider`) | Locked; IAM auth; no LLM API key |
| VPC + private subnets + NAT for all PHI Lambdas | **No VPC** for Lambda; DSQL public endpoint + IAM token | Cost; DSQL design |
| Many domain Lambdas from day one | **Single API Lambda router** (`handlers/api.ts`); split later if needed | Matches code |
| DynamoDB for Alena sessions / rate limits from day one | DSQL (and in-process limiter for Wave 0 YouCam) | Avoid extra always-on NoSQL until load requires it |
| Live SheMatch + Business Portal in hackathon | **Curated demo catalogue** in Wave 0; real engine in Wave 2 | Calendar + missing marketplace code |
| iOS/Android in PRD v1.0 scope | **React PWA only** until the Tier 3 decision | One codebase; mobile-shell UX |

---

## 3. Current State (locked)

Verified in the `girlcode360/` monorepo unless noted. Founder confirmation (13 Aug 2026): **Terraform is applied**; **YouCam API access is redeemed**.

### 3.1 Monorepo

```text
girlcode360/
├── apps/web/                    # Consumer PWA (Vite + React + vite-plugin-pwa)
├── apps/admin/                  # LATER — not in Wave 0
├── packages/api-types/
├── packages/domain/             # prediction, HealthLens rules, crisis detector
├── packages/ai-provider/        # Bedrock Converse, Nova 2 Lite, stub fallback
├── infra-web/                   # S3, CloudFront, ACM, Route53
├── infra-backend/               # Cognito, APIGW, DSQL, KMS, SSM, Lambda
│   ├── migrations/              # 001–009 (incl. Alena rename)
│   └── modules/lambda/codes/    # API + health handlers
├── ci-cd/                       # CodePipeline YAML + buildspecs
└── docs/
```

### 3.2 Client (PWA) — already a mobile-shell app

- Custom Cognito pages: `/signin`, `/signup`, `/verify`, `/forgot-password`. SDK: `amazon-cognito-identity-js`. **No Amplify. No Hosted UI.**
- Authenticated shell: `/app` via `AppShell`.
  - **Mobile (`lg:hidden`):** fixed 5-tab bottom nav — Home, Cycle, **Mirror**, Alena, Account — with `env(safe-area-inset-bottom)`. Health stays at `/app/health` via Home tiles and desktop nav.
  - **Desktop (`lg+`):** top nav — Home, Cycle, Health, Mirror, Alena, Library, Account.
- `index.html`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, theme colour, installable manifest (`display: standalone`).
- Offline cycle logging: IndexedDB outbox + `SyncManager` + `Idempotency-Key`.
- Health Wallet: client Argon2id / AES-GCM before upload.
- Alena chat UI + HealthLens surfaces exist. Route `/app/zara` redirects to `/app/alena`.

Mirror is in the 5-tab bar (Health dropped from the phone bar, not from the product). Do not add a sixth tab. Desktop keeps Health + Library. Visual production quality for this shell is **§16**, not a new product phase.

### 3.3 Backend — already a production-shaped API

Single Lambda router (`infra-backend/modules/lambda/codes/src/handlers/api.ts`) behind API Gateway REST + Cognito authorizer. Persistence: `isDsqlEnabled() ? DSQL : in-memory Maps`. **Production and hackathon demo must run with DSQL on** (Terraform applied; `enable_dsql` default true). Memory store is local/dev fallback only.

Live route families (do not re-specify as new work):

| Area | Prefix |
|---|---|
| Health | `GET /v1/health` |
| Users / consents / modules | `/v1/users/me`, `/v1/consents` |
| Cycles + offline sync | `/v1/cycles/**`, `POST /v1/cycles/sync` |
| PCOS | `/v1/pcos/**` |
| Pregnancy / TTC | `/v1/pregnancy/**`, `/v1/ttc/**` |
| Wallet | `/v1/wallet/**` (+ public share) |
| **Alena** | `/v1/alena/**` (legacy `/v1/zara/**` rewritten) |
| HealthLens | `/v1/healthlens/**` |
| Privacy / billing / content | `/v1/privacy/**`, `/v1/billing/**`, `/v1/content/**` |

### 3.4 Infra — already applied

| Layer | Choice |
|---|---|
| IaC | Terraform (`infra-web`, `infra-backend`), S3 state + DynamoDB lock |
| Auth | Cognito User Pool + app client; custom pages |
| API | API Gateway REST `{proxy+}` → Lambda |
| DB | Aurora DSQL cluster, IAM `dsql:DbConnect`, `pg` + `@aws-sdk/dsql-signer` |
| Objects | S3 data bucket + KMS CMK |
| Config | SSM Parameter Store; Secrets Manager JSON blobs (`girlcode360/{env}/app`) |
| AI | Bedrock Nova 2 Lite; `BEDROCK_ENABLED`; no Anthropic key |
| Web | Private S3 + CloudFront + ACM (us-east-1 for CloudFront certs) |
| Region | `eu-west-2` |

**Not in repo / not Wave 0:** YouCam gateway, Mirror UI, SheMatch engine, Business Portal, phone/social IdPs, APIGW STREAM for Alena, live Stripe/Paystack secrets, VPC.

---

## 4. Reference Architecture

### 4.1 Target shape (question this diagram answers: *what do we run, given what already exists?*)

```
                         Route 53
              girlcode.conquerorfoundation.com
                                  │
                          CloudFront + ACM
                     (PWA static; global edge)
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     S3: apps/web build                    API Gateway REST
     (manifest, SW, assets)                Cognito JWT authorizer
                                                  │
                                          Lambda (no VPC)
                                          handlers/api.ts
                    ┌─────────────┬─────────┼──────────┬────────────┐
                    ▼             ▼         ▼          ▼            ▼
              Aurora DSQL        S3       KMS     Bedrock      YouCam API
              (health,           wallet   CMK     Nova 2 Lite  (Mirror only,
               consents,         + mirror         (Alena,      server-side)
               Alena quota,      scans            HealthLens,
               skin_scans)                        Mirror copy)
```

**Global** means: CloudFront-fronted PWA reachable worldwide; API stays in `eu-west-2` until measured NG/GH latency forces a second region. Aurora DSQL does **not** support cross-continent multi-Region clusters — do not plan active-active London+Lagos on DSQL.

### 4.2 Why this shape (not Amplify, not RDS, not CDK)

1. **Already live.** Replacing Terraform with CDK or DSQL with RDS is a one-way cost with no Wave 0 product value.
2. **Domain control.** `girlcode.conquerorfoundation.com` coexists with the parent zone via explicit CloudFront/ACM/Route 53 — already in `infra-web`.
3. **DSQL cost.** Scale-to-zero DPU billing + permanent free tier (100k DPUs + 1 GB-month) vs RDS Multi-AZ ~$150–250/mo idle, plus NAT if VPC-attached. Integrity is enforced in the API (DSQL has no foreign keys).
4. **Alena provider.** Nova 2 Lite via IAM matches NFR-AI-10 (swappable provider). Mirror plain-language copy uses the **same** `packages/ai-provider` — not Anthropic.
5. **YouCam async** is a **handler + optional later SQS**, not a reason to explode into microservices this week.

### 4.3 AWS service map (as-built + Wave 0 additions)

| Layer | Service | Status | Purpose |
|---|---|---|---|
| DNS/CDN | Route 53, CloudFront, ACM | Applied | PWA + TLS |
| Static | S3 web bucket (OAC) | Applied | React build |
| Auth | Cognito User Pool | Applied | Email/password; IdPs later |
| API | API Gateway REST | Applied | All sync traffic |
| Compute | Lambda (Node, **not** VPC) | Applied | Single router; add Mirror/YouCam handlers |
| Relational | **Aurora DSQL** | Applied | System of record |
| Objects | S3 data bucket | Applied | Wallet ciphertext; add Mirror prefixes |
| Secrets | Secrets Manager JSON | Applied | Add `youcam_api_key` into `girlcode360/{env}/app` |
| Config | SSM | Applied | Cognito IDs, API URL, DSQL endpoint |
| Encryption | KMS CMK | Applied | DSQL, S3; extend key policy for Mirror objects |
| AI | Bedrock Nova 2 Lite | Wired in code | Alena, HealthLens, Mirror narratives |
| Async | EventBridge | Stub in TF | HealthLens monthly; Wave 1 YouCam sweep |
| Payments | Stripe / Paystack | Code stubs | Live keys in Phase 1.7 / 2.2 |
| SMS / phone auth | **Out of scope** | No Africa's Talking, no Cognito SMS, no phone OTP |

WAF: add when abuse appears; not a Wave 0 blocker. DynamoDB: optional Wave 1+ for a shared YouCam token-bucket if multi-Lambda pacing is required.

---

## 5. YouCam API Integration Architecture

Grounded in Perfect Corp. docs (`docs.perfectcorp.com/develop/*`, August 2026) and `docs/new/girlcode-mirror-spec.md`. **Wave 0 uses live APIs** (access confirmed). Production integration is TypeScript in our Lambda — YouCam MCP is a **dev accelerator only**, never shipped as the gateway.

### 5.1 Core pattern: async task + poll (webhook later)

1. Authenticate: `Authorization: Bearer <API_KEY>` (V2 API-key flow).
2. Upload: `file/*` → `{ upload_url, file_id }`, then PUT bytes to the pre-signed URL.
3. Initiate: `POST /s2s/v2.0/task/<capability>` → `task_id`.
4. Poll: `GET /s2s/v2.0/task/<capability>/<task_id>` until `success` or `error`. Units are not consumed while `running`.
5. Retrieve: download URL valid **2 hours**.

```
React PWA  --selfie/garment-->  POST /v1/mirror/...  (Cognito JWT)
                                      │
                                      ▼
                               Lambda youcam handlers
                                      │
                    Bearer key from Secrets Manager (never to client)
                                      ▼
                               YouCam yce-api-01.perfectcorp.com
                                      │
                         poll until success (Wave 0: same request
                         or client polls GET /v1/mirror/tasks/:id)
                                      │
                         COPY result + masks into our S3 (KMS)
                                      ▼
                               DSQL skin_scans / apparel_tryons
                                      ▼
                         GET /v1/mirror/scans/:id  (our URLs, not YouCam's)
```

**Wave 0:** implement gateway + poll inside the existing Lambda (sync poll with timeout, or client polling **our** task resource). **Wave 1:** SQS delay queue / EventBridge sweep + CloudWatch alarm if `success` without S3 object within 5 minutes. **Phase 2.2:** optional Standard Webhooks (`POST /webhooks/youcam`) to cut poll cost.

Do not let the browser poll YouCam: key exposure and a **shared** 250 req / 300s limit (per IP and per token).

### 5.2 Auth & key management

- Store key in existing packed secret `girlcode360/{env}/app` as `youcam_api_key` (minimise secret count).
- Lambda role: `secretsmanager:GetSecretValue` on that blob only.
- Cache the key in the Lambda execution environment after cold start.

### 5.3 Rate limits (documented)

- 250 requests / 300 seconds per IP **and** per access token.
- Pace ~5 QPS.
- `429` → backoff.

Wave 0: single-threaded in-process limiter in the gateway is enough for a judged demo. Wave 1: shared limiter (DSQL row or DynamoDB counter) if more than one concurrent Lambda needs to pace.

### 5.4 Retention (hard constraint)

| Artifact | YouCam retention | Our rule |
|---|---|---|
| `file_id` | 30 days | Do not re-use after task create |
| `task_id` | 30 days | Optional replay; do not depend on it |
| **Result URL** | **2 hours after success** | **Copy to our S3 immediately** — required for MIR-F-03 |

### 5.5 Image input

- Long side ≤ 4096px; short side ≥ 1080px recommended for HD.
- SD and HD concerns cannot mix in one call. Wave 0: **SD**. HD for Premium is Wave 1/2 (same gating pattern as Alena's 3/day free cap).
- Client pre-flight (framing/lighting) **before** upload to avoid burning units (MIR-LLR-002).

### 5.6 Skin Analysis — request shape

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/skin-analysis
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{file_id}",
  "dst_actions": ["wrinkle", "pore", "texture", "acne", "oiliness", "redness",
                   "radiance", "dark_circle", "eye_bag", "droopy_eyelid",
                   "age_spot", "tear_trough", "firmness", "moisture", "skin_type"],
  "miniserver_args": { "enable_mask_overlay": true },
  "format": "json"
}
```

YouCam returns 0–100 scores, mask URLs, skin type, overall score, estimated skin age. **Plain-language + cycle correlation is ours** (MIR-F-02), via existing cycle/PMOS reads + Nova narrative — not raw YouCam JSON to the user.

### 5.7 Apparel VTO — request shape

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/apparel-tryon
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{full-body file_id}",
  "garment_file_id": "{garment file_id}",
  "garment_category": "one_piece",
  "model_gender": "female",
  "prompt": "tucked at the waist, casual styling"
}
```

- Tops, bottoms, one-pieces, mix-and-match — MIR-F-05.
- Optional `prompt` for MIR-F-08 maternity/PMOS comfort language (do not expose internals).
- **No swimwear/lingerie** through this API (Perfect Corp. training exclusion) — hard catalogue constraint.
- Typical generation &lt; 10s (budget 15s).

**Wave 0 garments:** curated, founder-seeded catalogue (static JSON + S3 images), not Business Portal tagging.

### 5.8 Correlation layer (the hackathon differentiator)

```
YouCam scores + masks
        │
        ▼
Existing listCycles / listDays / PMOS logs (DSQL) for scan date
        │
        ▼
Rules: ≥2 scans across different cycle phases when possible (MIR-LLR-003)
        │
        ▼
packages/ai-provider converseNova — structured findings in, wellness copy out
        │
        ▼
Honest "no clear pattern yet" when data is thin
```

Keep a **module boundary** even inside one Lambda: YouCam I/O vs cycle correlation vs Nova. Alena's provider abstraction (NFR-AI-10) is the pattern.

### 5.9 Errors

| Failure | Handling |
|---|---|
| 429 | Backoff; Wave 0 fail with MIR-LLR-007 copy |
| `task_status: error` | Generic retry copy; never leak YouCam payloads |
| Poll timeout | Client timeout; do not cancel YouCam task; Wave 1 sweep may still persist the result |
| S3 copy fail | Wave 0: surface failure; Wave 1: alarm |
| YouCam outage | Circuit open after consecutive failures; **rest of app (Cycle, Alena, Wallet) stays up** (MIR-LLR-010) |

---

## 6. Data Architecture

### 6.1 System of record: Aurora DSQL

DSQL is PostgreSQL 16–compatible for transactional SQL. **Unsupported / unused here:** `FOREIGN KEY` (not in `CREATE TABLE` grammar), many extensions (PostGIS, pgvector). Migrations already use UUID/`TEXT` PKs, `CREATE INDEX ASYNC`, and API-enforced parent/child integrity.

**Do not introduce RDS.** Revisit only if: hospital BAA / US PHI requires a named HIPAA DB; DPU cost exceeds a small instance for two consecutive months; or a required extension appears.

Existing tables (migrations 001–009): `users` (Cognito `sub` PK), `consents`, cycles/days, PCOS, pregnancy/TTC, wallet metadata, Alena quota / HealthLens reports, privacy/billing. Dual store in code must prefer DSQL whenever `DSQL_ENABLED=true`.

### 6.2 Wave 0 new tables (illustrative, DSQL-safe — no FKs)

```sql
-- Append-only consents already exist; add purpose values in API:
-- 'mirror_biometric' (MIR-F-07)

CREATE TABLE IF NOT EXISTS skin_scans (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  youcam_task_id     TEXT NOT NULL,
  cycle_day_at_scan  INT,
  cycle_phase_at_scan TEXT,
  overall_score      INT,
  scores             TEXT NOT NULL,      -- JSON
  mask_overlay_s3_key TEXT,
  result_s3_key      TEXT NOT NULL,
  scan_quality       TEXT NOT NULL DEFAULT 'sd',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX ASYNC IF NOT EXISTS skin_scans_user_sub_idx ON skin_scans (user_sub);

CREATE TABLE IF NOT EXISTS apparel_tryons (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  youcam_task_id     TEXT NOT NULL,
  catalogue_item_id  TEXT NOT NULL,
  result_s3_key      TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mirror_catalogue (
  id                 TEXT PRIMARY KEY,
  kind               TEXT NOT NULL,      -- 'skincare' | 'apparel'
  title              TEXT NOT NULL,
  tags               TEXT NOT NULL,      -- JSON array
  image_s3_key       TEXT,
  active             BOOLEAN NOT NULL DEFAULT TRUE
);
```

`mirror_catalogue` is the Wave 0 / early Phase 1.4 stand-in for SheMatch + Business Portal. Phase 1.7 replaces lookups with the real trigger engine; keep `catalogue_item_id` stable so try-on history does not break.

### 6.3 Encryption

| Data | Control |
|---|---|
| Health rows in DSQL | Cluster KMS key (already) |
| Wallet objects | Client AES-GCM + S3/KMS (already) |
| Mirror face/body images | S3 prefix + KMS; never in Alena context blobs; deletion requests YouCam per processor terms (MIR-F-07) |
| TTC intimacy | Existing separate consent + delete path; exclude from Alena/Mirror prompts |
| YouCam key | Secrets Manager JSON |

v1.0's five separate CMKs remain a **Wave 1 hardening option**, not a Wave 0 blocker — one existing CMK already encrypts DSQL and the data bucket.

---

## 7. Security & Compliance Architecture

### 7.1 Network

**As-built:** Lambda has no VPC; DSQL IAM auth over TLS to `{id}.dsql.eu-west-2.on.aws`. **Do not add NAT** for Wave 0–1.

Wave 2+ optional: PrivateLink to DSQL (`vpc_endpoint_service_name` already outputted by the DSQL module) if a future audit demands no public DB endpoint.

### 7.2 IAM

- Existing Lambda role: Cognito, DSQL `DbConnect`, S3, KMS, Bedrock, SSM/Secrets.
- Add YouCam only via secret read + S3 writes to a `mirror/` prefix.
- No health or biometric payloads in logs, env vars, tags, or object key names that include symptoms.

### 7.3 Consent (reuse)

Existing `POST /v1/consents` ledger. Wave 0: new purpose `mirror_biometric`; Mirror routes 403 until granted. Declining Mirror must not disable Cycle, Alena, or Wallet.

### 7.4 Audit

Reuse privacy/audit patterns already in Phase 7 code. Log Mirror consent grants, scan deletes, and YouCam task ids (not images).

---

## 8. PWA / Frontend Architecture

The IA and PWA chrome below are locked. Visual system, states, copy, a11y, and page-by-page polish are specified in **§16**. Do not invent a second frontend architecture.

### 8.1 What “looks like a mobile app” means (already implemented; keep it)

A single Vite React app on S3/CloudFront.

| Viewport | Shell |
|---|---|
| Phone / standalone / `&lt; lg` | App chrome: brand header + **bottom tab bar**. Main padding includes tab height + `safe-area-inset-bottom`. No desktop mega-nav. |
| `lg` and up | Top primary nav; no bottom bar. |

Industry bar we already meet or will polish in Wave 1:

- Installable: HTTPS, manifest `name` / icons 192+512 / `start_url` / `display: standalone` (MDN / Chromium).
- `viewport-fit=cover` + safe-area env vars (web.dev).
- Wave 1 polish: `start_url` toward `/app` for installed users; maskable icons; `display-mode: standalone` tweaks.

**Do not** introduce React Native, Expo, or a second mobile repo in Wave 0–1.

### 8.2 State

Keep the current pattern: React Router, local IndexedDB for cycles, `fetch` via `lib/api.ts`. **Do not** add TanStack Query / Zustand as a Wave 0 prerequisite. Adopt them in Wave 1 only if Mirror polling state becomes unmanageable.

### 8.3 Offline

Health writes: existing outbox. Mirror: **network required**; disable scan/try-on offline with a clear message.

### 8.4 Mirror UI

- `getUserMedia` + pre-flight overlay before upload.
- Shared task UI: submitted → polling our API → result image from our S3.
- Wellness copy only — no diagnosis language (existing `lint:copy` discipline).
- Alena tab stays Alena; Mirror must not rename or bury the companion.

---

## 9. CI/CD & DevOps

**As-built:** CodePipeline / CodeBuild (`ci-cd/infra-web-pipeline.yaml`, `infra-backend-pipeline.yaml`), not GitHub Actions + CDK.

```
push → path-filtered pipelines
  apps/web/**     → build Vite PWA → deploy infra-web / invalidate CloudFront
  infra-backend/** → plan/apply Terraform; package Lambda; run migrate-dsql.mjs
```

- Migrations: SQL files in `infra-backend/migrations/`, applied by `scripts/migrate-dsql.mjs` (CI). Never hand-apply prod.
- Feature flags: env/SSM booleans (`MIRROR_ENABLED`, `BEDROCK_ENABLED`) rather than AppConfig in Wave 0.
- Console: read-only / break-glass; changes go through Terraform.

---

## 10. Testing Strategy

Source of truth for *what*: `GirlCode360_Requirements_and_TestCases.xlsx` (and Mirror LLRs/TCs in the Mirror spec).

| Layer | Tooling | Wave 0 bar |
|---|---|---|
| Unit | Node test / Vitest where present | YouCam mapper + correlation rules |
| Copy | `apps/web` `lint:copy` | No diagnose / Zara-as-product-name in new UI |
| E2E | Playwright against deployed HTTPS | Happy-path: consent → scan → scores → cycle overlay → VTO on a phone-width viewport |
| Manual | Real device | Bottom tabs, camera, install/standalone if time |
| Load | k6 later | Wave 1 against YouCam rate limit |

Hackathon judges need a **working public URL + 1–3 min phone video**, not full spreadsheet coverage.

---

## 11. Wave Plan (hackathon calendar)

### Wave 0 — YouCam hackathon (now → 17 August 2026)

**Goal:** Globally reachable production-shaped PWA demonstrating Skin AI + Apparel VTO as **one** experience, differentiated by cycle/PMOS correlation, on the **existing** stack.

**In:**

| Slice | Done when |
|---|---|
| DSQL-backed demo | App uses applied DSQL, not in-memory Maps |
| YouCam secret | Key in Secrets Manager; Lambda reads it |
| Gateway | Server-side upload/task/poll; results in our S3 |
| MIR-F-07 | Mirror unreachable without `mirror_biometric` consent |
| MIR-F-01 | Live Skin Analysis scores + overlay |
| MIR-F-02 | Overlay vs existing cycle/PMOS data (centrepiece) |
| MIR-F-03 | Timeline with seeded + new scans (seed if history is thin) |
| MIR-F-05 | Live Apparel VTO |
| MIR-F-04 / F-06 | **Curated catalogue** (skincare + boutique items), not SheMatch |
| MIR-F-08 | Catalogue filter by pregnancy week / PMOS if those modules are on; else honest empty state |
| PWA shell | Phone-width = bottom menus; desktop = top nav; HTTPS |
| Submit | Public URL, screenshots, 1–3 min device video, repo access |

**Out of Wave 0:** RDS, CDK, VPC, Anthropic, live SheMatch engine, Business Portal, marketplace payments, phone/social login, native apps, YouCam webhooks, DynamoDB rate limiter, Alena STREAM.

### Wave 1 — Harden the platform (week after submit)

- Prod boot: fail closed if DSQL is off.
- YouCam: copy-to-S3 alarm, DLQ/sweep for late `success`, shared rate limiter if needed.
- PWA: maskable icons, installed `start_url`, standalone chrome, iOS camera/safe-area QA.
- Alena: enable Bedrock in the demo/prod env if still stubbing; STREAM when APIGW supports it.
- Clinical/legal pass on Mirror + Alena copy.
- Optional extra KMS isolation for `mirror/` prefix.
- Reconcile remaining `docs/new` product IDs onto this plan (this file is the engineering SoT).

### After Wave 1 — follow the tier plan

Product delivery from here is **§12**: finish Tier 1 (especially Phase 1.4 remainder through 1.8), then Tier 2. Do not use a separate “Wave 2 feature list.”

---

## 12. Tiered product plan

**How to read this section.** Product delivery is **Tier 1 (Phase 1.1–1.8)** then **Tier 2 (Phase 2.1–2.3)**. Phase 1.0 (AWS foundation) is omitted: Terraform, Cognito, DSQL, API Gateway, Lambda, and the PWA shell are already applied. Where a feature already exists in code, finish gaps and harden — do not rebuild. **Visual production quality** (tokens, shell, states, a11y, page polish) is **§16**, not a missing Phase 1.x. **Deferred seams** (Should items, infra not yet available, honest stubs) are listed in **§12.1** — read that before starting Phase 1.7 or later.

**Out of scope (auth):** SMS / phone OTP — including Africa's Talking, Twilio, and Cognito SMS. UOB-F-01 is **email only**. Phone registration is not in Tier 1 or Tier 2.

Hackathon calendar (Wave 0) is §11 only. It does not replace this tier list. Mirror in Phase 1.4 is the full product epic; Wave 0 is the 17 August slice of that epic (live YouCam + curated catalogue).

---

### TIER 1 — Foundation & Core Value Proposition

This is not “the least we can ship.” It is the complete set of features the PRD defines as non-negotiable — a woman with PMOS symptoms and hormonal skin who can register, track her cycle without a 28-day assumption, use an AI companion that reads her actual data, generate a doctor-ready report, discover a nearby pharmacy or clinic when it matters, and — via Mirror — see her skin data correlated to that same cycle.

#### Phase 1.1 — Onboarding, Auth & Consent

- **UOB-F-01** (Email registration — Cognito email/password and email verification. **Phone / SMS auth is out of scope** — no Africa's Talking, no Twilio, no Cognito SMS.)
- **UOB-F-02** (Social Login — Google/Apple via Cognito federated identity providers)
- **UOB-F-03** (Age Verification & Minor Gate — client + server-side enforced)
- **UOB-F-04** (Jurisdiction Detection & Consent Routing)
- **UOB-F-05** (Granular Consent Management — first real consumer of the existing consent engine)
- **UOB-F-06** (Module Selection & Personalisation)
- **APS-F-04** (Biometric Authentication — Face ID/Touch ID via WebAuthn, since this is a PWA not a native app; graceful fallback to device PIN)
- **APS-F-05** (Password & Security Management)
- **APS-F-06** (Privacy Centre & Consent Management)

#### Phase 1.2 — Period Tracker & PMOS Manager (the clinical core)

- **PT-F-01** (Cycle Logging)
- **PT-F-02** (AI-Powered Cycle Prediction — the PMOS-aware, non-28-day algorithm)
- **PT-F-03** (Symptom Tracking)
- **PT-F-04** (Mood Tracking)
- **PT-F-05** (Cycle Calendar View)
- **PMOS-F-01** (Module Activation & Integration)
- **PMOS-F-02** (Symptom Diary)
- **PMOS-F-04** (Medication & Supplement Reminders)
- **PMOS-F-06** (Educational Content Library)

**INF-F-01** (Offline Mode & Data Sync) is fully proven out here, not just scaffolded: the offline-first write path (§8.3) is validated end-to-end against real Period Tracker/PMOS logging first, since this is the highest-frequency write action in the whole app — every subsequent module's logging (Pregnancy, TTC) reuses this same idempotent-write pattern rather than re-deriving it.

#### Phase 1.3 — Health Wallet

- **HW-F-01** (Document Upload & Encrypted Storage)
- **HW-F-02** (Categorisation & Management)
- **HW-F-03** (In-App Document Viewer)
- **HW-F-04** (Shareable Time-Limited Links)
- **HW-F-05** (Deletion & Right to Erasure)
- **HW-F-07** (Data Export)

This phase establishes the client-side-encrypt-before-upload pattern (§6.3) that Mirror's biometric consent model in Phase 1.4 deliberately mirrors.

#### Phase 1.4 — Mirror: Skin AI & Style Confidence

All 8 features, hackathon-originated, hardened here for Tier 1 production. Built in the dependency order established in `GirlCode360_Mirror_Feature_Spec.docx` §2.2, sequenced as production phases rather than hackathon days:

1. `youcam-gateway` + poller on the existing Lambda (§5.1–5.4) — the integration plumbing, built and load-tested against YouCam's documented rate limits before any feature UI exists.
2. **MIR-F-07** (Consent & Privacy) — ships before any scan or try-on is reachable, exactly as sequenced in the hackathon plan.
3. **MIR-F-01** (Skin AI Diagnostic Scan)
4. **MIR-F-02** (Cycle-Correlated Skin Insights) — first real workload for the HealthLens/correlation layer (§5.8), built here and *reused* by Phase 1.6's HealthLens epic rather than duplicated.
5. **MIR-F-04** (SheMatch Skincare Product Bridge) — new trigger-table rows only (§6.2), no new engine. Until Phase 1.7's engine exists, ships against the curated demo catalogue.
6. **MIR-F-03** (Skin Progress Timeline & Comparison)
7. **MIR-F-05** (Apparel Virtual Try-On)
8. **MIR-F-06** (Style Confidence Boutique Bridge) — depends on Business Portal inventory tagging existing in at least a minimal form; if Phase 1.7's Business Portal isn't ready yet, this ships against a manually-seeded tag set and is upgraded to self-service in Tier 2.
9. **MIR-F-08** (Maternity/PMOS Try-On Mode) — depends on Phase 1.2 (PMOS) and Phase 1.6 (Pregnancy week data existing).

#### Phase 1.5 — Alena (AI Health Companion)

Alena is the successor to Zara. Implement and harden under the Alena name only.

- **ALN-F-01** (Chat Interface & Streaming — SSE from the Alena path on the existing Lambda / API Gateway STREAM when enabled)
- **ALN-F-02** (Context-Aware Health Responses — pseudonymised health summary construction, zero PII in the model payload; **Amazon Bedrock Nova 2 Lite** via `packages/ai-provider`, not Anthropic)
- **ALN-F-03** (Anonymous Mode)
- **ALN-F-04** (Crisis Detection & Emergency Response)
- **ALN-F-05** (Free Tier Limits & Premium Gating)
- **ALN-F-06** (Localised Health Guidance & Market Routing)

This is where the Bedrock Nova integration is hardened — and the *same* narrative-generation call pattern is reused by HealthLens in Phase 1.6 and by Mirror's correlation insights in Phase 1.4, per the provider-abstraction principle in §5.8 (NFR-AI-10).

#### Phase 1.6 — HealthLens & Pregnancy/TTC core data models

- **HL-F-01 through F-06** (all Must) — the HealthLens engine, now generalized beyond just Mirror's skin correlation to the full monthly Health Intelligence Report and Doctor Appointment Prep Card across all modules.
- **PG-F-01, F-02, F-03, F-04, F-07** (Pregnancy core — initialisation, week content, logging, appointments, emergency shortcut)
- **TTC-F-01, F-02, F-05, F-07** (TTC core — mode activation, fertile window, timeline, educational content)

These land in the same phase because HealthLens' pattern-flagging logic (HL-F-05) needs real Pregnancy/TTC data models to flag against (e.g. reduced foetal movement patterns).

**Status (13 Aug 2026):** Must items above are in repo. Do not rebuild. Pickup list is §12.1.

#### 12.1 Carry-forward register (read before starting 1.7)

**Purpose:** later phases extend these seams. They are not unfinished Must work for 1.6. **Do not rebuild** working Cycle / Wallet / Mirror / Alena / HealthLens / Pregnancy / TTC paths.

| Left by | Item | Why it was left | Pick up in | Code / contract to reuse |
|---|---|---|---|---|
| 1.2 | PT-F-06 month summary, PT-F-07 period reminders | Should | 2.1 | Cycle calendar already has a month-summary toggle; notification prefs rows exist |
| 1.2 | PMOS-F-03 biometrics, PMOS-F-05 PMOS prep card | Should | 2.1 | Health PMOS tab already logs weight/sleep/water/stress; Prep Card is HealthLens (HL-F-04), not a second engine |
| 1.3 | HW-F-06 wallet medication reminders | Should | 2.2 | Distinct from PMOS meds; Health Wallet encrypt pattern is the template |
| 1.4 | Live SheMatch + Business Portal | **Closed in 1.7** — seeded directory + `/business`. SM-F-05 still Should | 2.2 | `catalogue_item_id` on listings; garment URLs stay in `mirrorCatalogue.ts` |
| 1.4 | YouCam webhooks, DynamoDB limiter, HD scans | Wave 0 poller + in-process pace; SD default | 2.2 webhooks; HD in 3.5 | `youcam.ts` poller + circuit; Alena 3/day gating pattern for HD |
| 1.5 | Alena SSE / APIGW `STREAM` | Plan forbids fake token animation | When APIGW STREAM exists (not 1.8 fake-out) | `POST /v1/alena/chat` returns full reply; UI shows “Alena is writing…” |
| 1.6 | HealthLens monthly **EventBridge** cron | Must monthly cadence is met by `maybeMonthlyHealthLensReport` on `GET /v1/healthlens/status` when `ai_healthlens` is granted | Prove with EventBridge once traffic is real (Tier 2 exit already requires one live monthly cycle) | `store/ai.ts` `generateHealthLensReport(sub, { monthly: true })` — monthly must **not** set `lastOndemandAt` |
| 1.6 | Prep Card as **PDF** | FR-091 says PDF; ship is structured `.txt` (`buildPrepCard`) | 2.1 if print/share requires PDF | Same sections: cycle, symptoms, meds, wallet **titles only**, questions. Do not send Wallet ciphertext to the model |
| 1.8 | FR-076 email / display-name / photo | Phone is out of scope; photo and display-name not in 1.8 Must list | Later account polish | Email already on profile when Cognito supplies it; My Data shows it. Do not add SMS. |
| 1.6 | PG-F-05 WHO weight ranges | Should | 2.1 | Pregnancy day `weightKg`; do not treat as a prescription |
| 1.6 | PG-F-06 kick **session** counter | Should (FR-035). Must logging is movement felt/reduced from week 20 | 2.1 | Symptoms `movement_felt` / `movement_reduced` via `encodePregnancyDaily`; kicks integer from week 24 |
| 1.6 | TTC-F-03/04/06 as full Should | Fields already on TTC tab | 2.1 | Do not duplicate intimacy into Alena/Mirror context (already excluded) |
| 1.6 | PG-F-07 nearest hospital from marketplace | **Closed in 1.7** — silent if none within 5 km | — | `SheMatchBanner` `pregnancy_emergency`; optional `gc360.pregHospitalPhone` still valid |
| 1.7 | EventBridge cron + VAPID for push send | Tick endpoint exists; prefs/quiet hours/generic body live | Ops / 2.2 | `POST /v1/notifications/tick` with `x-internal-key`; `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |
| 1.8 | Apply `013_phase18_content_reports.sql` on DSQL | Migration is in repo; queue works in memory without it | Ops with other DSQL migrations | Internal `GET/PATCH /v1/content/moderation-queue` — no `apps/admin` |
| 1.6 | HL-F-06 train a population model | Tier 1 = store opt-in only | 3.4 | `healthlens_prefs.population_learning_consent`; no training pipeline |

**Honest empty / not-live (keep until the owning phase ships):** Alena STREAM, HD YouCam, Wallet meds-as-Must, user reviews, favourites, sponsored placement.

#### Phase 1.7 — Marketplace, SheMatch & Notifications

**Status (13 Aug 2026):** Must items above are in repo (seeded directory + pending business submissions + SheMatch banners + notification prefs/tick). Do not rebuild. EventBridge schedule for `/v1/notifications/tick` and VAPID keys are ops follow-through, not a second engine. Reviews, favourites, sponsored placement, and SM-F-05 stay 2.2.

- **MKT-F-01, F-02, F-03, F-04, F-06** (Must-priority marketplace: discovery, browsing, listing detail, search, Business Portal registration)
- **SM-F-01 through F-04** (SheMatch engine — the trigger table, banner UI, consent, transparency — built generally enough that Phase 1.4's Mirror bridges plug into it as new rows, not new code)
- **NTF-F-01, F-02, F-03, F-05** (Push notifications, quiet hours, lock-screen privacy, preferences management)

**Pickup from earlier phases (done):** SheMatch trigger rows with stable `catalogue_item_id`; pregnancy nearest clinic and Alena crisis listing only when a live listing is within 5 km — never invented.

#### Phase 1.8 — Remaining Must-priority closeout

**Status (13 Aug 2026):** Must items below are in repo. Do not rebuild Cycle / Wallet / Mirror / Alena / HealthLens / Pregnancy / TTC / Marketplace. PMOS-F-05 remains Should (§12.1 → 2.1). Prep Card stays `.txt`. Alena STREAM stays out. FR-076 photo/display-name left in §12.1.

**Pickup (done):** One library corpus in `packages/domain/src/library.ts` with `reviewedAt` and 24-month stale flag; Library UI + article reports; `content_reports` queue (`013_phase18_content_reports.sql`); My Data inventory, JSON export including SheMatch/listings/reports, deletion with 24h cooling-off and in-page confirm.

- **COM-F-03** (Educational Article Library — Must, but content-only, no community *interaction* required yet)
- **COM-F-04** (Content Reporting & Moderation infrastructure, since article comments/reporting still needs a moderation queue even without full peer groups)
- **APS-F-01 / F-02 / F-03** (My Data, Data Export, Account Deletion)

**Tier 1 exit criteria:** all 76 Must-priority features live in production at `girlcode.conquerorfoundation.com`; full regression pass against every "Positive" and "Security" test case in the requirements spreadsheet; INF-F-05 monitoring dashboards green for 2 consecutive weeks before Tier 2 begins.

---

### TIER 2 — Full Product Breadth

Brings in the 18 "Should"-priority features — the ones that make the product feel complete and delightful rather than merely functional, phased by the same product areas as Tier 1 so each phase has continuity with what was just built.

#### Phase 2.1 — Tracking depth

**Read §12.1.** Several Should UIs already exist as thin fields. Harden to spec; do not add a second diary.

- **PT-F-06** (Monthly Cycle Summary & Reports)
- **PT-F-07** (Period Reminders & Notifications)
- **PMOS-F-03** (Biometric & Lifestyle Logging)
- **PMOS-F-05** (PMOS Health Report & Doctor Prep Card)
- **PG-F-05** (Pregnancy Weight Tracker) — weight kg field exists; add WHO range guide + midwife disclaimer
- **PG-F-06** (Kick Counter) — integer kicks from week 24 exist; add timed sessions + “when to seek care” copy (HealthLens already flags `movement_reduced` from week 20)
- **TTC-F-03** (BBT Logging) — BBT field exists; add chart
- **TTC-F-04** (Cervical Mucus Tracking) — mucus select exists; keep educational tooltips
- **TTC-F-06** (Intercourse Logging — zero-knowledge encrypted, §6.3) — consent + delete path exists; raise to wallet-grade client encrypt if still server-plaintext

#### Phase 2.2 — Marketplace richness & webhook migration

- **MKT-F-05** (User Reviews & Ratings)
- **MKT-F-07** (Featured & Sponsored Listings — Paystack/Stripe integration)
- **MKT-F-08** (Save to Favourites)
- **HW-F-06** (Medication Reminders, Wallet context) — pickup from 1.3; not PMOS meds
- **Migrate `youcam-gateway` from polling to webhooks** (§5.1) — pickup from 1.4; poller stays until this lands
- Optional: EventBridge schedule calling the same `maybeMonthlyHealthLensReport` path as GET status (pickup from 1.6) so monthly reports exist even if the user never opens Alena that month
- **SM-F-05** (Business Health Tagging — self-service in the Business Portal, upgrading Phase 1.4's manually-seeded MIR-F-06 tags to owner-managed)

#### Phase 2.3 — Communication & community

- **NTF-F-04** (Marketing Notifications, opt-in)
- **UOB-F-07** (Onboarding Tutorial & Contextual Tooltips)
- **COM-F-01** (Peer Support Groups)
- **COM-F-02** (Community Post Creation & Interaction)

**Tier 2 exit criteria:** all 94 HLR features (Tier 1 + Tier 2) live in production; full regression pass including "Edge Case" test cases; HealthLens monthly report cadence proven stable across at least one full monthly cycle in production.

---

### TIER 3 — Depth, Scale & Ecosystem

This tier is explicitly **beyond the current requirements matrix** — it is where the product goes once the full 94-feature scope is live and the team is validating growth and scale rather than closing a fixed backlog. Phased as strategic initiatives rather than a fixed feature list; sequencing depends on real Tier 1/2 usage data.

#### Phase 3.1 — Native app decision point

Revisit the Tier 1 PWA-only decision (§2) with real engagement data: if push notification reliability, camera/photo capture friction, or app-store discoverability prove to be genuine adoption blockers (particularly in Nigeria/Ghana where app-store presence carries more trust signal than a browser install prompt), invest in a thin React Native wrapper around the same API layer — **not a rewrite**, since the entire backend and business logic already live behind `api.girlcode.conquerorfoundation.com`.

#### Phase 3.2 — Multi-region & scale hardening

CloudFront already handles static asset edge caching globally. This phase is specifically about write-path and API-read latency in Nigeria and Ghana — add a regional API if measured p95 justifies it. **Do not** plan RDS read replicas (there is no RDS). Aurora DSQL does not support cross-continent multi-Region clusters.

Full AWS account isolation (separate accounts per environment) if compliance/audit requirements from a future funding round or partnership demand stricter blast-radius separation than the single-account, environment-segmented model in §2.

#### Phase 3.3 — Business Portal & marketplace self-service maturity

Full self-service Business Portal onboarding flow (beyond Tier 1/2's founder-assisted seeding), automated moderation-queue tooling, boutique inventory catalog sync APIs for larger retail partners.

#### Phase 3.4 — AI/ML maturity

HL-F-06's population learning (opt-in aggregate pattern detection) moves from "collect consented data" (Tier 1 scope — checkbox + `healthlens_prefs` row only) to "train and deploy an actual GirlCode360-owned model" — this is the point where population-level PMOS/cycle-irregularity pattern detection could graduate beyond rules-engine + Nova narrative into a genuinely proprietary model, if the consented dataset is large enough to justify it. Do not train on users who never granted this purpose.

Multi-language support (Pidgin, Twi) across Alena, HealthLens narratives, and educational content — flagged as future in `COM-LLR-001`'s market notes and now formally scoped here.

#### Phase 3.5 — Advanced Mirror

HD-tier skin analysis as a Premium-tier default (currently SD-default per §5.5), skin-age trend tracking, and — pending Perfect Corp.'s API roadmap — expansion into their broader Fashion API suite (jewellery, watches, bags, shoes) as additional Mirror try-on categories beyond apparel.

---

## 13. Cost Model (Indicative)

Early MAU, order-of-magnitude. Confirm on the AWS bill.

| Line item | Estimate (USD/month) | Notes |
|---|---|---|
| **Aurora DSQL** | ~$0–40 | Idle compute $0; 100k DPU + 1 GB free; then DPU + storage |
| Lambda + API Gateway | $20–80 | Low until Mirror traffic |
| S3 + CloudFront | $20–80 | Wallet + Mirror images dominate storage |
| Cognito | $0–50 | Free tier to 50k MAU |
| KMS | ~$1/key + requests | Existing CMK |
| Secrets Manager | ~$0.40–2 | Packed JSON preferred |
| CloudWatch | $20–60 | Log volume |
| Bedrock Nova 2 Lite | Variable | Bounded by Alena 3/day free quota |
| YouCam units | Variable | 1,000 hackathon units then PAYG |
| **AWS subtotal (no RDS/NAT)** | **typically well under v1.0's $300–650** | v1.0 RDS $150–250 + DynamoDB $20–50 + NAT removed |
| SMS OTP | **Out of scope** | No phone auth in Tiers 1–2 |
| Stripe/Paystack | Phase 1.7 / 2.2 | Fees on success |

---

## 14. Technical Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| YouCam 2-hour URL expires before S3 copy | Medium | High — lost scan | Copy on critical path; Wave 1 5-minute alarm |
| Shared 250/300s YouCam limit | Low in Wave 0 | Medium later | In-process limiter now; shared limiter Wave 1 |
| Memory store used in demo by mistake | Medium | High — data vanishes | DSQL_ENABLED required for demo/prod |
| DSQL no FKs → orphan rows | Medium | Medium | API deletes/cascades; purge jobs already exist for wallet/privacy |
| Diagnosis-like Mirror copy | Medium | High (MHRA/SaMD) | `lint:copy`; wellness framing |
| Zara strings leaking in new UI | Low | Brand confusion | Alena-only; keep aliases server-side |
| iOS PWA camera / push | Medium | Medium | Wave 0: HTTPS + getUserMedia; Wave 3 native if needed |
| Parent-domain DNS blast radius | Low | High | Only `girlcode` records; already isolated in infra-web |
| Cross-continent “global DB” expectation | — | — | Out of scope; CloudFront for static; single-region API |

**Revisit DSQL if:** BAA/US PHI; DPU bill &gt; small RDS for 2 months; PostGIS/pgvector/triggers required.

---

## 15. Appendix

### 15.1 Secrets / config (names, not values)

```
girlcode360/{env}/app          JSON: stripe_*, paystack_*, vapid_*, youcam_api_key, ...
                               (no LLM key — Bedrock IAM)
DSQL_ENDPOINT / DSQL_ENABLED   Lambda env from Terraform
ALENA_MODEL_ID                 default global.amazon.nova-2-lite-v1:0
BEDROCK_ENABLED                true in demo/prod
MIRROR_ENABLED                 Wave 0 flag
YOUCAM_API_SERVER              https://yce-api-01.perfectcorp.com
```

### 15.2 YouCam endpoints

| Purpose | Method & path |
|---|---|
| File upload (skin) | `POST /file/skin-analysis` |
| Skin task | `POST /s2s/v2.0/task/skin-analysis` |
| Poll skin | `GET /s2s/v2.0/task/skin-analysis/{task_id}` |
| Apparel task | `POST /s2s/v2.0/task/apparel-tryon` |
| Poll apparel | `GET /s2s/v2.0/task/apparel-tryon/{task_id}` |
| Our webhook (Phase 2.2) | `POST /webhooks/youcam` |

### 15.3 Naming: Alena vs Zara

| Surface | Canonical | Compatibility |
|---|---|---|
| Product / UI | Alena | None |
| PWA route | `/app/alena` | `/app/zara` → redirect |
| API | `/v1/alena/*` | `/v1/zara/*` rewritten in router |
| SQL | `alena_*` after migration 009 | Do not create new `zara_*` |
| Model env | `ALENA_MODEL_ID` | `ZARA_MODEL_ID` fallback in `ai-provider` only |

### 15.4 Source documents

- This file — engineering source of truth for sequencing and stack
- `docs/old/girlcode-implementation-plan.md` — original 14-day build; Phase 0–7 code status
- `docs/new/girlcode-prd.md`, `girlcode-ai-feature-spec.md`, `girlcode-mirror-spec.md`, `girlcode-roadmap.md`
- Perfect Corp. YouCam API docs (August 2026)
- AWS Aurora DSQL user guide (PostgreSQL compatibility, CREATE TABLE, pricing FAQ)

---

---

## 16. UI/UX production plan

**Status:** implementation track, not a product tier. Runs against code that already exists (Phases 1.2, 1.3, 1.5 minus SSE, 1.6, and 1.4 Mirror in-repo). Does **not** replace §12. Does **not** add SheMatch, Google/Apple IdP, or Alena STREAM.

**Goal:** one React PWA that reads as a production consumer product on desktop and as a native-feeling app below `lg` (bottom tabs, safe areas, standalone). Web first; mobile-responsive; no React Native in this track.

**How to execute:** tokens and shell first, then migrate each existing page onto that system. Critique and audit every screen before calling it done (`design-critique-polish-workflow`). Do not restyle in one pass.

---

### 16.1 Relationship to §12 and current code

| Product phase | Code | This UI track |
|---|---|---|
| 1.0 Infra | Applied | Out of scope |
| 1.1 Auth / onboarding / Privacy Centre | Mostly present; no Google/Apple | Restyle auth + onboarding + Account; do not add IdPs |
| 1.2 Cycle / PMOS | Present | Calendar, log sheet, offline banner, Health PCOS tab |
| 1.3 Wallet | Present | Wallet panel inside Health; share page |
| 1.4 Mirror | In repo, not production-hardened | Mirror page polish; camera/consent/poll states |
| 1.5 Alena | Present; no SSE | Chat + HealthLens panels; no fake token stream |
| 1.6 HealthLens / Pregnancy / TTC | Present | Health nested tabs |
| 1.7 Marketplace | Absent | Landing may mention SheMatch as coming; no fake marketplace UI |
| 1.8 Library / My Data / deletion | Present | Library + Account Privacy Centre |
| 2.1 extras already in UI | Weight, kicks, BBT, mucus, intimacy, month summary | Keep; style consistently |

**Exit for this track:** every shipped route in `apps/web` uses the token file, one button/card/input system, full state coverage, WCAG 2.2 AA, and a rendered critique pass. Marketing and app chrome feel like one product.

---

### 16.2 Ground

| | |
|---|---|
| **Subject** | Women’s wellness PWA: cycle/PMOS, wallet, Alena, HealthLens, Mirror. UK / Nigeria / Ghana. |
| **Audience** | First-time install on a phone; returning daily logger; occasional desktop (clinician prep, wallet files). |
| **One product job** | Help her log, see, and talk about *her* data without diagnosis theatre. |
| **Surfaces** | **Marketing** (`/`, `/privacy`, `/terms`) · **Auth** (`/signin` … `/forgot-password`) · **Onboarding** · **App** (`/app/*`) · **Public share** (`/share/:token`) |
| **Brand already in code** | Rose `#b0126a` on blush `#fbf4f7`; Syne (display) + Figtree (UI); logo `/logo.png`. Keep. Do not invent a purple SaaS palette. |

**Signature idea (one, then quiet everything else):** warm rose glass chrome over a still blush atmosphere — not a second product personality per page.

**Stacks (from frontend-design-master):**

- **Marketing + auth:** Stack A — tokens, spacing, hierarchy, landing conversion, glass, restrained orbs, CSS motion, photography, cards, a11y, critique.
- **App shell + tools:** Stack B — tokens, spacing, hierarchy, shadcn architecture, states, a11y, light motion, glass **on chrome only**, critique. Density where logging needs it (`enterprise-dashboard-patterns` for Cycle calendar, HealthLens report, Account — not for Home).

**3D (`three-d-immersive-ui`):** out. Mirror is 2D photos + scores. No R3F, no WebGL hero.

---

### 16.3 Honest audit of what we have

What already works and must be kept:

- Dual chrome: bottom tabs `< lg`, top nav `lg+`; `viewport-fit=cover`; install prompt; 48px `--tap`.
- Auth split-screen (`AuthShell`) with photo pane at `lg+`.
- Landing is not a generic three-indigo-card template; rose brand is distinctive.
- Cycle calendar + IndexedDB sync banner.
- shadcn `Button` + CVA exist; landing uses them. Most app pages still use ad hoc `<button className="primary">` in `health.css`.
- Copy lint (`lint:copy`) for diagnosis phrases.

What fails a production bar today:

| Debt | Evidence | Skill that owns the fix |
|---|---|---|
| Two visual systems | Tailwind/shadcn on landing/auth; plain `health.css` / `cycle.css` / `alena.css` / `mirror.css` / `onboarding.css` on the app | `react-shadcn-component-architecture`, `component-alignment-consistency` |
| Token drift | `--radius: 0.55rem` vs `--radius-lg: 1rem`; hardcoded `#d9b5c8` in `.btn.secondary`; SVG path icons in `AppShell` vs Lucide in `package.json` unused | `design-token-discipline`, `icon-system-placement` |
| Spacing off-scale | `gap-0.5`, `py-3.5`, `0.85rem`, `1.1rem 1rem` home tiles | `spacing-layout-system` |
| Dual primary CTAs | Health tabs + many equal `primary` buttons; Account billing row | `visual-hierarchy-typography` |
| Glass without atmosphere | Header `bg-white/82 backdrop-blur` over a near-flat blush; orbs are a single CSS radial, not a tokenised layer | `glassmorphism-elegant-surfaces`, `ambient-bubble-background-effects` |
| Incomplete states | Several pages flash empty then data; Mirror poll is stronger; Library/Home weaker | `state-coverage-edge-cases` |
| Icon inconsistency | Hand-drawn tab SVGs; no 16/20/24 grid | `icon-system-placement` |
| Dark class unused | `@custom-variant dark` and shadcn dark variants with no designed dark pairs | `color-typography-themes` — **light-only for this track** (see 16.5.5) |
| Copy voice | Landing more marketing; app more form-label | `ux-writing-content-design`, `humanizer` |
| Imagery | Auth panel photo exists; module tiles are text-only; Mirror results are user photos (correct) | `photography-imagery-language` |
| Nested Health IA | PCOS / pregnancy / TTC / wallet as in-page tabs — correct for density, visually a second tab bar competing with the shell | `enterprise-dashboard-patterns`, `visual-hierarchy-typography` |

---

### 16.4 Locked product/UX decisions

1. **One codebase** (`apps/web`). Breakpoint for app vs web chrome: **`lg` (1024px)**. Below: phone app. At/above: desktop web.
2. **Phone tabs (exactly five):** Home, Cycle, Mirror, Alena, Account. Health and Library are not in the phone bar.
3. **Desktop nav:** Home, Cycle, Health, Mirror, Alena, Library, Account. If the bar wraps, collapse Library + Account into an overflow menu — do not shrink tap targets below 48px.
4. **Edge-to-edge chrome.** Header and bottom bar flush to the viewport. Content may use horizontal padding; section backgrounds and Mirror result images may full-bleed inside the content column, not outside the shell.
5. **Tap target:** 48×48px minimum (`--tap`). Icon-only controls: 48×48 hit area, 24px glyph.
6. **Safe areas:** `env(safe-area-inset-*)` on header, main bottom padding, tab bar, auth forms, install banner.
7. **Standalone:** hide marketing header links that bounce to `/` when `display-mode: standalone`; `start_url` toward `/app` remains Wave 1 infra in §8.1 — this track styles for that mode.
8. **Offline:** Cycle logging remains available; Mirror/Alena/Wallet network actions show a specific offline state, not a generic spinner.
9. **Wellness copy only.** `npm run lint:copy` stays in CI. No diagnosis language.
10. **Do not** add a sixth tab, a hamburger on phone, hover-only actions, or a second colour accent for “AI.”

---

### 16.5 Skill-by-skill application

Each skill is in scope. This subsection is the contract for implementers.

#### 16.5.1 `frontend-design-master`

Orchestrator. Every screen: ground → surface type → signature stack → build from tokens → states → a11y → critique. Conflict order: a11y > tokens > motion/ambient > glass. Brand tokens beat master-skill defaults (keep rose/Syne/Figtree).

#### 16.5.2 `design-token-discipline`

Lock **one value per axis** in `apps/web/src/index.css` (and only there). After each page migration, grep for hex, raw `px` radii, and `box-shadow` outside that file.

| Axis | Decision |
|---|---|
| Radius | `--radius: 8px` for controls/cards; `--radius-lg: 16px` for sheets/modals/auth card only |
| Elevation | Outlined cards at rest (1px `--border`); `--shadow-2` only on hover/focus for **interactive** cards; `--shadow-modal` for dialogs. No mixed neumorphism. |
| Accent | `--primary: #b0126a` only. Destructive `--destructive`. Success `--ok`. No third CTA colour. |
| Light | Shadow-down, tinted with `--foreground` at low opacity — not pure black. |
| Type | Syne 700 for page titles / brand; Figtree 400/600 for UI. Drop 500/800 from new work. |

Replace `--radius: 0.55rem` and the extra `--radius-lg: 1rem` conflict. Keep `--space-*` that already map to 4/8 (e.g. `--space-3: 0.75rem` = 12px). Delete one-off `0.35rem` / `0.85rem` in page CSS.

#### 16.5.3 `spacing-layout-system`

Allowed padding/margin/gap: **4, 8, 12, 16, 24, 32, 48, 64, 96px**. Proximity: label→input 8px; field→field 16–24px; card padding 16px → gap between cards 24px. Marketing sections: hero 64–96px vertical; app page sections 24–32px. One alignment per section (left for forms and logs; center only for short empty states).

#### 16.5.4 `visual-hierarchy-typography`

| Token | Size | Use |
|---|---|---|
| `--text-caption` | 12px | Meta, timestamps, “Sample scan” |
| `--text-label` | 14px | Field labels, tab labels |
| `--text-body` | 16px | Body |
| `--text-sub` | 20px | Card titles |
| `--text-section` | 24px | `h2` in app |
| `--text-page` | 32px | App `h1` (clamp 28–32 on phone) |
| `--text-hero` | 40–48px | Landing only |

**One primary filled button per screen.** Secondary = outline. Tertiary = text. Health nested tabs are **segmented controls**, not a second row of primary buttons. Home tiles are an allowed exception: equal outlined choices, because the job is navigation.

#### 16.5.5 `color-typography-themes`

This track is **light-only**. Keep `.dark` unused rather than shipping an unaudited invert. If dark is requested later: semantic tokens (`bg-canvas`, `bg-surface`, `text-muted`, `accent`) with a separate dark ramp; lighter accent stop on dark; re-check muted text with APCA. Do not enable `prefers-color-scheme` auto-switch until those pairs exist.

Audit now: `--muted-foreground` on blush and on white cards; `--primary` on white (CTA); white text on `--primary`. Floor WCAG 2.2 AA; APCA as quality bar for captions.

#### 16.5.6 `glassmorphism-elegant-surfaces`

Glass **only** on: app header, bottom tab bar, auth form card, install banner, optional Mirror camera overlay. **Not** on Cycle calendar cells, long Alena transcripts, HealthLens reports, forms, Library articles.

One material:

```
--glass-tint: 18%;
--glass-blur: 16px;
--glass-border: color-mix(in srgb, white 40%, var(--border));
```

Sit glass on the ambient layer (16.5.7), never on a flat fill. `prefers-reduced-transparency` / `prefers-contrast: more` → solid `--card`. Max two blurred layers in one view (header + tabs is the pair).

#### 16.5.7 `ambient-bubble-background-effects`

App + auth: **two** large rose/blush orbs, opacity 10–20%, blur ≥80px, `pointer-events: none`, `aria-hidden`, `transform`-only drift 20–40s. Token colours only. Reduced motion: static gradient, no loop. Marketing hero may use the same two orbs; no particle field.

#### 16.5.8 `framer-motion-micro-interactions`

**Do not add `framer-motion` unless a screen needs layoutId, list stagger, or a gesture.** Default: CSS 150–350ms on `opacity`/`transform`. Budget per surface: enter fade, press scale on primary CTA, one ambient orb loop. Tab switch: no page-flip theatre. Keep the existing global `prefers-reduced-motion` short-circuit.

Alena: until APIGW STREAM exists, do **not** fake a typewriter of a finished reply. A short “Alena is writing” then reveal is honest.

#### 16.5.9 `card-design-system`

**Outlined** as the product default (border, no rest shadow). Interactive home tiles / catalogue rows: outlined + hover elevation-2. Image-led: Mirror results and try-on only, 4:3 or 1:1 locked per grid. Content-led: Home tiles, Library, skincare picks. Do not mix photo-top and icon-only in the same grid.

#### 16.5.10 `react-shadcn-component-architecture`

Target tree:

```
apps/web/src/components/
  ui/           # stock shadcn (button, input, card, …) — CLI-safe
  primitives/   # CVA extensions (tap-sized button, SegmentedTabs)
  blocks/       # PageHeader, EmptyState, ErrorState, ScoreBar, TabBar, AppHeader
```

Migrate app pages off `.health-form button` toward `Button` / `Input` / `Label` / `Card`. Do not duplicate a third button in CSS. Never strip Radix focus behaviour for glass.

#### 16.5.11 `component-alignment-consistency`

Flex/grid only. One `PageHeader` (eyebrow, h1, lead). One `SegmentedTabs` for Health, Mirror, Alena panels. Form fields: label and control share the start edge; 48px control height everywhere. Render with long names (NG/GH) and long error strings before sign-off.

#### 16.5.12 `icon-system-placement`

**Lucide only** (already a dependency). Sizes: 16 (inline), 24 (tabs/buttons). Tab icons: 24px in a 48px column, 8px gap to label. Replace `AppShell` path SVGs. Semantic lock: pick one glyph for Mirror and do not reuse it for Alena. Every icon-only control gets `aria-label`.

#### 16.5.13 `accessibility-contrast-standards`

WCAG 2.2 AA. Meaning never by colour alone (Mirror scores already pair number + label + bar — keep). Visible focus (`--ring`). Keyboard: tabs, calendar cells, file pickers, Alena composer. Camera/file inputs: associated `<label>`. Live regions for Mirror poll and cycle sync.

#### 16.5.14 `state-coverage-edge-cases`

Required on every data or submit surface: **loading (skeleton matching layout), empty + next action, error + retry, validation, success, offline, permission/consent denied.** Partial: one cycle, one scan, long boutique names.

#### 16.5.15 `ux-writing-content-design`

Glossary (do not synonym-drift):

| Term | Use |
|---|---|
| Alena | Companion. Never Zara in UI. |
| Mirror | Skin scores and try-on. |
| Cycle | Period logging. |
| Health | PCOS, pregnancy, TTC, wallet hub. |
| Scan / try-on | Mirror actions. |
| Allow / Not now | Mirror consent. Not “Accept all.” |
| Wellness / pattern / snapshot | Insights. Never diagnosis. |

Buttons: verb + object (“Take a face photo”, “Save this day”, “Allow Mirror photos”). Errors: situation + next step, no internals.

#### 16.5.16 `humanizer`

Landing and empty-state copy: cut promotional filler and vague “journey” language. Keep short, specific sentences. Run a pass on `/` and onboarding after visual polish.

#### 16.5.17 `auth-page-design`

Keep split-screen `lg+`, form-only on phone (current `AuthShell`). Raise form card opacity vs decorative glass; inputs **solid**. One primary CTA. Autofill: `email`, `current-password` / `new-password`, `one-time-code` on verify. Do not add Google/Apple buttons until UOB-F-02 exists. Age gate stays on onboarding.

#### 16.5.18 `landing-page-conversion-patterns`

Keep asymmetric/branded rose — do not regress to purple gradient + three identical icon cards. Hero: what it is + one primary CTA (Create account) + one secondary (Sign in). SheMatch copy must not look like a live marketplace. Trust claims only where true (UK/NG/GH, consent, device-side wallet encryption).

#### 16.5.19 `enterprise-dashboard-patterns`

Use for **Cycle calendar, HealthLens report, Account privacy/billing**, not Home. Density is allowed. Hide actions that can never run (e.g. scan when YouCam is unconfigured). No admin personas in this PWA.

#### 16.5.20 `photography-imagery-language`

| Surface | Medium |
|---|---|
| Landing / auth | One licensed or generated grade; grade the existing auth panel to match landing or replace both together. Avoid cliché “pain pose” stock. |
| App chrome | Logo only. No lifestyle photos behind logs. |
| Home tiles | Content-led, no photos. |
| Mirror | User-captured images; never stock faces as fake results. Seeded timeline: scores without fake selfies (already). |
| Try-on catalogue | Perfect Corp sample garments until SheMatch; same crop per grid. |

Image skeleton + `onError` fallback. Do not hotlink random CDNs beyond known Perfect Corp sample URLs.

#### 16.5.21 `design-critique-polish-workflow`

For each page in 16.9: critique hierarchy/flow before polish; refine with states; audit tokens/spacing/icons/a11y; polish last. Sign-off is a **rendered** pass at 390px, 768px, and 1280px plus standalone — not a code read.

#### 16.5.22 `three-d-immersive-ui`

Explicit skip. Documented so a later agent does not add a WebGL Mirror preview.

---

### 16.6 Information architecture (phone vs desktop)

```
Phone (< lg)                         Desktop (lg+)
─────────────────                    ─────────────────
[ brand header, no mega-nav ]        [ brand + text nav ]
[ page ]                             [ page, max content width ]
[ Home | Cycle | Mirror |            Home Cycle Health Mirror
  Alena | Account ]                    Alena Library Account
```

**Home** is the switchboard: Cycle, Health, Alena, Library, Mirror (and emergency). That is how Health/Library stay reachable on phone.

**Health** remains a hub with segmented control: PCOS | Pregnancy | TTC | Wallet. Do not promote Wallet to a sixth root tab.

**Deep links** stay: `/app/health`, `/app/library`, `/app/alena?panel=lens`.

---

### 16.7 PWA / mobile-app feel (implementation detail)

| Behaviour | Spec |
|---|---|
| Viewport | Already `viewport-fit=cover`; keep |
| Theme colour | Match `--background` / `--primary` in manifest |
| Tab bar | `position: fixed`; `padding-bottom: max(8px, env(safe-area-inset-bottom))`; glass tokens; active = icon + label in `--primary`, not colour alone |
| Header | `sticky`; same glass; 56px + `safe-area-inset-top` |
| Main | `padding-bottom: calc(64px + env(safe-area-inset-bottom))` below `lg`; normal padding `lg+` |
| Overscroll | `overscroll-behavior-y: contain` in standalone |
| Height | `dvh` (already on shell) |
| Keyboard | Alena composer stays usable; tab bar must not cover the field (`visualViewport` if needed) |
| Camera | Mirror: native file input + `capture`; add a preview sheet before upload (§8.4 still open) |
| Install | Existing prompt; don’t block first-run logging |
| Touch | No hover-only; `:active` press on tiles |

---

### 16.8 Shared blocks to build first (before page restyles)

Implement in `components/blocks/` + tokens, then swap pages:

1. `AmbientLayer` — two orbs, reduced-motion static.
2. `AppHeader` / `TabBar` — Lucide, glass tokens, 5 tabs / desktop links.
3. `PageHeader` — eyebrow, title, lead.
4. `EmptyState` / `ErrorBanner` / `OfflineBanner` / `SkeletonBlock`.
5. `SegmentedTabs`.
6. `ScoreBar` — Mirror (number + track).
7. `Disclaimer` — restyle existing `PredictionDisclaimer` to tokens.
8. Form field wrapping shadcn `Input`+`Label` at 48px.

Until these exist, do not restyle Cycle/Mirror in isolation (that recreates `health.css`).

---

### 16.9 Surface-by-surface spec

Execute in the order of §16.11. Each screen: one job, one primary CTA (Home excepted), listed states.

#### Marketing — `/`

- **Job:** Explain GirlCode360; get a qualified 18+ sign-up.
- **Primary CTA:** Create account. Secondary: Sign in.
- **Keep:** rose brand, module list, privacy points, steps.
- **Fix:** one hero composition; don’t compete header CTA with hero CTA; humanizer pass; SheMatch as later, not a screenshot we don’t have.

#### Auth family — `/signin`, `/signup`, `/verify`, `/forgot-password`

- **Job:** Get in / recover. Shared `AuthShell`.
- **States:** submit loading, field errors, generic auth failure, network error, verify/reset success.
- **A11y:** autofill attributes; focus first error.
- **Mobile:** no image pane; solid-enough card; safe-area padding (exists).

#### Onboarding — `/onboarding`

- **Job:** Age → market → consents → modules.
- **Primary CTA:** one per step.
- **States:** loading profile, 404 bootstrap, API missing, busy.
- **Mirror consent:** optional; declining must not block finish. Don’t style optional consents as required.

#### App — Home `/app`

- **Job:** Navigate + emergency numbers for market.
- **Tiles:** Cycle, Health, Mirror, Alena, Library — five. Grid: 1 col &lt;480, 2 col, 3 col `lg+`.
- **States:** loading name/market; emergency fetch fail → local numbers + quiet retry.

#### Cycle `/app/cycle`

- **Job:** Log today; see the month.
- **Primary CTA:** Save this day (when a date is selected). Start period = secondary.
- **States:** hydrating IDB, pending sync count, sync error, empty calendar, offline (log still works).
- **Calendar:** 48px min cells on phone; selected = border + text, not fill-only. Legend not colour-only.

#### Health `/app/health`

- **Job:** Module hub.
- **SegmentedTabs:** PCOS | Pregnancy | TTC | Wallet.
- **States:** module off (enable empty state), API down, number validation.
- **Wallet:** passphrase + WebAuthn/PIN; don’t glass the file list.

#### Mirror `/app/mirror`

- **Job:** Consent → scan or try-on → read scores with cycle context.
- **Primary CTA:** Allow Mirror photos, or Take a face photo / full-body (by tab).
- **Add:** pre-flight preview sheet; offline disabled; YouCam paused banner; seeded vs live labelling.
- **Scores:** numeric + bar. Insight disclaimer always visible.
- **Catalogue:** outlined selectable rows; maternity empty copy stays honest.

#### Alena `/app/alena`

- **Job:** Ask; optional HealthLens.
- **Primary CTA:** Send. HealthLens generate = secondary on that panel.
- **States:** quota exhausted, consent missing, crisis (existing), network, empty transcript.
- **Composer:** sticky above tab bar; 48px send. Transcript on a solid surface.

#### Library `/app/library`

- **Job:** Read one article.
- **States:** loading, empty topic, fetch error, offline local subset — say when content is local.

#### Account `/app/account`

- **Job:** Consents, export, deletion, billing stubs, notification prefs.
- **Delete** is destructive/outline, never the only filled button. Export = secondary.
- **Billing stubs:** visually “not live pay” until secrets exist.

#### Share `/share/:token`

- **Job:** Decrypt and view a shared wallet file.
- **States:** missing `#k=`, expired, wrong key, loading ciphertext.
- **Chrome:** no app tabs (public).

#### Legal `/privacy`, `/terms`

Solid reading surface, no glass. Match type scale.

---

### 16.10 Cross-cutting state matrix (minimum)

| Surface | Load | Empty | Error | Offline | Success |
|---|---|---|---|---|---|
| Home | skeleton tiles | n/a | emergency retry | tiles still work | — |
| Cycle | calendar skeleton | Log your first day | sync retry | banner + local write | saved day |
| Health tabs | panel skeleton | enable module | retry | message | saved |
| Mirror | page skeleton | consent / no scans | retry + mapped errors | disable capture | scores + poll live |
| Alena | quota skeleton | Ask Alena | retry | disable send | reply |
| Library | list skeleton | No articles in this topic | retry | local subset | — |
| Account | privacy skeleton | — | retry | disable export | Consent updated |
| Auth | — | — | field + form | disable submit | navigate |
| Wallet | list skeleton | No documents yet | retry | disable upload | listed |
| Share | — | invalid link | expired | — | file |

---

### 16.11 Implementation sequence (UX waves)

These are **frontend waves**, not §11 hackathon waves and not §12 phases. Do them in order. Do not skip UX-0.

| Wave | Work | Done when |
|---|---|---|
| **UX-0 Tokens & blocks** | Rewrite token section of `index.css`; Lucide TabBar/Header; AmbientLayer; PageHeader; Empty/Error/Offline; SegmentedTabs; Button/Input on Home | Grep: no new hex in components; 390px tab bar matches spec |
| **UX-1 Shell** | `AppShell` on tokens; standalone padding; focus rings; desktop overflow if needed | Phone/desktop screenshots; reduced-transparency fallback |
| **UX-2 Marketing + auth + onboarding** | Landing critique; AuthShell glass/opacity; onboarding steps | Conversion checklist + auth a11y |
| **UX-3 App pages** | Home → Cycle → Health/Wallet → Mirror → Alena → Library → Account → Share | Each page: states table + CTA rule |
| **UX-4 Audit & polish** | Contrast sample; copy lint + humanizer; icon audit; spacing grep; screenshots at 390/768/1280 | §16.12 ticked |

**Parallelism:** UX-0 is blocking. After UX-1, UX-2 and UX-3 can split by person but must not fork tokens.

**Out of this sequence:** Phase 1.7 marketplace UI, SSO buttons, Framer as a default dependency, dark mode, 3D, native wrap.

---

### 16.12 Definition of done (this track)

- [x] One radius, one accent, one outlined card recipe, one glass recipe, one icon library
- [x] Spacing values only from the 4/8 scale
- [x] App pages use `components/ui` + `blocks`, not a second button CSS
- [x] Phone: 5 tabs, 48px targets, safe areas, no hover-only
- [x] Desktop: top nav, Health + Library visible
- [x] Every route in 16.10 has the listed states
- [x] WCAG 2.2 AA on text/background pairs used; focus visible
- [x] `prefers-reduced-motion` and reduced-transparency honoured
- [x] `lint:copy` clean; glossary terms consistent
- [x] No WebGL; no fake SheMatch; no fake Alena stream
- [x] Rendered critique at 390, 768, 1280, and standalone

---

### 16.13 Risks specific to UI

| Risk | Mitigation |
|---|---|
| Restyling Mirror during hackathon judging | UX-3 Mirror after UX-0/1; don’t break capture/poll |
| Dual CSS during migration | Delete page CSS only when that page is on tokens; no long-lived mix inside one page |
| Desktop nav overflow | Overflow menu at `lg` if 7 items wrap |
| Glass contrast on cheap Androids | Solid fallback; don’t raise blur |
| Lucide + leftover SVGs | Remove path icons in the same PR as TabBar |

---

*GirlCode360 — Master Technical Implementation Plan v1.3 · Confidential · 13 August 2026*  
*v1.0 superseded for stack. v1.1 added DSQL/Lambda/Alena/Mirror engineering. v1.2 adds §16 UI/UX production plan. v1.3 adds §12.1 carry-forward register after Phase 1.6. Phase 1.8 Must closed 13 Aug 2026. Phone/SMS auth remains out of scope.*
