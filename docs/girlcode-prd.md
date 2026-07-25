# GirlCode360 — Product Requirements Document

**Functional & Non-Functional Requirements**

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Status | Active — Implementation Ready |
| Markets | United Kingdom · Nigeria · Ghana |
| Last Updated | July 2026 |
| Owner | Product Manager / Founder |
| Reviewers | Lead Engineer, Clinical Advisor, Legal Counsel, UX Designer |
| Related Docs | [AI Features Spec](./girlcode-ai.md) · [Roadmap](./girlcode-roadmap.md) · [Implementation Plan](./girlcode-implementation-plan.md) |
| Classification | Internal only — Confidential |

---

## 1. Introduction & Purpose

This Product Requirements Document (PRD) defines the functional and non-functional requirements for **GirlCode360**, an all-inclusive women’s beauty and wellness platform targeting users in the United Kingdom, Nigeria, and Ghana.

It is the single source of truth for product, engineering, clinical advisors, and legal counsel. It defines what the product must do, how it must perform and comply, and the regulatory obligations in each target jurisdiction.

### 1.1 Scope

This PRD covers GirlCode360 **v1.0** — the full health platform (mobile + API + admin surfaces) excluding marketplace.

| In scope (v1.0 sprint) | Deferred |
| --- | --- |
| Mobile-responsive **PWA** (installable; mobile bottom nav in standalone) | Native iOS/Android (Expo) — later if needed |
| Backend API & AWS infrastructure | Location-based marketplace (FR-054–FR-064) |
| Period, PCOS, Pregnancy, TTC, Health Wallet | SheMatch health-to-marketplace AI (FR-096–FR-103) |
| Alena + HealthLens AI | Telemedicine / video consults |
| Notifications, consent, privacy centre, Premium | Wearable device APIs |
| Educational content library | White-label B2B (2027+) |

> **Marketplace exclusion:** Business discovery, listings, reviews, business portal, and SheMatch are explicitly out of scope for the current build. Requirements are retained in §3.7 for future reference but must not block v1.0 delivery.

### 1.2 Definitions & Conventions

| Term | Definition |
| --- | --- |
| FR-XXX | Functional Requirement with unique identifier |
| NFR-XXX | Non-Functional Requirement with unique identifier |
| Must | MoSCoW: Core — product cannot ship without it |
| Should | MoSCoW: High value; planned for v1.0 but not launch-blocking |
| Could | MoSCoW: Desirable; may defer to v1.1+ |
| UK / NG / GH | United Kingdom / Nigeria / Ghana market context |
| SaMD | Software as a Medical Device (MHRA classification) |
| DPCO | Data Protection Compliance Organisation (Nigeria) |
| CMP | Consent Management Platform |

---

## 2. Product Overview

### 2.1 Product Vision

> GirlCode360 is the first platform that unites a woman’s complete health journey and beauty life in one trusted, culturally relevant app — from her first period to trying to conceive, through pregnancy, and every salon visit, pharmacy trip, and clinic appointment in between.

### 2.2 User Personas

**Persona 1 — Zara (UK, 24, Black Caribbean heritage)**  
Uses multiple apps for period tracking, mood logging, and GP booking. Has suspected PCOS; struggles to be taken seriously at her NHS GP. Wants a culturally competent, privacy-first app. Shops at Afrocentric beauty stores in London.

**Persona 2 — Chiamaka (Nigeria, 31, Lagos)**  
Married, TTC for 8 months. Finds Flo generic and not Nigeria-relevant. Books beauty appointments via WhatsApp. Privacy-conscious; concerned about health data sold to advertisers.

**Persona 3 — Abena (Ghana, 27, Accra)**  
Pregnant at 14 weeks; anxious about finding a reliable OB/GYN. Active smartphone user (Bolt, Jumia). Needs the app to work well on 3G/4G with intermittent coverage.

---

## 3. Functional Requirements

Requirements are organised by module. Each has a unique ID, MoSCoW priority, and market notes where applicable.

