# GirlCode360 — Product Roadmap

**UK · Nigeria · Ghana | Strategic roadmap + 2-week execution overlay**

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Status | Active |
| Last Updated | July 2026 |
| Related Docs | [PRD](./girlcode-prd.md) · [AI Spec](./girlcode-ai.md) · [Implementation Plan](./girlcode-implementation-plan.md) |
| Classification | Internal only — Confidential |

---

## Executive summary

| Item | Decision |
| --- | --- |
| **Immediate execution** | Compress all **in-scope** v1.0 features into a **14-day implementation sprint** (see Implementation Plan) |
| **Explicitly excluded now** | Marketplace (FR-054–064) and SheMatch (FR-096–103) |
| **Primary infra** | AWS — `infra-web` + `infra-backend`, Cognito, API Gateway, Lambda, **Aurora DSQL**, S3/CloudFront PWA |
| **Client** | Responsive **PWA** (bottom tab bar on mobile/standalone — not hamburger-primary) |
| **Config** | SSM Parameter Store (non-secrets) · Secrets Manager JSON blobs (secrets) |
| **Strategic 6-month arc** | Retained below for GTM, compliance registrations, and post-MVP growth — **not** a constraint on the 14-day build |

**North star (strategic, Month 6):** 50,000 registered users across UK, Nigeria, Ghana.  
**North star (sprint):** Ship installable PWA on `test` with Must-priority health modules + Alena + HealthLens + privacy rights flows.

---

## 1. Market context

| Market | Opportunity | Regulatory frame |
| --- | --- | --- |
| **United Kingdom** | Femtech ~£1.1B (2023), 16.7% CAGR; 4.9M Black African & Caribbean residents; NHS digital-first + Race & Health Observatory gaps | UK GDPR, MHRA wellness positioning (avoid SaMD), ICO, future DTAC |
| **Nigeria** | Digital health $571M → $861M by 2029; 110M+ women; beauty $3B+; WhatsApp-native behaviour | NDPA 2023 + GAID 2025; NDPC DCPMI registration |
| **Ghana** | ~17M women; 60%+ smartphone; Accra/Kumasi tech literacy; AfCFTA gateway | DPA Act 843; Ghana DPC registration |

---

## 2. Scope decisions for the 14-day sprint

### 2.1 In scope

- Mobile-responsive PWA (Add to Home Screen; bottom tab nav)
- Onboarding, auth, consent CMP
- Period Tracker, PCOS Manager, Pregnancy, TTC
- Health Wallet (client-side encryption)
- Notifications (Web Push; privacy-safe bodies)
- Educational content library (market-tagged)
- Account privacy: My Data, export, delete
- Alena + HealthLens
- Premium entitlement plumbing (Stripe UK + Paystack NG/GH — can soft-launch)
- AWS foundation: web + backend infra, CI/CD (DSQL, no NAT)

### 2.2 Out of scope (hard)

- Marketplace listings, search, business portal, reviews, sponsored ads
- SheMatch
- Native Expo / App Store / Play Store builds (PWA first)
- Peer community groups (Could — defer unless spare capacity Day 13–14)
- Postpartum module, menopause, wearables, telemedicine
- Pidgin / Twi localisation (i18n scaffolding only)

### 2.3 MVP simplifications (quality preserved, surface area cut)

| Area | Full PRD | Sprint MVP |
| --- | --- | --- |
| Symptom libraries | 30 / 50 full curated sets | Ship clinically approved MVP sets (≥20 period, ≥30 PCOS); expand content continuously |
| Pregnancy content | Weeks 4–42 full | Ship skeleton + priority weeks; CMS/JSON backfill |
| Community | Groups + posts | Articles only |
| Pen test | External web review | Internal checklist + scheduled external within 30 days of beta |
| Multi-region DB | Africa region | `eu-west-2` primary + documented transfer basis |
| Native apps | Expo / store builds | PWA only for v1 |

---

## 3. Two-week execution overlay

> Detail lives in [girlcode-implementation-plan.md](./girlcode-implementation-plan.md). This section is the roadmap-level view.

| Phase | Days | Theme | Exit criteria |
| --- | --- | --- | --- |
| **P0** | 0–1 | Bootstrap repos, AWS accounts, Terraform skeleton, design tokens | Pipelines green; Cognito pool exists in `dev` |
| **P1** | 2–4 | Auth, onboarding, consent, profile, i18n shell | User can register/login; consent version stored |
| **P2** | 5–8 | Period + PCOS + offline engine + offline calendar | AT-001 pass on staging |
| **P3** | 7–10 | Pregnancy + TTC + notifications | Modules selectable; reminders fire without PHI on lock screen |
| **P4** | 8–11 | Health Wallet encryption + share links | AT-002 pass |
| **P5** | 6–12 | Alena streaming + HealthLens rules/PDF | AT-009, AT-010 pass |
| **P6** | 11–13 | Privacy centre, export/delete, Premium gates | AT-004, AT-005, AT-008 pass |
| **P7** | 13–14 | Hardening, offline sync, store builds, clinical copy pass | Internal beta build distributed |

