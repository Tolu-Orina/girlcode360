
GirlCode360
Product Requirements Document
Functional & Non-Functional Requirements
Version 1.0  •  UK • Nigeria • Ghana  •  June 2026
Document Control
Version: 1.0  |  Status: Draft for Internal Review
Owner: Product Manager / Founder
Reviewers: Lead Engineer, Clinical Advisor, Legal Counsel, UX Designer
Last Updated: June 2026  |  Next Review: September 2026
Distribution: Internal only — Confidential



1. Introduction & Purpose
This Product Requirements Document (PRD) defines the functional and non-functional requirements for GirlCode360, an all-inclusive women’s beauty and wellness platform targeting users in the United Kingdom, Nigeria, and Ghana.
The purpose of this document is to provide a single source of truth for the product team, engineering team, clinical advisors, and legal counsel. It defines what the product must do (functional requirements), how it must perform and comply (non-functional requirements), and the regulatory obligations applicable in each target jurisdiction.

1.1  Scope
This PRD covers GirlCode360 v1.0 and v1.1 — the features slated for the 6-month roadmap (July–December 2026).
It encompasses iOS and Android mobile applications, a web-based business portal (marketplace), and the backend API and infrastructure.
It does not cover telemedicine integration, wearable device APIs, or white-label B2B products (planned for 2027).

1.2  Definitions & Conventions
FR-ID
Requirement Description
Priority
Market Notes / Localisation
TERM
Definition




FR-XXX
Functional Requirement with unique identifier




NFR-XXX
Non-Functional Requirement with unique identifier




Must
MoSCoW: Core requirement — product cannot ship without it




Should
MoSCoW: High value, planned for v1.0 but not blocking




Could
MoSCoW: Desirable, may be deferred to v1.1 or v2




UK
United Kingdom market context




NG
Nigeria market context




GH
Ghana market context




SaMD
Software as a Medical Device (MHRA classification)




DPCO
Data Protection Compliance Organisation (Nigeria)







2. Product Overview
2.1  Product Vision
Vision Statement
GirlCode360 is the first platform that unites a woman’s complete health journey and beauty life in one trusted, culturally
relevant app — from her first period to trying to conceive, through pregnancy, and every salon visit, pharmacy
trip, and clinic appointment in between.


2.2  User Personas
Persona 1: Zara (UK, 24, Black Caribbean heritage)
Uses 3 apps for period tracking, mood logging, and GP appointment booking
Has suspected PCOS but struggles to get taken seriously at her NHS GP surgery
Wants a culturally competent, privacy-first app that understands Black women’s health
Shops at Afrocentric beauty stores in London; wants to discover new ones easily

Persona 2: Chiamaka (Nigeria, 31, Lagos)
Married, actively trying to conceive for 8 months
Uses Flo for period tracking but finds it generic and not Nigeria-relevant
Books hair and beauty appointments manually via WhatsApp; wants a faster discovery tool
Privacy-conscious: concerned about health data being sold to advertisers

Persona 3: Abena (Ghana, 27, Accra)
Pregnant, 14 weeks. First pregnancy. Anxious about finding a reliable OB/GYN
Active smartphone user; uses Bolt, Jumia, and social commerce daily
Wants a local marketplace to find verified healthcare providers and beauty services near her
Needs app to work well on 3G/4G connections with intermittent coverage


3. Functional Requirements
Requirements are organised by module. Each requirement has a unique ID, priority level (Must/Should/Could), and market-specific notes where applicable.
3.1  Module: Onboarding & User Registration
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-001
User must be able to create an account using email address with email verification
Must
UK/NG/GH: All markets. Email must be verified before health data entry.
FR-002
User must be able to create an account using a mobile phone number (SMS OTP)
Must
NG/GH: Phone-first behaviour. UK: optional. OTP via Twilio or Africa’s Talking.
FR-003
System must enforce a minimum age gate of 18 years. Users confirming under 18 must be blocked.
Must
UK: GDPR child consent rules. NG/GH: NDPA/DPA prohibit health data from minors without consent.
FR-004
User must be shown a granular consent screen covering: health data processing, location data (optional), analytics (optional), marketing (optional). Each toggle independent.
Must
UK: UK GDPR Art.7 explicit consent. NG: NDPA s.25. GH: DPA s.20. No pre-ticked boxes.
FR-005
System must detect user’s jurisdiction on first launch and route to the appropriate consent flow (UK GDPR vs NDPA vs Ghana DPA).
Must
Auto-detect via IP + device locale. Allow manual override. Consent version stored server-side.
FR-006
User must be able to select which health module(s) to activate on first use (Period, PCOS, Pregnancy, TTC, Wallet) and can change selection later.
Must
Reduces friction. Users who choose only Period Tracker should not see PCOS content unprompted.
FR-007
User must be able to complete onboarding with a social login (Google, Apple) as an alternative to email/phone.
Should
UK: Apple login required for iOS App Store compliance. NG/GH: Google more prevalent.
FR-008
User must complete onboarding within 5 screens maximum.
Must
Benchmark: Flo onboarding converts at 78% with 5-step flow. Each extra screen loses ~12%.
FR-009
User must be able to skip optional personalisation questions (e.g. average cycle length) and return to complete later.
Should
Reduces drop-off for users who don’t know their cycle details.
FR-010
User must receive a welcome notification with a summary of what the app does and a clear link to the full privacy policy.
Must
UK GDPR requires privacy notice at point of collection. NG/GH equivalent.


3.2  Module: Period Tracker
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-011
User must be able to log period start date, end date, and daily flow intensity (light, medium, heavy, spotting).
Must
Core feature. Must support retroactive logging for past cycles.
FR-012
System must predict the next 3 menstrual cycle dates based on logged history using a validated algorithm. Minimum 2 logged cycles required before prediction activates.
Must
Algorithm must NOT claim diagnostic accuracy. Framed as ‘predicted’ not ‘confirmed’. Clinical advisor must review.
FR-013
User must be able to log daily symptoms from a curated symptom library (minimum 30 symptoms) including: cramps, bloating, headache, acne, breast tenderness, fatigue, mood changes.
Must
Symptom library to be clinically reviewed. Symptoms directly inform PCOS Manager cross-module insights.
FR-014
User must be able to log daily mood from a standardised mood scale (minimum 5 levels + emoji).
Must
NG/GH: Culturally appropriate emoji selection. No mood emoji should be culturally ambiguous.
FR-015
System must display a visual calendar view showing: logged periods (colour), predicted periods (lighter colour), fertile window (if TTC activated), and ovulation estimate.
Must
Calendar must be scrollable 6 months back and 6 months forward.
FR-016
User must be able to add free-text notes to any logged day.
Should
Supports qualitative health journaling. Notes must be encrypted.
FR-017
System must generate a monthly cycle summary view: average cycle length, average period length, most common symptoms, mood pattern.
Should
Shown at end of each cycle. Exportable as PDF for GP appointments. UK: useful for NHS consultations.
FR-018
System must display a clear disclaimer on all predictive outputs: ‘This is a wellness estimate, not medical advice. Consult a healthcare provider for diagnosis.’
Must
Required to avoid SaMD classification (MHRA). Non-negotiable on all outputs.
FR-019
User must be able to set a period reminder notification (configurable: 1 day, 2 days, or 3 days before predicted start).
Should
NG/GH: Notification timing sensitive; respect device quiet hours.
FR-020
System must allow user to manually correct predicted dates if cycle is irregular.
Must
Irregular cycles are common in PCOS users. Manual override essential.