### 3.1 Module: Onboarding & User Registration

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-001 | Create account with email + email verification | Must | All markets. Email verified before health data entry. |
| FR-002 | Create account with mobile phone (SMS OTP) | Must | NG/GH phone-first. UK optional. OTP via Africa’s Talking (NG/GH) + SNS/Twilio (UK). |
| FR-003 | Enforce minimum age gate of 18. Under-18 blocked. | Must | UK GDPR child rules; NG/GH health-data minor protections. |
| FR-004 | Granular consent screen: health data, location (optional), analytics (optional), marketing (optional). Independent toggles. No pre-ticked boxes. | Must | UK GDPR Art.7; NDPA s.25; Ghana DPA s.20. |
| FR-005 | Detect jurisdiction on first launch; route to correct consent flow. Allow manual override. Store consent version server-side. | Must | IP + device locale. |
| FR-006 | Select which health modules to activate (Period, PCOS, Pregnancy, TTC, Wallet); changeable later. | Must | Users on Period-only must not see PCOS unprompted. |
| FR-007 | Social login (Google, Apple) as alternative | Should | Apple required for iOS App Store. Google prevalent NG/GH. |
| FR-008 | Complete onboarding in ≤5 screens | Must | Each extra screen loses ~12% conversion. |
| FR-009 | Skip optional personalisation; complete later | Should | Reduces drop-off. |
| FR-010 | Welcome notification + privacy policy link | Must | Privacy notice at point of collection. |

### 3.2 Module: Period Tracker

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-011 | Log period start/end and daily flow (light, medium, heavy, spotting). Support retroactive logging. | Must | Core feature. |
| FR-012 | Predict next 3 cycle dates from history. Min 2 logged cycles before prediction. No diagnostic claims. | Must | Framed as “predicted”. Clinical advisor review. |
| FR-013 | Log daily symptoms from curated library (≥30), including cramps, bloating, headache, acne, breast tenderness, fatigue, mood changes. | Must | Clinically reviewed. Feeds PCOS insights. |
| FR-014 | Log daily mood (≥5 levels + emoji) | Must | Culturally appropriate emoji for NG/GH. |
| FR-015 | Calendar: logged periods, predicted periods, fertile window (if TTC), ovulation estimate. ±6 months scroll. | Must | — |
| FR-016 | Free-text notes per day (encrypted) | Should | — |
| FR-017 | Monthly cycle summary; exportable PDF for GP | Should | Useful for NHS consults. |
| FR-018 | Disclaimer on all predictive outputs: wellness estimate, not medical advice | Must | Required to avoid SaMD classification. |
| FR-019 | Period reminder (1/2/3 days before predicted start) | Should | Respect quiet hours. |
| FR-020 | Manual correction of predicted dates | Must | Essential for irregular / PCOS cycles. |

### 3.3 Module: PCOS Manager

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-021 | Enable PCOS as add-on to Period Tracker; PCOS insights from cycle + symptom data | Must | Not standalone. |
| FR-022 | PCOS symptom diary (≥50 symptoms): irregular cycles, acne, hair thinning, weight changes, hirsutism, mood swings, pelvic pain | Must | Plain language; clinical review. |
| FR-023 | Optional biometrics: weight, sleep hours, water, stress (1–5) | Should | Progressive disclosure. |
| FR-024 | Monthly PCOS insight summary: trends, irregularity, possible trigger correlations | Should | “Possible patterns”, not diagnoses. |
| FR-025 | Medication / supplement reminders (name, dosage, time, frequency) | Must | UK: Metformin, inositol, Letrozole. NG/GH: local supplements. |
| FR-026 | PCOS Health Report PDF (3 months) for doctor sharing | Should | NHS / private clinic formats. |
| FR-027 | Curated PCOS education library | Must | NHS / FMOH / GHS localisation. |
| FR-028 | Never use “diagnose” or imply diagnostic capability | Must | Legal + clinical review mandatory. |

