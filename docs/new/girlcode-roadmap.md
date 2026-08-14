
GirlCode360
6-Month Product Roadmap
UK • Nigeria • Ghana  |  July – December 2026
Roadmap Summary
Duration: 6 months (July – December 2026)
Target Markets: United Kingdom, Nigeria (Lagos/Abuja/Port Harcourt), Ghana (Accra/Kumasi)
Launch Strategy: UK Closed Beta (Month 3) → Nigeria Soft Launch (Month 5) → Ghana Launch (Month 6)
North Star Metric: 50,000 registered users by end of Month 6 across all three markets
Funded Assumption: Pre-seed round of £500K–£750K secured before Month 1 begins



1. Market Context & Strategic Framing
GirlCode360 launches across three distinct but complementary markets. The UK provides a high-trust, high-ARPU entry point with significant underserved demand among Black African and Caribbean women. Nigeria offers the largest African femtech opportunity with familiar app-economy behaviours. Ghana provides a strategically positioned ECOWAS gateway with a growing tech-literate user base.

Market
Key Stats
Regulatory Framework
Primary Opportunity
United Kingdom
Femtech market £1.1B (2023), 16.7% CAGR to 2030. 4.9M Black African & Caribbean residents. Black women face disproportionate reproductive health gaps under NHS.
UK GDPR (DPA 2018), MHRA software guidance, NHS DTAC, ICO oversight. Health data = Special Category.
Culturally competent health app for underserved Black and ethnic minority women; NHS digital-first push creates organic demand.
Nigeria
Digital health market $571M (2024), $861M by 2029. 110M+ women. Beauty market $3B+. Chowdeck-familiar digital behaviour.
Nigeria Data Protection Act (NDPA) 2023 + GAID 2025 (effective Sept 2025). National Health Act 2014. Register with NDPC as DCPMI.
First all-in-one femtech + local marketplace in Nigeria. Zero direct competitors. First-mover advantage in a high-growth market.
Ghana
Population 34M; ~17M women. Smartphone penetration 60%+. Strong digital health startup ecosystem (Helium Health, etc.).
Data Protection Act 2012 (Act 843); Data Protection Commission (DPC) registration required. Cybersecurity Act 2020.
Accra/Kumasi tech-savvy user base; AfCFTA links to further ECOWAS expansion. Ghana Digital Economy Hub provides startup support.


Critical UK Insight
NHS Race and Health Observatory research confirms Black African and Caribbean women in the UK experience
disproportionate reproductive health inequalities — dismissed by clinicians, underserved by apps, and left without
culturally relevant health tools. GirlCode360 is uniquely positioned to fill this gap.



2. 6-Month Roadmap Overview
The roadmap follows a build-validate-launch-expand sequence across three broad phases:

Phase 1 — Foundation (Months 1–2)
Build core architecture, compliance infrastructure, and the two highest-priority health modules.
No public users. Internal team testing only.


Phase 2 — Validation (Months 3–4)
Closed beta launch with 500 curated users in the UK, Lagos, and Accra.
Rapid iteration based on qualitative feedback. Clinical review of all health content.


Phase 3 — Launch & Scale (Months 5–6)
Public launch in Nigeria (Month 5) and UK + Ghana (Month 6).
Marketplace seed listings go live. Premium subscription introduced.


2.1  Milestone Swimlane
Milestone
 Month 1
Month 2
Month 3
Month 4
Month 5
Month 6
Arch. & Infra
●
●








Period Tracker
●
✓
✓
✓
✓
✓
PCOS Manager


●
✓
✓
✓
✓
Health Wallet


●
✓
✓
✓
✓
Compliance infra
●
✓
✓
✓
✓
✓
UK Closed Beta




●
✓




Pregnancy / TTC




●
✓
✓
✓
Nigeria Launch








●
✓
Marketplace v1








●
✓
UK+Ghana Public










●

● = In Progress    ✓ = Complete / Live


MONTH 1  —  July 2026
Foundation & Architecture
Build the engine room before you turn on the lights