3.3  Module: PCOS Manager
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-021
User must be able to enable PCOS Manager as an add-on to the Period Tracker, accessing PCOS-specific insights from their logged cycle and symptom data.
Must
PCOS Manager is not standalone. It draws on Period Tracker data to generate PCOS-specific patterns.
FR-022
System must display a PCOS symptom diary with an expanded symptom set (minimum 50 symptoms) including: irregular cycles, acne, hair thinning, weight changes, hirsutism, mood swings, pelvic pain.
Must
Symptom list must be reviewed by clinical advisor. All descriptions in plain language.
FR-023
System must allow user to log daily PCOS-specific biometrics: weight (optional), hours of sleep, water intake, stress level (1–5 scale).
Should
Optional logging — must not feel like a burden. Progressive disclosure UI.
FR-024
System must generate a monthly PCOS insight summary highlighting: symptom frequency trends, cycle irregularity patterns, possible trigger correlations (e.g. high stress + late period).
Should
All insights presented as ‘possible patterns’, not diagnoses. Clinical disclaimer on every screen.
FR-025
System must provide a medication and supplement reminder system: user can add custom reminders (name, dosage, time, frequency).
Must
UK: common meds include Metformin, inositol, Letrozole. NG/GH: include common local supplements.
FR-026
User must be able to generate a PCOS Health Report (PDF) summarising 3 months of logged data, formatted for sharing with a doctor.
Should
UK: formatted to be useful in NHS appointments. NG/GH: formatted for private clinic visits.
FR-027
System must provide a curated PCOS educational content library: what is PCOS, treatment pathways, diet, fertility implications. Content clinically reviewed.
Must
UK: Link to NHS resources where available. NG: Localise for Nigerian healthcare context. GH: Localise for Ghanaian context.
FR-028
System must NOT use the word ‘diagnose’ or imply diagnostic capability anywhere in the PCOS module. All outputs are ‘wellness insights’.
Must
Critical to avoid SaMD classification. Legal and clinical review mandatory before any copy ships.


3.4  Module: Pregnancy Management
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-029
User must be able to enter their Last Menstrual Period (LMP) or conception date to initialise the Pregnancy module. System calculates estimated due date (EDD).
Must
EDD calculated using Naegele’s rule. Display as a range (±1 week) not a single date.
FR-030
System must provide week-by-week pregnancy content: baby development, maternal body changes, nutrition guidance, common symptoms. Minimum content coverage: Weeks 4–42.
Must
All content clinically reviewed. UK: reference NHS guidelines. NG: reference Nigerian Federal Ministry of Health antenatal guidelines. GH: GHS antenatal guidance.
FR-031
User must be able to log pregnancy symptoms and wellbeing daily (nausea severity, fatigue, movement felt from week 20+, mood, sleep).
Must
Data stored encrypted. Daily logs inform weekly summary.
FR-032
User must be able to add and track antenatal appointments with date, time, location, type (scan, blood test, GP visit), and notes.
Must
UK: integrate NHS appointment terminology. NG/GH: Private clinic and government hospital terminology.
FR-033
System must send appointment reminders (configurable: 1 day and 1 hour before) and weekly pregnancy milestone notifications.
Must
User can opt out of any notification type independently.
FR-034
System must display a pregnancy weight gain tracker with WHO-recommended ranges displayed as a guide, not a prescription.
Should
Disclaimer required: ‘Consult your midwife or doctor for personalised guidance on pregnancy weight.’
FR-035
System must provide a kick counter tool (from week 24) to log foetal movement sessions.
Should
Displayed with guidance on when to seek medical advice (not diagnostic, informational only).
FR-036
System must provide an emergency contact shortcut on the Pregnancy module home screen: single tap to call user’s designated emergency contact or local emergency number.
Must
UK: 999/111 displayed. NG: 112 and user’s listed hospital. GH: 999 and nearest hospital from marketplace.
FR-037
Pregnancy module must transition to a Postpartum module at week 40+, offering postnatal recovery content.
Could
v1.1 scope. Postpartum mental health content flagged as priority for v1.1.


3.5  Module: Trying to Conceive (TTC)
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-038
User must be able to activate TTC mode, which overlays fertile window and ovulation estimates on the Period Tracker calendar.
Must
TTC mode requires at least 2 logged cycles to generate estimates. Clearly labelled as estimates.
FR-039
System must calculate and display a 5-day fertile window estimate and peak ovulation day based on cycle history.
Must
Algorithm based on standard LH surge + cycle-length modelling. Clinical review mandatory. Disclaimer on all outputs.
FR-040
User must be able to log Basal Body Temperature (BBT) daily and view a BBT chart showing temperature rise pattern across cycle.
Should
Optional for users who take BBT. Chart display must be clear and not require medical literacy to interpret.
FR-041
User must be able to log cervical mucus observations (dry, sticky, creamy, watery, egg-white) as a secondary fertility indicator.
Should
Optional logging. Descriptions in plain, non-clinical language. Educational tooltip for each type.
FR-042
User must be able to log intercourse for TTC tracking purposes. This data must be stored with the highest encryption level and never visible to third parties.
Should
Explicit user consent required specifically for this data type. User can delete all intercourse logs at any time.
FR-043
System must display a TTC timeline view showing: current cycle day, last period, fertile window, next predicted period.
Must
Clean, reassuring UI. Avoid anxiety-inducing language. Design review by clinical advisor.
FR-044
System must provide TTC educational content: how to optimise conception chances, when to seek fertility advice, lifestyle factors. All content clinically reviewed.
Must
UK: Reference NICE fertility guidelines. NG/GH: Reference local reproductive health guidance.
FR-045
System must display a ‘Month counter’ for TTC journey, showing how long user has been trying. System must surface a ‘Seek medical advice’ prompt (non-alarming) after 12 months of TTC logging.
Should
Language must be compassionate and non-judgmental. Clinical advisor reviews all TTC prompts.


