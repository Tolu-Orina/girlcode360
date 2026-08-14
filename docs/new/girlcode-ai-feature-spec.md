
GirlCode360
AI Features Specification
Addendum to PRD v1.0 • Roadmap Integration
Version 1.0  •  UK • Nigeria • Ghana  •  June 2026
AI Feature 1
✨ Alena
Contextual Health Companion
AI Feature 2
🔍 HealthLens
Symptom Pattern Analyser
AI Feature 3
📈 SheMatch
Health-to-Marketplace AI



1. Research Basis & Design Rationale
These three AI features were selected from a comprehensive analysis of clinical research, competitor products, and user behaviour data across the UK, Nigerian, and Ghanaian femtech markets. Each feature addresses a specific, validated gap that existing products fail to fill.

The 3 Critical User Needs These Features Address
1. Women need a stigma-free, always-on space to ask sensitive health questions — but only if answers
   are grounded in THEIR data, not generic advice. (Research: DCE study, 957 women, 2025)


2. Women with PCOS, irregular cycles, or suspected reproductive conditions are regularly dismissed by
   doctors without evidence. AI that generates structured health reports from logged data changes
   this. (Research: Flo PCOS Health Assistant: 250K women engaged, 1,500+ diagnosed)


3. No app currently connects a woman’s health context to local services. A user who gets a
   medication reminder should see nearby pharmacies. A user entering her fertile window should
   see local ovulation test kit availability. This bridge does not exist anywhere in the market.


What the research confirmed
AI predictions trained on regular cycles show only 18% accuracy for PCOS users (irregular cycles)
Flo’s PCOS AI assistant drove 9,000+ doctor visits and 1,500+ diagnoses from a single feature
54% of women have concerns about AI chatbots for health — privacy is the #1 barrier to adoption
Women prioritise accuracy, clarity, privacy protection, and disease knowledge in AI health tools
Context-aware chatbots (reading user’s own data) dramatically outperform generic LLM wrappers
What this means for GirlCode360
Alena must read from the user’s actual logged data, not just general health knowledge
HealthLens must specifically handle irregular cycles and multi-symptom PCOS patterns
All AI features must carry explicit, granular privacy consent distinct from general app consent
SheMatch is genuinely novel — no competitor has AI-driven health-to-marketplace bridging
All AI outputs must include a clear disclaimer and a path to a human healthcare provider



AI FEATURE 1  •  CHATBOT
Alena
Your always-on, privacy-first women’s health companion


2.1  What Alena Does
Alena is GirlCode360’s AI-powered conversational health companion. Unlike generic health chatbots, Alena reads from the user’s own logged data — cycle history, symptom logs, PCOS diary, pregnancy records, TTC tracking — and provides answers that are contextual, personal, and specific to their health journey.
Alena is available 24/7, requires no appointment, and is explicitly designed to be the space a woman goes to when she’s too embarrassed to ask a question out loud, when she’s up at 2am worried about a symptom, or when she simply can’t afford or access a GP.

The Alena Experience — Illustrated User Journey
Chiamaka (Lagos, 31) has been trying to conceive for 9 months. She opens GirlCode360 at 11pm,
worried because her cycle this month was 47 days — much longer than usual.


She taps Alena and types: “My period is very late this month, could I be pregnant or is something wrong?”


Alena reads her 8 months of logged data and responds:
“Based on your last 8 cycles, your average cycle length has been 38 days, with a range of 34–42 days.
This cycle is currently at Day 47, which is longer than your longest recorded cycle. You haven’t logged
a positive pregnancy test in the app. This could mean a delayed ovulation — which is common during
months of higher stress — or it might be worth discussing with a healthcare provider.
Would you like me to help you prepare an appointment summary to take to your doctor?”


Alena then offers: Book a nearby clinic | Generate appointment brief | Learn more about late cycles


2.2  What Makes Alena Different from Flo’s ‘Ask Flo’
Flo Ask Flo
Answers general women’s health questions
Limited access to user’s own health data
UK/US-centric health information
Premium-only feature ($39.99/year)
No marketplace integration
No doctor appointment prep output
GirlCode360 Alena
Reads 8 modules of the user’s own data for every response
Full multi-module context: cycle + PCOS + pregnancy + TTC + wallet
Localised: UK NHS context, Nigerian FMOH context, Ghanaian GHS context
Available on free tier (3 questions/day); unlimited on Premium
Can surface relevant marketplace results (pharmacies, clinics) in-chat
Can generate and send directly to HealthLens appointment prep