Objective
Establish the full technical, legal, and design foundation. No features ship to users this month — this is the sprint where everything that matters later gets built correctly the first time.
Workstreams
Workstream
Product & Design
Engineering & Delivery
Compliance & Legal
Engage UK data privacy solicitor for UK GDPR DPA structure. Register with Nigeria NDPC as DCPMI. Initiate Ghana DPC registration. Appoint Data Protection Officer (DPO).
Draft privacy policy, terms of service, and consent framework for all 3 jurisdictions. Confirm app is NOT classified as SaMD under MHRA (wellness positioning, not diagnostic).
Product & UX Design
Finalise wireframes for Onboarding, Period Tracker, and PCOS Manager. Conduct 15 user interviews across UK (Black women 20–40), Lagos, and Accra.
Set up Figma design system. Deliver high-fidelity prototypes for Month 2 development.
Engineering
Set up cloud infrastructure (AWS or GCP, UK region for UK data; West Africa region for Nigeria/Ghana). Implement zero-knowledge architecture for health data. Set up CI/CD pipelines, staging and prod environments.
Build user auth system (OAuth2 + email/phone). Implement AES-256 encryption at rest, TLS 1.3 in transit. Set up feature flags for market-specific rollout.
Clinical & Medical
Engage clinical advisor (UK-registered OB/GYN or women’s health specialist). Begin clinical review of Period Tracker content library.
Commission evidence-based cycle tracking algorithm aligned with Sensiplan/FAM methodology.
Business Development
Begin outreach to beauty stores, salons, clinics in Lagos and London for future marketplace seed listings.
Build CRM of 200+ target businesses in Lagos, Accra, and London for marketplace pre-registration.


Month 1 KPIs
KPI
Baseline
Month-End Target
Measurement Method
Compliance registrations complete
0
2 of 3 (UK + Nigeria)
Legal sign-off document
Design prototypes approved
0
3 screens (onboarding, tracker, PCOS)
Product team sign-off
Cloud infrastructure live
0
100%
DevOps deployment log
Business pre-registrations
0
50 (Lagos-focused)
CRM pipeline count
Clinical advisor contracted
0
1
Signed advisory agreement



MONTH 2  —  August 2026
Core Health Modules Build
Build what women actually open the app for every day


Objective
Deliver the Period Tracker, PCOS Manager, and Health Wallet as functional, internally testable features. These three modules form the trust-building core of the product.
Workstreams
Workstream
Product & Design
Engineering & Delivery
Period Tracker
Finalise cycle prediction logic with clinical advisor. Build cycle logging UI, symptom picker, mood tracker, and flow intensity input.
Complete Period Tracker backend (cycle storage, prediction engine, symptom correlation). Internal QA testing. Localise date formats for UK (DD/MM/YYYY) vs Nigeria/Ghana.
PCOS Manager
Design PCOS symptom diary and hormone-cycle analysis UI. Commission clinical content: what does cycle data mean for PCOS users?
Build PCOS module backend: symptom storage, trigger correlation, lifestyle recommendation engine. Medication reminder system (push notifications).
Health Wallet
Design document vault UI: upload, categorise, view records. Encryption UX — how does user understand their data is private?
Build Health Wallet: encrypted document storage (AES-256), in-app document viewer, shareable link generation with expiry. No server-side plaintext access.
Notifications
Design notification permission flow (UK: explicit opt-in per GDPR; Nigeria/Ghana: explicit consent per NDPA/DPA).
Build notification system: cycle reminders, medication alerts, appointment nudges. Per-market consent tracking.
Onboarding
Build onboarding flow: age confirmation (18+ gate), health module selection, jurisdiction detection for consent routing.
Complete onboarding engineering. Implement market-routing logic (UK GDPR flow vs NDPA flow vs Ghana DPA flow).


Month 2 KPIs
KPI
Baseline
Month-End Target
Measurement Method
Period Tracker feature-complete (internal)
0%
100%
QA test pass rate
PCOS Manager feature-complete (internal)
0%
100%
QA test pass rate
Health Wallet feature-complete (internal)
0%
100%
QA test pass rate
Ghana DPC registration confirmed
0
1
Confirmation letter
Clinical content reviewed & approved
0
100% of M1 content
Clinical advisor sign-off
Business pre-registrations (all markets)
50
200
CRM pipeline count



MONTH 3  —  September 2026
UK Closed Beta Launch
Real users. Real feedback. Ruthless prioritisation.