3.6  Module: Health Wallet
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-046
User must be able to upload health documents to a secure in-app vault. Supported file types: PDF, JPG, PNG. Maximum file size: 25MB per document.
Must
Documents stored client-side encrypted before upload. Server never holds plaintext documents.
FR-047
User must be able to categorise documents: Test Results, Prescriptions, Scan Images, Vaccination Records, Insurance Documents, Other.
Must
Category list reviewable by clinical advisor. Custom category option available.
FR-048
User must be able to view uploaded documents in-app without requiring an external app or browser.
Must
In-app PDF viewer and image viewer. No document cached to device’s unencrypted file system.
FR-049
User must be able to generate a time-limited shareable link (24h, 48h, 7-day expiry) for individual documents to share with a healthcare provider.
Must
Link is encrypted. Recipient accesses via browser. Link expires automatically. User can revoke at any time.
FR-050
User must be able to permanently delete any document from the vault. Deletion must remove all copies including server-side backups within 30 days.
Must
UK GDPR Art.17 right to erasure. NG NDPA s.34 deletion rights. GH DPA s.39. Confirmation modal required.
FR-051
User must be able to add free-text notes to any document (e.g. ‘Results from Dr. Okafor visit March 2026’).
Should
Notes encrypted and stored with the document metadata.
FR-052
System must allow user to set medication reminders stored in the Health Wallet context (drug name, dose, frequency, time). Separate from PCOS Manager reminders.
Should
Useful for users not using PCOS module but on medication. Reminder data stays local/encrypted.
FR-053
User must be able to export all Health Wallet data as an encrypted zip file (for backup or migration).
Should
GDPR Art.20 data portability. NG/GH equivalent. Export requires biometric/PIN re-authentication.


3.7  Module: Location-Based Marketplace
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-054
User must be able to browse marketplace listings sorted by proximity to their current location (GPS-based). Location permission is optional; users can also enter a postcode/area manually.
Must
Privacy: location data never stored server-side for non-consenting users. Session-only location use.
FR-055
Marketplace must display four business categories: Beauty Stores, Boutiques & Salons, Pharmacies, Clinics & Hospitals.
Must
Category icons must be clear and accessible (WCAG 2.1 AA compliant).
FR-056
Each listing must display: business name, category, distance from user, rating (1–5 stars), opening hours, address, phone number, and a ‘Directions’ button (opens native maps app).
Must
Opening hours must show OPEN/CLOSED status in real time based on device clock.
FR-057
User must be able to filter listings by: category, distance radius (0.5km, 1km, 2km, 5km, any), minimum star rating, and opening now.
Must
Filter state persists within session. Reset filter option available.
FR-058
User must be able to search marketplace listings by business name or product/service type.
Must
Search must be instant (< 500ms response). Fuzzy matching for common misspellings.
FR-059
User must be able to submit a business review (1–5 stars + text, minimum 20 characters) for any visited listing.
Should
Reviews moderated before display. Profanity filter applied. Report a review option available.
FR-060
Business owners must be able to register their business via a web portal (separate from user app): submit business name, category, location, hours, contact, photos. Listings go live after moderation.
Must
Business portal: responsive web app. Moderation queue for admin team. Listing approval within 48 hours SLA.
FR-061
System must allow featured/sponsored listings (paid tier) to appear at the top of category results with a clear ‘Sponsored’ label.
Should
Ad-labelling mandatory (UK ASA/CMA guidelines, NG APCON standards). No misleading placement.
FR-062
System must surface contextually relevant marketplace results based on health module context. Example: if user is in a PCOS medication reminder, nearby pharmacies surfaced.
Could
Requires explicit user opt-in for health-context-to-marketplace linking. Consent recorded separately.
FR-063
User must be able to save listings to a personal Favourites list within the marketplace.
Should
Favourites stored server-side (encrypted). Synced across devices.
FR-064
Marketplace listings must be moderated before going live: business must provide verifiable address, phone number, and category. Health/pharmacy listings require additional verification (registration number).
Must
Pharmacies and clinics require NAFDAC/PCN (Nigeria), Ghana FDA / GHS (Ghana), GPhC / CQC (UK) registration confirmation.


3.8  Module: Notifications & Reminders
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-065
System must deliver push notifications for: period reminders, ovulation window alerts, appointment reminders, medication reminders, and weekly health insights.
Must
Each notification type independently togglable. Master notification off switch available.
FR-066
User must be able to set a daily quiet hours window during which no notifications are delivered.
Must
Default quiet hours: 22:00–07:00 local time. User can customise.
FR-067
System must send in-app notifications (not push) for: new marketplace listings in user’s area, promotional offers from business partners (only if user has opted into marketing).
Should
Marketing notifications require separate opt-in distinct from health notifications.
FR-068
System must never send a push notification that reveals health information on the device lock screen. Notification body must be generic (e.g. ‘You have a note in GirlCode360’).
Must
Health data privacy on lock screen: critical for users who share devices or have nosy partners. No health content visible without app open.


3.9  Module: Community & Peer Support
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-069
System must provide opt-in peer support groups organised by health journey: TTC Circle, PCOS Warriors, Pregnancy Journey, Period Health.
Should
Groups are moderated. User can join/leave at any time. Anonymised display name used.
FR-070
Users must be able to post text updates in community groups. No photo/video sharing in v1.0 (reduces moderation burden).
Should
Post limit: 500 characters. No links permitted. Profanity filter. Moderator review queue.
FR-071
System must provide a curated educational article library organised by health topic, reviewed and dated by a clinical advisor.
Must
Articles must include ‘Last clinically reviewed’ date. Outdated articles (>24 months) flagged for review.
FR-072
Community module must include a Report Content function visible on every post. Reports go to moderation queue with <24-hour SLA.
Must
Safeguarding requirement. Moderators trained on sensitive health content.


3.10  Module: Account & Privacy Settings
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-073
User must be able to view all personal data held by GirlCode360 via a ‘My Data’ screen. Data displayed in a human-readable format.
Must
UK GDPR Art.15 right of access. NG NDPA. GH DPA. Request fulfilled in-app — no need to email support.
FR-074
User must be able to delete their entire account and all associated data from the app. Deletion is permanent and irreversible. Confirmation modal with 24-hour cooling-off window required.
Must
UK GDPR Art.17. NG NDPA. GH DPA. Deletion includes: all health logs, documents, marketplace favourites, community posts.
FR-075
User must be able to export all their data as a machine-readable file (JSON) from the account settings.
Must
UK GDPR Art.20 data portability. NG/GH equivalent provisions.
FR-076
User must be able to update their email, phone number, display name, and profile picture without contacting support.
Must
Phone/email change requires re-verification of new contact point.
FR-077
User must be able to enable biometric authentication (fingerprint/Face ID) as an additional security layer for opening the app and for sensitive actions (document share, data export).
Must
iOS: Face ID / Touch ID. Android: Biometric Prompt API. Falls back to device PIN.
FR-078
User must be able to change or reset their password at any time. Password reset via email OTP only (not security questions).
Must
OWASP password policy: minimum 8 characters, 1 uppercase, 1 lowercase, 1 number.



