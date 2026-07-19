/**
 * GirlCode360 API client — Cognito JWT (or local Bearer dev.* for offline API).
 */
import {
  ALL_MODULES,
  CURRENT_POLICY_VERSION,
  type BootstrapRequest,
  type ConsentPurpose,
  type CreateCycleRequest,
  type Cycle,
  type CycleDay,
  type HealthModule,
  type Market,
  type PatchCycleRequest,
  type PatchModulesRequest,
  type PatchUserRequest,
  type PostConsentsRequest,
  type PredictionResponse,
  type SyncOp,
  type SyncResponse,
  type UpsertCycleDayRequest,
  type UserProfile,
} from "../../../../packages/api-types/src/index";
import { apiBaseUrl } from "./config";
import { getCurrentSession } from "./cognito";

export {
  ALL_MODULES,
  CURRENT_POLICY_VERSION,
  type ConsentPurpose,
  type CreateCycleRequest,
  type Cycle,
  type CycleDay,
  type HealthModule,
  type Market,
  type PredictionResponse,
  type UpsertCycleDayRequest,
  type UserProfile,
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function authHeader(): Promise<string> {
  try {
    const session = await getCurrentSession();
    if (session) return `Bearer ${session.getIdToken().getJwtToken()}`;
  } catch {
    /* Cognito not configured — fall through to local dev token */
  }
  let raw = sessionStorage.getItem("gc360.devSub");
  if (!raw) {
    raw = JSON.stringify({
      sub: "local-dev-user",
      email: "dev@girlcode360.local",
    });
    sessionStorage.setItem("gc360.devSub", raw);
  }
  return `Bearer dev.${toBase64Url(raw)}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError(0, "api_base_url_missing");
  }
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) code = j.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getMe(): Promise<UserProfile> {
  return request<UserProfile>("GET", "/v1/users/me");
}

export function bootstrap(body: BootstrapRequest): Promise<UserProfile> {
  return request<UserProfile>("POST", "/v1/users/me/bootstrap", body);
}

export function patchMe(body: PatchUserRequest): Promise<UserProfile> {
  return request<UserProfile>("PATCH", "/v1/users/me", body);
}

export function patchModules(body: PatchModulesRequest): Promise<UserProfile> {
  return request<UserProfile>("PATCH", "/v1/users/me/modules", body);
}

export function postConsents(body: PostConsentsRequest): Promise<unknown> {
  return request("POST", "/v1/consents", body);
}

export function getCycles(): Promise<{
  cycles: Cycle[];
  days: CycleDay[];
  prediction: PredictionResponse;
}> {
  return request("GET", "/v1/cycles");
}

export function createCycle(
  body: CreateCycleRequest,
): Promise<{ cycle: Cycle; prediction: PredictionResponse }> {
  return request("POST", "/v1/cycles", body);
}

export function patchCycle(
  id: string,
  body: PatchCycleRequest,
): Promise<{ cycle: Cycle; prediction: PredictionResponse }> {
  return request("PATCH", `/v1/cycles/${id}`, body);
}

export function upsertCycleDay(
  body: UpsertCycleDayRequest,
): Promise<{ day: CycleDay }> {
  return request("PUT", "/v1/cycles/days", body);
}

export function syncCycles(
  ops: SyncOp[],
  idempotencyKey: string,
): Promise<SyncResponse> {
  return request(
    "POST",
    "/v1/cycles/sync",
    { ops },
    { "Idempotency-Key": idempotencyKey },
  );
}

export function getPcosBiometrics(): Promise<{
  biometrics: import("../../../../packages/api-types/src/index").BiometricLog[];
}> {
  return request("GET", "/v1/pcos/biometrics");
}

export function upsertPcosBiometric(
  body: import("../../../../packages/api-types/src/index").UpsertBiometricRequest,
) {
  return request<{
    biometric: import("../../../../packages/api-types/src/index").BiometricLog;
  }>("PUT", "/v1/pcos/biometrics", body);
}

export function getPcosMedications(): Promise<{
  medications: import("../../../../packages/api-types/src/index").MedicationReminder[];
}> {
  return request("GET", "/v1/pcos/medications");
}

export function createPcosMedication(
  body: import("../../../../packages/api-types/src/index").CreateMedicationRequest,
) {
  return request<{
    medication: import("../../../../packages/api-types/src/index").MedicationReminder;
  }>("POST", "/v1/pcos/medications", body);
}

export function deletePcosMedication(id: string) {
  return request<{ ok: boolean }>("DELETE", `/v1/pcos/medications/${id}`);
}

export function getPcosInsights(): Promise<{
  insights: import("../../../../packages/api-types/src/index").PcosInsight[];
  disclaimer: string;
}> {
  return request("GET", "/v1/pcos/insights");
}

export function getPcosArticles(market?: Market): Promise<{
  articles: import("../../../../packages/api-types/src/index").PcosArticle[];
}> {
  const q = market ? `?market=${market}` : "";
  return request("GET", `/v1/pcos/articles${q}`);
}

export function registerPushSubscription(body: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  return request("POST", "/v1/pcos/push-subscription", body);
}

export function getEmergency() {
  return request<{
    market: Market;
    numbers: import("../../../../packages/api-types/src/index").EmergencyNumber[];
  }>("GET", "/v1/emergency");
}

export function getNotificationPrefs() {
  return request<{
    prefs: import("../../../../packages/api-types/src/index").NotificationPrefs;
  }>("GET", "/v1/notifications/prefs");
}

export function patchNotificationPrefs(
  body: import("../../../../packages/api-types/src/index").PatchNotificationPrefsRequest,
) {
  return request<{
    prefs: import("../../../../packages/api-types/src/index").NotificationPrefs;
  }>("PATCH", "/v1/notifications/prefs", body);
}

export function getPregnancy() {
  return request<{
    profile: import("../../../../packages/api-types/src/index").PregnancyProfile;
    week: number;
  }>("GET", "/v1/pregnancy");
}

export function initPregnancy(
  body: import("../../../../packages/api-types/src/index").InitPregnancyRequest,
) {
  return request<{
    profile: import("../../../../packages/api-types/src/index").PregnancyProfile;
    week: number;
  }>("POST", "/v1/pregnancy", body);
}

export function getPregnancyWeek(week: number) {
  return request<{
    week: import("../../../../packages/api-types/src/index").WeekContent;
  }>("GET", `/v1/pregnancy/weeks?week=${week}`);
}

export function upsertPregnancyDay(
  body: import("../../../../packages/api-types/src/index").UpsertPregnancyDayRequest,
) {
  return request("PUT", "/v1/pregnancy/days", body);
}

export function getAppointments() {
  return request<{
    appointments: import("../../../../packages/api-types/src/index").Appointment[];
  }>("GET", "/v1/pregnancy/appointments");
}

export function createAppointment(
  body: import("../../../../packages/api-types/src/index").CreateAppointmentRequest,
) {
  return request("POST", "/v1/pregnancy/appointments", body);
}

export function deleteAppointment(id: string) {
  return request("DELETE", `/v1/pregnancy/appointments/${id}`);
}

export function getTtc() {
  return request<{
    startedOn: string;
    monthsTrying: number;
    twelveMonthPrompt: string | null;
    updatedAt: string;
  }>("GET", "/v1/ttc");
}

export function initTtc(body?: { startedOn?: string }) {
  return request("POST", "/v1/ttc", body ?? {});
}

export function getFertileWindow() {
  return request<
    import("../../../../packages/api-types/src/index").FertileWindowResponse
  >("GET", "/v1/ttc/fertile-window");
}

export function upsertTtcDay(
  body: import("../../../../packages/api-types/src/index").UpsertTtcDayRequest,
) {
  return request("PUT", "/v1/ttc/days", body);
}

export function deleteTtcIntimacy(date: string) {
  return request("DELETE", `/v1/ttc/days/${date}/intimacy`);
}

export function listWalletDocs() {
  return request<{
    docs: import("../../../../packages/api-types/src/index").WalletDocMeta[];
  }>("GET", "/v1/wallet/docs");
}

export function createWalletUpload(
  body: import("../../../../packages/api-types/src/index").CreateWalletUploadRequest,
) {
  return request<{
    doc: import("../../../../packages/api-types/src/index").WalletDocMeta;
    uploadPath: string;
    uploadMethod: "PUT";
  }>("POST", "/v1/wallet/uploads", body);
}

export async function putWalletCiphertext(
  uploadPath: string,
  ciphertextB64: string,
) {
  return request("PUT", uploadPath, { ciphertextB64 });
}

export function getWalletObject(id: string) {
  return request<{
    ciphertextB64: string;
    fileIv: string;
    contentType: string;
    filename: string;
  }>("GET", `/v1/wallet/objects/${id}`);
}

export function deleteWalletDoc(id: string) {
  return request("DELETE", `/v1/wallet/docs/${id}`);
}

export function createWalletShare(
  docId: string,
  body: import("../../../../packages/api-types/src/index").CreateWalletShareRequest,
) {
  return request<{
    share: import("../../../../packages/api-types/src/index").WalletShare;
    hint: string;
  }>("POST", `/v1/wallet/docs/${docId}/shares`, body);
}

export function revokeWalletShare(token: string) {
  return request("DELETE", `/v1/wallet/shares/${token}`);
}

export function getPublicWalletShare(token: string) {
  return request<
    import("../../../../packages/api-types/src/index").WalletSharePublic
  >("GET", `/v1/wallet/share/${token}`);
}

export function getPublicWalletObject(token: string) {
  return request<{
    ciphertextB64: string;
    fileIv: string;
    contentType: string;
    filename: string;
  }>("GET", `/v1/wallet/share/${token}/object`);
}

/* ——— Phase 6: Zara + HealthLens ——— */

export function getZaraQuota() {
  return request<{
    quota: {
      used: number;
      limit: number | null;
      remaining: number | null;
    };
  }>("GET", "/v1/zara/quota");
}

export function postZaraChat(body: {
  message: string;
  mode: "context" | "anonymous";
}) {
  return request<
    import("../../../../packages/api-types/src/index").ZaraChatResponse
  >("POST", "/v1/zara/chat", body);
}

export function getHealthLensStatus() {
  return request<
    import("../../../../packages/api-types/src/index").HealthLensStatus
  >("GET", "/v1/healthlens/status");
}

export function setHealthLensPopulationConsent(granted: boolean) {
  return request<{
    status: import("../../../../packages/api-types/src/index").HealthLensStatus;
  }>("POST", "/v1/healthlens/population-consent", { granted });
}

export function generateHealthLensReport() {
  return request<{
    report: import("../../../../packages/api-types/src/index").HealthLensReport;
  }>("POST", "/v1/healthlens/report");
}

export function getLatestHealthLensReport() {
  return request<{
    report: import("../../../../packages/api-types/src/index").HealthLensReport;
  }>("GET", "/v1/healthlens/report");
}

export function createPrepCard(questions: string[] = []) {
  return request<
    import("../../../../packages/api-types/src/index").PrepCardResponse
  >("POST", "/v1/healthlens/prep-card", { questions });
}

/* ——— Phase 7: Privacy, billing, content ——— */

export function getConsents() {
  return request<{
    current: import("../../../../packages/api-types/src/index").ConsentRecord[];
    history: import("../../../../packages/api-types/src/index").ConsentRecord[];
  }>("GET", "/v1/consents");
}

export function getMyData() {
  return request<
    import("../../../../packages/api-types/src/index").MyDataSnapshot
  >("GET", "/v1/privacy/my-data");
}

export function requestDataExport() {
  return request<{
    job: import("../../../../packages/api-types/src/index").ExportJob;
  }>("POST", "/v1/privacy/export");
}

export function getExportJob(id: string) {
  return request<{
    job: import("../../../../packages/api-types/src/index").ExportJob;
  }>("GET", `/v1/privacy/export/${id}`);
}

export function requestAccountDeletion() {
  return request<{
    deletion: import("../../../../packages/api-types/src/index").DeletionRequest;
  }>("POST", "/v1/privacy/delete");
}

export function cancelAccountDeletion() {
  return request<{
    deletion: import("../../../../packages/api-types/src/index").DeletionRequest;
  }>("POST", "/v1/privacy/delete/cancel");
}

export function getDeletionStatus() {
  return request<{
    deletion: import("../../../../packages/api-types/src/index").DeletionRequest | null;
  }>("GET", "/v1/privacy/delete");
}

export function getBillingStatus() {
  return request<
    import("../../../../packages/api-types/src/index").BillingStatus
  >("GET", "/v1/billing/status");
}

export function startCheckout(provider: "stripe" | "paystack" = "stripe") {
  return request<
    import("../../../../packages/api-types/src/index").CheckoutResponse
  >("POST", "/v1/billing/checkout", {
    provider,
    successUrl: `${window.location.origin}/app/account?billing=success`,
  });
}

export function openBillingPortal() {
  return request<{ portalUrl: string; premium: boolean; message: string }>(
    "POST",
    "/v1/billing/portal",
  );
}

export function devActivatePremium() {
  return request<{
    status: import("../../../../packages/api-types/src/index").BillingStatus;
  }>("POST", "/v1/billing/dev-activate");
}

export function getContentArticles(market?: string, topic?: string) {
  const q = new URLSearchParams();
  if (market) q.set("market", market);
  if (topic) q.set("topic", topic);
  const qs = q.toString();
  return request<{
    articles: import("../../../../packages/api-types/src/index").ContentArticle[];
  }>("GET", `/v1/content/articles${qs ? `?${qs}` : ""}`);
}

export function detectMarket(): Market {
  const lang = (navigator.language || "en-GB").toUpperCase();
  if (lang.includes("NG") || lang.endsWith("-NG")) return "NG";
  if (lang.includes("GH") || lang.endsWith("-GH")) return "GH";
  return "UK";
}

export function detectLocale(): string {
  return navigator.language || "en-GB";
}
