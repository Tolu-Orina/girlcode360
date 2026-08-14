# GirlCode360 — Pre-Tier 3 Implementation Plan: Mirror Studio (Beauty & Fashion)

**Version 1.0 · 14 August 2026**  
**Canonical engineering copy:** Master Technical Implementation Plan **v1.4** `docs/new/girlcode-imp-plan.md` **§12.2** (plus §5.10, §6.4, §7.3, §8.4). This file remains the research extract. Do not maintain a second sequencing SoT.

**Extends:** Master Technical Implementation Plan — same repo, same stack, same conventions.
**Scope source:** `GirlCode360_Mirror_Feature_Spec.docx` §6, `GirlCode360_PRD_v1.4.docx` §3.11.
**Sits between:** Tier 2 (closed) and Tier 3 (native app / multi-region / population ML) in the master plan's tier list.

> **This is not a greenfield plan, and it is not a rewrite of Mirror.** The single Lambda router, Aurora DSQL, Cognito auth, the existing `youcam-gateway` pattern, the PWA shell, Alena, and HealthLens are locked and already applied. Every phase below **extends** that stack — new route families in the existing router, new DSQL tables with the existing no-FK/TEXT-PK conventions, new context sources fed into the existing Alena/HealthLens pipelines. If a phase below appears to require a new Lambda, a new database, or a new AI provider, that is a signal to re-read the master plan's Guiding Principles before proceeding, not a instruction to build one.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Guiding Principles (Pre-Tier 3 specific)](#2-guiding-principles-pre-tier-3-specific)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [YouCam API Surface Added](#4-youcam-api-surface-added)
5. [Data Architecture](#5-data-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [AI Stylist — Extending Alena, Not Duplicating It](#7-ai-stylist--extending-alena-not-duplicating-it)
8. [Style Analytics — Extending HealthLens, Not Duplicating It](#8-style-analytics--extending-healthlens-not-duplicating-it)
9. [PWA / Frontend Architecture](#9-pwa--frontend-architecture)
10. [Consent Architecture](#10-consent-architecture)
11. [Security, Equity & Compliance](#11-security-equity--compliance)
12. [Testing Strategy](#12-testing-strategy)
13. [Phased Build Plan (P3.1–P3.6)](#13-phased-build-plan-p31p36)
14. [Monetisation Implementation](#14-monetisation-implementation)
15. [Cost Model (Incremental)](#15-cost-model-incremental)
16. [Risk Register](#16-risk-register)
17. [Appendix](#17-appendix)

---

## 1. Executive Summary

Mirror, as shipped through Tier 1 and Tier 2, integrates exactly two of Perfect Corp.'s roughly nine YouCam API product categories: AI Skin Analysis and generative Apparel Virtual Try-On. Pre-Tier 3 adds eight new features — Makeup Studio, Shade Match Engine, Hair Studio, My Wardrobe, Accessories Studio, AI Stylist, Style Analytics & Confidence Score, and Wardrobe Resale Bridge (STU-F-01 to STU-F-08, FR-112 to FR-143) — each grounded in a specific gap identified against the beauty-app category (Sephora Virtual Artist, Ulta GLAMlab, YouCam Makeup) and the digital-wardrobe category (Whering, Acloset, Cladwell, Indyx), and each mapped to a specific unused YouCam API family.

Every feature below reuses an existing GirlCode360 system rather than inventing one: the `youcam-gateway` pattern extends to new API families; new DSQL tables follow the exact no-FK, `TEXT` primary-key convention already established; AI Stylist is new context fed into Alena's existing pipeline, not a second assistant; Style Analytics is a new data series on HealthLens's existing timeline component, not a new report engine; Wardrobe Resale Bridge is a new listing type on the existing Marketplace and content-moderation queue, not a second marketplace.

Six phases (P3.1–P3.6), sequenced by dependency and shared validation work, not by feature glamour. Foundations and equity validation come first; features that depend on My Wardrobe existing are sequenced after it; features with external retailer dependencies (3D-authored jewellery assets) are sequenced last because they carry schedule risk outside GirlCode360's own engineering, not because they matter less.

---

## 2. Guiding Principles (Pre-Tier 3 specific)

These sit alongside, and never override, the master plan's §2 Guiding Principles.

| Principle | What it means in practice |
|---|---|
| **One `youcam-gateway`, more capabilities** | The existing gateway Lambda code gains new API-family handlers (makeup, hair, shade-finder, nail, jewellery, eyewear). It does not get a sibling gateway. Auth, rate-limiting, and the 2-hour-retention copy-to-S3 discipline (master plan §5.1–5.4) apply identically to every new capability — that logic is written once and parameterised, not re-implemented per feature. |
| **No sixth tab** | The PWA's 5-tab bottom bar (Home, Cycle, Mirror, Alena, Account) is locked. Every Pre-Tier 3 feature lives inside the existing `/app/mirror` surface as sub-navigation, never as a new top-level tab. |
| **AI Stylist is Alena, not a second Alena** | Perfect Corp.'s own "Ask AI" / Perfect Beauty Agent layer is explicitly not adopted. AI Stylist is new context appended to Alena's existing `ALN-F-02` context-construction step, using the same Bedrock Nova 2 Lite call already wired in `packages/ai-provider`. |
| **Style Analytics is HealthLens's timeline, extended** | No new report type, no new correlation engine. New data series on the existing Skin Progress Timeline component and the existing Monthly Health Intelligence Report. |
| **`mirror_catalogue` grows up, it doesn't get replaced** | The existing curated-catalogue table (Wave 0's SheMatch stand-in) extends with new `kind` values (`wardrobe_item`, `makeup_look`, `jewellery`, `eyewear`, `nail_color`) rather than spawning parallel catalogue tables per feature. |
| **DSQL conventions are non-negotiable** | Every new table: `TEXT` primary key, no `FOREIGN KEY` clauses, `CREATE INDEX ASYNC`, API-enforced parent/child integrity. No RDS, no exception, per the master plan's locked stack decision. |
| **Equity validation is a phase gate, not a launch-day checklist item** | Fitzpatrick I–VI validation (skin, shade-match) and hair-texture-range validation (straight/wavy/curly/coily) are explicit exit criteria for P3.1 and P3.3 respectively — no feature built on top of an unvalidated diagnostic ships until that validation is done. |

---

## 3. Scope & Non-Goals

**In scope for Pre-Tier 3 (P3.1–P3.6):**
STU-F-01 through STU-F-08 in full, per `GirlCode360_Mirror_Feature_Spec.docx` §6 and `GirlCode360_PRD_v1.4.docx` §3.11.

**Explicitly out of scope for Pre-Tier 3** (these remain Tier 3 or later, per the master plan):
- Native app wrapper (Tier 3 Phase 3.1) — Mirror Studio ships PWA-only, identically to the rest of the product.
- Multi-region latency hardening (Tier 3 Phase 3.2).
- Population-level ML training on Mirror Studio data (Tier 3 Phase 3.4) — consented data collection only, no training pipeline, same discipline already applied to `HL-F-06`.
- Live Paystack/Stripe checkout for Verified Shade Match / Try-On Ready sponsored placement — ships as a stub checkout URL with a webhook-settable flag, identical to `MKT-F-07`'s existing sponsored-listing pattern, until live payment keys exist as an ops task.
- YouCam webhook migration for the new API families — Pre-Tier 3 reuses the existing poller pattern; webhook migration (already a Tier 2 `2.2` item for Skin/Apparel) extends to the new families only after that migration is proven, not in parallel with it.

---

## 4. YouCam API Surface Added

All request shapes below follow the identical five-step pattern already documented in the master plan §5.1 (authenticate → upload → initiate task → poll → retrieve, 2-hour download URL). Only the capability-specific payloads differ; the gateway's auth, rate-limiting, and S3-copy logic is shared, unmodified code.

### 4.1 Makeup Transfer / AR Try-On (STU-F-01)

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/makeup-transfer
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{selfie or Mirror scan file_id}",
  "makeup_categories": ["lip", "eyeshadow", "blush", "foundation", "eyebrow", "eyeliner", "eyelash"],
  "reference_file_id": "{optional — for 'Get this look' transfer mode}",
  "format": "json"
}
```
Live-camera mode uses YouCam's AgileFace real-time tracking client-side (not a task/poll round-trip per frame); photo-mode and look-transfer mode use the task/poll pattern above. Foundation shade defaults to the user's most recent Shade Match Engine result where one exists within 30 days.

### 4.2 AI Skin Shade Finder + Fitzpatrick Analysis (STU-F-02)

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/shade-finder
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{existing Mirror skin_scans.youcam_task_id source file, reused if <30 days old}",
  "dst_actions": ["shade_match", "fitzpatrick_type"],
  "brand_filter": ["optional array of brand codes stocked by SheMatch-linked retailers in range"]
}
```
Reuses the source image from an existing `skin_scans` row where available — no duplicate capture, matching `FR-117`.

### 4.3 Hair Analysis + Colour/Style Try-On (STU-F-03)

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/hair-analysis
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{file_id}",
  "dst_actions": ["hair_type", "hair_length", "hair_frizziness", "hair_density"]
}
```
```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/hair-tryon
Authorization: Bearer {YOUCAM_API_KEY}
Content-Type: application/json

{
  "src_file_id": "{file_id}",
  "hair_color": "{hex or named shade}",
  "hairstyle_id": "{catalogue style id, optional}"
}
```
Two separate task types (diagnostic vs try-on) called independently — a user can request a hair-density score without generating a style try-on, and vice versa.

### 4.4 Nail, Jewellery, Watch, Eyewear Try-On (STU-F-05)

```http
POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/nail-tryon
{ "src_file_id": "{hand photo file_id}", "nail_color": "{hex}" }

POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/accessory-tryon
{ "src_file_id": "{file_id}", "accessory_category": "ring|bracelet|watch|earring|necklace",
  "asset_3d_id": "{retailer-supplied 3D-authored asset id — see §11.3 dependency}" }

POST https://yce-api-01.perfectcorp.com/s2s/v2.0/task/eyewear-tryon
{ "src_file_id": "{file_id}", "frame_id": "{catalogue frame id}" }
```

### 4.5 Apparel VTO — extended for My Wardrobe (STU-F-04)

No new endpoint. `POST /s2s/v2.0/task/apparel-tryon` (already integrated for `MIR-F-05`) is called with `garment_file_id` pointing at a user-uploaded `wardrobe_items` photo instead of a `mirror_catalogue` entry. This is a new *caller*, not a new *integration* — the gateway function signature does not change; only the source of the `garment_file_id` argument does.

---

## 5. Data Architecture

All tables below follow the master plan's §6.1–6.2 conventions exactly: `TEXT` primary keys, no `FOREIGN KEY` clauses, `CREATE INDEX ASYNC`, API-enforced referential integrity.

```sql
-- P3.1/P3.2 — makeup looks + shade matches
CREATE TABLE IF NOT EXISTS makeup_looks (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  youcam_task_id     TEXT NOT NULL,
  categories         TEXT NOT NULL,       -- JSON array of applied categories
  source_kind        TEXT NOT NULL,       -- 'live' | 'photo' | 'transfer'
  result_s3_key      TEXT NOT NULL,
  saved              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX ASYNC IF NOT EXISTS makeup_looks_user_sub_idx ON makeup_looks (user_sub);

CREATE TABLE IF NOT EXISTS shade_matches (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  source_scan_id     TEXT NOT NULL,       -- references skin_scans.id, no FK enforced
  fitzpatrick_type   TEXT,
  matches            TEXT NOT NULL,       -- JSON array of { brand, shade_code, retailer_listing_id, confidence }
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC IF NOT EXISTS shade_matches_user_sub_idx ON shade_matches (user_sub);

-- P3.3 — hair diagnostic + correlation
CREATE TABLE IF NOT EXISTS hair_scans (
  id                    TEXT PRIMARY KEY,
  user_sub              TEXT NOT NULL,
  youcam_task_id        TEXT NOT NULL,
  cycle_day_at_scan     INT,
  cycle_phase_at_scan   TEXT,
  type_score            TEXT,             -- JSON: { type, length, frizziness, density }
  result_s3_key         TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX ASYNC IF NOT EXISTS hair_scans_user_sub_idx ON hair_scans (user_sub);

-- P3.4 — My Wardrobe
CREATE TABLE IF NOT EXISTS wardrobe_items (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  category            TEXT,               -- 'top' | 'bottom' | 'one_piece' | 'outerwear' | 'shoes' | ...
  colour_tags         TEXT,               -- JSON array, AI-suggested + user-corrected
  purchase_price_minor INT,               -- optional, minor currency units; null if not logged
  image_s3_key         TEXT NOT NULL,
  worn_count           INT NOT NULL DEFAULT 0,
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);
CREATE INDEX ASYNC IF NOT EXISTS wardrobe_items_user_sub_idx ON wardrobe_items (user_sub);

CREATE TABLE IF NOT EXISTS wardrobe_outfits (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,
  item_ids           TEXT NOT NULL,       -- JSON array of wardrobe_items.id
  occasion            TEXT,
  worn_on             DATE,
  tryon_result_s3_key TEXT,               -- populated only if the user requested a VTO render of the outfit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC IF NOT EXISTS wardrobe_outfits_user_sub_idx ON wardrobe_outfits (user_sub);

-- P3.6 — resale
CREATE TABLE IF NOT EXISTS resale_listings (
  id                 TEXT PRIMARY KEY,
  user_sub           TEXT NOT NULL,       -- seller
  wardrobe_item_id   TEXT NOT NULL,
  price_minor        INT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending_moderation',  -- reuses content_reports-style moderation flow
  moderation_ref      TEXT,               -- id in the existing moderation-queue table
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC IF NOT EXISTS resale_listings_user_sub_idx ON resale_listings (user_sub);

-- mirror_catalogue extension — new 'kind' values, no schema change required
-- existing: 'skincare' | 'apparel'
-- adding:   'jewellery' | 'eyewear' | 'nail_color' (P3.6)
```

Migration file numbering continues the existing sequence (`017`–`022`, one per phase; see §17.3 for the mapping). Applied on the next **backend** deploy per each phase, matching the existing `01X_phaseYZ_*.sql` convention.

---

## 6. Backend Architecture

No new Lambda functions. Every route family below is added to the existing single router (`infra-backend/modules/lambda/codes/src/handlers/api.ts`), consistent with the master plan's §2 "extend, don't rebuild" and §4.2 rationale for a single-router shape at this scale.

| Route family | Phase | Behind |
|---|---|---|
| `POST /v1/mirror-studio/makeup/*` | P3.2 | `mirror_biometric` consent (existing) + new `mirror_live_camera` consent for live mode |
| `POST /v1/mirror-studio/shade-match` | P3.2 | `mirror_biometric` consent |
| `POST /v1/mirror-studio/hair/*` | P3.3 | `mirror_biometric` consent |
| `GET/POST /v1/mirror-studio/wardrobe/*` | P3.4 | New `wardrobe` consent purpose (photos of clothing, not the body) |
| `POST /v1/mirror-studio/wardrobe/outfits/suggest` | P3.5 | Calls Alena's context-construction extension (§7), not a separate recommendation engine |
| `GET /v1/mirror-studio/style-analytics` | P3.5 | Read-only aggregation over existing consented data; no new consent required (§8) |
| `POST /v1/mirror-studio/accessories/*` | P3.6 | `mirror_biometric` consent; gated on retailer 3D-asset availability |
| `POST /v1/mirror-studio/resale/*` | P3.6 | Existing Marketplace + content-moderation consent/flow |

The `youcam-gateway` internal module gains one handler function per new capability (§4), each calling the same shared `submitTask` / `pollTask` / `copyResultToS3` helpers already written for Skin Analysis and Apparel VTO — this is the concrete meaning of "one gateway, more capabilities" from §2.

---

## 7. AI Stylist — Extending Alena, Not Duplicating It

```
Existing Alena context-construction step (ALN-F-02)
        │
        ▼
Extended in P3.5 to optionally append:
  - wardrobe_items + wardrobe_outfits summary (not raw photos — same
    pseudonymisation discipline as existing health context)
  - most recent skin_scans / hair_scans scores
  - most recent shade_matches result
  - current weather (existing Marketplace/location context, session-only)
  - active pregnancy trimester or PMOS body-confidence mode flag
        │
        ▼
Same Bedrock Nova 2 Lite call via packages/ai-provider — no new provider,
no new API key, no new streaming/quota mechanism
        │
        ▼
Same ALN-F-05 daily quota + Premium gating applies to AI Stylist queries
Same ALN-F-04 crisis detection applies unmodified
Same ALN-F-06 market routing applies unmodified
```

**Implementation note:** the context-construction function gains optional parameters; it is not forked into a second function. A code review gate for P3.5: any PR that introduces a second Bedrock `converse` call path for styling queries, rather than extending the existing one, should be rejected — this is the concrete enforcement mechanism for the "no second assistant" principle in §2.

---

## 8. Style Analytics — Extending HealthLens, Not Duplicating It

```
Existing HealthLens Monthly Health Intelligence Report + Skin Progress
Timeline (HL-F-02, MIR-F-03)
        │
        ▼
P3.5 adds new data series to the SAME timeline component:
  - wardrobe utilisation % (computed from wardrobe_outfits.worn_on
    against wardrobe_items count — pure aggregation, no new collection)
  - cost-per-wear (wardrobe_items.purchase_price_minor ÷ worn_count,
    null-safe if price was never logged)
  - shade-match history (shade_matches over time)
  - hair-score trend (hair_scans, same pattern as existing skin trend)
        │
        ▼
Hair-density-vs-PMOS-symptom correlation reuses the EXACT rules engine
already built for MIR-F-02 (§5.8 of the master plan), parameterised for
a different symptom category — same minimum-2-scans guardrail, same
honest "no clear pattern yet" fallback, same clinical-advisor review gate
```

No new consent category is introduced by this feature (`NFR-STU-11`) — this is an architecture constraint, not just a description, and should be re-verified at each future addition to Style Analytics, not only at initial launch.

---

## 9. PWA / Frontend Architecture

- **No sixth tab.** All Mirror Studio surfaces live under `/app/mirror`, with an in-page segmented control (matching the existing `SegmentedTabs` pattern already used at `/app/health`) for: Skin · Makeup · Hair · Wardrobe · Accessories.
- **My Wardrobe cataloguing works offline** (photo capture + local IndexedDB queue), consistent with the existing health-logging offline pattern — but AI tagging, outfit generation, and any YouCam call remain **network-required**, identical to Mirror's existing skin-scan/try-on behaviour (master plan §8.3).
- **Live-camera Makeup Studio** uses `getUserMedia` with AgileFace client-side tracking; a pre-flight quality overlay (reused from Mirror's existing skin-scan pre-flight pattern) runs before any frame is submitted for photo-mode capture or look-transfer upload.
- **Shared task UI** (submitted → polling our API → result from our S3) is the same component already built for Mirror's skin/apparel flows, parameterised per capability — not rebuilt per feature.
- **AI Stylist surfaces inside the existing Alena tab**, not inside Mirror — a styling answer is still an Alena conversation, consistent with §2's "AI Stylist is Alena" principle. Mirror's role is to feed context into it, not to host a second chat surface.
- **Wellness/styling copy only** — the existing `lint:copy` discipline (no diagnostic language, no absolute styling claims) extends to Makeup Studio and Hair Studio copy without a separate copy-review process.

---

## 10. Consent Architecture

Two new consent purposes, added to the existing append-only `consents` ledger — no second consent system, per the master plan's §2 "Consent is infrastructure" principle.

| Purpose | Gates | Introduced |
|---|---|---|
| `mirror_live_camera` | Live-camera Makeup Studio only; photo-mode remains under the existing `mirror_biometric` purpose | P3.2 |
| `wardrobe` | My Wardrobe cataloguing and outfit generation — clothing photos, not body/face photos, and therefore a distinct purpose from `mirror_biometric` rather than reusing it | P3.4 |

Both follow the existing consent-screen pattern: plain-language explanation, no pre-ticked toggles, independently withdrawable, and — for `mirror_live_camera` specifically — explicit mention that live video frames are processed client-side via AgileFace and are not uploaded to YouCam except for a still frame at capture time.

---

## 11. Security, Equity & Compliance

### 11.1 Fitzpatrick and hair-texture validation (phase-gating, not a checklist)

- **P3.1 exit criterion:** Shade Match Engine and Makeup Studio's foundation-matching accuracy independently validated across Fitzpatrick I–VI before P3.2 features ship to any real user. Shade-finder tools have a well-documented history of underperforming on darker skin tones; this is a stated equity commitment with a testable gate, not an assumption.
- **P3.3 exit criterion:** Hair Studio's diagnostic accuracy validated across straight, wavy, curly, and coily hair textures before the hair-symptom correlation feature (which touches PMOS-sensitive hirsutism/hair-thinning data) ships.

### 11.2 Clinical review

Hair-density-vs-PMOS correlation language (§8) requires the identical clinical-advisor review already mandated for skin-cycle correlation (`MIR-F-02`) before P3.3 ships — hirsutism and hair thinning are diagnostic-adjacent, sensitive topics and must never be presented as diagnostic, exactly as already established for skin.

### 11.3 3D asset dependency (Accessories Studio)

Jewellery and watch try-on quality is explicitly gated on retailer-supplied 3D-authored assets meeting Perfect Corp.'s documented authoring standard (`FR-133`). GirlCode360 does not auto-generate 3D assets from 2D product photos. This is a genuine external dependency on Business Portal retailer onboarding, not a pure-engineering task, and is the reason P3.6 is sequenced last rather than earlier.

### 11.4 Encryption

New image data classes (`makeup_looks`, `hair_scans`, `wardrobe_items` photos) land in the same S3 bucket/KMS-key structure already used for `skin_scans` and `apparel_tryons` (master plan §6.3) — no new key, no new bucket, consistent with the "one existing CMK already encrypts DSQL and the data bucket" decision already made for Mirror.

### 11.5 No swimwear/lingerie constraint carries forward

Perfect Corp.'s training-data exclusion for swimwear and lingerie (already a hard constraint on `MIR-F-05`/`MIR-F-08`) applies identically to My Wardrobe cataloguing and outfit generation — these categories are simply not attempted through the Apparel VTO API, in any wardrobe context.

---

## 12. Testing Strategy

Follows the master plan §10 test pyramid unmodified. Pre-Tier 3-specific additions:

| Test layer | Addition |
|---|---|
| Equity/accuracy | New test suite: shade-match and skin-tone accuracy across Fitzpatrick I–VI reference image set; hair-diagnostic accuracy across 4 texture categories. Gates P3.1 and P3.3 respectively — CI must fail if this suite is not green before those phases merge to `main`. |
| Integration | New `youcam-gateway` handler functions each get the same integration-test pattern already applied to Skin Analysis/Apparel VTO (mocked task/poll, S3-copy verification, 429/error-path coverage). |
| E2E | New Playwright flows: makeup live-camera consent → capture → result; wardrobe item photograph → tag → outfit generation; AI Stylist "what should I wear today" query returning a wardrobe-sourced outfit, not a shopping suggestion. |
| Copy lint | Existing `lint:copy` discipline extended to Makeup Studio and Hair Studio strings — no new lint configuration, same glossary/rules file. |

---

## 13. Phased Build Plan (P3.1–P3.6)

### P3.1 — Foundations & Equity Validation

**Goal:** extend the gateway and validate accuracy before any user-facing feature ships on top of it.

- Extend `youcam-gateway` with handler functions for the Makeup, Hair, Shade Finder, Nail, Jewellery, and Eyewear API families (§4), sharing the existing `submitTask`/`pollTask`/`copyResultToS3` helpers.
- Add `mirror_live_camera` consent purpose.
- Stand up the Fitzpatrick I–VI validation harness (reference image set + accuracy scoring script) for Shade Match Engine and Makeup Studio.
- Apply migration `017_pretier3_makeup_shade.sql` (`makeup_looks`, `shade_matches`).

**Done when:** all six new gateway handlers pass integration tests; Fitzpatrick validation suite is green; `017` applied on the next backend deploy.

### P3.2 — Makeup Studio + Shade Match Engine

**Goal:** close the single largest competitive gap first.

- `POST /v1/mirror-studio/makeup/*` routes (live, photo, transfer modes) — `STU-F-01` / `FR-112`–`FR-116`.
- `POST /v1/mirror-studio/shade-match` — `STU-F-02` / `FR-117`–`FR-119`, reusing an existing `skin_scans` source image where available.
- Live-camera AgileFace client integration + pre-flight overlay reuse.
- Makeup Studio segment added to `/app/mirror`'s in-page navigation.

**Done when:** live and photo-mode makeup try-on both functional end-to-end; shade match returns a cross-brand result set from `mirror_catalogue`-linked retailers; Fitzpatrick validation from P3.1 confirmed against real (not only reference) scan data.

### P3.3 — Hair Studio

**Status (14 Aug 2026):** In repo on the engineering SoT (`docs/new/girlcode-imp-plan.md` §12.2). Monthly HealthLens hair category remains off until clinical sign-off (`HAIR_HL_MONTHLY_SIGNED_OFF`).

**Goal:** the tier's clearest differentiator — ship once the correlation and clinical-review process is warm from P3.2's equity work.

- `POST /v1/mirror-studio/hair/*` — diagnostic and try-on task types — `STU-F-03` / `FR-120`–`FR-123`.
- Hair-density-vs-PMOS-symptom correlation, reusing `MIR-F-02`'s rules engine parameterised for hair.
- Hair-texture validation suite (straight/wavy/curly/coily) — phase-gating per §11.1.
- Clinical advisor review of correlation copy — phase-gating per §11.2. Hair Studio UI copy is in; monthly report attachment waits on sign-off.
- Apply migration `018_pretier3_hair.sql` (`hair_scans`).

**Done when:** hair diagnostic and try-on both functional; correlation surfaces in the next HealthLens Monthly Report only after clinical sign-off; texture validation suite green.

### P3.4 — My Wardrobe

**Status (14 Aug 2026):** In repo on the engineering SoT (`docs/new/girlcode-imp-plan.md` §12.2). Calendar-aware daily outfit (FR-126) remains unshipped. `POST …/outfits/suggest` shipped in P3.5 without calendar.

**Goal:** the largest single build in this tier — closes the biggest functional gap versus the digital-wardrobe app category.

- `wardrobe` consent purpose.
- `GET/POST /v1/mirror-studio/wardrobe/*` — cataloguing, tagging, outfit generation via the existing Apparel VTO integration against user-uploaded garment photos — `STU-F-04` / `FR-124`–`FR-129`.
- Offline photo-capture queue (IndexedDB), reusing the existing health-logging outbox pattern; AI tagging and outfit generation remain network-required.
- Packing-list generator (`FR-127`).
- Apply migration `019_pretier3_wardrobe.sql` (`wardrobe_items`, `wardrobe_outfits`).

**Done when:** a user can catalogue 20+ items offline, sync and auto-tag on reconnection, and generate an outfit try-on against their own body photo within the existing 15-second Apparel VTO budget.

### P3.5 — AI Stylist + Style Analytics

**Status (14 Aug 2026):** In repo on the engineering SoT (`docs/new/girlcode-imp-plan.md` §12.2). No second Bedrock `converse` path. No live weather. No calendar read. Complementary makeup (FR-136) remains Should.

**Goal:** both depend on My Wardrobe existing first — neither has anything meaningful to reason over or measure without it.

- Extend Alena's context-construction step per §7 — `STU-F-06` / `FR-134`–`FR-137`.
- `GET /v1/mirror-studio/style-analytics` aggregation endpoint per §8 — `STU-F-07` / `FR-138`–`FR-140`.
- "What should I wear today" E2E flow validated to return a wardrobe-sourced outfit, never a shopping suggestion first (`FR-135`).
- Code-review gate: no second Bedrock call path introduced (§7 implementation note).

**Done when:** AI Stylist queries count against the existing Alena quota with zero new quota infrastructure; Style Analytics renders on the existing Skin Progress Timeline component with zero new consent prompts.

### P3.6 — Accessories Studio + Wardrobe Resale Bridge

**Status (14 Aug 2026):** In repo on the engineering SoT (`docs/new/girlcode-imp-plan.md` §12.2). Curated 3D/`frameId`/nail seeds; no 2D→3D. Resale uses the existing marketplace moderate path and review thread.

**Goal:** sequenced last because both carry dependencies outside GirlCode360's own engineering — retailer 3D-asset supply and community listing volume — not because they matter less.

- `POST /v1/mirror-studio/accessories/*` — jewellery, watch, eyewear, nail try-on — `STU-F-05` / `FR-130`–`FR-133`, gated on Business Portal-supplied 3D assets (§11.3).
- `mirror_catalogue` extended with `jewellery` / `eyewear` / `nail_color` kinds — no schema change.
- Resale listing flow reusing existing Marketplace messaging and content-moderation queue — `STU-F-08` / `FR-141`–`FR-143`.
- Apply migration `020_pretier3_accessories_resale.sql` (`accessory_looks`, `resale_listings`).

**Done when:** at least one retailer per accessory category has supplied validated 3D assets; resale listings pass through the existing moderation queue and are visually labelled as peer-to-peer per `FR-143`.

**Pre-Tier 3 exit criteria:** all 8 STU features live in production; full regression pass including the equity/accuracy test suite from §12; Fitzpatrick and hair-texture validation results published internally before any retailer partnership is marketed as "verified"; zero new Lambda functions, zero new AI providers, zero new consent systems introduced across the whole tier — every addition traces to an extension of an existing system, per §2.

---

## 14. Monetisation Implementation

- **Consumer:** Mirror Studio's 8 features bundle into the existing Premium tier gate (`ALN-F-05`'s quota/gating mechanism, extended — not a new billing product, not a new pricing tier).
- **Retailer:** "Verified Shade Match" and "Try-On Ready" paid placement extend `MKT-F-07`'s existing Featured & Sponsored Listings mechanism — same stub-checkout-URL-plus-webhook pattern already used for sponsored marketplace listings, priority in Shade Match Engine and Accessories Studio results contingent on the retailer supplying accurate shade inventory or validated 3D assets via the Business Portal.
- **KPI instrumentation:** Mirror Studio Premium attach rate among existing Mirror users is tracked from P3.2 onward but not target-locked until real Makeup Studio usage data exists — consistent with the master plan's evidence-before-KPI-lock discipline used throughout Tier 1/2.

---

## 15. Cost Model (Incremental)

Incremental to the master plan's existing cost model — this is what Pre-Tier 3 adds, not a restatement of the whole stack.

| Line item | Incremental estimate | Notes |
|---|---|---|
| YouCam API units | Variable, scales with Makeup/Hair/Shade/Accessory call volume | Monitor via the existing API Console usage dashboard; same billing-alert pattern as Skin/Apparel |
| S3 storage | Modest increase | New image classes (makeup looks, hair scans, wardrobe photos) in the existing bucket/key structure — no new bucket |
| DSQL | Negligible at Pre-Tier 3 scale | New tables, same cluster; DSQL's scale-to-zero cost model already established in the master plan applies unchanged |
| Bedrock Nova 2 Lite | Modest increase | AI Stylist queries count against existing Alena quota, bounding worst-case spend per free-tier user identically to today |

---

## 16. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shade-match or hair-diagnostic accuracy underperforms on darker skin tones or textured hair, discovered post-launch rather than pre-launch | Medium if validation is skipped under schedule pressure | High — repeats a well-documented industry failure and damages trust in the health-adjacent parts of the product | Phase-gated exit criteria (§11.1) are non-negotiable; P3.2/P3.3 do not proceed without a green validation suite |
| A future PR introduces a second conversational AI path for styling, quietly duplicating Alena | Low with the code-review gate in §7, higher without it | Medium — fragments the product's trusted assistant relationship | Explicit review-gate language in §7; flagged in PR templates for `mirror-studio` changes |
| Retailer 3D-asset supply for Accessories Studio is slower than expected | Medium — this is an external dependency | Low-medium — P3.6 is already sequenced last specifically to absorb this risk without blocking the rest of the tier | Sequencing decision itself is the mitigation; do not pull P3.6 forward to "keep momentum" if assets aren't ready |
| Wardrobe cataloguing offline queue grows unbounded on low-storage devices | Low | Medium | Reuse the existing health-logging outbox's storage-cap and sync-retry patterns rather than inventing new limits |
| `mirror_catalogue` kind-value sprawl makes the table hard to query as new kinds accumulate | Low at Pre-Tier 3 scale | Low | Revisit only if a 7th+ kind is proposed post-Pre-Tier 3; not a blocker for this tier |

---

## 17. Appendix

### 17.1 New environment / secret references

No new secrets. All new YouCam capabilities authenticate via the existing `youcam_api_key` inside the packed secret `girlcode360/{env}/app`, per the master plan's minimise-secret-count principle (§5.2).

### 17.2 New endpoint quick reference

| Purpose | Method & Path |
|---|---|
| Makeup try-on (live/photo/transfer) | `POST /v1/mirror-studio/makeup/*` |
| Shade match | `POST /v1/mirror-studio/shade-match` |
| Hair diagnostic | `POST /v1/mirror-studio/hair/analysis` |
| Hair colour/style try-on | `POST /v1/mirror-studio/hair/tryon` |
| Wardrobe cataloguing | `POST /v1/mirror-studio/wardrobe/items` |
| Wardrobe outfit suggestion | `POST /v1/mirror-studio/wardrobe/outfits/suggest` |
| Style Analytics | `GET /v1/mirror-studio/style-analytics` |
| Accessories try-on | `POST /v1/mirror-studio/accessories/*` |
| Resale listing | `POST /v1/mirror-studio/resale/listings` |

### 17.3 Migration file mapping

| Migration | Phase | Tables |
|---|---|---|
| `017_pretier3_makeup_shade.sql` | P3.1 | `makeup_looks`, `shade_matches` |
| `018_pretier3_hair.sql` | P3.3 | `hair_scans` |
| `019_pretier3_wardrobe.sql` | P3.4 | `wardrobe_items`, `wardrobe_outfits` |
| `020_pretier3_accessories_resale.sql` | P3.6 | `accessory_looks`, `resale_listings`; `mirror_catalogue` kind extension (no schema change) |

### 17.4 Source documents this plan is grounded in

- `girlcode-imp-plan.md` (Master Technical Implementation Plan v1.3) — current locked stack, conventions, and Tier 1/2 status this plan extends
- `GirlCode360_Mirror_Feature_Spec.docx` §6 — Pre-Tier 3 feature definitions, competitive grounding, NFR-STU series
- `GirlCode360_PRD_v1.4.docx` §3.11 — explicit functional requirements FR-112 to FR-143
- `GirlCode360_AI_Features_Spec.docx` §8 — AI Stylist / Style Analytics extension addendum
- `GirlCode360_6Month_Roadmap_v4.docx` §4C — phase sequencing and monetisation target, expanded here into full engineering detail
- Perfect Corp. YouCam API developer documentation (`docs.perfectcorp.com/develop/*`, `docs.perfectcorp.com/reference/*`)

---

*GirlCode360 — Pre-Tier 3 Implementation Plan v1.0 · Confidential · 14 August 2026*