Objective
Launch a closed beta in the UK with 500 invited users. Simultaneously begin building the Pregnancy and TTC modules. Collect qualitative and quantitative feedback to shape the public launch.
UK Beta User Criteria
300 women aged 18–35 in UK cities (London, Birmingham, Manchester, Leeds)
Minimum 40% Black African or Black Caribbean heritage — GirlCode360’s core underserved UK segment
60 active TTC or pregnancy planners for early pregnancy module input
100 women with diagnosed or suspected PCOS
Recruited via: Instagram/TikTok micro-influencers in UK Black women’s health spaces, Black maternal health charities, and university societies

Workstreams
Workstream
Product & Design
Engineering & Delivery
Beta Launch (UK)
Manage beta user onboarding. Set up weekly user interview schedule (10 users/week). Deploy in-app feedback widget.
Deploy iOS and Android TestFlight/Play beta builds. Set up analytics (Mixpanel or Amplitude): DAU, feature funnel, retention curves.
Pregnancy Module
Design week-by-week pregnancy tracker UI. UK-specific: NHS appointment scheduler integration concept. Nigeria-specific: localised antenatal care guidance.
Start Pregnancy module backend: trimester tracking, foetal development content API, appointment reminders.
TTC Module
Design TTC module: ovulation prediction calendar, fertile window visualisation, BBT logging (optional).
Build TTC prediction algorithm (LH surge pattern + cycle history). Integrate with Period Tracker data.
Nigeria Pre-Launch Prep
Begin Nigeria community building: recruit 50 Lagos beta testers. Partner outreach to 2–3 Nigerian women’s health influencers.
Localise app for Nigeria: Naira currency display, Nigerian state location data seeded, Lagos/Abuja/PH business listings prep.
Marketplace Architecture
Design marketplace listing card, proximity search UI, business profile pages.
Build marketplace backend: listing CRUD API, Google Maps / HERE Maps integration, proximity search algorithm.


Month 3 KPIs
KPI
Baseline
Month-End Target
Measurement Method
UK beta users activated
0
500
TestFlight / Play Console
Day-7 retention (beta)
N/A
≥40%
Mixpanel retention report
Period Tracker daily logs
0
≥1,500 logs/week
Backend analytics
CSAT score (beta survey)
N/A
≥4.0 / 5.0
In-app survey
Pregnancy module build progress
0%
60%
Sprint board
Nigeria beta tester waitlist
0
500 sign-ups
Landing page leads



MONTH 4  —  October 2026
Iteration & Nigeria Pre-Launch
Fix what the beta told you. Build what the data demands.


Objective
Respond to beta feedback with a focused iteration sprint. Complete Pregnancy and TTC modules. Begin Nigeria-specific marketplace seeding with 100+ business listings in Lagos and Abuja.
Workstreams
Workstream
Product & Design
Engineering & Delivery
Beta Iteration (UK)
Synthesise Month 3 feedback. Identify top 10 pain points. Prioritise fixes vs. backlog.
Fix critical bugs. Implement top 5 user-requested improvements (e.g. dark mode, improved cycle calendar, language clarity for PCOS insights).
Pregnancy & TTC — Complete
Clinical review of all pregnancy content with OB/GYN advisor. UK-specific: link to NHS services. Nigeria/Ghana: local antenatal care pathways.
Complete Pregnancy module. Complete TTC module. Integration testing across Period Tracker → TTC → Pregnancy journey continuity.
Nigeria Marketplace Seeding
In-person BD visits to Lagos (Lagos Island, VI, Lekki, Ikoyi, Ikeja, Surulere) and Abuja business districts. Recruit 100+ beauty stores, salons, pharmacies for free listing tier.
Build Nigeria business onboarding portal. Implement listing moderation workflow. Seed 100+ verified listings in Lagos and Abuja.
Accra Marketplace Seeding
BD outreach to Accra (Osu, Labone, East Legon, Airport Residential) and Kumasi beauty/health businesses.
Seed 50+ Ghana listings. Localise for Ghana: GHS currency, Ghanaian English, Greater Accra / Ashanti region geocoding.
Premium Subscription Setup
Design paywall and subscription tiers: Free vs Premium (£4.99/mo UK, ₦2,500/mo Nigeria, GH₵35/mo Ghana).
Integrate Stripe (UK), Paystack (Nigeria/Ghana) for subscription billing. Build subscription management UI.


