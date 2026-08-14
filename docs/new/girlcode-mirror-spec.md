
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
Mirror introduces the single highest-sensitivity data category in GirlCode360 to date: a photograph of the user's face or body, transmitted to a third-party AI vendor. Every other module either keeps data on-device/encrypted-server-side, or (for Zara) sends only pseudonymised statistical summaries. This section exists because that difference deserves explicit treatment, not an assumption that existing consent patterns simply extend to cover it.

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
All 8 Mirror features hardened for production and enter closed beta alongside Alena, HealthLens, and SheMatch (per the Month 5 AI milestone in the 6-Month Roadmap). Seeded demo garment catalogue and boutique tags replaced with real Business Portal onboarding.
Month 6
Full Mirror epic goes live for initial launch markets alongside the rest of the AI feature set, on an architecture designed to onboard additional markets without re-engineering (see §6). Skin Progress Timeline populated by real accumulated user scan history rather than seed data.
Post-Month 6
Continued Business Portal self-service onboarding for boutique inventory tagging (MIR-F-06) and maternity/PMOS catalogue expansion (MIR-F-08) as more businesses register through the Marketplace.


6. Pre-Tier 3 — Mirror Studio: Beauty & Fashion
Mirror as shipped through Tier 1/Tier 2 uses exactly two of Perfect Corp.'s roughly nine YouCam API product categories: AI Skin Analysis and generative Apparel Virtual Try-On. That was the right hackathon-and-Tier-1 scope — narrow enough to ship in 10 days, deep enough to win on — but it leaves the majority of YouCam's platform, and the majority of the beauty-and-fashion category's proven revenue mechanics, untouched. This section defines Pre-Tier 3: a deliberate, deeply-researched expansion that turns Mirror from ‘the skin-and-outfit feature inside a health app’ into Mirror Studio — a beauty-and-fashion product genuinely competitive with, and differentiated from, the dedicated apps in that category, while remaining anchored to the one thing none of them have: GirlCode360's own longitudinal health and cycle data.
Sequencing: Pre-Tier 3 sits between Tier 2 (closed, per the Master Technical Implementation Plan) and Tier 3 (native app, multi-region scale, population ML). It is additive to the existing Mirror epic — every feature below is a new capability, not a rebuild of MIR-F-01 through F-08, and every feature reuses an existing GirlCode360 system (SheMatch, Alena, HealthLens, the consent engine, the Business Portal, the Marketplace) wherever one already does the job, per the same reuse-over-duplication principle that governs the rest of the product.

6.1 Why Now: The Gap in the Current Build
Grounded in market research
Virtual try-on's proven commercial impact is not a hypothesis — it is documented, repeatedly, across the
category: AR-driven beauty try-on tools report 30–40% lifts in online purchase conversion and up to a
40% reduction in returns (the single largest cost centre in online beauty and fashion retail). One
enterprise virtual try-on platform reports a 3.5x lift in product-page-to-purchase conversion specifically
from AI skin diagnostics plus try-on used together — exactly the combination Mirror already has the
scaffolding for, and exactly the combination this tier deepens.


Yet GirlCode360 currently ships none of the single most-used feature across the entire beauty-app
category: makeup try-on. Sephora Virtual Artist, Ulta GLAMlab, L'Oréal's Makeup Genius, and Perfect
Corp.'s own consumer app YouCam Makeup all lead with it. It is the feature every mainstream beauty
app is best known for — and it is a YouCam API GirlCode360 has not yet touched.


