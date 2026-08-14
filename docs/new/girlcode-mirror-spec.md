
GirlCode360
Mirror: Skin AI & Style Confidence
Epic 15 Feature Specification  •  Powered by Perfect Corp. YouCam API
Version 1.0  •  UK • Nigeria • Ghana  •  Prepared 7 August 2026
Submission Target
YouCam API Skin AI & Apparel VTO Hackathon (Perfect Corp. / Devpost)
Topic: Skin AI + Apparel VTO (combined) — "bring both capabilities together into one experience"
Deadline: 17 August 2026, 4:45pm GMT+1  —  10 days from this document's preparation date
Prize pool: $6,000+ (1st: $5,000 cash, 2nd: $1,000 cash, 3rd–5th: API credits)



1. Strategic Rationale
This document defines Mirror, a new GirlCode360 module combining AI skin diagnostics and generative apparel try-on, built on Perfect Corp.'s YouCam API. It serves two purposes at once: a hackathon submission due 17 August 2026, and a permanent addition to the GirlCode360 production roadmap. Every requirement below is written to survive past the hackathon — nothing here is throwaway demo code.

1.1  Why This Fits GirlCode360
The user's own framing was correct: YouCam leans the product further toward beauty. That is a natural extension, not a detour. GirlCode360 was already positioned around PMOS-related skin symptoms (acne tracking in the Period Tracker and PMOS Manager) and SheMatch's beauty-store marketplace bridge. Mirror gives both of those existing features something they never had — an actual, objective, quantified skin measurement, rather than the user's own subjective 1–5 severity rating.

The Market Gap This Closes
Every existing AI skin-scanning app — Ada, SkinAI, ScanSkinAI, ScanSkinAI, Perfect Corp.'s own consumer
apps — treats a skin scan as an isolated snapshot: 'here is your skin today.' None of them have access
to a user's menstrual cycle or PMOS symptom history, so none of them can answer the question a
hormonal-acne sufferer actually has: 'is this cyclical, or is something else going on?'


GirlCode360 already has 6+ months of cycle and PMOS symptom data for existing users. Mirror doesn't
need to build that data asset — it already exists. This is a genuine, defensible product advantage,
not a feature that any skincare app could copy by simply also integrating YouCam.


1.2  Competitive Landscape (as of August 2026)
Standalone skin-scanning apps
Ada, SkinAI, ScanSkinAI: 30–80+ condition detection, dermatologist review add-ons, mole-mapping
Strong on breadth of dermatological conditions (eczema, psoriasis, melanoma risk)
Zero connection to hormonal or menstrual cycle data
Positioned as medical triage tools, not beauty/wellness companions
Beauty retailer AI tools
Sephora Virtual Artist, L'Oréal Perso, YouCam Makeup: skin scan feeds directly into THEIR product catalogue
Optimised for retail conversion, not longitudinal health tracking
No skin-progress-over-time view tied to a health record
No independent marketplace — locked to one retailer's products


GirlCode360's Mirror sits in the gap between these two categories: health-context-aware like a medical triage tool, but positioned as an empowering wellness companion like a beauty app — and, via SheMatch, connected to an independent, multi-brand local marketplace rather than one retailer's shelf.


2. Hackathon Submission Strategy
The hackathon offers three topics: Skin AI, Apparel VTO, or both combined. We are submitting under the combined topic — the judging brief explicitly rewards products that treat both capabilities as one experience rather than two bolted-together features. That is precisely what GirlCode360 is positioned to do, because both capabilities plug into data GirlCode360 already collects (PMOS symptoms, pregnancy stage).

2.1  Hackathon Scope
All 8 Mirror features ship for the 17 August 2026 submission. Nothing is deferred — the full epic is the demo, and the full epic is what goes into the GitHub repository.

All 8 Features In Scope for the Hackathon Submission
MIR-F-01  Skin AI Diagnostic Scan — live YouCam Skin Analysis API call, real quantified scores
MIR-F-02  Cycle-Correlated Skin Insights — the demo's centrepiece: skin score + PMOS symptom overlay
MIR-F-03  Skin Progress Timeline & Comparison — trend graphs + before/after view, seeded with demo scan history
MIR-F-04  SheMatch Skincare Product Bridge — reuses existing SheMatch UI, proves ecosystem fit
MIR-F-05  Apparel Virtual Try-On — live YouCam Apparel VTO API call, real generated try-on image
MIR-F-06  Style Confidence Boutique Bridge — try-on tied to tagged boutique inventory via Business Portal
MIR-F-07  Consent & Privacy — demonstrates responsible handling of biometric data from day one
MIR-F-08  Maternity/PMOS Try-On Mode — contextual catalogue filtering by pregnancy week and PMOS state