3.11  Module: Mirror Studio — Beauty & Fashion (Pre-Tier 3)
Mirror Studio extends the Mirror epic (§3.x does not separately list Mirror’s original 8 features, which are specified in full in GirlCode360_Mirror_Feature_Spec.docx §3; this section covers only the Pre-Tier 3 beauty-and-fashion expansion) with eight further modules, each grounded in a specific competitor gap identified in market research and mapped to a specific Perfect Corp. YouCam API category GirlCode360 does not yet use. Full competitive grounding, non-functional requirements, and phased build sequencing are in GirlCode360_Mirror_Feature_Spec.docx §6 and GirlCode360_PreTier3_Implementation_Plan.md; this section states the functional requirements at the same level of explicit detail as every other module in this PRD.

3.11.1  Makeup Studio
Real-time AR and photo-mode makeup try-on across the 7 categories every mainstream beauty app leads with, plus a look-transfer mode from a reference image. GirlCode360 currently ships zero makeup try-on — this closes the single largest feature gap identified against Sephora Virtual Artist, Ulta GLAMlab, and YouCam Makeup.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-112
System must provide live-camera AR makeup try-on across 7 categories — lip colour, eyeshadow, blush, foundation, eyebrow, eyeliner, eyelash — using YouCam’s AgileFace real-time tracking for jitter-free application in motion. Camera access requires its own explicit consent event, separate from Mirror’s existing photo-capture consent.
Must
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-113
System must provide photo-mode makeup try-on applied to a saved Mirror skin scan, giving full functionality to users who decline live-camera consent or lack camera access.
Must
Accessibility parity requirement, applies in all markets
FR-114
System must support a ‘Get this look’ mode: user uploads a reference image and the system approximates the look on the user’s own face via AI Makeup Transfer.
Should
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-115
System must let the user save a completed look to Style Analytics history, private by default, shared only on explicit user action.
Must
Same explicit-share default as Health Wallet
FR-116
Every completed foundation/concealer look must surface a ‘Shop this shade’ action routed through the Shade Match Engine and SheMatch, not a generic outbound retailer link.
Should
Requires SheMatch-linked retailer inventory in the user’s market or shippable region


3.11.2  Shade Match Engine
Cross-brand foundation and concealer shade matching from an existing Mirror scan, validated across the full Fitzpatrick skin-tone range — addressing the single largest driver of online beauty-purchase returns and hesitation.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-117
System must generate a shade match (foundation and concealer) from the user’s existing Mirror skin scan where one exists from the last 30 days, without requiring a duplicate capture.
Must
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-118
System must return a cross-brand ‘shade twin’ list: the closest matching shade code at each brand stocked by a SheMatch-linked retailer within the user’s search radius or shippable to their region.
Must
Extends the existing SheMatch trigger table (no new marketplace engine)
FR-119
System must flag shade-match confidence as Lower for any lighting/skin-tone combination where YouCam’s documented accuracy is reduced, using the same Low/Medium/High confidence pattern already established for HealthLens.
Must
Equity requirement — tested across Fitzpatrick I–VI before any market launch, not assumed


3.11.3  Hair Studio
Hair colour and style try-on plus a quantified diagnostic (type, length, frizziness, density), correlated against hair-thinning and hirsutism symptoms already logged in the PCOS/PMOS Manager — the clearest cross-module differentiator in this tier.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-120
System must provide a hair diagnostic scan returning quantified type, length, frizziness, and density scores via YouCam’s AI Hair Analysis suite.
Must
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-121
System must cross-reference hair density/frizziness trend against logged PCOS/PMOS hair-thinning and hirsutism symptom entries, applying the same correlation guardrails as MIR-F-02 (minimum 2 scans across different time points; explicit ‘no clear pattern yet’ when data does not support one).
Must
Reuses the existing HealthLens correlation engine — no second correlation system
FR-122
System must provide virtual hair colour try-on and hairstyle try-on from a single face photo.
Must
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-123
Hair-density trend must feed into the next HealthLens Monthly Health Intelligence Report as an additional pattern category, with the same non-diagnostic disclaimer treatment as every other HealthLens pattern.
Should
Extends the existing report structure — no new report type


3.11.4  My Wardrobe
A real digital closet: catalogue owned clothing, generate outfit combinations from what the user actually owns, and plan by weather, calendar, or trip — closing the largest functional gap identified against the digital-wardrobe app category (Whering, Acloset, Cladwell, Indyx).
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-124
System must let the user catalogue owned clothing items by photographing each piece, with AI-suggested category and colour tags the user can correct.
Must
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-125
System must generate outfit combinations from the user’s own catalogued wardrobe using the same generative Apparel VTO engine already integrated for Mirror’s boutique try-on, applied to the user’s own body photo.
Must
Direct reuse of the existing YouCam Apparel VTO integration
FR-126
System must provide a daily outfit suggestion factoring local weather and, where the user opts in, calendar event type.
Should
Calendar integration is a separate, explicit consent event
FR-127
System must provide a packing-list generator: given a trip length and destination climate, suggest a capsule pulled from the user’s own wardrobe.
Should
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-128
Wardrobe cataloguing must work fully offline (photo capture and local storage); AI tagging and outfit generation sync when connectivity returns.
Must
Consistent with the existing offline-first health-logging principle
FR-129
Wardrobe data must be private by default and never surfaced to Community or any other user without explicit, separate sharing action.
Must
Same explicit-share default as Health Wallet and Makeup Studio saved looks


3.11.5  Accessories Studio
AR try-on for jewellery, watches, eyewear, and nails — a category neither the beauty-app nor the wardrobe-app competitor set covers, bridged to Marketplace jewellers, opticians, and nail salons.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-130
System should provide AR try-on for rings, bracelets, watches, earrings, and necklaces via YouCam’s 3D Viewer/Authoring and per-category AR try-on APIs.
Should
Requires retailer-supplied 3D-authored assets via the Business Portal — a genuine onboarding dependency
FR-131
System should provide AI-powered virtual try-on for eyeglasses and sunglasses, sourced from optician listings on the Marketplace.
Should
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-132
System could provide virtual nail-colour try-on from a hand photo, with a ‘find a nail salon near you’ SheMatch bridge for in-person application.
Could
Sequenced after jewellery/eyewear due to lower relative build complexity, not lower value
FR-133
Jewellery and watch try-on quality must be gated on retailer-supplied assets meeting Perfect Corp.’s documented 3D-authoring standard; the system must not attempt to auto-generate 3D assets from 2D product photos.
Must
Explicit scope boundary to avoid a degraded try-on experience