2.3  Alena Technical Architecture
Alena is powered by the Claude Sonnet 4.6 API (Anthropic). The architecture is designed for privacy-by-default: no personally identifiable information (PII) is ever sent to the API. Only pseudonymised, structured health context is included.

Alena API Call Structure — Privacy Architecture
SYSTEM PROMPT: You are Alena, a compassionate women’s health companion integrated into GirlCode360.
You have access to the user’s health summary below. You must never diagnose, and must always
recommend professional care for any concerning symptoms. Your tone is warm, clear, and non-alarming.
You are culturally aware: recognise UK NHS, Nigerian, and Ghanaian healthcare contexts.


USER HEALTH CONTEXT (pseudonymised — no name, no DOB, no identifiers):
{
  market: 'Nigeria',
  modules_active: ['period_tracker', 'pcos_manager', 'ttc'],
  cycle_summary: { avg_length: 38, last_6_cycles: [36,40,34,42,39,47], avg_period: 5 },
  recent_symptoms: ['fatigue (14 days)', 'acne (10 days)', 'bloating (7 days)'],
  ttc_months: 9,
  last_logged: '2026-06-28'
}


USER MESSAGE: 'My period is very late this month, could I be pregnant or is something wrong?'


Key privacy guarantees in this architecture:
No user name, email, phone, date of birth, or device identifier is ever sent to the Anthropic API
Health context is pseudonymised: only aggregate patterns and recent data, not raw records
Conversation history is stored locally (on-device, encrypted) for session continuity
User can delete all Alena conversation history at any time from the Privacy Centre
Alena conversations are explicitly excluded from any analytics or training datasets
User must grant explicit separate consent for health-data-to-Alena context linking

2.4  Alena Functional Requirements
FR-ID
Requirement
Priority
AI-Specific Notes
FR-079
Alena must be accessible from a persistent chat icon across all health module screens. Opening Alena mid-module pre-fills the health context from that module.
Must
UK/NG/GH: Context pre-fill reduces cognitive load. E.g. opening Alena from PCOS diary pre-loads PCOS context.
FR-080
Alena must respond in 5 seconds or less at P95. Streaming responses must begin within 2 seconds (display tokens as they generate).
Must
2G/3G resilience: use SSE (Server-Sent Events) for streaming. Partial responses displayed progressively.
FR-081
Alena must operate in two modes: Context Mode (reads user health data) and Anonymous Mode (no data access, general health questions only). User selects on first use.
Must
Anonymous Mode essential for users who want privacy even within the app. UK GDPR: consent must be freely withdrawable.
FR-082
Free tier: 3 Alena conversations per day (a conversation = one question + response thread). Premium: unlimited. Conversation counter visible in UI.
Must
Freemium gate on AI drives Premium conversion. Research: AI assistant is the top-cited reason for Flo Premium upgrades.
FR-083
Alena must end every response to a symptom-related question with: a wellness disclaimer (‘This is not a medical diagnosis’) and a contextual action button (e.g. ‘Find a clinic nearby’ or ‘Generate appointment brief’).
Must
Non-negotiable to avoid SaMD classification. Clinical advisor must review disclaimer language.
FR-084
Alena must detect crisis language (e.g. mentions of self-harm, suicidal ideation, severe pregnancy complications, heavy bleeding with dizziness) and immediately switch to an emergency response: surface emergency contact number + nearest hospital from marketplace.
Must
UK: 999/NHS 111. NG: 112 / user’s logged hospital. GH: 999/193. Clinical advisor defines trigger phrases.
FR-085
Alena must support conversation continuity: a user can refer back to a previous question within the same session (‘what did you say about my cycle last time?’) with session history.
Should
In-session history only. Cross-session memory requires explicit opt-in (separate consent).
FR-086
Alena must support localised health guidance: UK responses reference NHS services and NICE guidelines; Nigeria responses reference FMOH and private clinic norms; Ghana responses reference GHS and typical Ghanaian clinical pathways.
Must
Localisation content library reviewed by clinical advisor and native experts in each market.
FR-087
Alena must offer to surface nearby marketplace results within chat when the conversation warrants it (e.g. ‘I can show you pharmacies near you that stock progesterone supplements’) only if user has SheMatch consent active.
Should
Requires SheMatch (Feature 3) consent to be active. Shown as a gentle suggestion, not an interrupt.