2.2  10-Day Build Timeline
Date
Milestone
Deliverable
Day 1(7 Aug)
API Setup & Registration
Register on Devpost, redeem 1,000 free YouCam API units, verify Skin Analysis and Apparel VTO API access via API Playground. Confirm YouCam MCP integration option for faster prototyping. Scaffold the Business Portal inventory-tagging schema needed for MIR-F-06.
Day 2–3(8–9 Aug)
Skin AI Core + Consent
Build MIR-F-01 (scan capture + API call + results screen) and MIR-F-07 (consent screen, ships first — nothing else in Mirror is reachable without it). Wire into existing PMOS symptom data model.
Day 4(10 Aug)
Cycle Correlation + SheMatch
Build MIR-F-02 (the differentiating correlation logic) and MIR-F-04 (reuse existing SheMatch trigger engine, add one new trigger type).
Day 5(11 Aug)
Skin Progress Timeline
Build MIR-F-03: trend graphs per concern and before/after comparison view. Seed 5–10 demo scans spanning several weeks so the timeline has real data to show.
Day 6–7(12–13 Aug)
Apparel VTO Core
Build MIR-F-05 (photo upload + garment selection + API call + result display). Seed a 15–20 item demo garment catalogue, including items tagged to specific boutique listings for MIR-F-06.
Day 8(14 Aug)
Boutique Bridge + Maternity/PMOS Mode
Build MIR-F-06 (Marketplace listing → tagged inventory → try-on → contact boutique) and MIR-F-08 (contextual catalogue filtering by pregnancy week / PMOS state, launched from within the Pregnancy and PMOS modules).
Day 9(15 Aug)
Integration Pass + Regression
Full end-to-end walkthrough of all 8 features against the existing GirlCode360 app. Regression check that Mirror consent decline doesn't degrade any other module (per MIR-LLR-009/010). Fix integration seams.
Day 10(16–17 Aug)
Polish, Video, Submission
Record 1–3 minute demo video showing the full flow: scan → cycle correlation insight → SheMatch suggestion → progress timeline → try-on → boutique bridge → maternity mode. Capture screenshots, finalise public/shared GitHub repo with setup instructions, upload video to YouTube, submit on Devpost before 17 Aug 4:45pm GMT+1.


Sequencing Logic
Consent (MIR-F-07) ships on Day 2–3, before any scan or try-on feature, because every other Mirror
feature is gated behind it — building it first avoids rework and keeps every subsequent feature
demoable in isolation from that point on.


MIR-F-06 and MIR-F-08 are sequenced late (Day 8) because they depend on catalogue tagging work
(boutique inventory tags, pregnancy-week/PMOS tags) that only becomes meaningful once the core
Try-On flow (MIR-F-05) is stable — building the filter before the thing it filters wastes a day.


2.3  Judging Criteria Alignment
FR-ID
Requirement
Priority
Notes
TechnicalImplementation
Both YouCam APIs called live (not mocked) in the demo. Skin Analysis API drives real quantified scores; Apparel VTO API generates a real image. Non-trivial: correlation logic is genuine computation over two real data sources, not a static screen.
Must
Judges explicitly reward 'genuine effort and a working, non-trivial implementation'
Design
Reuses GirlCode360's existing design system (Fraunces/Manrope, pink/magenta palette) so Mirror feels native to the product, not bolted on. Consent screen, results screen, and SheMatch banner all match established GirlCode360 UI patterns.
Must
Judges reward 'a complete, coherent product experience — not just a technical proof of concept'
PotentialImpact
Demo video explicitly narrates the real problem: hormonal acne sufferers get generic skincare advice because no existing tool has their cycle data. Shows the specific before/after: generic advice vs. cycle-aware insight.
Must
Judges reward a 'credible, specific case for solving a real problem for a real audience'
Quality ofthe Idea
The combined-topic framing itself is the core idea: skin and style aren't separate concerns for GirlCode360 users — both tie back into the same hormonal and life-stage journey already being tracked.
Must
Judges reward 'creative, non-obvious use' and 'genuine understanding of the problem space'