3.11.6  AI Stylist
An extension of Alena’s existing conversational architecture — not a second assistant — that reasons over the user’s wardrobe, Mirror scores, shade history, weather, and life stage to answer styling questions.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-134
System must extend Alena’s existing context-construction step to optionally include: the user’s My Wardrobe catalogue, most recent Mirror skin/hair scores, Shade Match history, current weather, and — where active — pregnancy trimester or PCOS/PMOS body-confidence mode.
Must
Same pseudonymised-summary pattern as existing Alena health context; no new AI provider
FR-135
‘What should I wear today’ queries must return an outfit assembled from the user’s own wardrobe, never a shopping suggestion first, factoring weather and available calendar context.
Must
Directly reuses My Wardrobe’s outfit-generation output
FR-136
Styling responses should be able to propose a complementary makeup look via Makeup Studio when the query implies an occasion.
Should
Cross-feature reasoning; not required for initial release
FR-137
AI Stylist queries must count against the same Alena daily quota and Premium gating already defined for Alena — no separate quota system.
Must
Reuse of existing monetisation infrastructure, not duplication


3.11.7  Style Analytics & Confidence Score
Cost-per-wear, wardrobe utilisation, and a combined skin/hair/shade trend view — a presentation layer over data already collected elsewhere in Mirror Studio, not a new data-collection category.
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-138
System should calculate cost-per-wear per wardrobe item (purchase price ÷ times worn), where the user optionally logs a purchase price at cataloguing time; the feature must degrade gracefully to wear-count only when price is not provided.
Should
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-139
System should calculate wardrobe utilisation percentage: proportion of catalogued items worn, per logged outfit selections, in the last 90 days.
Should
Global — no market restriction; feature availability follows YouCam API regional coverage, not GirlCode360’s own market list
FR-140
System must provide a combined skin, hair, and shade-match trend view extending the existing Skin Progress Timeline’s before/after comparison pattern — no new UI pattern, additional data series only.
Must
Reuses the existing Mirror Progress Timeline component


3.11.8  Wardrobe Resale Bridge
Peer-to-peer resale of catalogued wardrobe items through the existing Marketplace and Business Portal, addressing the sustainability expectation increasingly standard in the digital-wardrobe category (Acloset, Whering).
FR-ID
Requirement Description
Priority
Market Notes / Localisation
FR-141
System should let a user list a My Wardrobe item for resale with one tap from its catalogue entry, pre-filled with the existing photo and tags.
Should
Reuses existing My Wardrobe photo/tag data — no separate resale photography flow
FR-142
System should provide peer-to-peer buyer-seller messaging through the existing Marketplace messaging surface; resale listing photos and descriptions must pass through the existing content-moderation queue before going live.
Should
Reuses the existing Community content-moderation infrastructure
FR-143
Resale listings must be clearly labelled as peer-to-peer (‘from a GirlCode360 member’), visually distinct from business/boutique listings.
Must
Trust and transparency parity with SheMatch’s existing ‘Sponsored’ labelling discipline


Non-functional requirements for all eight modules above (NFR-STU-01 to NFR-STU-11 — performance, accuracy/equity validation across Fitzpatrick I–VI and hair-texture ranges, consent architecture, and clinical review of correlation language) are specified in full in GirlCode360_Mirror_Feature_Spec.docx §6 and are incorporated into this PRD by reference, consistent with how Mirror’s original NFR-AI series is referenced from §6A.
4. Non-Functional Requirements
Non-functional requirements define the quality attributes, constraints, and standards the system must meet, independent of specific features.
4.1  Performance Requirements
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-001
Performance
App launch time (cold start) must be ≤3 seconds on a device with 2GB RAM on a 4G connection.
Measured via instrumented testing on minimum-spec Android (2GB RAM) and iPhone SE. P95 metric.
NFR-002
Performance
API response time for all read operations must be ≤500ms at P95 under normal load.
Load tested at 10,000 concurrent users. P95 measured via Datadog or New Relic APM.
NFR-003
Performance
App must function with graceful degradation on 2G/3G connections (critical for NG/GH markets). Core health logging must work offline and sync when connection restored.
Offline-first architecture for health log writes. Offline queue with conflict resolution. QA tested on throttled 2G network.
NFR-004
Performance
Period prediction algorithm must return results within 1 second of cycle data submission.
Benchmark with 24 months of logged cycle data. Prediction computation must occur server-side and be cached.
NFR-005
Performance
Marketplace proximity search must return results within 1 second at P95.
Geospatial indexing required (PostGIS or equivalent). Tested with 10,000 business listings.
NFR-006
Performance
Image upload to Health Wallet must support progressive upload with a visible progress indicator. Upload must resume automatically on reconnection if interrupted.
Resume upload via chunked multipart upload (S3 multipart or equivalent). QA tested on flaky network.


4.2  Security Requirements
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-007
Security
All health data at rest must be encrypted using AES-256. Encryption keys must be managed via a KMS (AWS KMS or GCP Cloud KMS). No server-side plaintext access to Health Wallet documents.
Annual penetration test required (OWASP Top 10 and OWASP Mobile Top 10). Results reviewed by engineering lead and legal.
NFR-008
Security
All data in transit must use TLS 1.3 minimum. TLS 1.2 may be maintained for compatibility only where 1.3 is unavailable on older devices. TLS 1.0 and 1.1 must be disabled.
Verified via SSL Labs scan (A+ rating required). Certificate pinning implemented on mobile apps.
NFR-009
Security
User authentication must implement: multi-factor authentication option, session expiry after 30 days of inactivity, device-bound session tokens, and rate limiting on login (max 5 failed attempts triggers 5-minute lockout).
OWASP ASVS Level 2 compliance. Auth flow reviewed by security engineer.
NFR-010
Security
All user-uploaded documents in the Health Wallet must be stored using zero-knowledge encryption: the server cannot decrypt documents without the user’s key.
Architecture verified by external security review. Key derivation: PBKDF2 or Argon2id.
NFR-011
Security
The app must implement certificate pinning to prevent man-in-the-middle attacks.
Mobile app OWASP M8 control. QA verified via Burp Suite or mitmproxy testing.
NFR-012
Security
System must implement a Data Breach Response Plan (DBRP). Breaches must be assessed within 24 hours. Notifications to relevant DPA must be made within 72 hours (UK ICO), ‘as soon as reasonably practicable’ (NG NDPC, GH DPC).
DBRP documented and reviewed by legal counsel. Breach simulation exercise run before public launch.
NFR-013
Security
Application must pass OWASP Mobile Security Testing Guide (MSTG) Level 1 checks before App Store / Play Store submission.
External security audit required. Sign-off from security engineer.


4.3  Data Privacy & Compliance Requirements
Compliance obligations across all three target jurisdictions are summarised below:

Requirement
UK (UK GDPR / DPA 2018)
Nigeria (NDPA 2023 + GAID 2025)
Ghana (DPA 2012 Act 843)
Legal basis for health data processing
Explicit consent (Art.6 + Art.9 UK GDPR). DPIAs required for all health data processing.
Explicit consent mandatory (NDPA s.25). Register with NDPC as DCPMI. Annual compliance audit.
Explicit consent (DPA Act 843 s.20). Register with Ghana Data Protection Commission (DPC).
Data subject rights
Right to access, correct, erase, portability, restrict, object. Requests fulfilled within 1 month.
Right to access, correct, delete, restrict, data portability. Honoured within 21 days per NDPA.
Right to be informed, access, object, correct, withdraw consent. Honoured within 21 days.
Data residency
No strict residency requirement but transfers outside UK need UK adequacy / SCCs.
No mandatory residency, but NDPC recommends local storage for health data. Cross-border transfers need safeguards.
No mandatory residency. Cross-border transfers need DPC approval or contractual protections.
Breach notification
72 hours to ICO if risk to individuals. Notify users without undue delay.
Report to NDPC and affected data subjects ‘as soon as reasonably practicable’.
Report to Ghana DPC and affected users as soon as reasonably practicable.
Data Protection Officer
Required if processing special category data at scale. Must be independent.
DPO recommended; DPCO required for audit and NDPC liaison.
Data Supervisor recommended per DPA s.58. Not mandatory but good practice.
Privacy notice / policy
Comprehensive privacy policy in plain language. Granular consent per processing purpose.
Privacy policy in plain language. Separate consent for each data category processed.
Privacy notice required detailing collection purpose, retention, rights. Consent per category.
Children / minors
Minimum age 18 for health data processing without parental consent (UK standard).
18+ minimum age; NDPA prohibits consent in circumstances that endanger a child’s rights.
18+ minimum age; DPA requires parental consent for minors processing special personal data.


NFR-ID
Category
Requirement
Acceptance Criterion
NFR-014
Privacy
System must implement a consent management platform (CMP) that records the exact version of privacy policy and consent terms accepted by each user, with timestamp and jurisdiction.
Consent version logged in database. System must serve updated consent when policy changes. User must re-consent to material changes.
NFR-015
Privacy
No personal health data may be shared with third-party advertising platforms (Meta Ads, Google Ads, TikTok Ads) without explicit, separate, specific consent that is clearly distinct from app usage consent.
Flo Health paid $56M settlement for this exact violation. GirlCode360 must contractually prohibit ad partners from accessing health data.
NFR-016
Privacy
System must implement a Privacy Centre in the app: shows what data is collected, why, who it is shared with, retention periods, and how to exercise rights.
UK ICO recommends this. Reduces support burden for data subject access requests.
NFR-017
Privacy
System must complete a Data Protection Impact Assessment (DPIA) before launch in each market, covering all health data processing activities.
UK: DPIA mandatory for special category data at scale (ICO guidance). NG: NDPA s.62 DPIA requirement. GH: DPA best practice.
NFR-018
Privacy
Anonymised, aggregated analytics data only may be used for product improvement. No individual-level health data used for analytics without explicit consent.
Analytics tool (Mixpanel/Amplitude) must be configured to exclude health fields from event tracking.


4.4  Accessibility Requirements
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-019
Accessibility
App must meet WCAG 2.1 Level AA compliance for the iOS and Android versions.
UK: Accessibility required for inclusion (Public Sector Bodies Accessibility Regulations informed best practice). Test with VoiceOver (iOS) and TalkBack (Android).
NFR-020
Accessibility
All interactive elements must have a minimum touch target size of 44x44 points (iOS) / 48x48 dp (Android).
Verified via automated accessibility scanner and manual testing.
NFR-021
Accessibility
App must support system-level font size adjustments (up to 200% on iOS, Extra Large on Android) without layout breaking.
Dynamic Type (iOS) and Scalable SP units (Android). Tested across all text size settings.
NFR-022
Accessibility
All colour combinations used in the UI must meet WCAG 2.1 AA contrast ratio (minimum 4.5:1 for body text, 3:1 for large text and icons).
Verified via Colour Contrast Analyser tool during design review. No exceptions for decorative use of colour in functional UI.
NFR-023
Accessibility
App must support a screen reader-accessible mode for all health module inputs (calendar, symptom picker, medication reminders).
Screen reader labels on all interactive elements. No unlabelled icons.


4.5  Localisation & Internationalisation
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-024
Localisation
App must support date formats per market: DD/MM/YYYY (UK, NG, GH). Time must display in 12h or 24h per device setting.
Localisation library: i18n-js or react-i18next. Date formatting: date-fns with locale.
NFR-025
Localisation
Currency display: UK (£ GBP), Nigeria (₦ NGN), Ghana (GH₵ GHS). Prices formatted per locale convention.
Currency formatting via Intl.NumberFormat. No hardcoded currency strings.
NFR-026
Localisation
Marketplace listings must display distance in kilometres (km) for all three markets.
No imperial units displayed. Distance calculated from user’s device GPS or entered postcode.
NFR-027
Localisation
All user-facing strings must be externalised into locale files enabling translation. v1.0 ships in English only. v1.1 to add Pidgin English (Nigeria) and Twi (Ghana) options.
i18n architecture must be in place from Day 1 to avoid costly refactoring for translations.
NFR-028
Localisation
Emergency contact numbers displayed in Pregnancy module must be localised: UK (999/111), Nigeria (112/Lagos State Emergency: 767), Ghana (999/193).
Localised emergency content stored in locale config, not hardcoded.
NFR-029
Localisation
Educational content (health articles, PCOS guidance, antenatal information) must have market-specific variants: UK version references NHS; Nigeria version references FMOH; Ghana version references GHS.
Content management system (CMS) must support market-tagged content. No single content version for all three markets.


4.6  Reliability & Availability
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-030
Availability
System must achieve 99.5% uptime (measured monthly) for all API services. Planned maintenance windows must be announced 48 hours in advance via in-app banner.
SLA enforced via cloud provider SLA + monitoring alerts. Downtime budget: <3.6 hours/month.
NFR-031
Reliability
All user health log data must be backed up daily with a Recovery Point Objective (RPO) of 24 hours and a Recovery Time Objective (RTO) of 4 hours.
Backups encrypted and stored in a separate geographic region. Restore tested quarterly.
NFR-032
Reliability
App must handle network disconnection gracefully. All health log writes must queue locally and sync automatically on reconnection without data loss.
Offline-first architecture tested via airplane mode scenarios on iOS and Android.
NFR-033
Availability
System must implement automated health checks and alerting with PagerDuty or equivalent. On-call engineer must be alerted within 5 minutes of a P0 incident.
On-call rota established before Nigeria public launch (Month 5). Runbooks documented for top 10 failure scenarios.


4.7  Scalability
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-034
Scalability
System architecture must support horizontal scaling to accommodate 500,000 concurrent users without architectural changes. Target: v1.0 supports 50,000 users; v2.0 target 500,000.
Microservices architecture with auto-scaling groups (AWS ECS or GCP Cloud Run). Load testing with k6 or Artillery before each major launch.
NFR-035
Scalability
Database architecture must use read replicas for all read-heavy operations (cycle calendar, marketplace search). Write operations through primary only.
PostgreSQL with PgBouncer connection pooling. Read replica in each market region.
NFR-036
Scalability
Marketplace proximity search must use geospatial indexing (PostGIS or Elasticsearch geo-queries) capable of handling 100,000 business listings without performance degradation.
Load tested at 100,000 listing scale before Nigeria launch.