### 3.4 Module: Pregnancy Management

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-029 | Enter LMP or conception date; calculate EDD (Naegele’s rule) as range ±1 week | Must | — |
| FR-030 | Week-by-week content Weeks 4–42: baby development, maternal changes, nutrition, symptoms | Must | NHS / FMOH / GHS variants. |
| FR-031 | Daily pregnancy symptoms & wellbeing logs | Must | Encrypted. |
| FR-032 | Antenatal appointment tracker (date, time, location, type, notes) | Must | NHS vs private clinic terminology. |
| FR-033 | Appointment reminders (1 day + 1 hour) and weekly milestones; per-type opt-out | Must | — |
| FR-034 | Weight gain tracker with WHO ranges as guide | Should | Disclaimer required. |
| FR-035 | Kick counter from week 24 | Should | Informational only. |
| FR-036 | Emergency contact shortcut (local emergency numbers) | Must | UK 999/111; NG 112; GH 999/193. |
| FR-037 | Transition to Postpartum at week 40+ | Could | v1.1. |

### 3.5 Module: Trying to Conceive (TTC)

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-038 | Activate TTC mode; overlay fertile window + ovulation on calendar | Must | Min 2 cycles. Labelled as estimates. |
| FR-039 | 5-day fertile window + peak ovulation day | Must | LH surge + cycle-length model. Disclaimer. |
| FR-040 | Daily BBT log + chart | Should | Plain interpretation. |
| FR-041 | Cervical mucus observations | Should | Educational tooltips. |
| FR-042 | Intercourse logging with highest encryption; specific consent; deletable | Should | — |
| FR-043 | TTC timeline view | Must | Non-anxiety language. |
| FR-044 | TTC educational content | Must | NICE / local guidance. |
| FR-045 | Month counter; compassionate “seek medical advice” after 12 months | Should | Clinical review of prompts. |

### 3.6 Module: Health Wallet

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-046 | Upload documents (PDF, JPG, PNG; max 25MB). Client-side encrypt before upload. | Must | Server never holds plaintext. |
| FR-047 | Categories: Test Results, Prescriptions, Scan Images, Vaccination, Insurance, Other + custom | Must | — |
| FR-048 | In-app PDF/image viewer; no unencrypted device cache | Must | — |
| FR-049 | Time-limited share links (24h / 48h / 7d); revocable | Must | Encrypted link; browser access. |
| FR-050 | Permanent delete; all copies gone within 30 days | Must | GDPR Art.17 / NDPA / Ghana DPA. |
| FR-051 | Free-text notes on documents | Should | Encrypted with metadata. |
| FR-052 | Medication reminders in Wallet context | Should | Separate from PCOS reminders. |
| FR-053 | Export wallet as encrypted zip (biometric/PIN re-auth) | Should | Data portability. |

### 3.7 Module: Location-Based Marketplace — DEFERRED

> **Status:** Out of scope for v1.0 implementation. Requirements retained for v1.1+.

| FR-ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-054–FR-064 | Browse/filter/search listings; reviews; business portal; sponsored listings; favourites; moderation; contextual surfacing | Deferred | See historical PRD v1.0. Depends on BD seeding + geospatial search. |

### 3.8 Module: Notifications & Reminders

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-065 | Push for period, ovulation, appointments, medication, weekly insights. Independent toggles + master off. | Must | Web Push (VAPID) via service worker; generic lock-screen/notification copy. |
| FR-066 | Quiet hours (default 22:00–07:00 local) | Must | — |
| FR-067 | In-app (not push) for promos if marketing opted-in | Should | Marketplace listing alerts deferred with marketplace. |
| FR-068 | Lock-screen notifications must never reveal health content | Must | Generic body only (e.g. “You have a note in GirlCode360”). |

### 3.9 Module: Community & Peer Support

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-069 | Opt-in peer support groups | Could | Stretch / post-v1.0. Moderation burden. |
| FR-070 | Text posts in groups (no media v1.0) | Could | Deferred with FR-069. |
| FR-071 | Curated educational article library with clinical review dates | Must | Flag articles >24 months old. |
| FR-072 | Report Content on every post; <24h SLA | Must if FR-069 ships | Safeguarding. |

### 3.10 Module: Account & Privacy Settings