3. Full Feature Specification (Epic 15: MIR)
The complete Mirror epic, covering both the hackathon MVP and the post-hackathon production build. Full BDD-level acceptance criteria and test cases for all 8 features are maintained in GirlCode360_Requirements_and_TestCases.xlsx (Epic MIR).

3.1  MIR-F-01 — Skin AI Diagnostic Scan
Users take a guided selfie scan analysed by the YouCam AI Skin Analysis API, returning quantified 0–100 scores across up to 15 skin concerns: acne, oiliness, pores, redness, wrinkles, dark spots, texture, hydration, radiance, dark circles, firmness, eye bags, droopy eyelids, tear trough, and skin type. Scan completes within 10 seconds with a visual overlay mask per concern.
Technical note: YouCam's documented dataset spans 70,000+ medical-grade images with 95% test-retest reliability. This is materially more clinically grounded than a generic vision-model wrapper, which matters for a health-adjacent product.

3.2  MIR-F-02 — Cycle-Correlated Skin Insights (the differentiator)
Skin scan results are cross-referenced against the user's logged cycle day and PMOS symptom data from the same date to surface hormonal correlation patterns — for example, acne and oiliness scores consistently elevated in the luteal phase. This feeds directly into HealthLens as a new pattern category in the Monthly Health Intelligence Report, using the same confidence-level (Low/Medium/High) and non-diagnostic disclaimer treatment as every other HealthLens pattern.

Correlation Logic — Guardrails
Minimum data bar: requires 2+ scans across genuinely different cycle phases before ANY correlation
is surfaced. A single scan produces a skin report with zero cycle claims.