AI FEATURE 2  •  PATTERN ANALYSER
HealthLens
6 months of logged data. One appointment-ready report.


3.1  What HealthLens Does
HealthLens is GirlCode360’s longitudinal AI pattern analyser. It runs silently in the background, analysing the user’s accumulating health log data across all active modules. Once per month (and on demand), it generates two outputs:

Monthly Health Intelligence Report
A plain-language summary of patterns detected in the user’s health data over the past 30–90 days. Surfaces trends the user may not have noticed themselves. Examples:
Cycle length shortening over 4 months (possible stress or hormonal shift)
Acne and fatigue consistently highest in the 5 days before period (probable PMS pattern)
PCOS symptom cluster elevated: acne + irregular cycles + fatigue correlating
TTC: ovulation window appears to be occurring 3–4 days later than average for this user
Pregnancy: kick count frequency dropped below your usual average this week
Doctor Appointment Prep Card
A structured 1-page document, formatted for sharing with a healthcare provider, summarising the user’s health data in clinical-adjacent language. Sections include:
Cycle summary: length range, average, trend direction
Key symptom frequencies and severity scores (last 90 days)
Medication adherence log (from medication reminders)
Health wallet documents flagged as relevant to share
User’s own note: ‘What I want to ask my doctor today’ (user-editable)
Export as PDF — shareable via messaging app or printing


Why This Is the Most Clinically Impactful Feature
Research finding: Flo’s PCOS Health Assistant, which simply flagged PCOS-related symptoms, drove
9,000+ doctor visits and led to 1,500+ PCOS diagnoses. But Flo stopped there — it didn’t help users
PREPARE for or STRUCTURE that doctor visit.


The specific pain of Black women in the UK (NHS Race & Health Observatory, 2025):
‘Women — particularly Black women — are often ignored and dismissed. The importance of doctors
“genuinely listening” and believing them was emphasised repeatedly.’


A structured, data-backed Doctor Appointment Prep Card gives a woman undeniable evidence.
She walks into an NHS GP or a Lagos clinic with 3 months of quantified symptom data.
That changes the clinical conversation. That is GirlCode360’s most meaningful contribution.


3.2  HealthLens Technical Architecture
HealthLens runs as a background job on the server (not client-side) triggered monthly per user or on-demand. It uses a lightweight ML model trained on anonymised, aggregated population data from GirlCode360 users (opt-in consent required) to surface pattern significance, combined with a rules-based clinical flagging layer reviewed and maintained by the clinical advisor.

For v1.0, HealthLens uses a hybrid approach:
Rules-based engine: clinical flagging logic authored by the OB/GYN clinical advisor (e.g. ‘if cycle length variance > 10 days across 3+ cycles, flag as irregular; if acne + fatigue co-occur in luteal phase > 70% of cycles, flag as probable PMS pattern’)
LLM-based narrative generation: Claude Sonnet 4.6 API generates the plain-language narrative for the Monthly Health Intelligence Report, using the output of the rules engine as structured input — NOT raw health data
Pattern significance thresholds: all thresholds are authored and approved by the clinical advisor before any pattern is surfaced to a user
Minimum data requirement: HealthLens activates only after 3 logged cycles or 90 days of data. Users are shown progress toward activation.