4.8  Usability Requirements
NFR-ID
Category
Requirement
Acceptance Criterion
NFR-037
Usability
New users must be able to log their first period data within 3 minutes of completing onboarding (tested via task-based usability testing).
Usability test with 10 participants per market in Month 2. Success criterion: ≥80% completion rate in <3 min.
NFR-038
Usability
System error messages must be written in plain language (reading level: UK Year 8 / 14-year-old equivalent). No technical jargon in user-facing errors.
All error copy reviewed by UX writer and clinical advisor for health contexts.
NFR-039
Usability
All health content must be written in plain language at maximum reading age 14. Technical terms must include in-app tooltip definitions.
Readability test: Flesch-Kincaid score ≥60 for all health copy. Clinical advisor reviews accuracy.
NFR-040
Usability
App must include an in-app onboarding tooltip system for first-time use of each module. Tooltips must be dismissible and not reappear after dismissal.
Tooltip state stored locally. Re-trigger option available in Help settings.



5. Technical Architecture Requirements
5.1  Technology Stack (Recommended)
Layer
Technology
Rationale
Mobile App
React Native (iOS + Android)
Single codebase for 2 platforms. Expo for OTA updates. Large hiring pool.
Backend API
Node.js (Express) or Python (FastAPI)
RESTful API. JWT authentication. Async job queue (Bull/Redis) for background tasks.
Primary Database
PostgreSQL (AWS RDS or GCP Cloud SQL)
ACID compliance for health data. PostGIS extension for marketplace geospatial search.
Caching
Redis
Session management, API response caching, offline sync queue.
File Storage
AWS S3 (UK) + S3 Africa (Nigeria/Ghana)
Client-side encrypted before upload. Separate S3 buckets per market for data residency.
Location Services
Google Maps Platform (Geocoding + Places) / HERE Maps fallback
Used for marketplace proximity search. HERE Maps as fallback for network resilience.
Payments
Stripe (UK) + Paystack (Nigeria/Ghana)
Stripe for UK card processing. Paystack for local African card + mobile money.
Push Notifications
Firebase Cloud Messaging (FCM)
Cross-platform push. Notification content must not expose health data.
Analytics
Mixpanel or Amplitude
Health data fields must be excluded from event tracking. PII-free analytics only.
Auth
Auth0 or Supabase Auth
OAuth2, PKCE flow, social login (Google, Apple), JWT session management.
CDN
Cloudflare
DDoS protection, TLS termination, health article content caching.
Monitoring
Datadog / Sentry + PagerDuty
Application performance monitoring. Error tracking. On-call alerting.



6. Acceptance Criteria & Definition of Done
6.1  Definition of Done — Feature Level
A functional requirement is considered Done when ALL of the following are met:
Feature is implemented and passes all automated unit tests (minimum 80% code coverage)
Feature passes QA regression test suite with zero P0 or P1 bugs outstanding
All user-facing copy has been reviewed and approved by UX writer and clinical advisor (for health modules)
Privacy/legal review completed for any new data collection or processing activity
Feature is accessible: WCAG 2.1 AA verified for all new UI components
Localisation strings are externalised (no hardcoded text in production builds)
Feature has been documented in the internal wiki and user-facing help centre
Performance benchmarks met: no new API endpoint >500ms at P95

6.2  Definition of Done — Launch Level
A market launch is considered Done when ALL of the following are met:
All ‘Must’ functional requirements for target modules are complete and QA-signed-off
Privacy policy and terms of service are live, jurisdiction-specific, and legally reviewed
DPIA (Data Protection Impact Assessment) is documented and approved
Data subject rights workflows are tested and functional (access, erasure, portability)
External penetration test completed (OWASP Mobile Top 10). Critical findings remediated.
Emergency response plan (data breach, downtime) is documented and on-call rota established
App Store and Google Play listings approved and live with compliant privacy nutrition labels
Clinical advisor has signed off all health module copy in the launch build
Customer support workflow is established (minimum: in-app help, email support, 48h SLA)

6.3  Key Acceptance Tests — Critical Paths
FR-ID
Requirement Description
Priority
Market Notes / Localisation
AT-001
User can register, log first period, and view cycle prediction in <5 minutes from first app open.
Must
All 3 markets tested with real device lab.
AT-002
User can upload a document to the Health Wallet, view it, generate a share link, and verify link expires after 24 hours.
Must
Verified in UK and Nigeria environments.
AT-003
User in Lagos can search ‘hair salon near me’ and see minimum 5 results within 2km in <1 second.
Must
Requires 100+ Lagos listings seeded before test.
AT-004
User data export (GDPR Art.20 / NDPA) completes successfully, producing a valid, readable JSON file within 60 seconds.
Must
Tested with users with 12+ months of logged data.
AT-005
User account deletion removes all data from app, API, and backup systems within the documented retention period.
Must
Verified by engineering team with database audit log.
AT-006
App functions correctly on 2G network (throttled in QA environment): period log syncs on reconnection.
Must
Tested on Android device throttled to 2G speeds.
AT-007
Push notification for period reminder does NOT display health content on lock screen.
Must
Tested on iOS and Android with various lock screen settings.
AT-008
Consent withdrawal by user stops all analytics tracking within 24 hours (UK GDPR requirement).
Must
Verified by analytics engineer checking tracking event logs post-withdrawal.



6A. AI Feature Requirements (Addendum)
GirlCode360 incorporates three AI features that have been defined in a dedicated AI Features Specification document (GirlCode360_AI_Features_Spec.docx). That document should be read in conjunction with this PRD. The functional requirements FR-079 to FR-103 and non-functional requirements NFR-AI-01 to NFR-AI-10 are contained within that document and are considered part of this PRD v1.0 by reference.
6A.1  AI Feature Summary
AI Feature 1: Alena — Contextual Health Companion (Chatbot)
An AI-powered chatbot (powered by Claude Sonnet 4.6 via Anthropic API) that reads from the user’s own logged health data across all active modules to provide contextual, personalised health guidance. Unlike generic health chatbots, Alena is context-aware: it knows the user’s cycle history, PCOS symptoms, TTC status, and pregnancy progress before the user asks their first question.
Free tier: 3 conversations per day. Premium: unlimited. Functional requirements: FR-079 to FR-087.
AI Feature 2: HealthLens — Longitudinal Symptom Pattern Analyser
A background AI engine that analyses 90+ days of logged health data to detect meaningful patterns and generate two outputs: (1) a Monthly Health Intelligence Report in plain language, and (2) a Doctor Appointment Prep Card — a structured PDF summary of the user’s health data formatted for sharing with a healthcare provider. Specifically designed to handle irregular cycles (PCOS users) where standard calendar-based algorithms show only 18% accuracy.
Activates after 3 logged cycles or 90 days of data. Monthly report free; on-demand reports on Premium. Functional requirements: FR-088 to FR-095.
AI Feature 3: SheMatch — Health-to-Marketplace AI Bridge
A rules-based recommendation engine that connects the user’s active health context to the marketplace in real time. When a medication reminder fires, nearby pharmacies are surfaced. When the fertile window begins, nearby pharmacies stocking ovulation test kits appear. When pregnancy reaches Week 20, obstetric scan centres are surfaced. This feature is unique in the femtech market — no competitor connects health tracking data to local service discovery.
Requires separate explicit consent per module. Available on free tier (2 trigger types) and Premium (all trigger types). Functional requirements: FR-096 to FR-103.