Month 4 KPIs
KPI
Baseline
Month-End Target
Measurement Method
UK beta retention (Day-30)
N/A
≥30%
Mixpanel cohort analysis
Critical bug fix rate
N/A
100% of P0/P1 bugs
JIRA ticket closure
Pregnancy + TTC modules complete
0%
100%
QA sign-off
Nigeria listings seeded (Lagos/Abuja)
0
100+
Marketplace CMS count
Ghana listings seeded (Accra/Kumasi)
0
50+
Marketplace CMS count
Payment integration (Stripe + Paystack)
0%
100% tested
Payment gateway QA



MONTH 5  —  November 2026
Nigeria Public Launch
The biggest women’s health app Nigeria has never seen before.


Objective
Execute GirlCode360’s public launch in Nigeria. Target 20,000 registered Nigerian users within 30 days of launch. Activate marketplace for Lagos and Abuja. Continue UK beta expansion.
Nigeria Launch Plan
Launch Date: 1 November 2026 (World Menstrual Health Action Day week)
City Priority: Lagos (primary), Abuja (secondary), Port Harcourt (Phase 2)
Channels: Instagram, TikTok, X (Twitter) — micro-influencer saturation campaign (5–10 creators, 50K–500K followers)
PR: Tech Cabal, TechPoint Africa, Zikoko, Guardian Nigeria women’s section pitch
Community activation: WhatsApp group launches in 10 Nigerian cities
Referral programme: 1 month free Premium for every 3 successful referrals

Workstreams
Workstream
Product & Design
Engineering & Delivery
Nigeria Marketing & Comms
Execute influencer campaign. Manage press day. Launch Twitter/X Spaces panel: ‘Women’s Health in Nigeria: Why We Deserve Better Tools’.
Monitor social listening. Triage user support in Nigeria (WhatsApp Business integration for support tier).
Marketplace Activation
Launch marketplace in Nigeria: beauty stores, salons, boutiques, pharmacies visible in app. ‘Featured’ listing tier goes live for early business partners.
Monitor listing quality and report a listing flow. Customer support for business partners. Performance monitoring: proximity API load.
UK Beta Expansion
Expand UK beta from 500 to 2,000 users. Open referral slots. Community tab soft-launch: user groups by health journey (TTC, PCOS, Pregnancy).
Scale UK infrastructure. Monitor retention and engagement uplift from community features.
Subscription Revenue
Activate Premium subscription for Nigeria (₦2,500/mo). Paystack billing live.
Monitor subscription conversion rate. Target 3% of Nigerian users converting to Premium in first 30 days.
Month 6 Prep (UK Public + Ghana)
Finalise UK App Store and Google Play public listings. Begin App Review submission process.
Ghana listing finalisation: 100+ business listings in Accra and Kumasi ready for Month 6.


Month 5 KPIs
KPI
Baseline
Month-End Target
Measurement Method
Nigeria registered users (30 days)
0
20,000
Firebase/Analytics
Nigeria Day-7 retention
N/A
≥35%
Mixpanel
Marketplace listings live (Nigeria)
100
200+
Marketplace CMS
Premium conversion (Nigeria)
0%
≥3%
Paystack / Stripe dashboard
UK beta users
500
2,000
App analytics
App Store / Play Store submissions
0
Both submitted
Store review status



MONTH 6  —  December 2026
UK & Ghana Public Launch + Platform Consolidation
All three markets live. Now it’s time to accelerate.


Objective
Execute simultaneous public launch in the UK and Ghana. Consolidate analytics across all three markets. Introduce community features. Achieve the 6-month North Star: 50,000 registered users across UK, Nigeria, and Ghana.
UK Launch Plan
Launch Date: 8 December 2026 (International Day of Human Rights week — women’s health as a right messaging)
Channels: NHS charity partnerships, Black maternal health charities (FIVEXMORE, Black Mamas Matter), UK TikTok health creators
Media: The Voice, gal-dem, Black Ballad, Glamour UK, Refinery29 UK pitch
NHS DTAC submission initiated (for future NHS trust integrations in 2027)
Premium UK pricing: £4.99/month or £44.99/year
Ghana Launch Plan
Launch Date: 8 December 2026 (co-launch with UK for combined press moment)
Channels: Ghana Web, Joy Online, Graphic Online, Accra-based lifestyle influencers
Ghana community: Activate WhatsApp groups in Greater Accra and Ashanti regions
Premium Ghana pricing: GH₵35/month or GH₵300/year
Partnership: Ghana Health Service digital health outreach for maternal health module