3.3  HealthLens Functional Requirements
FR-ID
Requirement
Priority
AI-Specific Notes
FR-088
HealthLens must activate automatically after 3 complete logged cycles OR 90 days of any health module logging. Before activation, the UI shows: ‘Keep logging — HealthLens activates after 3 cycles’.
Must
This prevents shallow, meaningless reports. Minimum data threshold is a quality gate.
FR-089
System must generate a Monthly Health Intelligence Report on the 1st of each month for users with sufficient data. User can also trigger a report on-demand (maximum once per 14 days on free tier; unlimited on Premium).
Must
Monthly cadence creates a health ritual. On-demand is a Premium conversion driver.
FR-090
The Monthly Health Intelligence Report must display: detected patterns (plain language), confidence level (Low/Medium/High), and a clear caveat: ‘These are patterns in your logged data, not a medical assessment.’
Must
Confidence levels authored by clinical advisor. ‘Low’ patterns: informational only. ‘High’ patterns: include ‘consider discussing with a doctor’ prompt.
FR-091
User must be able to generate a Doctor Appointment Prep Card at any time from within HealthLens. The card must include: cycle summary, symptom log summary, medication adherence (if logged), relevant health wallet documents (user selects), and an editable ‘Questions for my doctor’ field.
Must
Card exported as PDF. Shareable via native share sheet (WhatsApp, email, print). A4 and US Letter formats.
FR-092
HealthLens must specifically handle irregular cycle detection for PCOS users. Standard calendar AI (Flo, Clue) shows 18% accuracy for irregular cycles. HealthLens uses a PCOS-aware algorithm that does NOT assume a 28-day cycle and weights symptom co-occurrence as a primary signal.
Must
Clinical advisor specifies the PCOS pattern detection rules. Algorithm validated against published Rotterdam criteria indicators.
FR-093
HealthLens must flag the following patterns as ‘worth discussing with a healthcare provider’ (not diagnose): cycle length variance >10 days across 3+ cycles; symptom severity increasing consistently month-on-month; 3+ PCOS symptom cluster elevation; reduced foetal movement (pregnancy users).
Must
Flagging logic reviewed and signed off by clinical advisor every 6 months. Flags are advisory, never alarming.
FR-094
System must allow user to share their Health Intelligence Report with Alena for conversational follow-up (‘Ask Alena about this report’ button).
Should
Creates seamless flow between passive insight (HealthLens) and active Q&A (Alena).
FR-095
HealthLens must require explicit, separate opt-in consent for population-level learning: ‘Allow GirlCode360 to use your anonymised, aggregated data to improve pattern detection for all users’. Opt-out does not affect individual HealthLens reports.
Must
UK GDPR Art.9: processing special category data for research requires specific consent. Users can withdraw at any time.



AI FEATURE 3  •  MARKETPLACE AI
SheMatch
The right service, at the right place, at the right moment in your health journey.


4.1  What SheMatch Does
SheMatch is GirlCode360’s most original AI feature — the engine that connects a woman’s active health context to the marketplace listings nearest to her. No competitor has built this bridge. Every other femtech app and every other local marketplace exist in separate silos. SheMatch collapses that distance.

The principle is simple: if your health data tells us what you might need, and our marketplace knows what’s available near you, we should connect those two things automatically — with your consent.

SheMatch in Action — 6 Real Scenarios
PERIOD TRACKER: GirlCode360 detects period start → SheMatch surfaces: ‘Nearest pharmacy (0.4km)
with pain relief in stock’ + ‘Beauty stores with heating pad options’


TTC MODULE: Fertile window begins → SheMatch surfaces: ‘Pharmacies near you stocking ovulation
test kits’ + ‘Supplement stores with folic acid’


PREGNANCY — WEEK 20: Anomaly scan window → SheMatch surfaces: ‘Obstetric scan centres near you
(rated 4.5+)’ + ‘Maternity clothing boutiques in your area’


PCOS MANAGER: Acne symptom spike logged → SheMatch surfaces: ‘Beauty stores near you with
salicylic acid-rated products’ + ‘Dermatology clinics accepting new patients’


MEDICATION REMINDER fires for Metformin: → SheMatch surfaces: ‘Pharmacies within 1km that
carry Metformin — tap to call ahead’ (Nigeria/Ghana: stock availability verified)


HEALTH WALLET: User uploads an abnormal thyroid test result → SheMatch surfaces: ‘Endocrinology
and women’s health specialists nearest to you’


4.2  SheMatch Technical Architecture
SheMatch is a context-matching engine that runs as a lightweight background service. It is NOT an AI in the traditional LLM sense — it is a rules-based recommendation engine with ML-assisted relevance ranking. This design choice was made deliberately:
Rules-based triggering: specific health events trigger specific marketplace category lookups (Medication Reminder fired → query Pharmacy category)
ML-assisted ranking: within a returned category, listings are ranked by: proximity, rating, relevance score (tags on the listing match current health context), and user preference history
No LLM needed: this approach is faster, cheaper, more predictable, and easier to audit for clinical appropriateness than using an LLM to decide which marketplace results to show
Privacy: SheMatch uses ephemeral health context signals (not stored health records) combined with GPS location (session-only). The health signal is never stored with the marketplace query log.