| FR-ID | Requirement | Priority | Market Notes |
| --- | --- | --- | --- |
| FR-073 | “My Data” screen — human-readable view of held data | Must | GDPR Art.15 / NDPA / DPA. |
| FR-074 | Delete account + all data; 24h cooling-off; irreversible | Must | Includes health logs, documents, posts. |
| FR-075 | Export all data as machine-readable JSON | Must | Art.20 portability. |
| FR-076 | Update email, phone, display name, avatar (re-verify contacts) | Must | — |
| FR-077 | Biometric / device unlock for app open + sensitive actions (WebAuthn / platform authenticator where available; PIN fallback) | Must | PWA: WebAuthn; fallback to app PIN. |
| FR-078 | Password change/reset via email OTP; OWASP policy (8+, upper, lower, number) | Must | Cognito password policy. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-001 | Cold start ≤3s on 2GB RAM device / 4G | P95 on min-spec Android + iPhone SE |
| NFR-002 | API read P95 ≤500ms under normal load | Load tested; CloudWatch metrics |
| NFR-003 | Graceful degradation on 2G/3G; offline health writes + sync | Offline-first outbox; throttle QA |
| NFR-004 | Period prediction ≤1s after submission | Server-side + cache |
| NFR-005 | *(Marketplace proximity ≤1s)* | Deferred with marketplace |
| NFR-006 | Health Wallet upload: progressive + resumable | S3 multipart |

### 4.2 Security

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-007 | Health data at rest AES-256; keys via AWS KMS. No server plaintext of wallet docs. | Pen test; architecture review |
| NFR-008 | TLS 1.3 in transit (1.2 compatibility only where needed) | SSL Labs A+ on CloudFront/API |
| NFR-009 | MFA option; 30-day idle session expiry; device-bound tokens; login rate limit (5 fails → 5 min lockout) | Cognito + API Gateway; OWASP ASVS L2 |
| NFR-010 | Zero-knowledge encryption for Health Wallet documents | External security review; Argon2id KDF |
| NFR-011 | *(Certificate pinning)* | Deferred with native apps; PWA relies on browser TLS + CSP |
| NFR-012 | Data Breach Response Plan; assess 24h; notify DPA within jurisdiction windows | Legal-reviewed DBRP |
| NFR-013 | Security review before public launch (OWASP ASVS / web Top 10) | Sign-off from security engineer |

### 4.3 Data Privacy & Compliance

| Topic | UK (UK GDPR / DPA 2018) | Nigeria (NDPA 2023 + GAID 2025) | Ghana (DPA 2012 Act 843) |
| --- | --- | --- | --- |
| Legal basis (health) | Explicit consent Art.6+9; DPIA | Explicit consent NDPA s.25; NDPC register as DCPMI | Explicit consent s.20; register with DPC |
| Subject rights | Access, correct, erase, port, restrict, object (1 month) | Access, correct, delete, restrict, port (21 days) | Informed, access, object, correct, withdraw (21 days) |
| Residency | Adequacy / SCCs for transfers | Local storage recommended for health; safeguards for transfers | DPC approval or contractual protections for transfers |
| Breach | 72h to ICO | As soon as reasonably practicable to NDPC | As soon as reasonably practicable to DPC |
| Minors | 18+ for health without parental consent | 18+ | 18+ |

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-014 | CMP records consent version, timestamp, jurisdiction | Re-consent on material policy change |
| NFR-015 | No health data to ad platforms without separate explicit consent | Contractual prohibition; Flo $56M settlement lesson |
| NFR-016 | In-app Privacy Centre | ICO-aligned |
| NFR-017 | DPIA before each market launch | Documented + approved |
| NFR-018 | Aggregated anonymised analytics only unless explicit consent | Mixpanel/Amplitude exclude health fields |

### 4.4 Accessibility

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-019 | WCAG 2.1 AA (responsive web / PWA) | Keyboard + screen reader (VoiceOver Safari / TalkBack Chrome) |
| NFR-020 | Touch targets ≥44×44 CSS px on mobile breakpoints | Automated + manual |
| NFR-021 | Support browser zoom / rem-based scaling without layout break | Test at 200% zoom |
| NFR-022 | Contrast ≥4.5:1 body, ≥3:1 large | Colour Contrast Analyser |
| NFR-023 | Screen-reader labels on all health inputs | No unlabelled icons |

