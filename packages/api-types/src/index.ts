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
  | "ai_zara"
  | "ai_healthlens";

export type HealthResponse = {
  ok: boolean;
  service: string;
  environment: string;
  ts: string;
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
  createdAt: string;
  updatedAt: string;
};

export type InitPregnancyRequest = {
  method: "lmp" | "conception";
  anchorDate: string;
};

export type PregnancyDayLog = {
  date: string;
  symptoms: string[];
  wellbeing: 1 | 2 | 3 | 4 | 5 | null;
  weightKg: number | null;
  kicks: number | null;
  note: string | null;
  updatedAt: string;
};

export type UpsertPregnancyDayRequest = {
  date: string;
  symptoms?: string[];
  wellbeing?: 1 | 2 | 3 | 4 | 5 | null;
  weightKg?: number | null;
  kicks?: number | null;
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
  note: string | null;
  updatedAt: string;
};

export type UpsertTtcDayRequest = {
  date: string;
  bbtC?: number | null;
  mucus?: MucusType | null;
  intimacy?: boolean;
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

/* ——— Phase 6: Zara + HealthLens ——— */

export type ZaraMode = "context" | "anonymous";

export type ZaraChatRequest = {
  message: string;
  mode: ZaraMode;
  moduleHint?: HealthModule;
};

export type ZaraChatResponse = {
  reply: string;
  crisis: boolean;
  stub: boolean;
  quota: { used: number; limit: number | null; remaining: number | null };
  disclaimer: string;
  actions: Array<{ id: "prep_card"; label: string }>;
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

export type WalletDocMeta = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: WalletCategory;
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
  noteCiphertext?: string | null;
  noteIv?: string | null;
  wrappedDek: string;
  wrappedDekIv: string;
  fileIv: string;
};

export type CreateWalletUploadResponse = {
  doc: WalletDocMeta;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

export type WalletShare = {
  token: string;
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
};