4.3  SheMatch Functional Requirements
FR-ID
Requirement
Priority
AI-Specific Notes
FR-096
SheMatch must require a dedicated, clearly explained opt-in consent screen separate from all other consents: ‘Allow GirlCode360 to use your health activity to suggest relevant local services’. Consent is granular: user can enable/disable per health module.
Must
This consent is over and above existing marketplace location consent. Per-module consent: user may want SheMatch for medication reminders but not for cycle-based suggestions.
FR-097
SheMatch suggestions must appear as a non-intrusive banner below a health action (not a pop-up interrupt). Banner shows: business name, distance, rating, relevant tag. Dismissible with one tap.
Must
Non-interrupt design is critical. A user logging a symptom should not feel advertised to. SheMatch is a service suggestion, not an ad.
FR-098
SheMatch must operate only when: (1) SheMatch consent is active, (2) user is on an active module screen, (3) a triggering health event has occurred (see trigger table), (4) at least one matching marketplace listing exists within 5km.
Must
If no listing within 5km exists, SheMatch is silent. Never shows an empty or irrelevant result.
FR-099
SheMatch trigger events must be defined by a rule table (authored by product + clinical advisor). Example triggers: Period Start → Pharmacies (pain relief), Fertile Window Start → Pharmacies (OPKs), Medication Reminder → Pharmacies, PCOS Acne Spike → Beauty Stores + Dermatology Clinics, Pregnancy Week 18-22 → Scan Centres.
Must
Trigger table is a configuration file (not hardcoded) so clinical advisor can update it without a code deploy.
FR-100
All SheMatch marketplace suggestions must be clearly labelled: ‘Suggested based on your health activity’. Sponsored listings within SheMatch results must be additionally labelled: ‘Sponsored’.
Must
UK ASA rules on AI-driven advertising disclosure. NG APCON advertising standards. Dual label required for sponsored results in SheMatch context.
FR-101
User must be able to view a ‘Why am I seeing this?’ explanation for any SheMatch result, showing which health event triggered it and what consent they’ve given.
Must
UK GDPR Art.22 AI transparency. User always has visibility into why they are being shown a recommendation.
FR-102
SheMatch must track result dismissal patterns: if a user consistently dismisses SheMatch for a specific trigger type, that trigger type is automatically suppressed after 3 dismissals. User can re-enable in settings.
Should
Respect user fatigue. Persistent unwanted suggestions destroy trust faster than any feature builds it.
FR-103
SheMatch must allow businesses to opt into ‘SheMatch tagging’ in the business portal: businesses self-declare which health contexts their products/services are relevant to (e.g. ‘PCOS-friendly products’, ‘Maternity scan services’, ‘Period care products’).
Should
Business tagging improves SheMatch precision and creates value for health-aware businesses. Premium listing tier benefit.



5. AI Non-Functional Requirements
These NFRs apply across all three AI features and supplement the existing NFR sections in PRD v1.0.

NFR-ID
Category
Requirement
Acceptance Criterion
NFR-AI-01
AI Accuracy
Alena and HealthLens outputs must be reviewed by the clinical advisor quarterly. Any health claim that cannot be supported by evidence-based guidelines must be removed from the prompt/rules library.
Clinical advisor sign-off log maintained. Reviewed content stamped with last-review date.
NFR-AI-02
Hallucination Prevention
Alena must be configured with explicit system prompt constraints: output only information grounded in the user’s logged data and clinically approved content. Any speculative statement must be flagged with ‘this is general information, not specific to you’.
Bi-weekly red-teaming exercises. Prompt injection tests. Output evaluated against clinical advisor checklist.
NFR-AI-03
AI Transparency
Every AI-generated output (Alena response, HealthLens report, SheMatch suggestion) must carry a visible label: ‘AI-generated’ and a link to an explanation of how the AI works.
UK GDPR Art.22 compliance. ICO guidance on automated decision-making transparency. Tested in user acceptance testing.
NFR-AI-04
Bias & Equity
All AI features must be tested for demographic bias before launch. HealthLens must be validated on datasets inclusive of irregular cycles (PCOS) and diverse ethnicity health patterns. Alena responses must not differ by detected market (UK/NG/GH) in ways that disadvantage users in African markets.
Bias audit conducted by clinical advisor and external reviewer before each major release. Results documented.
NFR-AI-05
AI Data Minimisation
Alena API calls must include the minimum health context required to generate a useful response. A full cycle history is NOT sent — only relevant summary statistics and recent events.
Architecture reviewed by data privacy counsel. API payload size monitored to detect context creep.
NFR-AI-06
Rate Limiting & Cost
Alena API calls must be rate-limited per user (free: 3/day; premium: unlimited) and globally (circuit breaker at 10,000 requests/minute to prevent cost overrun).
Cost dashboard: Anthropic API spend tracked daily. Alert at 80% of monthly budget.
NFR-AI-07
Consent Persistence
All AI feature consent states must be stored server-side with timestamp and consent version. If Anthropic or any AI provider updates their data use terms, users must be notified and consent re-obtained.
Consent version control system. Automated check: if API provider T&Cs version changes, flag for consent review.
NFR-AI-08
MHRA / SaMD Safety
No AI feature must make or imply a diagnosis. HealthLens pattern flags and Alena symptom responses must always be framed as ‘wellness observations’ and must include a ‘Consult a healthcare provider’ pathway.
Clinical advisor reviews all AI output templates before launch. ‘Diagnosis language’ is tested for and rejected in CI/CD pipeline via keyword scanning.
NFR-AI-09
Offline Behaviour
If Alena or HealthLens API calls fail (no network), a graceful fallback message must be displayed: ‘Alena is unavailable right now — check your connection. Your health data is safe.’ No incomplete or truncated health information is shown.
Tested in offline QA scenarios. No user-visible errors that could cause health-related anxiety.
NFR-AI-10
LLM Provider Resilience
GirlCode360 must maintain the ability to switch LLM providers (e.g. from Anthropic to Google Gemini) within 30 days if required. AI feature logic must be abstracted from the specific provider API.
Provider abstraction layer in backend. System prompt and output format documented independently of provider.



