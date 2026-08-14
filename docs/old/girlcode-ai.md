# GirlCode360 — AI Features Specification

**Addendum to PRD v1.1 · Roadmap & Implementation Integration**

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Status | Active — Implementation Ready |
| Markets | United Kingdom · Nigeria · Ghana |
| Last Updated | July 2026 |
| Related Docs | [PRD](./girlcode-prd.md) · [Roadmap](./girlcode-roadmap.md) · [Implementation Plan](./girlcode-implementation-plan.md) |
| Classification | Internal only — Confidential |

| Feature | Name | v1.0 status |
| --- | --- | --- |
| AI-1 | **Alena** — Contextual Health Companion | In scope |
| AI-2 | **HealthLens** — Symptom Pattern Analyser | In scope |
| AI-3 | **SheMatch** — Health-to-Marketplace Bridge | **Deferred** (marketplace out of scope) |

---

## 1. Research Basis & Design Rationale

These features were selected from clinical research, competitor analysis, and user behaviour across UK, Nigerian, and Ghanaian femtech markets. Each addresses a validated gap.

### 1.1 Critical user needs

1. **Stigma-free, always-on Q&A** grounded in *their* data — not generic advice (DCE study, 957 women, 2025).
2. **Structured evidence for dismissed patients** — especially PCOS / irregular cycles — so GP or clinic visits are data-backed (Flo PCOS Assistant: 250K engaged; 1,500+ diagnosed pathway).
3. **Health context → local services** — unique in market, but **blocked until marketplace ships** (SheMatch deferred).

### 1.2 Research confirmation

| Finding | Product implication |
| --- | --- |
| AI predictions trained on regular cycles show ~18% accuracy for PCOS / irregular cycles | HealthLens must be PCOS-aware; never assume 28-day cycles |
| Flo’s PCOS AI drove 9,000+ doctor visits from one feature | Doctor Appointment Prep Card is high-impact |
| 54% of women distrust health chatbots; privacy is #1 barrier | Separate AI consent; no PII to LLM; data minimisation |
| Context-aware chatbots beat generic LLM wrappers | Alena must read structured user health summaries |

### 1.3 Design principles (all AI)

- Never diagnose; always wellness framing + path to a human clinician
- Explicit, granular, withdrawable consent distinct from general app consent
- Minimum necessary context in every LLM payload
- Single LLM: Amazon Nova 2 Lite on Bedrock (IAM-authenticated; model ID via SSM)
- Clinical advisor owns rules thresholds and disclaimer language

---

## 2. AI Feature 1 — Alena (Contextual Health Companion)

### 2.1 What Alena does

Alena is GirlCode360’s conversational health companion. It reads the user’s logged data (cycle history, symptoms, PCOS diary, pregnancy, TTC) and answers with contextual, personalised guidance — available 24/7 without an appointment.

**Illustrated journey (Chiamaka, Lagos):** late cycle at Day 47 after 9 months TTC → Alena summarises her 8-cycle average (38 days, range 34–42), notes Day 47 is outside range, avoids diagnosing pregnancy, offers appointment brief + educational follow-up.

### 2.2 Differentiation vs Flo “Ask Flo”

| Flo Ask Flo | GirlCode360 Alena |
| --- | --- |
| General women’s health Q&A | Multi-module personal context every turn |
| Limited use of user’s own data | Cycle + PCOS + pregnancy + TTC (+ wallet metadata, not docs) |
| UK/US-centric | NHS / FMOH / GHS localisation |
| Premium-only | Free: 3 conversations/day; Premium: unlimited |
| No appointment prep handoff | Can hand off to HealthLens Prep Card |

### 2.3 Technical architecture (AWS)

```text
PWA (Vite + React)
  → API Gateway REST (Cognito JWT)  [STREAM mode for /alena/chat]
    → Lambda (Node.js, streamifyResponse)
      → Context assembler (Aurora DSQL)  // pseudonymised summary only
      → Bedrock Runtime `ConverseStream` → Amazon Nova 2 Lite
      → Crisis detector (rules + keyword list from clinical advisor)
      → SSE chunks back to client
```

**LLM:** Amazon Nova 2 Lite on Amazon Bedrock only. Model IDs (SSM-configurable):

| Access pattern | Model ID |
| --- | --- |
| Global CRIS (preferred) | `global.amazon.nova-2-lite-v1:0` |
| EU geo inference | `eu.amazon.nova-2-lite-v1:0` |
| In-region (where available) | `amazon.nova-2-lite-v1:0` |