6B. Mirror: Skin AI & Style Confidence (Addendum)
GirlCode360 incorporates a fifteenth epic, Mirror, combining AI skin diagnostics and generative apparel try-on via the Perfect Corp. YouCam API. Mirror is defined in full in the dedicated GirlCode360_Mirror_Feature_Spec.docx, which should be read alongside this PRD. Functional requirements FR-104 to FR-111 are contained within that document and are considered part of this PRD v1.2 by reference. Mirror originated as a submission to the YouCam API Skin AI & Apparel VTO Hackathon (deadline 17 August 2026) and has been scoped for production from the outset.
Mirror’s defining principle: skin scan results are cross-referenced with the user’s existing cycle and PMOS symptom data (MIR-F-02), giving GirlCode360 a correlation capability no standalone skin-scanning app can replicate, since none of them have access to a user’s hormonal cycle history. This pattern also feeds into HealthLens as a new monthly report category.
MIR-F-01 to F-08 (all 8 features: Skin AI Diagnostic Scan, Cycle-Correlated Skin Insights, Skin Progress Timeline, SheMatch Skincare Product Bridge, Apparel Virtual Try-On, Style Confidence Boutique Bridge, biometric data Consent & Privacy, and Maternity/PMOS Try-On Mode) all ship for the 17 August 2026 hackathon submission and are hardened for production in Month 4–6, running in parallel with the existing Alena, HealthLens, and SheMatch AI milestones.
Mirror introduces GirlCode360’s highest-sensitivity data category to date: a photograph of the user’s face or body sent to a third-party AI vendor. This requires a dedicated consent tier (MIR-F-07), distinct from all existing health-data consents, treating the biometric image as UK GDPR Article 9 special category data. See GirlCode360_Mirror_Feature_Spec.docx Section 4 for the full privacy and compliance treatment.


6C. Pre-Tier 3 — Mirror Studio: Beauty & Fashion (Addendum)
GirlCode360 incorporates a deliberate expansion of the Mirror epic, Mirror Studio, adding eight beauty-and-fashion features (STU-F-01 to STU-F-08, FR-112 to FR-143, NFR-STU-01 to NFR-STU-11) grounded in a competitive audit of the beauty-app category (Sephora Virtual Artist, Ulta GLAMlab, YouCam Makeup) and the digital-wardrobe category (Whering, Acloset, Cladwell, Indyx). Mirror Studio is defined in full in GirlCode360_Mirror_Feature_Spec.docx §6, which should be read alongside this PRD. This addendum is considered part of PRD v1.3 by reference.
Why this tier exists: Mirror as shipped in Tier 1/2 uses only two of Perfect Corp.’s roughly nine YouCam API product categories (Skin Analysis and Apparel Virtual Try-On), and GirlCode360 currently ships none of the single most-used feature across the entire beauty-app category: makeup try-on. Mirror Studio closes that gap while remaining anchored to GirlCode360’s one defensible advantage — a real hormonal and cycle-health data layer that no beauty or wardrobe competitor has.
Makeup Studio, Shade Match Engine, Hair Studio, My Wardrobe, Accessories Studio, AI Stylist (an Alena extension, not a second assistant), Style Analytics & Confidence Score, and Wardrobe Resale Bridge — each grounded in a specific competitor gap and mapped to a specific unused YouCam API category, and each reusing an existing GirlCode360 system (SheMatch, Alena, HealthLens, Business Portal, Marketplace, content moderation) rather than duplicating one.
Monetisation: Mirror Studio bundles into the existing Premium subscription tier (reusing ALN-F-05’s gating, not new billing infrastructure) at a price competitive with any single dedicated wardrobe or beauty competitor app alone, since it replaces several $5–10/month single-purpose subscriptions with one. A second monetisation vector extends the existing Featured & Sponsored Listings mechanism (MKT-F-07): retailers pay for ‘Verified Shade Match’ or ‘Try-On Ready’ placement contingent on supplying accurate inventory or 3D assets via the Business Portal.
Global market positioning (supersedes prior three-market framing): Earlier GirlCode360 documentation referenced the UK, Nigeria, and Ghana as the product’s market scope. These remain accurate as GirlCode360’s initial launch markets and continue to ground concrete compliance examples (UK GDPR, Nigeria NDPA/GAID, Ghana DPA) throughout this PRD, but they are not, and were never architecturally, a restriction on the product’s ambition. UOB-F-04’s jurisdiction detection and consent routing already operate per-user on a detected-jurisdiction basis rather than a hardcoded enum of three countries; onboarding a new market is a configuration and legal-review exercise, not a re-architecture. All product, engineering, and go-to-market documentation should describe GirlCode360 as building for a global market from initial launch markets, not as a UK/Nigeria/Ghana-only product. New-market expansion is evaluated as a Tier 3 scale decision (Master Technical Implementation Plan §Phase 3.2) on demand and compliance readiness.


7. Appendix
7.1  Key Regulatory References
UK GDPR: https://www.legislation.gov.uk/ukpga/2018/12 | ICO guidance: ico.org.uk
MHRA Software as a Medical Device: https://www.gov.uk/government/publications/software-as-a-medical-device
NHS DTAC (Digital Technology Assessment Criteria): https://www.nhsx.nhs.uk/key-tools-and-info/digital-technology-assessment-criteria-dtac/
Nigeria Data Protection Act 2023 (NDPA): https://ndpc.gov.ng
Nigeria GAID 2025: General Application and Implementation Directive (effective Sept 2025)
Ghana Data Protection Act 2012 (Act 843): https://www.lawsghana.com
Ghana DPC (Data Protection Commission): https://www.dataprotection.org.gh

7.2  Out of Scope for v1.0
Telemedicine / video consultation integration
Wearable device data ingestion (Fitbit, Apple Watch, Oura Ring)
AI-powered symptom checker or diagnostic features
In-app appointment booking direct to clinic systems (planned v1.1)
Menopause module
Social sharing of health data or cycle insights
Multi-language support beyond English (Pidgin, Twi planned for v1.1)
White-label B2B version for HMOs / corporate wellness


GirlCode360 — Product Requirements Document v1.0  |  Confidential  |  August 2026