6. Roadmap Integration
The three AI features integrate into the existing 6-month roadmap as follows. No AI feature is introduced before the underlying health module data it depends on is live and generating real user data.

AI Feature
 Month 1
 Month 2
 Month 3
 Month 4
 Month 5
 Month 6
Alena (chatbot)
● (build)


● (beta UK)
Iterate
✓ Live NG
✓ Live UK/GH
HealthLens
● (rules)
● (build)


Iterate
✓ Live NG
✓ Live UK/GH
SheMatch






● (build)
✓ Live NG
✓ Live UK/GH
AI Consent UX
Design
Build
✓ Live beta


✓ Verified
✓ All markets
Clinical review
Rules
Content
Beta
Iterate
Pre-launch
Quarterly


● = In Development    ✓ = Live    Text = Status label

6.1  AI Integration Into Hackathon Strategy
Hackathon Opportunities Unlocked by These AI Features
CS Girlies Wellness Hackathon (16 Aug 2026): Submit Alena as the centrepiece demo.
A working chatbot that reads from a user’s actual cycle and PCOS data is a compelling,
live-demonstrable product for a wellness-themed hackathon with a female-majority judging panel.


AI Builders Hackathon (25 Aug 2026): Submit HealthLens — the AI symptom pattern analyser
and Doctor Appointment Prep Card. The ‘AI for real-world impact’ narrative is strong.
The PCOS irregular-cycle accuracy gap is a specific, demonstrable problem that AI can solve.


Build with Gemini XPRIZE (17 Aug 2026): SheMatch + HealthLens combined — frame as
‘AI for healthcare access in underserved communities’. The Africa angle is powerful here.


RevenueCat Shipaton (30 Sep 2026): All 3 AI features gate behind Premium subscription.
The AI features ARE the Premium value proposition. Perfect narrative for a monetisation hackathon.



7. AI Features & Premium Monetisation
The three AI features are the cornerstone of GirlCode360’s Premium subscription value proposition. Research from Flo Health confirms that the AI Health Assistant is their primary Premium conversion driver.

Feature
Free Tier
Premium Tier
Premium Conversion Driver
✨ Alena (chatbot)
3 conversations / day
Unlimited conversations
Creates habit — users want more access
🔍 HealthLens (pattern AI)
Monthly report only
On-demand reports (every 14 days)
High-value moment: seeing your own patterns
🔍 HealthLens (Appointment Card)
1 card / month
Unlimited cards, branded PDF export
Doctor visit prep is high emotional value
📈 SheMatch (basic)
Enabled for 2 trigger types
All trigger types enabled
Utility value: saves time finding services
📈 SheMatch (business tags)
Generic results
Health-tagged results (e.g. PCOS-friendly)
Precision matching is visible, tangible benefit




GirlCode360 — AI Features Specification v1.0  |  Addendum to PRD v1.0 & 6-Month Roadmap  |  Confidential  |  June 2026