6.2 Competitive Landscape: Two Categories, Two Sets of Gaps
Beauty apps do this well…
Real-time AR makeup try-on across 7 categories: lip, eyeshadow, blush, foundation, eyebrow, eyeliner, eyelash (Sephora, Ulta, YouCam Makeup)
AI shade-matching to reduce the #1 driver of beauty returns — buying the wrong foundation shade online
Loyalty and rewards tie-ins driving repeat engagement (Sephora Beauty Insider, Ulta Ultimate Rewards)
…but: none of them know anything about the user's hormonal cycle, skin-condition history, or life stage. A shade recommendation is a snapshot, not a pattern.
Wardrobe apps do this well…
Digital closet cataloguing and AI outfit generation from clothes the user actually owns (Whering, Acloset, Cladwell)
Weather- and calendar-aware daily outfit suggestions; packing lists; capsule wardrobe building
Cost-per-wear and wardrobe-utilisation analytics (Indyx); sustainability/impact tracking (Whering); peer resale (Acloset)
…but: virtually none combine this with any skin, body, or health signal — styling is blind to how the user's face or body actually looks today, and blind entirely to pregnancy, PMOS, or cycle-stage context.


The Gap Mirror Studio Closes
No competitor in either category combines a real digital wardrobe, a real skin/hair diagnostic, and a
real hormonal-health data layer into one styling intelligence. That combination — not any single
feature below in isolation — is Mirror Studio's defensible position, and it is unbuildable by a beauty
app or a wardrobe app copying one feature at a time, because neither has the underlying health data
asset GirlCode360 already holds.



6.3 The YouCam Surface Mirror Currently Leaves Unused
Perfect Corp.'s YouCam API platform spans nine functional categories. Mirror (Tier 1/2) uses two. The table below is the complete surface, sourced from Perfect Corp.'s published API catalogue, with each unused category mapped to the Mirror Studio feature that adopts it.