Workstreams
Workstream
Product & Design
Engineering & Delivery
UK + Ghana Launch Execution
Manage UK/Ghana launch day comms. Coordinate dual press release. Monitor community response.
Monitor infrastructure stability across 3 markets. On-call engineering team during launch week.
Community Features
Launch peer support groups in app: TTC Circle, PCOS Warriors, Pregnancy Journey. UK-specific: NHS tips integration content.
Community tab fully live: groups, shared content, moderation tools. Report/flag content workflow.
Analytics & Reporting
Compile 6-month retrospective: user acquisition, retention, revenue, feature usage by market.
Build consolidated analytics dashboard. Identify top 5 feature requests for H1 2027 roadmap.
Subscription Activation (UK/Ghana)
Activate Premium subscription for UK (£4.99/mo, Stripe) and Ghana (GH₵35/mo, Paystack).
Monitor payment processing stability. Subscription churn analysis.
2027 Roadmap Planning
Define Q1 2027 priorities: telemedicine integration, Nigeria Phase 2 cities (Kano, Ibadan, Enugu), pharmacy marketplace tier.
Technical debt review. Architecture scale assessment for 100K+ users.


Month 6 KPIs — North Star Review
KPI
Baseline
Month-End Target
Measurement Method
Total registered users (all markets)
0
50,000
Firebase Analytics
UK registered users
0
10,000
Analytics (market-segmented)
Nigeria registered users
0
35,000
Analytics
Ghana registered users
0
5,000
Analytics
Overall Day-30 retention
N/A
≥30%
Mixpanel
Monthly Active Users (MAU)
0
25,000
App analytics
Premium subscribers (total)
0
1,500+
Paystack + Stripe
Monthly Recurring Revenue (MRR)
0
~£15,000–£20,000
Financial dashboard
Marketplace listings (all markets)
0
400+
Marketplace CMS
NPS Score
N/A
≥45
In-app survey (Delighted/Typeform)



3. Team Structure & Resource Plan
The following is the recommended minimum team composition to execute this roadmap within the 6-month window.

Role
Location / Type
Key Months
Critical Responsibility
Founder/CEO-PM
Full-time, any market
All months
Product vision, investor relations, BD
Lead Mobile Engineer (React Native)
Full-time, remote
Months 1–6
Core app development, iOS + Android
Backend Engineer
Full-time, remote
Months 1–6
API, database, security architecture
UX/UI Designer
Full-time, remote
Months 1–4
Design system, user research, prototyping
Clinical Advisor (OB/GYN)
Part-time (1–2 days/week)
Months 1–6
Health content validation, medical accuracy
Data Privacy / Legal Counsel
Part-time / Retained
Months 1–2, 5
Compliance setup for all 3 jurisdictions
Marketing & Community Manager
Full-time, Nigeria-based
Months 3–6
Nigeria/Ghana launch, influencer, community
Business Development Rep
Full-time, Lagos-based
Months 2–6
Marketplace business recruitment



4. Indicative 6-Month Budget
Based on a pre-seed funding assumption of £600,000 (≈$750,000 / ₦900M), the recommended budget allocation is:

Budget Line
Allocation
Notes
Engineering & Product Team (6 months)
60% (£360K)
Lead eng, backend eng, designer salaries/contracts
Marketing & Launch (Months 3–6)
15% (£90K)
Influencer fees, PR, community, Nigeria launch
Legal, Compliance & Clinical
8% (£48K)
Solicitor, DPO, clinical advisor, registrations
Infrastructure & Tools
5% (£30K)
AWS/GCP, analytics, CI/CD, Maps API
Business Development
5% (£30K)
BD rep salary, marketplace seeding costs
Contingency
7% (£42K)
Regulatory delays, pivots, re-hiring buffer