### 4.5 Localisation & Internationalisation

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-024 | Dates DD/MM/YYYY; time follows device 12/24h | i18n + date-fns locales |
| NFR-025 | Currency: £ / ₦ / GH₵ via `Intl.NumberFormat` | No hardcoded strings |
| NFR-026 | *(Distance in km for marketplace)* | Deferred |
| NFR-027 | All strings externalised; v1.0 English only | i18n from day 1 |
| NFR-028 | Localised emergency numbers | Locale config, not hardcoded |
| NFR-029 | Market-tagged educational content (NHS / FMOH / GHS) | CMS or content JSON with market tags |

### 4.6 Reliability & Availability

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-030 | 99.5% monthly API uptime; 48h maintenance notice | CloudWatch + SLA |
| NFR-031 | Daily backups; RPO 24h; RTO 4h | Encrypted cross-AZ; restore tested |
| NFR-032 | Offline queue + auto-sync without data loss | Airplane-mode QA |
| NFR-033 | Health checks + alerting within 5 min of P0 | CloudWatch Alarms (+ PagerDuty when on-call exists) |

### 4.7 Scalability

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-034 | Architecture supports growth to 50k users (v1) → 500k (v2) without redesign | Lambda + Aurora DSQL auto-scale |
| NFR-035 | HealthLens / calendar reads stay within DSQL free-tier–aware query budgets; add read caching (CloudFront/API) if needed | Query cost monitored |
| NFR-036 | *(Marketplace geospatial at 100k listings)* | Deferred |

### 4.8 Usability

| NFR-ID | Requirement | Acceptance |
| --- | --- | --- |
| NFR-037 | First period log within 3 minutes of onboarding | ≥80% success in usability tests |
| NFR-038 | Plain-language errors (≈ UK Year 8) | UX writer review |
| NFR-039 | Health copy max reading age 14; tooltips for technical terms | Flesch-Kincaid ≥60 |
| NFR-040 | Dismissible first-use tooltips per module | Stored locally; re-trigger in Help |

---

## 5. Technical Architecture Requirements

### 5.1 Confirmed Technology Stack (AWS-primary)

Aligned with existing WalkCroach-style split: **`infra-web`** (S3, CloudFront, DNS, ACM) and **`infra-backend`** (API, Lambda, data, auth, secrets).

| Layer | Technology | Rationale |
| --- | --- | --- |
| Client | **Responsive PWA** (Vite + React) on S3 + CloudFront | One codebase; installable; no App Store tax for v1; matches `infra-web` |
| Mobile UX | **Bottom tab bar** in standalone / narrow viewports; top nav on desktop — **no hamburger as primary mobile nav** | Add-to-Home-Screen feels app-like |
| Auth | Amazon Cognito User Pools (**no Amplify, no Hosted UI**) | Custom sign-in / sign-up / forgot-password / verification pages; `amazon-cognito-identity-js` (SRP) + Cognito JWT to API Gateway |
| API | Amazon API Gateway (REST) + AWS Lambda (Node.js / TypeScript) | Serverless; Cognito authorizer; response streaming for Alena |
| Primary DB | **Amazon Aurora DSQL** | SQL for cycles/HealthLens; **scale-to-zero**; permanent free tier; no VPC/NAT/RDS Proxy |
| Hot counters (optional) | DynamoDB on-demand | Alena daily quota only if cheaper than DSQL writes |
| File storage | S3 (SSE-KMS) + multipart | Wallet ciphertext; content assets |
| Secrets | **AWS Secrets Manager** — JSON blobs per env | Stripe/Paystack, SMS (DSQL uses IAM auth tokens — no static DB password if using IAM) |
| Config | **SSM Parameter Store** | Endpoints, feature flags, Nova model ID, VAPID public key |
| Encryption keys | AWS KMS CMKs | Envelope encryption; bucket keys |
| Push | Web Push (VAPID) + service worker | Generic notification bodies (FR-068) |
| Payments | Stripe (UK) + Paystack (NG/GH) | Local card + mobile money |
| AI | Amazon Nova 2 Lite (Bedrock) | Alena streaming; HealthLens narrative |
| Offline | IndexedDB (e.g. Dexie) + outbox sync | Offline health writes for flaky NG/GH networks |
| Analytics | Mixpanel or Amplitude (PII/health-field excluded) | Product analytics only |
| Monitoring | CloudWatch + Sentry | Logs + front-end errors |
| IaC / CI | Terraform + CodePipeline / CodeBuild | `infra-web` + `infra-backend` |
| Primary region | `eu-west-2` (London) | UK GDPR posture |