Parallel tracks: **PWA frontend**, **backend**, **infra**, **clinical content**, **legal templates**.

---

## 4. Strategic 6-month arc (post-sprint)

The original July–December 2026 plan remains useful for GTM after the product exists.

### Phase A — Foundation product (Weeks 1–2) ← *current*

Ship v1.0 health platform (this sprint).

### Phase B — Closed validation (Months 1–2 post-sprint)

- UK closed beta (~500 curated users)
- Clinical content completion to full week coverage
- External pen test + DPIA finalisation
- NDPC / Ghana DPC registration progress

### Phase C — Public launch (Months 3–4)

- Nigeria soft/public launch
- UK + Ghana public
- Premium conversion optimisation (Alena / HealthLens as hooks)

### Phase D — Marketplace + SheMatch (Months 4–6)

- Seed listings Lagos / Accra / London
- Business portal
- SheMatch trigger engine
- Sponsored / health-tagged listings

### Milestone swimlane (strategic)

| Milestone | Sprint | +1–2 mo | +3–4 mo | +5–6 mo |
| --- | --- | --- | --- | --- |
| Core health modules | ✓ | Iterate | Live | Live |
| Alena / HealthLens | ✓ | Beta | Live | Live |
| Compliance registrations | Start | Complete | Maintain | Maintain |
| UK closed beta | — | ✓ | Expand | — |
| Public NG / UK / GH | — | — | ✓ | Scale |
| Marketplace + SheMatch | — | — | Build | ✓ |

---

## 5. Team & budget (indicative)

### 5.1 Minimum team for 14-day sprint

| Role | Allocation | Focus |
| --- | --- | --- |
| Founder / PM | Full-time | Scope lock, clinical/legal chase, copy |
| Frontend engineer | Full-time | PWA (Vite/React), bottom tabs, offline |
| Backend engineer | Full-time | Lambda / DSQL / AI |
| Infra / DevOps | 50–100% | Terraform + pipelines |
| UX/UI | Full-time Days 0–7, then as needed | Flows + design system |
| Clinical advisor | Part-time | Rules, disclaimers, content |
| Legal / privacy | Retained | Policies, consent, DPIA draft |

### 5.2 Strategic 6-month budget (unchanged order of magnitude)

| Line | ~% of £600k pre-seed |
| --- | --- |
| Engineering & product | 60% |
| Marketing & launch | 15% |
| Legal, compliance, clinical | 8% |
| Infrastructure & tools | 5% |
| Business development (marketplace later) | 5% |
| Contingency | 7% |

Sprint infra should stay lean: **Aurora DSQL** (scale-to-zero + free tier), **no VPC/NAT**, single region, Secrets Manager JSON packing, PWA-only client.

---

## 6. Risks & contingencies

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 14-day scope overflow | Miss Must features | Daily cut list; Prefer cutting Could/Should before Must; freeze marketplace forever for this sprint |
| MHRA SaMD perception | Regulatory delay | Wellness copy only; CI keyword bans; advisor sign-off; disclaimers on every predictive/AI surface |
| Zero-knowledge wallet complexity | Slip Days 8–11 | Ship envelope encryption with vault passphrase + Secure Store; defer recovery mnemonic polish if needed |
| Bedrock / Nova cost overrun | Budget burn | Hard free-tier limits; global circuit breaker; CloudWatch + Cost Explorer alarms |
| NDPC / DPC registration lag | Compliance exposure | Start paperwork Day 0; ship with DPIA draft + lawful basis documented |
| Offline sync bugs | Data loss on 2G | Outbox + idempotency keys from Day 5; airplane-mode AT-006 mandatory |

---

## 7. Success metrics

### Sprint (Day 14)

| KPI | Target |
| --- | --- |
| Must FR completion (in-scope) | 100% |
| Critical AT suite | All Must ATs green on `test` |
| Internal testers on PWA (Add to Home Screen) | ≥10 |
| Open P0 bugs | 0 |
| Clinical sign-off on shipped copy | Complete for Period, PCOS, Alena, HealthLens |

### Strategic (Month 6)

| KPI | Target |
| --- | --- |
| Registered users | 50,000 |
| Day-30 retention | ≥30% |
| Premium subscribers | ≥1,500 |
| Marketplace listings (when live) | ≥400 |

---

*GirlCode360 — Product Roadmap v1.1 | Confidential | July 2026*