No forced patterns: if scores are flat across phases, the system explicitly says so ('We haven't
detected a clear pattern yet') rather than fabricating a trend to seem more insightful.


Correlation, not causation: all insight language is reviewed by the clinical advisor to avoid
implying a diagnosed hormonal cause — consistent with the disclaimer standard set across HealthLens.


3.3  MIR-F-03 — Skin Progress Timeline & Comparison
A chronological view of skin scans with trend graphs per concern and side-by-side before/after image comparison between any two scan dates, annotated with cycle phase where available. Ships in the hackathon demo seeded with 5–10 scans spanning several weeks, so the timeline has genuine data to visualise rather than a single empty point.

3.4  MIR-F-04 — SheMatch Skincare Product Bridge
When a scan surfaces an elevated concern (e.g. acne score above 60), a SheMatch banner suggests nearby beauty stores or pharmacies stocking relevant products. This is a new trigger type added to the existing SheMatch trigger table (Epic 13) — it deliberately does not introduce a second consent system, a second transparency mechanism, or a second suppression/dismissal model. Reuse, not duplication, is the architectural principle.

3.5  MIR-F-05 — Apparel Virtual Try-On
Users upload or select a full-body photo and virtually try on clothing via the YouCam Apparel Virtual Try-On generative API, previewing fit, fabric, and colour before purchase. Generation completes within 15 seconds, preserving the user's body proportions and features. Supports mixing separate garment pieces and full outfit swaps without re-uploading a photo.
Technical note: Perfect Corp.'s Fashion API suite (expanded January 2026) also covers watches, jewellery, bags, and shoes as modular APIs — a natural post-hackathon extension once core apparel try-on is validated.

3.6  MIR-F-06 — Style Confidence Boutique Bridge
Apparel VTO integrates with SheMatch and the Marketplace so users can try on real inventory tagged by nearby boutiques via the Business Portal, closing the loop between a digital try-on and a real, local purchase. Ships in the hackathon demo against a small seeded set of boutique-tagged catalogue items; full Business Portal self-service tagging by real business owners is a Month 5–6 production concern once real boutiques are onboarded.

3.7  MIR-F-07 — Photo & Biometric Data Consent, Privacy and Retention
Mirror requires a dedicated consent screen — separate from every other GirlCode360 consent — before any Skin Scan or Try-On becomes available, explaining: that a photo will be sent to Perfect Corp. (YouCam) as a data processor, the applicable retention period, and that photos are not used to train models beyond the user's own analysis without further explicit consent. Declining this consent must not degrade any other module.

Why This Gets Its Own Consent Tier
A facial or body photograph is biometric data — UK GDPR Article 9 'special category data', treated
identically to health data under NDPA and Ghana's DPA. Mirror is the first GirlCode360 feature that
sends an image (rather than structured health data) to a third-party processor, which is a materially
different risk profile from anything else in the product. This is why it cannot be folded into the
existing health-data consent — it needs its own explicit, informed, revocable consent event.


3.8  MIR-F-08 — Maternity, Postpartum & PMOS Body-Confidence Try-On Mode
A contextual Try-On mode surfaced within the Pregnancy module (maternity wear filtered to the user's current pregnancy week) and PMOS Manager (adaptive-fit, body-confidence clothing), rather than generic undifferentiated browsing. Ships in the hackathon demo with a small trimester-tagged catalogue covering first, second, and third trimester examples.


4. Privacy, Consent & Compliance
Mirror introduces the single highest-sensitivity data category in GirlCode360 to date: a photograph of the user's face or body, transmitted to a third-party AI vendor. Every other module either keeps data on-device/encrypted-server-side, or (for Alena) sends only pseudonymised statistical summaries. This section exists because that difference deserves explicit treatment, not an assumption that existing consent patterns simply extend to cover it.

Requirement
Implementation
Legal basis
Explicit consent (UK GDPR Art. 9(2)(a); NDPA and Ghana DPA equivalent provisions for special category / biometric data). Never legitimate interest or contract necessity — the consent bar is deliberately the highest available.
Data processor agreement
GirlCode360 must execute a data processing agreement with Perfect Corp. covering: purpose limitation (analysis only), no secondary use for model training without further consent, retention limits, and sub-processor disclosure, before this feature reaches production for any real user.
Retention
Default: images are not retained by GirlCode360 beyond the session unless the user explicitly opts to save a scan to their Skin Progress Timeline. Saved images follow the same deletion architecture as Health Wallet documents (24h app removal, 30-day backup purge).
Vendor deletion
Deleting a scan or try-on photo in-app must also trigger a deletion request to the YouCam API per Perfect Corp.'s documented data processing terms, logged for audit purposes.
Minors
The existing UOB-F-03 age gate (18+) applies identically to Mirror — no separate age verification is introduced, but Mirror inherits the same block on any account that has not passed age verification.
Cross-market handling
Consent copy must be reviewed per market: UK (ICO guidance on biometric data), Nigeria (NDPA/GAID 2025), Ghana (DPA 2012) — following the same three-jurisdiction review pattern established in PRD v1.1's compliance matrix.



5. Post-Hackathon Production Hardening
All 8 Mirror features ship functionally by the 17 August 2026 hackathon deadline. The work remaining afterward is hardening, not building: moving from hackathon API credits to a commercial contract, replacing seeded demo data with real user data and real business onboarding, and the legal/security review a consumer health product requires before real users' biometric data flows through it.

Phase
Scope
Aug 2026(Hackathon)
All 8 MIR features (F-01 to F-08) built and demoed as a working prototype for hackathon submission, using hackathon API credits and seeded demo data (scan history, garment catalogue, boutique tags, trimester tags).
Month 4(post-hackathon)
Legal executes the Perfect Corp. data processing agreement and commercial API contract, replacing hackathon credits. Security review of the consent flow and vendor deletion pipeline. Clinical advisor reviews all correlation-insight language across MIR-F-02.
Month 5
All 8 Mirror features hardened for production and enter UK Closed Beta alongside Alena, HealthLens, and SheMatch (per the existing Month 5 AI milestone in the 6-Month Roadmap). Seeded demo garment catalogue and boutique tags replaced with real Business Portal onboarding.
Month 6
Full Mirror epic goes live for Nigeria and UK/Ghana public launch alongside the rest of the AI feature set. Skin Progress Timeline populated by real accumulated user scan history rather than seed data.
Post-Month 6
Continued Business Portal self-service onboarding for boutique inventory tagging (MIR-F-06) and maternity/PMOS catalogue expansion (MIR-F-08) as more businesses register through the Marketplace.




GirlCode360 — Mirror Feature Specification v1.0  |  Epic 15 (MIR)  |  Confidential  |  7 August 2026