Auth is **IAM on the Lambda execution role** (`bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`) — no third-party LLM API key in Secrets Manager.

**Privacy architecture**

- System prompt: compassionate companion; never diagnose; always recommend professional care when concerning; market-aware (UK/NG/GH).
- User health context JSON: **no name, email, phone, DOB, or device IDs** — only aggregates and recent structured events.
- Conversation history: encrypted at rest; deletable from Privacy Centre; excluded from analytics and model training datasets.
- Separate consent for health-data → Alena linking.

**Example pseudonymised context**

```json
{
  "market": "Nigeria",
  "modules_active": ["period_tracker", "pcos_manager", "ttc"],
  "cycle_summary": {
    "avg_length": 38,
    "last_6_cycles": [36, 40, 34, 42, 39, 47],
    "avg_period": 5
  },
  "recent_symptoms": ["fatigue (14 days)", "acne (10 days)", "bloating (7 days)"],
  "ttc_months": 9,
  "last_logged": "2026-06-28"
}
```

**Streaming:** Lambda calls Bedrock `ConverseStream`; API Gateway uses **response streaming** (`ResponseTransferMode: STREAM`) + Lambda `streamifyResponse` so first tokens arrive within the FR-080 budget on REST.

### 2.4 Functional requirements

| FR-ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-079 | Persistent chat entry on all health module screens; opening mid-module pre-fills that module’s context | Must | — |
| FR-080 | Response P95 ≤5s; streaming first token ≤2s | Must | SSE; degrade gracefully on 2G/3G |
| FR-081 | Context Mode vs Anonymous Mode (no personal data) | Must | Freely withdrawable consent |
| FR-082 | Free: 3 conversations/day; Premium: unlimited; counter visible | Must | Enforce server-side rate limit |
| FR-083 | Symptom responses end with wellness disclaimer + action (e.g. Generate appointment brief) | Must | SaMD safety |
| FR-084 | Crisis language → emergency numbers + seek immediate care messaging | Must | UK 999/111; NG 112; GH 999/193. Clinical phrase list. Marketplace hospital lookup deferred. |
| FR-085 | In-session conversation continuity | Should | Cross-session memory = separate opt-in |
| FR-086 | Localised guidance (NHS / FMOH / GHS) | Must | Content library + prompt market flag |
| FR-087 | Suggest marketplace results in-chat | Deferred | Requires SheMatch + marketplace |

---

## 3. AI Feature 2 — HealthLens (Symptom Pattern Analyser)

### 3.1 What HealthLens does

Background longitudinal analyser over the user’s health logs. Once activated, it produces:

1. **Monthly Health Intelligence Report** — plain-language patterns over 30–90 days (trends, symptom clustering, irregularity flags).
2. **Doctor Appointment Prep Card** — 1-page PDF: cycle summary, symptom frequencies, medication adherence, optional wallet doc list, editable “Questions for my doctor”.

**Why it matters:** Flo stopped at flagging; HealthLens prepares the clinical conversation. Especially valuable for Black women facing dismissal in NHS pathways (NHS Race & Health Observatory findings).

### 3.2 Technical architecture (v1.0 hybrid)

| Layer | Approach |
| --- | --- |
| Rules engine | Clinical-advisor-authored thresholds (pure TypeScript in `packages/domain`) — e.g. cycle length variance >10 days across 3+ cycles |
| Narrative | Nova 2 Lite generates plain-language report from **rules engine output only** — not raw row dumps |
| Trigger | EventBridge schedule (1st of month) + on-demand API |
| PDF | Lambda → HTML/PDF (e.g. Puppeteer layer or server-side PDF kit) → S3; signed URL to client |
| Activation | ≥3 complete cycles **or** ≥90 days of logging |

**Minimum data gate:** Before activation, UI shows progress: “Keep logging — HealthLens activates after 3 cycles”.

### 3.3 Functional requirements

| FR-ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-088 | Auto-activate after 3 cycles OR 90 days; progress UI before | Must | Quality gate |
| FR-089 | Monthly report on 1st; on-demand (free: max 1 / 14 days; Premium: unlimited) | Must | — |
| FR-090 | Patterns + confidence Low/Medium/High + “not a medical assessment” caveat | Must | Advisor owns confidence mapping |
| FR-091 | Doctor Prep Card anytime; PDF share via native share sheet | Must | A4 + US Letter |
| FR-092 | PCOS-aware irregular cycle handling; symptom co-occurrence weighted | Must | No 28-day assumption |
| FR-093 | Flag “worth discussing with a provider” patterns (variance, worsening severity, PCOS cluster, reduced foetal movement) | Must | Advisory, never alarming |
| FR-094 | “Ask Alena about this report” handoff | Should | — |
| FR-095 | Separate opt-in for anonymised population learning; opt-out does not block personal reports | Must | Art.9 research consent |