Category
Requirement
Priority
Notes
Face & Skin
AI Skin Analysis (in use — MIR-F-01/F-02), AI Skin Shade Finder, AI Fitzpatrick Skin Type Analysis, AI Makeup Transfer, Face Diagnostic, AI Skin Simulation, AI Face Reshape Simulator
In use + STU-F-01/F-02
Shade Finder + Fitzpatrick analysis are the two categories Mirror Studio newly adopts here
Hair
AI Virtual Hair Colour Try-On, AR Hairstyle Virtual Try-On, AI Hair Type/Length/Frizziness/Density Analysis
STU-F-03
Marketed by Perfect Corp. as its most comprehensive hair-and-beard API suite; entirely unused by Mirror today
Makeup
Live AR + photo-mode try-on across 7 categories (lip, eyeshadow, blush, foundation, eyebrow, eyeliner, eyelash) via AgileFace tracking
STU-F-01
Zero current usage — the single largest gap versus every mainstream beauty-app competitor
Nails
Virtual Try-On for Nails
STU-F-05
Zero current usage
Jewellery & Watches
3D Viewer/Authoring, AR Ring / Bracelet / Watch / Earring / Necklace Try-On
STU-F-05
Zero current usage; requires 3D-authored retailer assets — a real Business Portal dependency, noted as an NFR below
Eyewear
AI-Powered Virtual Try-On for Glasses
STU-F-05
Zero current usage
Apparel
Generative Apparel Virtual Try-On (in use — MIR-F-05/F-06/F-08)
In use + STU-F-04
My Wardrobe (STU-F-04) extends the same engine to the user's own photographed clothing, not only a catalogue
Conversational AI
“Ask AI” / Perfect Beauty Agent (Perfect Corp.'s own conversational layer)
Not adopted
GirlCode360 already owns a superior, health-aware conversational layer (Alena); STU-F-06 extends Alena instead of adopting a second, YouCam-native assistant — see §6.9



MIRROR STUDIO · 01
Makeup Studio
Real-time and photo-mode AR makeup try-on, matched to your actual skin — not a generic swatch


Live-camera and photo-mode makeup try-on across the seven categories every mainstream beauty app leads with — lip colour, eyeshadow, blush, foundation, eyebrow, eyeliner, eyelash — plus a “transfer” mode that lifts a makeup look from a reference photo (a screenshot, an inspiration image) and applies it to the user's own face. Every look starts from the user's most recent Mirror skin scan, so foundation and concealer shades are proposed against the user's actual, measured skin tone rather than a generic shade wheel.

Feature ID
Requirement
Priority
Notes
STU-F-01a
Live AR makeup try-on via device camera across all 7 categories (lip, eyeshadow, blush, foundation, eyebrow, eyeliner, eyelash), using YouCam's AgileFace real-time tracking for jitter-free application in motion.
Must
YouCam API: AI Makeup Transfer / live AR makeup category. Camera permission is a new, separate consent event from MIR-F-07's photo-capture consent.
STU-F-01b
Photo-mode makeup try-on applied directly to a saved Mirror skin scan, so a user without camera access (or who prefers not to use live AR) gets full functionality from a still photo.
Must
Ensures parity for users who decline live-camera consent — mirrors the accessibility principle already established for Anonymous Mode in Alena (ALN-F-03).
STU-F-01c
‘Get this look’: upload a reference image and have Makeup Studio approximate the look on the user's own face via AI Makeup Transfer.
Should
This is the single feature most requested in beauty-app user research broadly (‘I saw this on Pinterest/TikTok, can I see it on me’) and has no equivalent anywhere else in GirlCode360's current product.
STU-F-01d
Save a completed look to the user's Style Analytics history (STU-F-07) and optionally to Health Wallet-adjacent private storage; share externally only on explicit user action.
Must
Never auto-shared. Same explicit-share pattern as Health Wallet's HW-F-04 time-limited links.
STU-F-01e
Every completed foundation/concealer look surfaces a ‘Shop this shade’ action routed through the Shade Match Engine (STU-F-02) and SheMatch, not a generic outbound link.
Should
Keeps the commercial loop inside GirlCode360's own marketplace rather than sending the user to a third-party retailer with no SheMatch context.


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-01
Live AR latency must stay within YouCam's documented jitter-free performance envelope on a mid-tier device (2GB RAM, 4G); a visible frame-rate degradation banner and automatic fallback to photo-mode fires rather than shipping a laggy live-AR experience.
Must
Performance testing
NFR-STU-02
Makeup Studio must be validated for accurate, natural-looking application across the full Fitzpatrick I–VI skin-tone range before launch — not spot-checked on a narrow demo set.
Must
Equity / accuracy audit; ties to NFR-STU-05 under Shade Match Engine
NFR-STU-03
Camera access for live AR requires its own explicit consent screen, separate from Mirror's existing photo-capture consent (MIR-F-07), since live video is a materially different data flow.
Must
Privacy / consent architecture



MIRROR STUDIO · 02
Shade Match Engine
Cross-brand foundation and concealer shade matching, validated across every skin tone — not just the easy ones


The single biggest driver of beauty-product returns and buyer hesitation is uncertainty about shade — will this foundation actually match my skin. The Shade Match Engine uses YouCam's AI Skin Shade Finder together with AI Fitzpatrick Skin Type Analysis, run against the user's Mirror scan, to recommend a matched shade code across multiple brands stocked by SheMatch-linked retailers, and to remember that match so it never needs re-deriving from scratch.

Feature ID
Requirement
Priority
Notes
STU-F-02a
Generate a shade match (foundation and concealer) from the user's existing Mirror skin scan — no separate scan required if one already exists from the last 30 days.
Must
Reuses MIR-F-01 scan data rather than requiring a duplicate capture
STU-F-02b
Return a cross-brand ‘shade twin’ list: the closest matching shade code at each brand stocked by a SheMatch-linked retailer within the user's search radius or shippable to their region.
Must
Extends the SheMatch trigger table (SM-F-01) with a new trigger type — no second marketplace engine
STU-F-02c
Persist shade match history to Style Analytics (STU-F-07) so a user can see, and a retailer can later stock toward, their established shade rather than re-guessing every purchase.
Should
—
STU-F-02d
Explicitly flag shade-match confidence as Lower for any combination of lighting conditions and skin tone where YouCam's documented accuracy is reduced, rather than presenting every match with equal confidence.
Must
Honesty parity with HealthLens's existing Low/Medium/High confidence pattern (HL-F-02)


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-04
Shade Match accuracy must be independently validated across Fitzpatrick I–VI before any retailer partnership is marketed as ‘verified shade match’ — shade-finder tools have a well-documented history of underperforming on darker skin tones, and GirlCode360 does not repeat that failure silently.
Must
This is a stated equity commitment, not an assumption; it is testable and must be tested
NFR-STU-05
Retailer participation in cross-brand shade matching requires the retailer to publish accurate, current shade-code inventory via the Business Portal; GirlCode360 does not fabricate stock availability.
Must
Business Portal dependency



MIRROR STUDIO · 03
Hair Studio
Hair colour and style try-on, plus a real diagnostic — correlated to the PMOS symptoms already being logged


Hair Studio is the feature in this tier with the clearest, most defensible ‘quality of idea’ case: PMOS-F-02's symptom diary already asks users to log hair thinning and hirsutism as PMOS-relevant symptoms — today as a subjective severity rating. YouCam's AI Hair Type, Length, Frizziness, and Density Analysis turns that into an objective, quantified score, and — exactly like MIR-F-02's skin-cycle correlation — that score can be tracked against the user's logged PMOS data over time. Paired with AI Virtual Hair Colour Try-On and AR Hairstyle Try-On, this is simultaneously a genuine clinical-adjacent signal and a genuine styling feature; no competitor in either the beauty or wardrobe category attempts this combination.

Feature ID
Requirement
Priority
Notes
STU-F-03a
Hair diagnostic scan returning quantified type, length, frizziness, and density scores via YouCam's AI Hair Type/Length/Frizziness/Density Analysis suite.
Must
Same scan-and-score UX pattern already proven for skin in MIR-F-01
STU-F-03b
Cross-reference hair density/frizziness trend against logged PMOS hair-thinning and hirsutism symptom entries (PMOS-F-02), using the same correlation guardrails already established for skin (MIR-F-02): minimum 2 scans across different time points before any pattern is surfaced; explicit ‘no clear pattern yet’ honesty when the data doesn't support one.
Must
Reuses the HealthLens correlation engine — not a second correlation system
STU-F-03c
Virtual hair colour try-on (AI Virtual Hair Colour Try-On) and hairstyle try-on (AR Hairstyle Virtual Try-On) from a single face photo.
Must
YouCam API, direct integration
STU-F-03d
Hair-density trend feeds into the next HealthLens Monthly Health Intelligence Report as an additional pattern category, alongside the existing skin-correlation pattern, with the same non-diagnostic disclaimer treatment.
Should
Extends HL-F-02's report structure; no new report type


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-06
Hair-symptom correlation language is reviewed by the clinical advisor before launch, with the identical rigour applied to MIR-F-02's skin-correlation language — hirsutism and hair thinning are sensitive, PMOS-diagnostic-adjacent topics and must never be presented as diagnostic.
Must
Clinical review
NFR-STU-07
Hair diagnostic accuracy validated across a full range of hair types and textures (straight, wavy, curly, coily), not just the hair types most commonly represented in beauty-tech training data.
Must
Equity / accuracy audit



MIRROR STUDIO · 04
My Wardrobe
A real digital closet — outfit suggestions from clothes the user actually owns, not only a boutique catalogue


This is the single largest functional gap identified in the competitive research: Mirror's existing Apparel Virtual Try-On (MIR-F-05) only ever tries on catalogue or boutique items — it has never let a user photograph and catalogue her own wardrobe, the single defining feature of the entire digital-wardrobe app category (Whering, Acloset, Cladwell, Stylebook, Indyx). My Wardrobe closes that gap by extending the same generative try-on engine to the user's own photographed clothing, then layering AI outfit generation, weather- and calendar-aware daily suggestions, packing lists, and cost-per-wear analytics on top — the exact feature set that makes those competitor apps worth paying for.

Feature ID
Requirement
Priority
Notes
STU-F-04a
Catalogue owned clothing items by photographing each piece; auto-suggest category and colour tags via AI image analysis, with the user able to correct any tag.
Must
Photo capture reuses Mirror's existing image pipeline; tagging model is new
STU-F-04b
Generate outfit combinations from the user's own catalogued wardrobe using the same generative Apparel VTO engine already integrated for MIR-F-05, applied against the user's own body photo rather than a catalogue model shot.
Must
Direct reuse of existing YouCam Apparel VTO integration — new data source, not new API integration
STU-F-04c
Daily outfit suggestion factoring in local weather and, where the user opts in, calendar event type (e.g. ‘client meeting’ vs ‘gym’).
Should
Weather via existing SheMatch/Marketplace location context; calendar integration is opt-in and separately consented
STU-F-04d
Packing-list generator: select a trip length and destination climate, receive a suggested capsule pulled from the user's own wardrobe.
Should
—
STU-F-04e
Cataloguing works fully offline (photo capture and local storage); AI tagging and outfit generation sync when connectivity returns.
Must
Consistent with the offline-first principle already established for health logging (INF-F-01)
STU-F-04f
Wardrobe data is private by default and never surfaced to Community (COM epic) or any other user without explicit, separate sharing action.
Must
Same explicit-share default as Health Wallet and Makeup Studio saved looks


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-08
Wardrobe cataloguing for a 50-item closet must complete without the user perceiving cumulative lag — each item photograph-to-tagged cycle target under 5 seconds at P95, batchable so a user can photograph several items before waiting on tagging.
Must
Performance testing
NFR-STU-09
Outfit-generation try-on reuses MIR-F-05's existing 15-second generation budget — no separate, slower code path for wardrobe-sourced garments versus catalogue garments.
Must
Performance parity



MIRROR STUDIO · 05
Accessories Studio
Jewellery, watches, eyewear, and nails — the rest of the self-image no competitor's wardrobe app touches


Neither the beauty-app category nor the wardrobe-app category covers jewellery, watch, eyewear, or nail try-on — it is a genuine white space between the two categories that YouCam's API suite already supports natively. Accessories Studio extends Mirror's existing Style Confidence Boutique Bridge pattern (MIR-F-06) to these new categories, so a jeweller, optician, or nail salon on the Marketplace becomes as try-on-enabled as a clothing boutique already is.

Feature ID
Requirement
Priority
Notes
STU-F-05a
AR try-on for rings, bracelets, watches, earrings, and necklaces via YouCam's 3D Viewer/Authoring and per-category AR try-on APIs.
Should
Requires 3D-authored retailer assets — a genuine Business Portal onboarding dependency, not a pure-software feature
STU-F-05b
AI-powered virtual try-on for eyeglasses and sunglasses, sourced from optician listings on the Marketplace.
Should
YouCam API, direct integration
STU-F-05c
Virtual nail-colour try-on from a hand photo, with a ‘find a nail salon near you’ SheMatch bridge for in-person application.
Could
Lower build complexity than jewellery/eyewear; sequenced after them only because 3D-asset dependencies for those two categories take longer to resolve with retail partners


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-10
Jewellery and watch try-on quality is gated on retailer-supplied 3D assets meeting Perfect Corp.'s documented authoring standard; GirlCode360 does not attempt to auto-generate 3D assets from 2D product photos, which would degrade visible quality below the category's bar.
Must
Sets a clear, honest scope boundary rather than shipping a degraded 3D experience



MIRROR STUDIO · 06
AI Stylist
Alena, extended — not a second assistant


Perfect Corp.'s own YouCam API platform includes a conversational ‘Ask AI’ / Perfect Beauty Agent layer. GirlCode360 deliberately does not adopt it. Alena already exists, is already context-aware, and is already the product's trusted conversational surface — introducing a second, YouCam-native assistant would fragment the user's relationship with the product and violate the reuse-over-duplication principle that governs every other decision in this document. AI Stylist is instead a new context source feeding the existing Alena architecture (ALN-F-01/F-02), exactly as HealthLens and Mirror's correlation layer already do.

Feature ID
Requirement
Priority
Notes
STU-F-06a
Extend Alena's context-construction step (ALN-F-02) to optionally include: the user's My Wardrobe catalogue, most recent Mirror skin/hair scores, Shade Match history, current weather, and — where active — pregnancy trimester or PMOS body-confidence mode.
Must
Same pseudonymised-summary pattern already used for health context; no new AI provider, no new API
STU-F-06b
‘What should I wear today’ queries return an outfit assembled from the user's own wardrobe (never a shopping suggestion first) factoring weather and, where available, calendar context.
Must
Directly reuses STU-F-04's outfit-generation output
STU-F-06c
Styling responses can propose a complementary makeup look via Makeup Studio (STU-F-01) when the user's query implies an occasion (‘date night’, ‘job interview’).
Should
Cross-feature reasoning is the differentiator; not a hard requirement for MVP
STU-F-06d
AI Stylist queries count against the same Alena daily quota and premium gating already defined in ALN-F-05 — no separate quota system.
Must
Reuse, not duplication, of monetisation infrastructure



MIRROR STUDIO · 07
Style Analytics & Confidence Score
Cost-per-wear, wardrobe utilisation, and skin/hair trend — in one dashboard, built from data GirlCode360 already has


Cost-per-wear and wardrobe-utilisation analytics are the standout differentiator in the competitor research (the wardrobe app Indyx is best known specifically for this). Style Analytics extends Mirror's existing Skin Progress Timeline pattern (MIR-F-03) to cover wardrobe utilisation, shade-match history, and hair-score trend in one place — and because every underlying data point already exists from features above, this is a computation-and-presentation layer, not a new data-collection category.

Feature ID
Requirement
Priority
Notes
STU-F-07a
Cost-per-wear calculation per wardrobe item (purchase price ÷ times worn, where the user optionally logs price at cataloguing time).
Should
Purchase price is optional input — the feature degrades gracefully without it, showing wear-count only
STU-F-07b
Wardrobe utilisation percentage: proportion of catalogued items worn (per logged outfit selections) in the last 90 days.
Should
—
STU-F-07c
Combined skin, hair, and shade-match trend view extending MIR-F-03's existing before/after comparison pattern.
Must
No new UI pattern — same timeline component, additional data series


Non-functional requirements
NFR ID
Requirement
Priority
Notes
NFR-STU-11
Style Analytics is computed entirely from data the user has already separately consented to (Mirror scans, Wardrobe catalogue, Shade Match history) — it introduces no new consent category, and this must remain true as new metrics are added.
Must
Architecture constraint, testable at each future addition to this feature



MIRROR STUDIO · 08
Wardrobe Resale Bridge
List what you no longer wear — through the Marketplace you already trust


Acloset's built-in secondhand marketplace, and Whering's sustainability/impact framing more broadly, point at a real and growing user expectation in this category: a wardrobe tool that helps a user buy less, not just buy more. The Resale Bridge lets a user list a catalogued My Wardrobe item for resale directly through the existing Marketplace and Business Portal infrastructure (MKT epic) — as a new listing type, not a second marketplace — with buyer-seller messaging and moderation reusing the content-moderation queue already built for Community (COM-F-04).

Feature ID
Requirement
Priority
Notes
STU-F-08a
List a My Wardrobe item for resale with one tap from its catalogue entry, pre-filled with the photo and tags already captured.
Should
Reuses STU-F-04's existing photo/tag data — no separate resale-listing photography flow
STU-F-08b
Peer-to-peer buyer-seller messaging through the existing Marketplace messaging surface; resale listing photos and descriptions pass through the existing content-moderation queue before going live.
Should
Reuses COM-F-04's moderation infrastructure directly
STU-F-08c
Resale listings are clearly labelled as peer-to-peer (‘from a GirlCode360 member’), visually distinct from business/boutique listings, so users are never confused about who they are buying from.
Must
Trust and transparency parity with SheMatch's existing ‘Sponsored’ labelling discipline (SM-F-04)



6.12 Monetisation & Competitive Positioning — Making This Genuinely Buyable
The brief for this tier was explicit: build something people see enough value in to pay for, long-term — not only something that wins a hackathon. Two real monetisation vectors follow directly from the competitive research, and neither requires inventing new billing infrastructure.

Vector 1 — Consumer Premium
Dedicated wardrobe apps charge $5–10/month or ~$40–60/year for a single capability (digital closet, or capsule planning, or sustainability tracking — rarely more than one well). Mirror Studio bundles all eight features above into GirlCode360's existing Premium tier (the same gate already defined for Alena's unlimited quota, ALN-F-05) — meaning a single subscription buys health AI, skin/hair diagnostics, makeup and wardrobe styling, and shade-matched shopping, at a price competitive with any one dedicated competitor app alone.
Vector 2 — Retailer / Business
Extends the existing Featured & Sponsored Listings mechanism (MKT-F-07) rather than inventing new ad infrastructure: retailers pay for ‘Verified Shade Match’ or ‘Try-On Ready’ placement — prioritised inclusion in Shade Match Engine and Accessories Studio results, contingent on supplying accurate shade inventory or 3D-authored assets through the Business Portal. This mirrors the exact mechanic virtual try-on vendors already use to monetise enterprise retail partnerships, applied here to GirlCode360's own local, multi-brand Marketplace rather than a single retailer's own site.




