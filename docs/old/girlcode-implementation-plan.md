# GirlCode360 — Phased Implementation Plan

**14-day build plan · AWS · Marketplace excluded**

| Field | Value |
| --- | --- |
| Version | 1.7 |
| Status | Phase 7 complete (code); AWS deploy / live payments / clinical sign-off still pending |
| Horizon | 14 calendar days (10–12 engineering workdays with weekend buffer) |
| Primary region | `eu-west-2` (London) |
| Related Docs | [PRD](./girlcode-prd.md) · [AI Spec](./girlcode-ai.md) · [Roadmap](./girlcode-roadmap.md) |
| Last Updated | 19 July 2026 |

---

## 0. Plan contract

### 0.1 Goal

Ship an **internal-beta-ready** GirlCode360 **PWA** + serverless AWS backend covering all **Must** health, privacy, and AI features (Alena + HealthLens), with production-shaped infrastructure (`infra-web` / `infra-backend`), **excluding marketplace and SheMatch**.

### 0.2 Non-negotiables

1. Wellness positioning only — no diagnosis language (MHRA SaMD avoidance).
2. Health data: AES-256 at rest (KMS), TLS 1.3 in transit, Health Wallet client-side encrypted.
3. Config in **SSM Parameter Store**; secrets in **Secrets Manager as JSON** (packed keys to minimise secret count / cost).
4. Offline-first health writes (IndexedDB outbox + idempotent API).
5. Notification bodies never contain health content (Web Push).
6. Marketplace / SheMatch code paths are **not** started in this sprint.
7. **Low-budget infra:** Aurora DSQL (not Serverless v2); no NAT Gateway; PWA only (no Expo).
8. Mobile/standalone UI uses a **bottom tab bar**, not a hamburger as primary nav.

### 0.3 Team assumption (minimum)

| Track | Owner |
| --- | --- |
| A — Infra / CI | Infra engineer (or backend dual-hat Days 0–3) |
| B — Backend / AI | Backend engineer |
| C — Frontend (PWA) | Frontend engineer |
| D — Design / content | Designer + PM + clinical advisor (parallel) |

If solo or two people: sequence Infra → Auth → Period → parallel AI with Wallet; cut Should items first (BBT charts, kick counter polish, community posts).

### 0.4 Environments

| Env | Branch | Purpose |
| --- | --- | --- |
| `dev` | `develop` | Continuous deploy; engineers live here |
| `test` | `develop` (gated) | QA / acceptance tests |
| `prod` | `main` | Reserved; optional soft-deploy Day 14 |

Parameter / secret namespaces:

```text
SSM:     /girlcode360/{env}/web/*
         /girlcode360/{env}/backend/*
         /girlcode360/cicd/*

Secrets: girlcode360/{env}/app     # stripe_*, paystack_*, vapid_private_key, ... (no LLM API key — Bedrock IAM)
         girlcode360/{env}/sms     # africastalking_*, twilio_*
# DSQL: IAM auth from Lambda — prefer no static DB password secret
```

Example `girlcode360/dev/app` JSON:

```json
{
  "stripe_secret_key": "...",
  "stripe_webhook_secret": "...",
  "paystack_secret_key": "...",
  "vapid_private_key": "...",
  "sentry_dsn": "..."
}
```

---

## 1. Target architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  PWA (Vite + React) — S3 + CloudFront  ← infra-web           │
│  Cognito (custom auth pages) · IndexedDB · SW · Web Push                       │
│  Mobile/standalone: BOTTOM TAB BAR  |  Desktop: top nav      │
└────────────────────────────┬─────────────────────────────────┘
                             │ Cognito JWT
                             ▼
                    API Gateway REST (Cognito authorizer)
                             │  STREAM on POST /v1/alena/chat
                             ▼
                    Lambda (TypeScript) — no VPC required
                             │
         ┌───────────────────┼────────────────┬─────────────┐
         ▼                   ▼                ▼             ▼
    Aurora DSQL           S3              EventBridge    Bedrock
    (SQL, scale-to-0)   (wallet         (HealthLens    Nova 2 Lite
                         ciphertext)     monthly)      ConverseStream