4A. AI Feature Milestones
GirlCode360 incorporates three AI features — Alena (chatbot), HealthLens (pattern analyser), and SheMatch (marketplace AI) — that are fully specified in the AI Features Specification document. Below are the key milestones for AI delivery within this roadmap. Full technical and functional requirements are in GirlCode360_AI_Features_Spec.docx.
4A.1  Alena (AI Chatbot) — Months 1–3
Month 1: Design Alena consent UX; define system prompt architecture with clinical advisor; configure Anthropic API integration with pseudonymisation layer
Month 2: Build Alena UI (chat interface, context pre-fill, streaming responses, crisis detection); clinical advisor reviews all response templates and disclaimer language
Month 3: Alena live in UK Closed Beta (500 users). KPI: Day-7 Alena engagement rate ≥60% of beta users. Measure: average conversations per active user per week
4A.2  HealthLens (Pattern Analyser) — Months 1–5
Month 1: Clinical advisor authors the PCOS-aware pattern detection rules library (irregularity flags, symptom co-occurrence thresholds, Rotterdam-criteria-aligned indicators)
Month 2: Build rules engine backend; build Doctor Appointment Prep Card PDF generator; build Monthly Health Intelligence Report narrative layer (Claude API)
Month 3–4: HealthLens tested in beta (UK). Requires 90 days of user data — Month 3 beta users generate HealthLens’ first real reports by early Month 6. KPI: Report open rate ≥70%; Appointment Card export rate ≥25% of report viewers
Month 5: HealthLens live for Nigeria launch users. Note: Nigerian users will receive their first HealthLens report in Month 8 (3 months after registration). Communicate activation timeline clearly during onboarding.
4A.3  SheMatch (Marketplace AI) — Months 4–5
Month 4: Build SheMatch context-matching engine; define trigger table configuration file with product + clinical advisor; build ‘Why am I seeing this?’ transparency UI; implement per-module consent controls
Month 5: SheMatch live at Nigeria launch with Lagos/Abuja marketplace listings seeded. KPI: SheMatch consent opt-in rate ≥40% of users; SheMatch result tap-through rate ≥15%
Month 6: SheMatch live UK + Ghana with sponsored health-tagged listing tier activated. Business portal updated with SheMatch tagging self-declaration feature.


4B. Mirror Hackathon Sprint & Production Integration
GirlCode360 is submitting Mirror (Skin AI + Apparel VTO, powered by Perfect Corp.’s YouCam API) to the YouCam API Skin AI & Apparel VTO Hackathon, deadline 17 August 2026, 4:45pm GMT+1. All 8 Mirror features (MIR-F-01 to F-08) ship within this 10-day sprint — nothing is deferred to production. This runs ahead of, and independent from, the existing Month 1–6 roadmap below, with the resulting build hardened into the main roadmap at Month 4–6. Full detail in GirlCode360_Mirror_Feature_Spec.docx.
4B.1  Hackathon Sprint (7–17 August 2026, pre-Month-1) — All 8 Features
Day 1: Register on Devpost, redeem 1,000 free YouCam API units, verify Skin Analysis and Apparel VTO API access; scaffold the Business Portal inventory-tagging schema needed for the boutique bridge
Day 2–3: Build Skin AI Diagnostic Scan and the mandatory biometric data Consent & Privacy screen (ships first — every other Mirror feature is gated behind it)
Day 4: Build Cycle-Correlated Skin Insights (the demo centrepiece) and the SheMatch Skincare Product Bridge, reusing the existing Epic 13 SheMatch architecture
Day 5: Build the Skin Progress Timeline, seeded with 5–10 demo scans spanning several weeks so trend graphs and before/after comparison have real data to show
Day 6–7: Build Apparel Virtual Try-On with a 15–20 item seeded demo garment catalogue, including items tagged to specific boutique listings
Day 8: Build the Style Confidence Boutique Bridge and the Maternity/PMOS Try-On Mode (contextual catalogue filtering by pregnancy week and PMOS state)
Day 9: Full end-to-end integration pass across all 8 features and regression check against the existing GirlCode360 app
Day 10: Record demo video, finalise public/shared GitHub repository, submit on Devpost before the 17 August 4:45pm GMT+1 deadline
4B.2  Production Hardening (Month 4–6, in parallel with existing AI milestones)
All 8 features are functionally complete at the hackathon deadline. What remains afterward is hardening, not building.
Month 4: Legal executes the Perfect Corp. data processing agreement and commercial API contract (replacing hackathon credits); security review of the consent flow and vendor deletion pipeline
Month 5: All 8 Mirror features hardened for production and enter UK Closed Beta alongside Alena, HealthLens, and SheMatch. Seeded demo garment catalogue and boutique tags replaced with real Business Portal onboarding. KPI: Mirror consent opt-in rate ≥35% of beta users; skin scan completion rate ≥60% of consenting users
Month 6: Full Mirror epic live for Nigeria and UK/Ghana public launch, Skin Progress Timeline populated by real accumulated scan history rather than seed data