6.13 Global by Design, Not Restricted by Market
Every feature in this tier, and every feature in the wider GirlCode360 product, is specified without a hardcoded market list. The product's early documentation referenced the UK, Nigeria, and Ghana as illustrative initial launch markets — useful for grounding concrete examples (an NHS reference, a Paystack integration, an NDPA compliance note) — but the underlying architecture was never built to require exactly three markets, and this tier makes that explicit rather than implicit.

What Changes in Practice
Jurisdiction detection and consent routing (UOB-F-04) already operate on a per-user detected-jurisdiction
basis, not a fixed enum of three countries — adding a new market is a configuration and legal-review
exercise, not a re-architecture.


Mirror Studio's retailer-facing features (Shade Match Engine, Accessories Studio, Resale Bridge) work
identically in any market with Business Portal-onboarded retailers — nothing in this tier assumes UK,
Nigerian, or Ghanaian retail specifically.


Going forward, product and engineering documentation should describe UK/Nigeria/Ghana as GirlCode360's
initial launch markets, not as the boundary of the product's ambition. New-market expansion is a Tier 3
scale decision (see the Master Technical Implementation Plan §Phase 3.2), evaluated on demand and
compliance readiness — not blocked by anything built in this tier or earlier.



6.14 Phased Build Plan
Date
Milestone
Deliverable
Phase P3.1
Foundations
`youcam-gateway` extended to cover Makeup, Hair, and Shade Finder API families; new consent event for live-camera access (NFR-STU-03); Fitzpatrick-range validation harness stood up before any feature ships on top of it.
Phase P3.2
Makeup Studio + Shade Match Engine
STU-F-01 and STU-F-02 — sequenced first because they close the single largest competitive gap (no makeup try-on today) and share the shade/skin-tone validation work.
Phase P3.3
Hair Studio
STU-F-03, including the PMOS hair-symptom correlation — sequenced after Makeup/Shade because it reuses the same clinical-review and correlation-guardrail process, now already proven once.
Phase P3.4
My Wardrobe
STU-F-04 — the largest single build in this tier; sequenced once the team's generative-VTO integration muscle is warm from P3.2/P3.3, since it reuses that same YouCam Apparel VTO integration against a new data source.
Phase P3.5
AI Stylist + Style Analytics
STU-F-06 and STU-F-07 — both depend on My Wardrobe (P3.4) existing first, since neither has anything meaningful to reason over or measure without it.
Phase P3.6
Accessories Studio + Resale Bridge
STU-F-05 and STU-F-08 — sequenced last because both carry external dependencies outside GirlCode360's own build (3D retailer assets; resale listing volume) rather than pure internal engineering risk.




GirlCode360 — Mirror Feature Specification v2.0  |  §6 Pre-Tier 3: Mirror Studio  |  Confidential  |  14 August 2026