### 5.1.1 Database decision (low budget)

| Option | Idle cost | Fit for GirlCode360 | Verdict |
| --- | --- | --- | --- |
| **Aurora Serverless v2** | Min capacity / VPC + often **NAT Gateway (~$32+/mo)** + RDS Proxy | Full Postgres | **Rejected** — floor cost too high for early budget |
| **DynamoDB** | ~$0 idle (on-demand) | Excellent for key lookups; painful for cycle joins, HealthLens aggregations, GDPR export joins | **Secondary only** (quotas) — avoid as primary |
| **Aurora DSQL** | **$0 DPU when idle**; permanent free tier (~100k DPUs + 1 GB/mo) | PostgreSQL-compatible SQL + ACID; app-enforced FKs (no DB FKs/sequences — use UUIDs) | **Primary choice** |

DSQL caveats we accept: no foreign keys/triggers/extensions; enforce referential integrity in the API layer; use `gen_random_uuid()` for IDs.

### 5.2 Configuration & Secrets Convention

```text
# SSM Parameter Store (non-secret)
/girlcode360/{env}/web/...
/girlcode360/{env}/backend/api_base_url
/girlcode360/{env}/backend/cognito_user_pool_id
/girlcode360/{env}/backend/feature_flags
/girlcode360/cicd/codeconnections_arn

# Secrets Manager (JSON — one secret per concern per env)
girlcode360/{env}/app         → { stripe_secret, paystack_secret, vapid_private_key, ... }
girlcode360/{env}/sms         → { africastalking_api_key, twilio_auth_token, ... }
# DSQL: prefer IAM DB auth tokens from Lambda role — avoid long-lived DB password secrets when possible
```

- Lambdas load secrets **once outside the handler** (or via Lambda Powertools / Parameters utility) and cache for the warm container lifetime.
- Prefer **one JSON secret with multiple keys** over many single-value secrets to reduce Secrets Manager cost.
- Never put secrets in SSM `SecureString` when Secrets Manager is the chosen store for credentials (AWS guidance).

### 5.3 Repository Layout (target)

```text
girlcode360/
├── apps/
│   └── web/             # Consumer PWA (sprint)
│   └── admin/           # LATER — ops scaffold only
├── packages/
│   ├── api-types/       # Shared Zod schemas
│   └── domain/          # Cycle math, HealthLens rules (pure TS)
├── infra-web/           # Terraform: S3, CloudFront, ACM, Route53
├── infra-backend/       # Terraform + modules/lambda/codes (handlers)
├── ci-cd/               # Pipeline CloudFormation (web + backend)
└── docs/
```

### 5.4 PWA navigation rules

| Context | Primary navigation |
| --- | --- |
| Desktop / wide viewport | Top (or side) nav — links, not a hamburger drawer as the only path |
| Mobile browser / **Add to Home Screen** (`display: standalone`) | **Persistent bottom tab bar** (Home, Cycle, Health, Alena, Account) |
| Hamburger | Allowed only as overflow for secondary items — **never** as the sole mobile menu |
---

## 6. Acceptance Criteria & Definition of Done

### 6.1 Feature-level DoD

A FR is Done when **all** apply:

1. Implemented with automated tests (target ≥80% coverage on domain + API critical paths)
2. QA regression: zero open P0/P1
3. Health copy reviewed by UX writer + clinical advisor
4. Privacy/legal review for new processing
5. WCAG 2.1 AA for new UI
6. Strings externalised (no hardcoded user-facing text)
7. Documented in help / internal notes
8. New API endpoints meet ≤500ms P95 under test load

### 6.2 Launch-level DoD

1. All **Must** FRs for in-scope modules complete
2. Jurisdiction-specific privacy policy + ToS live and legally reviewed
3. DPIA documented for launch market(s)
4. Access / erasure / portability workflows tested
5. External pen test (OWASP Mobile Top 10); criticals remediated
6. Breach + downtime runbooks exist
7. Store listings compliant (privacy nutrition labels)
8. Clinical advisor sign-off on health + AI copy
9. Support path live (in-app help + email, 48h SLA)

### 6.3 Critical-path acceptance tests

| AT-ID | Test | Priority |
| --- | --- | --- |
| AT-001 | Register → log first period → see prediction in <5 minutes | Must |
| AT-002 | Upload wallet doc → view → share link → verify 24h expiry | Must |
| AT-003 | *(Marketplace search)* | Deferred |
| AT-004 | Data export JSON within 60s (12+ months synthetic data) | Must |
| AT-005 | Account deletion removes app + API + backup copies within retention window | Must |
| AT-006 | 2G throttle: period log syncs on reconnect | Must |
| AT-007 | Period reminder Web Push does NOT display health content | Must |
| AT-008 | Consent withdrawal stops analytics within 24h | Must |
| AT-009 | Alena Context Mode streams first token <2s; full response P95 <5s | Must |
| AT-010 | HealthLens activates only after 3 cycles or 90 days | Must |

---

## 6A. AI Feature Requirements (Addendum)

Full requirements **FR-079–FR-095** and **NFR-AI-01–NFR-AI-10** live in [girlcode-ai.md](./girlcode-ai.md). Summary:

| Feature | Role | v1.0 status |
| --- | --- | --- |
| **Alena** | Contextual health companion (Amazon Nova 2 Lite) | In scope |
| **HealthLens** | Longitudinal pattern analyser + Doctor Prep Card | In scope |
| **SheMatch** | Health → marketplace bridge | **Deferred** (marketplace dependency) |

---

## 7. Appendix

### 7.1 Key Regulatory References

- [UK GDPR / DPA 2018](https://www.legislation.gov.uk/ukpga/2018/12) · [ICO](https://ico.org.uk)
- [MHRA Software as a Medical Device](https://www.gov.uk/government/publications/software-as-a-medical-device)
- [MHRA Software and AI as a medical device](https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device/software-and-artificial-intelligence-ai-as-a-medical-device)
- [NHS DTAC](https://www.nhsx.nhs.uk/key-tools-and-info/digital-technology-assessment-criteria-dtac/)
- [Nigeria NDPA](https://ndpc.gov.ng) · GAID 2025
- [Ghana DPA Act 843](https://www.lawsghana.com) · [Ghana DPC](https://www.dataprotection.org.gh)

### 7.2 SaMD Positioning (non-negotiable)

Per MHRA guidance: general fitness / wellbeing monitoring is typically **not** a medical device when the product does not diagnose, treat, or claim to control conception. GirlCode360 must:

- Frame all outputs as **wellness insights / estimates**, never diagnoses
- Always offer a path to a human healthcare provider
- Avoid language that implies fertility control or clinical decision-making
- Run CI keyword scans for banned diagnostic phrasing
- Maintain clinical advisor sign-off on all health + AI templates

### 7.3 Out of Scope for v1.0

- Marketplace + SheMatch
- Telemedicine / video consultation
- Wearable ingestion (Fitbit, Apple Watch, Oura)
- AI symptom checker / diagnostic features
- In-app clinic booking systems
- Menopause module
- Social sharing of health data
- Languages beyond English (Pidgin / Twi → v1.1)
- White-label B2B

---

*GirlCode360 — Product Requirements Document v1.1 | Confidential | July 2026*
