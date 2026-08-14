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
  | "shematch";

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

export type FlowLevel = "none" | "spotting" | "light" | "medium" | "heavy";
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export type Cycle = {
  id: string;
  startDate: string;
  endDate: string | null;
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

export type SyncOp =
  | { op: "upsert_cycle"; cycle: CreateCycleRequest & { id?: string } }
  | { op: "patch_cycle"; id: string; patch: PatchCycleRequest }
  | { op: "delete_cycle"; id: string }
  | { op: "upsert_day"; day: UpsertCycleDayRequest };

export type SyncRequest = {
  ops: SyncOp[];
};

export type PredictionResponse = {
  cycleLengthDays: number;
  periodLengthDays: number;
  nextStarts: string[];
  confidenceBandDays: number;
  highVariance: boolean;
  message: string;
  predictedDates: string[];
  enoughData: boolean;
};

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

export type PushSubscriptionRequest = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export const GENERIC_PUSH_BODY = "You have a note in GirlCode360";

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

export type TtcProfile = {
  startedOn: string;
  updatedAt: string;
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

export type NotificationPrefs = {
  masterEnabled: boolean;
  period: boolean;
  ovulation: boolean;
  appointments: boolean;
  medication: boolean;
  weeklyInsights: boolean;
  periodLeadDays: 1 | 2 | 3;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
};

export type PatchNotificationPrefsRequest = Partial<
  Omit<NotificationPrefs, "updatedAt">
>;

export type WalletCategory =
  | "test_results"
  | "prescriptions"
  | "scan_images"
  | "vaccination"
  | "insurance"
  | "other";

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

export type CreateWalletShareRequest = {
  expiresIn: "24h" | "48h" | "7d";
};

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

export type MirrorCatalogueItem = {
  id: string;
  kind: "skincare" | "apparel";
  title: string;
  subtitle: string;
  tags: string[];
  garmentCategory?: "upper_body" | "lower_body" | "full_body";
  tryOnPrompt?: string;
  refImageUrl?: string;
  boutiqueName: string;
  boutiqueArea: string;
  trimester?: 1 | 2 | 3 | null;
  pmosFit: boolean;
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

export type MarketplaceCategory =
  | "beauty"
  | "boutique"
  | "pharmacy"
  | "clinic";

export type MarketplaceListingStatus = "pending" | "live" | "rejected";

export type MarketplaceHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  [string, string] | null
>;

export type MarketplaceListing = {
  id: string;
  name: string;
  category: MarketplaceCategory;
  market: Market;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  hours: MarketplaceHours;
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
  ownerSub?: string | null;
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
  hours?: MarketplaceHours;
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
  | "mirror_skin";

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
  authorSub?: string;
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