```

### 1.1 Why Aurora DSQL (not Serverless v2, not DynamoDB-primary)

| | Aurora Serverless v2 | DynamoDB primary | **Aurora DSQL (chosen)** |
| --- | --- | --- | --- |
| Idle compute | Floor cost / ACU (or resume tax) | ~$0 | **$0 DPU** |
| Hidden tax | VPC + **NAT ~$32+/mo** + RDS Proxy | None | None (public endpoint + IAM) |
| Free tier | None meaningful ongoing | On-demand free tier (limited) | **Permanent ~100k DPUs + 1 GB/mo** |
| HealthLens / cycles | Excellent SQL | Awkward (single-table / many GSIs) | **SQL joins + aggregates** |
| Integrity | Full Postgres FKs | App-level | App-level (no FKs — OK for greenfield) |

**DynamoDB** remains optional for hot counters (Alena daily quota) only — not the system of record for health logs.

### 1.2 Recommended service choices

| Concern | Choice | Why |
| --- | --- | --- |
| Client | Vite + React **PWA** | One deploy via `infra-web`; installable |
| Mobile nav | Bottom tabs in standalone / ≤768px | Explicit product requirement vs hamburger |
| Auth | Cognito User Pool + **custom auth pages** (sign-in, sign-up, forgot password, verification). Client: `amazon-cognito-identity-js`. **No Amplify. No Cognito Hosted UI.** | Full UX control; tokens stored securely in browser |
| API | REST API Gateway + Lambda | Streaming for Alena; no VPC |
| DB | **Aurora DSQL** | Budget + SQL |
| Offline | IndexedDB (Dexie) + outbox | Works in PWA; NG/GH flaky networks |
| Wallet crypto | Web Crypto AES-GCM + Argon2id | Client-side before S3 |
| Alena | APIGW STREAM + Bedrock ConverseStream | Nova 2 Lite |
| Push | Web Push VAPID | Service worker |
| Observability | CloudWatch + Sentry | Cheap Day 1 |

### 1.3 Monorepo layout

```text
girlcode360/
├── apps/web/                    # Consumer PWA (current sprint)
├── apps/admin/                  # LATER — ops/content scaffold only
├── packages/api-types/
├── packages/domain/
├── packages/ai-provider/        # Bedrock Converse (Nova 2 Lite)
├── infra-web/                   # S3, CloudFront, ACM, Route53
├── infra-backend/               # Cognito, APIGW, DSQL, KMS, SSM…
│   └── modules/lambda/
│       ├── main.tf
│       └── codes/               # Lambda application source
├── ci-cd/
└── docs/
```

Adapt WalkCroach sample pipelines: rename to `girlcode360`; **do not** provision VPC/NAT/RDS Proxy for DSQL.

---

## 2. Data model (core tables)

Implement in **Aurora DSQL** (PostgreSQL-compatible subset). Use UUIDs (`gen_random_uuid()`); enforce parent/child integrity in the API (DSQL has no foreign keys). Migrations via SQL files applied by a deploy Lambda or CI step.

| Table | Purpose |
| --- | --- |
| `users` | Cognito `sub`, market, locale, created_at |
| `consents` | purpose, version, granted_at, jurisdiction, metadata JSON |
| `user_modules` | enabled modules flags |
| `cycles` / `cycle_days` | period ranges, flow, notes |
| `symptoms` / `mood_logs` | daily logs |
| `pcos_biometrics` | optional weight/sleep/water/stress |
| `medications` / `medication_reminders` | PCOS + wallet reminders |
| `pregnancies` / `pregnancy_logs` / `appointments` / `kick_sessions` | pregnancy |
| `ttc_profiles` / `bbt_logs` / `mucus_logs` / `intimacy_logs` | TTC (intimacy highest sensitivity flag) |
| `wallet_documents` | S3 key, category, wrapped_dek metadata, mime, size — **no plaintext** |
| `share_links` | token hash, expires_at, revoked_at |
| `content_articles` | market tags, reviewed_at, body |
| `alena_conversations` / `alena_messages` | encrypted or redacted storage policy |
| `healthlens_reports` | rules JSON, narrative, pdf_s3_key |
| `subscriptions` | Stripe/Paystack customer ids, tier, status |
| `audit_events` | append-only privacy/security events |
| `deletion_requests` | cooling-off until purge |

Indexes: `(user_id, date)` on logs; GIN optional later. **No PostGIS** until marketplace.

---

## 3. Phase plan (day-by-day)

### Phase 0 — Bootstrap (Day 0–1)

**Status: DONE (scaffold)** — monorepo + Terraform + pipelines + PWA auth shell land locally. Live AWS `dev` apply / pipeline green still depends on account credentials + first deploy.

**Objective:** Empty product that deploys.

| Track | Tasks | Done when | Status |
| --- | --- | --- | --- |
| Infra | AWS account org tags; KMS CMK; S3 tf-state + DynamoDB lock; bootstrap Secrets Manager empty JSON skeletons; SSM path scaffolding | Secrets/params readable by a test role | Deferred to first AWS apply |
| Infra | `infra-backend` Terraform: Cognito, API Gateway, Lambdas (**no VPC**), Aurora DSQL cluster, S3 data bucket, KMS; enable Bedrock Nova 2 Lite | `curl` health 200; DSQL `SELECT 1`; Bedrock smoke invoke | Terraform modules present; not yet applied |
| Infra | `infra-web` Terraform: private S3 web bucket, CloudFront, ACM, SPA routing + PWA cache headers | Placeholder PWA live | Terraform modules present; not yet applied |
| CI | Port sample pipelines → GirlCode360; path filters `infra-*`, `apps/web/**` | Pipeline validates + deploys `dev` | `ci-cd/infra-*-pipeline.yaml` + buildspecs ready |
| Web | Vite + React PWA; custom Cognito auth routes (`/signin`, `/signup`, `/forgot-password`, `/verify`); bottom tab shell | Auth pages render; tabs visible ≤768px; Lighthouse installable | **Done** (`apps/web`) |
| Admin | `apps/admin` mini scaffold marked **LATER** | Present but not in sprint scope | **Done** |
| Shared | `packages/api-types` + `packages/domain` stubs; CI typecheck | Green | **Done** (expanded in Phase 1) |

**SSM seed (examples):**

| Parameter | Value |
| --- | --- |
| `/girlcode360/dev/backend/api_base_url` | `https://api.dev....` |
| `/girlcode360/dev/backend/cognito_user_pool_id` | `eu-west-2_...` |
| `/girlcode360/dev/backend/cognito_client_id` | `...` |
| `/girlcode360/dev/web/cloudfront_distribution_id` | `E...` |

**Exit:** Dev pipeline green; PWA points at Cognito + health endpoint; bottom tabs render on mobile width.  
**Exit notes:** Bottom tabs + auth pages done. Pipeline/Cognito/health live wiring awaits first AWS deploy.

---

### Phase 1 — Identity, consent, onboarding (Day 2–4)

**Status: DONE (app + API code)** — email Cognito path, onboarding UI, consent/modules APIs, and SQL migration are in repo. Phone/Google/Apple IdPs deferred. Persistence uses in-memory Lambda store until DSQL is applied.

**Objective:** Compliant user entry.

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 1.1 | Cognito: email/password, email verification, password policy OWASP, optional MFA | B/A | FR-001, FR-078 | **Done** (TF + custom pages); MFA optional / not enforced |
| 1.2 | Phone auth / SMS OTP via Cognito + SMS provider credentials in `girlcode360/{env}/sms` | B | FR-002 | **Deferred** (Should) |
| 1.3 | Google + Apple IdPs on Cognito | B/C | FR-007 | **Deferred** (Should) |
| 1.4 | Custom auth pages (sign-in, sign-up, forgot password, verify code) via Cognito SDK (`amazon-cognito-identity-js`); secure token storage | C | FR-001, FR-078 | **Done** |
| 1.5 | Age gate 18+ screen | C | FR-003 | **Done** (`/onboarding` step 1) |
| 1.6 | Jurisdiction detect (locale + IP country header from CloudFront/API) + override | B/C | FR-005 | **Done** (locale detect + override); CloudFront country header later |
| 1.7 | Granular CMP UI + `POST /v1/consents`; versioned policy IDs in SSM | B/C | FR-004, NFR-014 | **Done** (CMP UI + API; policy version constant / env) |
| 1.8 | Module picker (≤5 screens total onboarding) | C | FR-006, FR-008–010 | **Done** (4-step flow) |
| 1.9 | `users` + `user_modules` + `consents` migrations | B | — | **Done** (`migrations/001_phase1_users_consents.sql`; modules JSON on `users`) |
| 1.10 | Privacy policy / ToS placeholder pages on `apps/web` | D | Launch DoD | **Done** (`/privacy`, `/terms`) |

**API surface**

```text
POST /v1/users/me/bootstrap
GET  /v1/users/me
PATCH /v1/users/me
POST /v1/consents
GET  /v1/consents
PATCH /v1/users/me/modules
```

**Implemented also:** `GET /v1/health` (public); Cognito JWT authorizer on `{proxy+}`; local `Bearer dev.*` for scaffold testing; Lambda code under `infra-backend/modules/lambda/codes/`.

**Exit:** New user completes onboarding; consent rows immutable audit; AT path ready for health logging.  
**Exit notes:** Onboarding gated before `/app`. Consent history append-only in memory store (DSQL wiring = Phase 0 deploy follow-up). Phone / social IdPs remain backlog.

---

### Phase 2 — Period Tracker + prediction core (Day 5–7)

**Status: DONE (app + API code)** — prediction domain, cycle CRUD/sync APIs, calendar UI, IndexedDB outbox, symptom library (≥24), disclaimer, and thin monthly summary are in repo. Persistence still in-memory until DSQL apply; AT-001/AT-006 need `test` env.

**Objective:** Daily habit loop (AT-001).

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 2.1 | Domain: cycle length / next period prediction (≥2 cycles); irregular override | B + clinical | FR-012, FR-020 | **Done** (`packages/domain` + override on cycle) |
| 2.2 | CRUD APIs for cycles, days, symptoms, mood | B | FR-011, FR-013, FR-014 | **Done** (`/v1/cycles/**`, `/v1/symptoms/library`) |
| 2.3 | Calendar UI ±6 months; predicted vs logged styling | C | FR-015 | **Done** (`CyclePage`) |
| 2.4 | Disclaimer component on all prediction surfaces | C | FR-018 | **Done** (`PredictionDisclaimer`) |
| 2.5 | IndexedDB schema + outbox + SyncManager (idempotency keys) | C | NFR-003, NFR-032 | **Done** (`lib/idb.ts`, `lib/sync.ts`) |
| 2.6 | Sync endpoints accepting idempotency-key header | B | — | **Done** (`POST /v1/cycles/sync`) |
| 2.7 | Symptom MVP library JSON (≥20) clinically reviewed | D | FR-013 | **Done** (24 symptoms; clinical review pending) |
| 2.8 | Monthly summary view (Should — if time) | C | FR-017 | **Done** (thin in-app summary; PDF export later) |

**Prediction rules (v1):** average of last N cycles (N=min(6, count)); stddev for confidence banding; if variance high, UI says “your cycles vary — predictions are approximate”.

**API surface (Phase 2)**

```text
GET    /v1/cycles
POST   /v1/cycles
GET    /v1/cycles/:id
PATCH  /v1/cycles/:id
DELETE /v1/cycles/:id
GET    /v1/cycles/predictions
GET    /v1/cycles/days?from=&to=
PUT    /v1/cycles/days
POST   /v1/cycles/sync          # Idempotency-Key required
GET    /v1/symptoms/library
```

**Migration:** `infra-backend/migrations/002_phase2_cycles.sql`

**Exit:** AT-001 green on `test`; airplane mode log → sync works (AT-006 partial).  
**Exit notes:** Code ready for AT-001/AT-006 once API is deployed; offline outbox + sync path implemented locally.

---

### Phase 3 — PCOS Manager (Day 6–8, overlaps Phase 2)

**Status: DONE (app + API code)** — module opt-in, expanded symptoms (≥30), biometrics, medication reminders + generic push payload, insight stubs, market-tagged articles, and FR-028 copy lint are in repo. Real VAPID Web Push send awaits Secrets Manager keys on deploy.

**Objective:** Trust module for core persona.

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 3.1 | Enable PCOS flag; expanded symptom set MVP (≥30) | B/C/D | FR-021, FR-022 | **Done** (module gate + 34 symptoms; clinical review pending) |
| 3.2 | Biometrics optional logging UI | C | FR-023 | **Done** (`/app/health` + `PUT /v1/pcos/biometrics`) |
| 3.3 | Medication reminder entities + Web Push scheduling | B/C | FR-025 | **Done** (CRUD + subscription store + generic payload; VAPID send later) |
| 3.4 | Insights stub: rules on irregularity + co-occurrence (feeds HealthLens later) | B | FR-024 | **Done** (`buildPcosInsights` + `GET /v1/pcos/insights`) |
| 3.5 | PCOS education articles (3–5 market-tagged) | D | FR-027 | **Done** (5 articles UK/NG/GH) |
| 3.6 | Copy lint: ban “diagnose” / “you have PCOS” | CI | FR-028 | **Done** (`npm run lint:copy`) |

**API surface (Phase 3)**

```text
GET/PUT  /v1/pcos/biometrics
GET/POST /v1/pcos/medications
PATCH/DELETE /v1/pcos/medications/:id
GET      /v1/pcos/insights
GET      /v1/pcos/articles?market=
POST     /v1/pcos/push-subscription
GET      /v1/pcos/reminders/due   # returns due meds + generic push body (FR-068)
```

**Migration:** `infra-backend/migrations/003_phase3_pcos.sql`

**Exit:** PCOS module usable end-to-end; reminders schedule with generic push body (FR-068).  
**Exit notes:** End-to-end in app code; push body always `You have a note in GirlCode360`. Full browser PushManager + VAPID after secrets bootstrap.

---

### Phase 4 — Pregnancy + TTC (Day 7–10)

**Status: DONE (app + API code)** — pregnancy EDD/weeks/logs/appointments, TTC fertile overlay + BBT/mucus/intimacy consent, emergency numbers, quiet-hours notification prefs, and Home hub are in repo.

**Objective:** Full journey coverage for Must FRs.

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 4.1 | Pregnancy init (LMP/conception → EDD range) | B/C | FR-029 | **Done** (Naegele ±1 week) |
| 4.2 | Week content JSON Weeks 4–42 skeleton; fill priority weeks 4–12, 18–22, 36–40 first | D | FR-030 | **Done** (skeleton + priority filled; clinical review pending) |
| 4.3 | Daily logs + appointments + reminders | B/C | FR-031–033 | **Done** (day logs + appointments with remind flags) |
| 4.4 | Emergency shortcut (localised numbers from locale config) | C | FR-036, NFR-028 | **Done** (Home + `GET /v1/emergency`) |
| 4.5 | Weight tracker + kick counter (Should — ship thin UI) | C | FR-034, FR-035 | **Done** (thin; kicks from week 24) |
| 4.6 | TTC mode overlay on calendar; fertile window algorithm | B/C | FR-038, FR-039, FR-043 | **Done** (Cycle calendar + `/v1/ttc/fertile-window`) |
| 4.7 | BBT + mucus optional logs | C | FR-040, FR-041 | **Done** |
| 4.8 | Intimacy log with separate consent + delete API | B/C | FR-042 | **Done** |
| 4.9 | Month counter + 12-month compassionate prompt | C | FR-045 | **Done** |
| 4.10 | Quiet hours + notification preferences API | B/C | FR-065, FR-066 | **Done** (Account + `/v1/notifications/prefs`) |

**Push architecture:** Store Web Push subscriptions server-side; Lambda sends via Web Push (VAPID keys in Secrets Manager). Payload body always generic (e.g. “You have a note in GirlCode360”); deep link in `data` only.

**API surface (Phase 4)**

```text
GET/POST /v1/pregnancy
GET      /v1/pregnancy/weeks?week=
GET/PUT  /v1/pregnancy/days
GET/POST /v1/pregnancy/appointments
DELETE   /v1/pregnancy/appointments/:id
GET/POST /v1/ttc
GET      /v1/ttc/fertile-window
GET/PUT  /v1/ttc/days
DELETE   /v1/ttc/days/:date/intimacy
GET      /v1/emergency
GET/PATCH /v1/notifications/prefs
```

**Migration:** `infra-backend/migrations/004_phase4_pregnancy_ttc.sql`

**Exit:** Module toggles work; pregnancy + TTC happy paths QA’d.  
**Exit notes:** Happy paths implemented in code; QA on `test` after deploy.

---

### Phase 5 — Health Wallet (Day 8–11)

**Status: DONE (app + API code)** — client Argon2id/AES-GCM vault, ciphertext upload/metadata/share/delete, in-memory viewer, `#k=` share fragment, WebAuthn/PIN gate, and 30-day purge policy are in repo. Live S3 multipart presign swaps in when `DATA_BUCKET` is wired; current path stores ciphertext via `PUT /v1/wallet/objects/:id`.

**Objective:** Zero-knowledge-ish vault (AT-002).

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 5.1 | Client: vault passphrase → Argon2id → KEK; per-file DEK; AES-GCM encrypt before upload | C | FR-046, NFR-010 | **Done** (`walletCrypto.ts`) |
| 5.2 | `POST /v1/wallet/uploads` → presigned S3 multipart PUT | B | NFR-006 | **Done** (API upload session + ciphertext PUT; S3 presign follow-up on deploy) |
| 5.3 | Metadata API: list, category, notes (notes encrypted client-side or as ciphertext blob) | B | FR-047, FR-051 | **Done** |
| 5.4 | In-app PDF/image viewer decrypt-in-memory | C | FR-048 | **Done** |
| 5.5 | Share links: ciphertext + time-limited token; key in URL fragment `#k=` | B/C | FR-049 | **Done** (`/share/:token`) |
| 5.6 | Delete + S3 lifecycle / async purge worker (30-day backup purge policy documented) | B | FR-050 | **Done** (soft-delete + purge_after + Privacy Centre note) |
| 5.7 | Biometric gate before share/export | C | FR-077 | **Done** (WebAuthn + PIN fallback) |

**Pragmatic v1 share model (recommended for 14 days):**  
Recipient page loads ciphertext from API via short-lived token; decryption key transported in URL fragment (`#k=...`) so it never hits server logs. Document the threat model in Privacy Centre.

**API surface (Phase 5)**

```text
GET/POST /v1/wallet/docs | uploads
PUT/GET  /v1/wallet/objects/:id
PATCH/DELETE /v1/wallet/docs/:id
POST/GET /v1/wallet/docs/:id/shares
DELETE   /v1/wallet/shares/:token
GET      /v1/wallet/share/:token          # public
GET      /v1/wallet/share/:token/object   # public
```

**Migration:** `infra-backend/migrations/005_phase5_wallet.sql`

**Exit:** AT-002 green.  
**Exit notes:** Code path ready; APIGW must expose public share routes without Cognito; S3 SSE-KMS multipart when bucket env is live.

---

### Phase 6 — Alena + HealthLens (Day 6–12, parallel)

**Status: DONE (app + API code)** — `packages/ai-provider` (Nova 2 Lite Converse + stub), context assembler (~4KB), crisis detector, free quota (3/day), HealthLens rules + activation/report/prep card, chat + HealthLens UI, migration `006_phase6_ai.sql`, and CloudWatch/EventBridge Terraform stubs are in repo. Live Bedrock (`BEDROCK_ENABLED=true`) + APIGW STREAM + monthly cron await account wiring; replies are full-body until STREAM is enabled.

#### 6.A Alena

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 6A.1 | `packages/ai-provider` Bedrock `Converse` client for Nova 2 Lite (STREAM later) | B | NFR-AI-10 | **Done** (stub fallback) |
| 6A.2 | Context assembler → pseudonymised JSON (size cap e.g. 4KB) | B | NFR-AI-05 | **Done** |
| 6A.3 | System prompt pack + market localisation blocks; clinical review | D | FR-086 | **Done** (prompts; clinical review pending) |
| 6A.4 | `POST /v1/alena/chat` Lambda (+ APIGW STREAM later) | B | FR-080 | **Done** (full reply; STREAM deferred) |
| 6A.5 | Chat UI + modes Context/Anonymous + consent | C | FR-079, FR-081 | **Done** |
| 6A.6 | Quota in-memory / DSQL row later; Premium bypass via `PREMIUM_SUBS` | B | FR-082, NFR-AI-06 | **Done** |
| 6A.7 | Crisis detector (phrase list) → emergency response template | B/D | FR-084 | **Done** |
| 6A.8 | Disclaimer + action buttons (Generate Prep Card) | C | FR-083 | **Done** |
| 6A.9 | Cost/error CloudWatch alarms (Bedrock invocation metrics) | A | NFR-AI-06 | **Stub** (`bedrock_alarms.tf.example`) |

#### 6.B HealthLens

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 6B.1 | Rules library in `packages/domain` | B + clinical | FR-092, FR-093 | **Done** |
| 6B.2 | Activation status API | B | FR-088 | **Done** |
| 6B.3 | Report generator: rules → Nova narrative → store | B | FR-089, FR-090 | **Done** |
| 6B.4 | EventBridge cron 1st 06:00 UTC + on-demand free/premium limits | B | FR-089 | **On-demand done**; cron **stub** |
| 6B.5 | Prep Card download (text; PDF/S3 later) | B/C | FR-091 | **Done** (`.txt` client download) |
| 6B.6 | Population learning consent flag | B | FR-095 | **Done** |
| 6B.7 | Ask Alena about report deep link | C | FR-094 | **Done** (`?ask=report`) |

**Exit notes:** AT-009/AT-010 need `test` env + Bedrock; free tier enforceable in-memory until DSQL apply.

---

### Phase 7 — Privacy centre, Premium, content, hardening (Day 11–14)

**Status: DONE (app + API code)** — Privacy Centre (My Data, JSON export, 24h deletion cooling-off + purge tick), billing stubs (Stripe/Paystack checkout + webhooks + dev activate), content library, analytics consent gate, Alena/HealthLens paywall CTAs, PWA install banner, k6 smoke, and ops runbooks are in repo. Live Stripe/Paystack secrets, Cognito Premium group sync, and formal clinical/legal sign-off remain pre-launch.

| ID | Work | Owner | Maps to | Status |
| --- | --- | --- | --- | --- |
| 7.1 | Privacy Centre + My Data aggregation API | B/C | FR-073, NFR-016 | **Done** |
| 7.2 | JSON export job | B | FR-075, AT-004 | **Done** (sync-ready in-memory) |
| 7.3 | Account deletion + 24h cooling-off + purge worker | B | FR-074, AT-005 | **Done** |
| 7.4 | Analytics consent wiring (exclude health fields) | B/C | NFR-015, NFR-018, AT-008 | **Done** (client stub sink) |
| 7.5 | Stripe + Paystack checkout/portal/webhooks; Premium entitlement | B | Monetisation | **Stub** (+ `PREMIUM_SUBS` / dev-activate) |
| 7.6 | Paywall UI for Alena/HealthLens limits | C | AI free/premium table | **Done** |
| 7.7 | Educational library browser | C | FR-071 | **Done** (`/app/library`) |
| 7.8 | Accessibility pass (targets, labels, alerts) | C | NFR-019–023 | **Partial** |
| 7.9 | PWA install prompt + offline/bottom-tab QA notes | C | §5.4 PRD | **Done** |
| 7.10 | Load smoke k6 | A | NFR-002 | **Done** (`load/k6-smoke.js`) |
| 7.11 | Internal testers | C | — | **Ops** (post-deploy) |
| 7.12 | Clinical + legal checklist | D | Launch DoD | **Tracker** (`docs/ops/`) |
| 7.13 | Runbooks | A/B | NFR-012, NFR-AI-09 | **Done** |

**Exit notes:** Demo script steps 1–6 supported in code; AWS `test` URL + real payment providers still pending.

---

## 4. Parallel workstream calendar

```text
Day  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
Infra ████████░░░░░░░░░░░░░░░░░░░░░░░░░░
Auth/Onboard ░░████████░░░░░░░░░░░░░░░░░░
Period/PCOS      ░░░░░░████████████░░░░░░
Preg/TTC              ░░░░████████████░░░
Wallet                   ░░░░████████████
Alena            ░░░░████████████████████░
HealthLens         ░░░░████████████████░░
Privacy/Premium              ░░░░████████
QA/ Harden                     ░░░░██████
Clinical copy ████████████████████████░░░
```

---

## 5. API catalogue (v1)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/v1/health` | none | Deploy check |
| GET/PATCH | `/v1/users/me` | JWT | Profile |
| POST/GET | `/v1/consents` | JWT | CMP |
| PATCH | `/v1/users/me/modules` | JWT | Module flags |
| * | `/v1/cycles/**` | JWT | Period data + sync |
| * | `/v1/pcos/**` | JWT | PCOS |
| * | `/v1/pregnancy/**` | JWT | Pregnancy |
| * | `/v1/ttc/**` | JWT | TTC |
| * | `/v1/wallet/**` | JWT | Docs + shares |
| POST | `/v1/alena/chat` | JWT | **STREAM** |
| GET | `/v1/healthlens/status` | JWT | Activation |
| POST | `/v1/healthlens/report` | JWT | On-demand |
| POST | `/v1/healthlens/prep-card` | JWT | PDF |
| GET | `/v1/content/articles` | JWT | Market filter |
| GET | `/v1/privacy/my-data` | JWT | Art.15 |
| POST | `/v1/privacy/export` | JWT | Art.20 |
| POST | `/v1/privacy/delete` | JWT | Art.17 |
| POST | `/v1/billing/checkout` | JWT | Stripe/Paystack |
| POST | `/v1/billing/webhooks/*` | sig | Providers |

Public share viewer: `GET /share/:token` on web CloudFront → Lambda@Edge or API.

---

## 6. Security & compliance checklist (sprint-embedded)

| Control | When | Evidence |
| --- | --- | --- |
| TLS 1.3 on CloudFront + API custom domain | Day 1 | SSL Labs |
| KMS CMK on S3 (+ DSQL encryption at rest) | Day 1 | Terraform |
| Cognito password policy + rate limiting | Day 2–3 | Pool config + WAF/APIGW throttle |
| No health fields in analytics events | Day 11 | Event schema review |
| SaMD denylist in CI | Day 5+ | GitHub/CodeBuild step |
| DPIA draft | Day 0–14 parallel | Legal doc |
| Breach runbook draft | Day 13 | Markdown in `docs/ops/` |
| Lock-screen push QA | Day 10 | Device photos |

---

## 7. Explicit cut list (if behind schedule)

Cut in this order — **never** cut the items in the “do not cut” list.

### Cut / slim first

1. Peer community groups (FR-069/070)  
2. Kick counter polish, weight tracker charts  
3. BBT chart styling  
4. Monthly cycle PDF (keep on-screen summary)  
5. Apple/Google social login (keep email+phone)  
6. Premium Paystack path (keep Stripe or feature-flag billing)  
7. Cert pinning / native wrappers (not needed for PWA v1)  
8. Full Weeks 4–42 copy (keep skeleton + key weeks)

### Do not cut

- Age gate, granular consent, jurisdiction routing  
- Period log + prediction + disclaimer  
- Offline outbox for health writes  
- Health Wallet encryption before upload  
- Alena streaming + rate limit + crisis path  
- HealthLens activation gate + Prep Card  
- Export + delete + My Data  
- Generic Web Push bodies (no health content)  
- Marketplace (already cut)
- Bottom tab bar on mobile/standalone (do not regress to hamburger-only)

---

## 8. Definition of Done — Day 14

| # | Criterion | Owner |
| --- | --- | --- |
| 1 | `dev` and `test` environments deploy via pipelines | A |
| 2 | All in-scope Must FRs demoable | B/C |
| 3 | AT-001, 002, 004, 005, 006, 007, 008, 009, 010 pass on `test` | QA |
| 4 | Clinical sign-off spreadsheet green for shipped modules | D |
| 5 | Privacy policy + ToS URLs live on web | D |
| 6 | Bedrock / Nova spend alarm + Alena quota verified | A/B |
| 7 | Internal testers on PWA (Add to Home Screen) ≥10 | C |
| 8 | Open P0 = 0; P1 have owners + dates | PM |
| 9 | Marketplace/SheMatch absent from app navigation | PM |
| 10 | This plan’s cut decisions logged if any Must slipped | PM |

---

## 9. Day-15+ backlog (immediate post-sprint)

1. External web security review (OWASP Top 10)  
2. Complete pregnancy week content  
3. Expand symptom libraries to PRD minima  
4. NDPC / Ghana DPC registration completion  
5. Prod cutover + optional native wrappers later  
6. Marketplace BD + SheMatch (separate epic)  
7. Peer community with moderation tooling  
8. Multi-region / Africa data residency evaluation  

---

## 10. Research references (implementation choices)

| Topic | Source / practice applied |
| --- | --- |
| SSM vs Secrets Manager | [AWS Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) — config in SSM; credentials in Secrets Manager |
| Secrets JSON packing | [Secrets Manager JSON structure](https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_secret_json_structure.html); single `app` secret with multiple keys for cost |
| DB (low budget) | [Aurora DSQL pricing](https://aws.amazon.com/rds/aurora/dsql/pricing/) — scale-to-zero + permanent free tier; avoid Serverless v2 VPC/NAT floor |
| DSQL limits | No FKs/triggers/sequences — enforce in API; UUIDs ([What is Aurora DSQL?](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/what-is-aurora-dsql.html)) |
| LLM streaming on AWS | Bedrock `ConverseStream` (Nova 2 Lite) + API Gateway response streaming |
| Offline-first (PWA) | IndexedDB outbox + idempotency keys |
| Wallet encryption | Web Crypto envelope encryption; Argon2id KDF |
| SaMD avoidance | [MHRA software/apps guidance](https://www.gov.uk/government/publications/medical-devices-that-need-a-clinical-investigation/determining-if-a-clinical-investigations-is-required) |
| Auth | Cognito User Pools + custom pages (`amazon-cognito-identity-js`) — **not Amplify, not Hosted UI** |
| Nova 2 Lite | Prefer `global.amazon.nova-2-lite-v1:0` (Global CRIS) from `eu-west-2` |

---

## 11. First commands (kickoff)

```bash
# After AWS SSO / credentials configured
aws ssm put-parameter --name /girlcode360/cicd/codeconnections_arn --type String --value "<arn>"
aws secretsmanager create-secret --name girlcode360/dev/app --secret-string '{"stripe_secret_key":"","paystack_secret_key":"","vapid_private_key":""}'

# Repo bootstrap (illustrative)
npm create vite@latest apps/web -- --template react-ts
# Add vite-plugin-pwa, React Router, amazon-cognito-identity-js (custom auth pages)
# Terraform init in infra-backend / infra-web with remote state
```

---

*GirlCode360 — Phased Implementation Plan v1.7 | Confidential | July 2026*