4C. Pre-Tier 3 — Mirror Studio: Beauty & Fashion
Positioned between Tier 2 (closed) and Tier 3 in the Master Technical Implementation Plan. Eight new features (STU-F-01 to F-08) extend Mirror into a genuinely competitive beauty-and-fashion product, grounded in a competitive audit against Sephora Virtual Artist, Ulta GLAMlab, YouCam Makeup, Whering, Acloset, Cladwell, and Indyx. Full detail in GirlCode360_Mirror_Feature_Spec.docx §6.
4C.1  Phased Build (P3.1–P3.6)
P3.1 Foundations: youcam-gateway extended for Makeup, Hair, and Shade Finder API families; new live-camera consent event; Fitzpatrick-range validation harness
P3.2 Makeup Studio + Shade Match Engine — closes the single largest competitive gap first (no makeup try-on today)
P3.3 Hair Studio, including PMOS hair-symptom correlation reusing the HealthLens/Mirror correlation guardrails
P3.4 My Wardrobe — the largest single build in this tier; closes the biggest functional gap versus the digital-wardrobe app category
P3.5 AI Stylist (Alena extension, not a new assistant) + Style Analytics — both depend on My Wardrobe existing first
P3.6 Accessories Studio + Wardrobe Resale Bridge — sequenced last as both carry external retailer/community-volume dependencies rather than pure internal build risk
4C.2  Monetisation Target
Mirror Studio bundles into the existing Premium tier (reusing ALN-F-05 gating) rather than adding a third pricing tier, priced competitively against the $5–10/month dedicated wardrobe-app category it displaces. Retailer-side monetisation extends MKT-F-07 Featured & Sponsored Listings with ‘Verified Shade Match’ and ‘Try-On Ready’ paid placement. KPI: Mirror Studio Premium attach rate among existing Mirror users — target set once P3.2 (Makeup Studio) usage data exists, per the same evidence-before-KPI-lock discipline used elsewhere in this roadmap.
Global market note: UK, Nigeria, and Ghana remain GirlCode360’s initial launch markets and this roadmap’s concrete planning basis, but they are not a ceiling on the product’s ambition. Mirror Studio’s retailer-facing features work identically in any market with Business Portal-onboarded retailers. See PRD §6C for the full global-positioning statement.


5. Roadmap Risks & Contingencies

Risk 1: MHRA classifies app as Software as a Medical Device (SaMD)
If the period tracker's cycle predictions are framed as diagnostic (e.g. 'you have PCOS'), MHRA may require UKCA marking, which typically takes 6–12 months.
Mitigation: Position all outputs as 'wellness insights', not diagnoses. Clinical advisor reviews all copy. Add clear medical disclaimers on every output. This is a core design constraint, not an afterthought.

Risk 2: Nigeria NDPC registration delayed
NDPC processing times can extend beyond 30 days. A delayed registration does not block launch but increases regulatory exposure.
Mitigation: Submit registration in Month 1. Engage a Nigeria-licensed DPCO (Data Protection Compliance Organisation) to manage submission and liaison. Build compliance in depth regardless of registration status.

Risk 3: Low Nigeria Day-7 retention (<25%)
Poor early retention signals product-market fit failure and risks wasting launch momentum.
Mitigation: Month 5 Nigeria launch is preceded by 500-person Lagos pre-beta in Month 3 specifically to validate retention. If D7 < 30% in pre-beta, delay Nigeria public launch by 4 weeks and fix before scale.

Risk 4: Marketplace supply-side too thin at launch
Launching a marketplace with fewer than 50 listings per city produces a dead-catalogue experience that kills trust.
Mitigation: BD recruitment starts Month 1. Month 5 Nigeria launch requires 100+ Lagos listings as a hard gate. Launch blocked if supply threshold not met.


GirlCode360 — 6-Month Product Roadmap  |  Confidential  |  June 2026