---

## 4. AI Feature 3 — SheMatch (Deferred)

> **Deferred with marketplace.** Spec retained so v1.1 can implement without re-research.

### 4.1 Intent

Rules-based recommendation engine connecting ephemeral health context signals to nearby marketplace listings (pharmacies, clinics, beauty). Not LLM-driven — faster, cheaper, auditable.

### 4.2 Requirements (future)

FR-096–FR-103 remain as specified in PRD history: dedicated consent, non-intrusive banners, trigger config table, “Why am I seeing this?”, dismissal suppression, business tagging. **Do not implement until marketplace listings exist.**

---

## 5. AI Non-Functional Requirements

| NFR-ID | Category | Requirement | Acceptance |
| --- | --- | --- | --- |
| NFR-AI-01 | Accuracy | Quarterly clinical review of Alena/HealthLens outputs | Sign-off log + last-review stamps |
| NFR-AI-02 | Hallucination | Prompt constraints; speculative content flagged as general | Bi-weekly red-team; injection tests |
| NFR-AI-03 | Transparency | Visible “AI-generated” label + how-it-works link | Art.22 / ICO ADM guidance |
| NFR-AI-04 | Bias & equity | Validate irregular-cycle + multi-market behaviour | Bias audit before major release |
| NFR-AI-05 | Data minimisation | Send summaries only; monitor payload size for context creep | Privacy counsel architecture review |
| NFR-AI-06 | Rate & cost | Per-user + global circuit breaker (e.g. 10k req/min) | Daily Bedrock / Nova spend via CloudWatch + Cost Explorer; alert at 80% budget |
| NFR-AI-07 | Consent persistence | Server-side consent version + timestamp; re-consent if Bedrock/Nova data-use terms change materially | Consent version control |
| NFR-AI-08 | SaMD safety | No diagnosis language; CI keyword reject | Advisor templates + pipeline scan |
| NFR-AI-09 | Offline | Graceful unavailable message; no truncated health advice | Offline QA |
| NFR-AI-10 | Model resilience | Prompt pack + SSM model ID; stay on Nova 2 Lite (no multi-vendor LLM) | Documented Converse interface; model ID swappable via SSM only within Nova family if needed |

---

## 6. Delivery Integration

### 6.1 Two-week build mapping

| Day window | Alena | HealthLens | SheMatch |
| --- | --- | --- | --- |
| Days 1–3 | Consent UX, system prompt, Bedrock ConverseStream stub | Rules library authoring (clinical) | — |
| Days 4–7 | Streaming chat Lambda + UI + rate limits | Rules engine + activation gate | — |
| Days 8–11 | Crisis detection, localisation, Premium gate | Monthly job + on-demand + PDF Prep Card | — |
| Days 12–14 | Hardening, red-team, cost alarms | Narrative polish + Alena handoff | Remains deferred |

Full day-by-day detail: [girlcode-implementation-plan.md](./girlcode-implementation-plan.md).

### 6.2 Premium monetisation

| Feature | Free | Premium |
| --- | --- | --- |
| Alena | 3 conversations / day | Unlimited |
| HealthLens report | Monthly only | On-demand |
| HealthLens Prep Card | 1 / month | Unlimited + branded PDF |
| SheMatch | Deferred | Deferred |

---

## 7. Implementation checklist (engineering)

- [ ] `packages/ai-provider` Bedrock Converse/ConverseStream client for Nova 2 Lite
- [ ] IAM: Lambda role `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` on Nova 2 Lite model ARNs
- [ ] Lambda env `ALENA_MODEL_ID` from TF var (default `global.amazon.nova-2-lite-v1:0`); SSM `alena_daily_free_limit` when added
- [ ] API routes: `POST /v1/alena/chat` (stream), `GET /v1/healthlens/status`, `POST /v1/healthlens/report`, `POST /v1/healthlens/prep-card`
- [ ] DynamoDB **or** DSQL counters for daily Alena quota (idempotent per user/day)
- [ ] EventBridge cron: `healthlens-monthly`
- [ ] CI: diagnosis-language denylist on prompts + static copy
- [ ] CloudWatch alarms: Bedrock error rate, P95 TTFB, estimated token/cost metrics

---

*GirlCode360 — AI Features Specification v1.1 | Confidential | July 2026*
