/** Shared API contracts */

export type Market = "UK" | "NG" | "GH";

export type HealthModule =
  | "period_tracker"
  | "pcos_manager"
  | "pregnancy"
  | "ttc"
  | "wallet";

export type ConsentPurpose =
  | "health_data"
  | "analytics"
  | "marketing"
  | "location"
  | "ai_alena"
  | "ai_healthlens"
  | "mirror_biometric"
  | "mirror_live_camera"
  | "wardrobe"
  | "shematch";

export type HealthResponse = {
  ok: boolean;
  service: string;
  environment: string;
  ts: string;
  policyVersion?: string;
  viewerCountry?: string | null;
  suggestedMarket?: Market | null;
};

export type UserProfile = {
  sub: string;
  email?: string;
  market: Market;
  locale: string;
  ageConfirmed18: boolean;
  onboardingComplete: boolean;
  modules: HealthModule[];
  createdAt: string;
  updatedAt: string;
};

export type ConsentRecord = {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  jurisdiction: Market;
  recordedAt: string;
};

export type BootstrapRequest = {
  market?: Market;
  locale?: string;
  ageConfirmed18: boolean;
};

export type PatchUserRequest = {
  market?: Market;
  locale?: string;
  ageConfirmed18?: boolean;
  onboardingComplete?: boolean;
};

export type PatchModulesRequest = {
  modules: HealthModule[];
};

export type PostConsentsRequest = {
  jurisdiction: Market;
  policyVersion: string;
  items: Array<{ purpose: ConsentPurpose; granted: boolean }>;
};

export const CURRENT_POLICY_VERSION = "2026-07-v1";

export const ALL_MODULES: HealthModule[] = [
  "period_tracker",
  "pcos_manager",
  "pregnancy",
  "ttc",
  "wallet",
];

/* ——— Phase 2: Period Tracker ——— */

export type FlowLevel = "none" | "spotting" | "light" | "medium" | "heavy";

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export type Cycle = {
  id: string;
  startDate: string;
  endDate: string | null;
  /** Manual override for next-cycle length (FR-020) */
  cycleLengthOverride: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CycleDay = {
  date: string;
  flow: FlowLevel;
  mood: MoodLevel | null;
  symptomIds: string[];
  note: string | null;
  updatedAt: string;
};

export type SymptomDef = {
  id: string;
  label: string;
  category: "pain" | "digestive" | "mood" | "skin" | "energy" | "other";
};

export type CreateCycleRequest = {
  startDate: string;
  endDate?: string | null;
  cycleLengthOverride?: number | null;
};

export type PatchCycleRequest = {
  startDate?: string;
  endDate?: string | null;
  cycleLengthOverride?: number | null;
};

export type UpsertCycleDayRequest = {
  date: string;
  flow?: FlowLevel;
  mood?: MoodLevel | null;
  symptomIds?: string[];
  note?: string | null;
};

export type PredictionResponse = {
  cycleLengthDays: number;
  periodLengthDays: number;
  nextStarts: string[];
  confidenceBandDays: number;
  highVariance: boolean;
  message: string;
  /** Flattened predicted bleeding dates for calendar */
  predictedDates: string[];
  enoughData: boolean;
};

export type SyncOp =
  | { op: "upsert_cycle"; cycle: CreateCycleRequest & { id?: string } }
  | { op: "patch_cycle"; id: string; patch: PatchCycleRequest }
  | { op: "delete_cycle"; id: string }
  | { op: "upsert_day"; day: UpsertCycleDayRequest };

export type SyncRequest = {
  ops: SyncOp[];
};

export type SyncResponse = {
  idempotencyKey: string;
  applied: number;
  cycles: Cycle[];
  days: CycleDay[];
  prediction: PredictionResponse;
};

/* ——— Phase 3: PCOS Manager ——— */

export type BiometricLog = {
  date: string;
  weightKg: number | null;
  sleepHours: number | null;
  waterGlasses: number | null;
  stress: 1 | 2 | 3 | 4 | 5 | null;
  updatedAt: string;
};

export type UpsertBiometricRequest = {
  date: string;
  weightKg?: number | null;
  sleepHours?: number | null;
  waterGlasses?: number | null;
  stress?: 1 | 2 | 3 | 4 | 5 | null;
};

export type MedicationReminder = {
  id: string;
  name: string;
  dosage: string | null;
  /** HH:mm local */
  timeLocal: string;
  frequency: "daily" | "weekdays" | "custom";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateMedicationRequest = {
  name: string;
  dosage?: string | null;
  timeLocal: string;
  frequency?: "daily" | "weekdays" | "custom";
  enabled?: boolean;
};

export type PatchMedicationRequest = {
  name?: string;
  dosage?: string | null;
  timeLocal?: string;
  frequency?: "daily" | "weekdays" | "custom";
  enabled?: boolean;
};

export type PcosInsight = {
  id: string;
  title: string;
  body: string;
  kind: "irregularity" | "co_occurrence" | "data";
};

export type PcosArticle = {
  id: string;
  title: string;
  markets: Market[];
  summary: string;
  body: string;
  reviewedAt?: string;
  outdated?: boolean;
};

export type PushSubscriptionRequest = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** FR-068 — notification bodies never contain health content */
export const GENERIC_PUSH_BODY = "You have a note in GirlCode360";

/* ——— Phase 4: Pregnancy + TTC ——— */

export type PregnancyProfile = {
  method: "lmp" | "conception";
  anchorDate: string;
  edd: string;
  eddEarly: string;
  eddLate: string;
  prePregnancyWeightKg?: number | null;
  heightCm?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InitPregnancyRequest = {
  method: "lmp" | "conception";
  anchorDate: string;
};

export type PatchPregnancyRequest = {
  prePregnancyWeightKg?: number | null;
  heightCm?: number | null;
};

export type PregnancyDayLog = {
  date: string;
  symptoms: string[];
  wellbeing: 1 | 2 | 3 | 4 | 5 | null;
  weightKg: number | null;
  kicks: number | null;
  kickSessionMinutes: number | null;
  note: string | null;
  updatedAt: string;
};

export type UpsertPregnancyDayRequest = {
  date: string;
  symptoms?: string[];
  wellbeing?: 1 | 2 | 3 | 4 | 5 | null;
  weightKg?: number | null;
  kicks?: number | null;
  kickSessionMinutes?: number | null;
  note?: string | null;
};

export type Appointment = {
  id: string;
  date: string;
  timeLocal: string | null;
  location: string | null;
  type: string;
  notes: string | null;
  remindDayBefore: boolean;
  remindHourBefore: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAppointmentRequest = {
  date: string;
  timeLocal?: string | null;
  location?: string | null;
  type: string;
  notes?: string | null;
  remindDayBefore?: boolean;
  remindHourBefore?: boolean;
};

export type WeekContent = {
  week: number;
  title: string;
  baby: string;
  maternal: string;
  nutrition: string;
  priority: boolean;
  clinicalNote?: string;
};

export type TtcProfile = {
  startedOn: string;
  monthsTrying: number;
  twelveMonthPrompt: string | null;
  updatedAt: string;
};

export type InitTtcRequest = {
  startedOn?: string;
};

export type MucusType =
  | "dry"
  | "sticky"
  | "creamy"
  | "watery"
  | "egg_white"
  | "not_sure";

export type TtcDayLog = {
  date: string;
  bbtC: number | null;
  mucus: MucusType | null;
  intimacy: boolean;
  intimacyCiphertext: string | null;
  intimacyIv: string | null;
  note: string | null;
  updatedAt: string;
};

export type UpsertTtcDayRequest = {
  date: string;
  bbtC?: number | null;
  mucus?: MucusType | null;
  intimacy?: boolean;
  intimacyCiphertext?: string | null;
  intimacyIv?: string | null;
  note?: string | null;
  intimacyConsent?: boolean;
};

export type FertileWindowResponse = {
  ovulationDay: string;
  fertileStart: string;
  fertileEnd: string;
  fertileDates: string[];
  cycleLengthDays: number;
  message: string;
  enoughData: boolean;
};

export type NotificationPrefs = {
  masterEnabled: boolean;
  period: boolean;
  ovulation: boolean;
  appointments: boolean;
  medication: boolean;
  weeklyInsights: boolean;
  /** FR-019: 1, 2, or 3 days before predicted start */
  periodLeadDays: 1 | 2 | 3;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
};

export type PatchNotificationPrefsRequest = Partial<
  Omit<NotificationPrefs, "updatedAt">
>;

export type EmergencyNumber = {
  label: string;
  number: string;
};

/* ——— Phase 6: Alena + HealthLens ——— */

export type AlenaMode = "context" | "anonymous";

export type AlenaChatRequest = {
  message: string;
  mode: AlenaMode;
  moduleHint?: HealthModule;
  openedFrom?: "cycle" | "health" | "mirror" | "home" | "library";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Session climate for stylist questions — not persisted, not a weather API. */
  climate?: "hot" | "temperate" | "cold" | "mixed";
};

export type AlenaChatResponse = {
  reply: string;
  crisis: boolean;
  stub: boolean;
  quota: { used: number; limit: number | null; remaining: number | null };
  disclaimer: string;
  actions: Array<{ id: string; label: string }>;
};

export type HealthLensStatus = {
  activated: boolean;
  cyclesLogged: number;
  cyclesNeeded: number;
  loggingSpanDays: number;
  daysNeeded: number;
  progressLabel: string;
  populationLearningConsent: boolean;
};

export type HealthLensReport = {
  id: string;
  createdAt: string;
  narrative: string;
  confidence: "Low" | "Medium" | "High";
  findings: Array<{
    id: string;
    title: string;
    body: string;
    confidence: "Low" | "Medium" | "High";
    discussWithProvider: boolean;
  }>;
  stub: boolean;
};

export type PrepCardResponse = {
  text: string;
  filename: string;
  createdAt: string;
};

/* ——— Phase 5: Health Wallet ——— */

export type WalletCategory =
  | "test_results"
  | "prescriptions"
  | "scan_images"
  | "vaccination"
  | "insurance"
  | "other";

export const WALLET_CATEGORIES: WalletCategory[] = [
  "test_results",
  "prescriptions",
  "scan_images",
  "vaccination",
  "insurance",
  "other",
];

/** FR-046 — PDF, JPEG, PNG only. */
export const WALLET_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export function isAllowedWalletUpload(
  filename: string,
  contentType: string,
): boolean {
  const name = filename.toLowerCase();
  const extOk =
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png");
  const type = contentType.toLowerCase();
  const typeOk =
    !type ||
    type === "application/octet-stream" ||
    (WALLET_ALLOWED_TYPES as readonly string[]).includes(type) ||
    type === "image/jpg";
  return extOk && typeOk;
}

export type WalletDocMeta = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: WalletCategory;
  customLabel: string | null;
  noteCiphertext: string | null;
  noteIv: string | null;
  wrappedDek: string;
  wrappedDekIv: string;
  fileIv: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAfter: string | null;
};

export type CreateWalletUploadRequest = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: WalletCategory;
  customLabel?: string | null;
  noteCiphertext?: string | null;
  noteIv?: string | null;
  wrappedDek: string;
  wrappedDekIv: string;
  fileIv: string;
};

export type PatchWalletDocRequest = {
  category?: WalletCategory;
  customLabel?: string | null;
  noteCiphertext?: string | null;
  noteIv?: string | null;
};

export type CreateWalletUploadResponse = {
  doc: WalletDocMeta;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

export type WalletShare = {
  id: string;
  token: string;
  docId: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

/** List/revoke shape — plaintext token is never returned after create. */
export type WalletShareListItem = {
  id: string;
  docId: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

export type CreateWalletShareRequest = {
  expiresIn: "24h" | "48h" | "7d";
};

export type WalletSharePublic = {
  token: string;
  filename: string;
  contentType: string;
  fileIv: string;
  expiresAt: string;
  downloadUrl: string;
};

/* ——— Phase 7: Privacy, billing, content ——— */

export type MyDataSnapshot = {
  profile: UserProfile;
  consents: ConsentRecord[];
  modules: HealthModule[];
  counts: {
    cycles: number;
    cycleDays: number;
    biometrics: number;
    medications: number;
    walletDocs: number;
    pregnancyDays: number;
    ttcDays: number;
    healthLensReports: number;
    skinScans?: number;
    apparelTryons?: number;
    appointments?: number;
    marketplaceListingsOwned?: number;
    marketplaceFavourites?: number;
    walletMedications?: number;
    reportsFiled?: number;
    communityGroupsJoined?: number;
    inAppNotifications?: number;
    makeupLooks?: number;
    shadeMatches?: number;
    hairScans?: number;
    wardrobeItems?: number;
    wardrobeOutfits?: number;
  };
  inventory?: {
    email: string | null;
    market: Market;
    locale: string;
    modules: HealthModule[];
    consentsGranted: ConsentPurpose[];
    shematchGranted: boolean;
    shematchModulesOn: string[];
    notifications: {
      masterEnabled: boolean;
      quietHoursStart: string;
      quietHoursEnd: string;
    };
    deletionStatus: string;
    purgeAfter: string | null;
  };
  premium: boolean;
  deletion: DeletionRequest | null;
  exportedAt: string;
};

export type ExportJob = {
  id: string;
  status: "pending" | "ready" | "failed";
  createdAt: string;
  readyAt: string | null;
  downloadHint: string;
  /** Present when status=ready (in-memory sync export) */
  payload?: Record<string, unknown>;
};

export type DeletionRequest = {
  id: string;
  requestedAt: string;
  purgeAfter: string;
  cancelledAt: string | null;
  purgedAt: string | null;
  status: "cooling_off" | "cancelled" | "purged";
};

export type BillingProvider = "stripe" | "paystack" | "dev";

export type BillingStatus = {
  premium: boolean;
  provider: BillingProvider | null;
  plan: "free" | "premium";
  renewsAt: string | null;
};

export type CheckoutRequest = {
  provider: "stripe" | "paystack";
  successUrl?: string;
  cancelUrl?: string;
};

export type CheckoutResponse = {
  provider: "stripe" | "paystack";
  /** Stub checkout URL until live keys are wired */
  checkoutUrl: string;
  sessionId: string;
  message: string;
};

export type ContentArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  topic: "pcos" | "cycle" | "pregnancy" | "ttc" | "privacy" | "general";
  markets: Market[];
  reviewedAt: string;
  outdated: boolean;
};

export type ContentReportReason =
  | "inaccurate"
  | "harmful"
  | "spam"
  | "privacy"
  | "other";

export type ContentReport = {
  id: string;
  reporterSub: string;
  targetType: "article" | "post" | "listing" | "review";
  targetId: string;
  reason: ContentReportReason;
  details: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
};

export type CreateContentReportRequest = {
  targetType: ContentReport["targetType"];
  targetId: string;
  reason: ContentReportReason;
  details?: string;
};

/* ——— Phase 2.3 community + in-app marketing ——— */

export type CommunityGroupId =
  | "ttc_circle"
  | "pcos_warriors"
  | "pregnancy_journey"
  | "period_health";

export type CommunityGroupView = {
  id: CommunityGroupId;
  name: string;
  body: string;
  joined: boolean;
  displayName: string | null;
  memberCount: number;
};

export type CommunityPostStatus = "pending" | "live" | "rejected";

export type CommunityPost = {
  id: string;
  groupId: CommunityGroupId;
  authorDisplay: string;
  body: string;
  status: CommunityPostStatus;
  mine: boolean;
  createdAt: string;
};

export type CreateCommunityPostRequest = {
  body: string;
};

export type InAppKind = "new_listing" | "promo";

export type InAppNotification = {
  id: string;
  kind: InAppKind;
  title: string;
  body: string;
  listingId: string | null;
  readAt: string | null;
  createdAt: string;
};

/* ——— Phase 1.4 Mirror ——— */

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export type MirrorTaskStatus = "pending" | "success" | "error";

export type MirrorInsight = {
  title: string;
  body: string;
  confidence: "Low" | "Medium" | "High";
  enoughScans: boolean;
  patternFound: boolean;
};

export type SkinScan = {
  id: string;
  status: MirrorTaskStatus;
  createdAt: string;
  cycleDayAtScan: number | null;
  cyclePhaseAtScan: CyclePhase | null;
  overallScore: number | null;
  scores: Record<string, number>;
  skinType?: string;
  hasResultImage: boolean;
  hasMask: boolean;
  insight: MirrorInsight | null;
  seeded: boolean;
  scanQuality: "sd" | "hd";
};

export type ApparelTryOn = {
  id: string;
  status: MirrorTaskStatus;
  createdAt: string;
  catalogueItemId: string;
  hasResultImage: boolean;
};

export type MirrorCatalogueKind =
  | "skincare"
  | "apparel"
  | "makeup"
  | "jewellery"
  | "eyewear"
  | "nail_color";

export type MirrorCatalogueItem = {
  id: string;
  kind: MirrorCatalogueKind;
  title: string;
  subtitle: string;
  tags: string[];
  garmentCategory?: "upper_body" | "lower_body" | "full_body";
  /** Internal YouCam styling hint — never shown as model internals. */
  tryOnPrompt?: string;
  refImageUrl?: string;
  boutiqueName: string;
  boutiqueArea: string;
  trimester?: 1 | 2 | 3 | null;
  pmosFit: boolean;
  brandCode?: string;
  shadeCode?: string;
  shadeFamily?: string;
  accessoryCategory?: "ring" | "bracelet" | "watch" | "earring" | "necklace";
  nailColor?: string;
  /** True when a retailer 3D asset or frame/nail sku is present. Never inferred from a 2D photo. */
  tryOnReady?: boolean;
};

export type MirrorStatus = {
  consented: boolean;
  liveCameraConsented: boolean;
  wardrobeConsented: boolean;
  youcamConfigured: boolean;
  youcamAvailable: boolean;
};

export type MakeupLook = {
  id: string;
  status: MirrorTaskStatus;
  sourceKind: "live" | "photo" | "transfer";
  categories: string[];
  saved: boolean;
  hasResultImage: boolean;
  createdAt: string;
};

export type ShadeTwin = {
  catalogueId: string;
  brandCode: string;
  shadeCode: string;
  family: string;
  boutiqueName: string;
  boutiqueArea: string;
  confidence: "low" | "medium" | "high";
};

export type ShadeMatch = {
  id: string;
  sourceScanId: string;
  fitzpatrickType: string | null;
  wellnessNote: string;
  overallConfidence: "Low" | "Medium" | "High";
  twins: ShadeTwin[];
  createdAt: string;
};

export type HairScanKind = "analysis" | "tryon";

export type HairScan = {
  id: string;
  kind: HairScanKind;
  status: MirrorTaskStatus;
  createdAt: string;
  cycleDayAtScan: number | null;
  cyclePhaseAtScan: CyclePhase | null;
  scores: {
    hair_type?: string | null;
    hair_length?: number | null;
    hair_frizziness?: number | null;
    hair_density?: number | null;
  };
  hairColor: string | null;
  hairstyleId: string | null;
  hasResultImage: boolean;
  insight: MirrorInsight | null;
};

export type WardrobeItem = {
  id: string;
  name: string | null;
  category: string | null;
  colourTags: string[];
  suggestedColourTags: string[];
  suggestedCategory: string | null;
  purchasePriceMinor: number | null;
  wornCount: number;
  archived: boolean;
  hasImage: boolean;
  createdAt: string;
};

export type WardrobeOutfit = {
  id: string;
  itemIds: string[];
  occasion: string | null;
  wornOn: string | null;
  status: MirrorTaskStatus | "ready";
  hasResultImage: boolean;
  createdAt: string;
};

export type WardrobePackingList = {
  itemIds: string[];
  notes: string[];
  enoughItems: boolean;
};

export type StyleCostPerWear = {
  itemId: string;
  name: string | null;
  wornCount: number;
  purchasePriceMinor: number | null;
  costPerWearMinor: number | null;
};

export type StylePoint = {
  id: string;
  createdAt: string;
  label: string;
  value: number | null;
};

export type StyleAnalytics = {
  windowDays: number;
  utilisationPct: number | null;
  itemsCatalogued: number;
  itemsWornInWindow: number;
  costPerWear: StyleCostPerWear[];
  skinTrend: StylePoint[];
  hairTrend: StylePoint[];
  shadeHistory: StylePoint[];
  newConsentRequired: false;
};

export type DailyOutfitSuggestion = {
  itemIds: string[];
  notes: string[];
  enoughItems: boolean;
  shopFirst: false;
  climate: string;
  climateSource: "session" | "market_default";
};

export type AccessoryLookKind = "jewellery" | "eyewear" | "nail";

export type AccessoryLook = {
  id: string;
  kind: AccessoryLookKind;
  status: MirrorTaskStatus;
  catalogueItemId: string;
  accessoryCategory: string | null;
  hasResultImage: boolean;
  createdAt: string;
};

export type ResaleListingStatus = "pending_moderation" | "live" | "rejected";

export type ResaleListing = {
  id: string;
  wardrobeItemId: string;
  title: string;
  details: string;
  priceMinor: number;
  status: ResaleListingStatus;
  peerLabel: "from a GirlCode360 member";
  market: Market;
  hasImage: boolean;
  createdAt: string;
  mine?: boolean;
};

export type CreateSkinScanRequest = {
  imageB64: string;
  contentType?: string;
};

export type CreateTryOnRequest = {
  imageB64: string;
  contentType?: string;
  catalogueItemId: string;
};

/* ——— Phase 1.7 Marketplace / SheMatch ——— */

export type MarketplaceCategory =
  | "beauty"
  | "boutique"
  | "pharmacy"
  | "clinic";

export type MarketplaceListingStatus = "pending" | "live" | "rejected";

export type MarketplaceListing = {
  id: string;
  name: string;
  category: MarketplaceCategory;
  market: Market;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  hours: Record<
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
    [string, string] | null
  >;
  rating: number;
  tags: string[];
  services: string[];
  registrationNumber: string | null;
  seeded: boolean;
  status: MarketplaceListingStatus;
  catalogueItemId: string | null;
  sponsored: boolean;
  distanceKm: number | null;
  openNow: boolean | null;
  reviewCount?: number;
  reviewAverage?: number | null;
  favourite?: boolean;
};

export type CreateBusinessListingRequest = {
  name: string;
  category: MarketplaceCategory;
  market: Market;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  hours?: MarketplaceListing["hours"];
  tags?: string[];
  services?: string[];
  registrationNumber?: string | null;
};

export type PatchOwnedListingRequest = {
  tags?: string[];
  services?: string[];
  catalogueItemId?: string | null;
};

export type ListingReview = {
  id: string;
  listingId: string;
  stars: number;
  body: string;
  status: "pending" | "live" | "rejected";
  mine?: boolean;
  createdAt: string;
};

export type CreateListingReviewRequest = {
  stars: number;
  body: string;
};

export type WalletMedication = {
  id: string;
  nameCiphertext: string;
  nameIv: string;
  doseCiphertext: string | null;
  doseIv: string | null;
  timeLocal: string;
  frequency: "daily" | "weekdays";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateWalletMedicationRequest = {
  nameCiphertext: string;
  nameIv: string;
  doseCiphertext?: string | null;
  doseIv?: string | null;
  timeLocal: string;
  frequency?: "daily" | "weekdays";
  enabled?: boolean;
};

export type SheMatchTriggerId =
  | "period_start"
  | "fertile_window"
  | "pregnancy_scan"
  | "pregnancy_emergency"
  | "pcos_acne"
  | "medication_due"
  | "mirror_skin"
  | "mirror_shade"
  | "mirror_nail";

export type SheMatchSuggestion = {
  listing: MarketplaceListing;
  triggerId: SheMatchTriggerId;
  why: string;
  label: "Suggested based on your health activity";
  sponsoredLabel: "Sponsored" | null;
};

export type SheMatchPrefs = {
  granted: boolean;
  modules: Record<HealthModule, boolean>;
};


