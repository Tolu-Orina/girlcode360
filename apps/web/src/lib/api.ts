/**
 * GirlCode360 API client — Cognito JWT (or local Bearer dev.* for offline API).
 */
import {
  ALL_MODULES,
  CURRENT_POLICY_VERSION,
  DEFAULT_MODULES,
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
import { apiBaseUrl, apiUrl, cognitoConfig, localYoucam } from "./config";
import { getCurrentSession } from "./cognito";
import { marketplaceQuery } from "./session-geo";

export {
  ALL_MODULES,
  CURRENT_POLICY_VERSION,
  DEFAULT_MODULES,
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
  if (localYoucam) return "Bearer local-youcam";
  const cognitoReady = Boolean(
    cognitoConfig.userPoolId && cognitoConfig.clientId,
  );
  try {
    const session = await getCurrentSession();
    if (session) return `Bearer ${session.getIdToken().getJwtToken()}`;
  } catch {
    /* no session */
  }
  // Live API Gateway uses a Cognito authorizer. The local `Bearer dev.*`
  // scaffold never passes it (that is a 401, not a CORS block).
  if (cognitoReady || apiBaseUrl) {
    throw new ApiError(401, "not_authenticated");
  }
  // Local scaffold when Cognito env is unset
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
  const res = await fetch(apiUrl(path), {
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

/** Public (unauthenticated) API calls — wallet share recipients. */
async function publicRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError(0, "api_base_url_missing");
  }
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
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

type AlenaSseEvent =
  | { type: "delta"; text: string }
  | { type: "done"; [k: string]: unknown };

async function readAlenaSse<T>(
  res: Response,
  onDelta?: (text: string) => void,
): Promise<T> {
  if (!res.body) throw new ApiError(res.status || 0, "empty_stream");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let donePayload: T | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let parsed: AlenaSseEvent;
      try {
        parsed = JSON.parse(line.slice(6)) as AlenaSseEvent;
      } catch {
        continue;
      }
      if (parsed.type === "delta" && typeof parsed.text === "string") {
        onDelta?.(parsed.text);
      }
      if (parsed.type === "done") donePayload = parsed as unknown as T;
    }
  }
  if (!donePayload) throw new ApiError(res.status || 0, "incomplete_stream");
  return donePayload;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  let code = `http_${res.status}`;
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) code = j.error;
  } catch {
    /* ignore */
  }
  throw new ApiError(res.status, code);
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

export function patchPregnancy(
  body: import("../../../../packages/api-types/src/index").PatchPregnancyRequest,
) {
  return request<{
    profile: import("../../../../packages/api-types/src/index").PregnancyProfile;
    week: number;
  }>("PATCH", "/v1/pregnancy", body);
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

export function getPregnancyDays() {
  return request<{
    days: import("../../../../packages/api-types/src/index").PregnancyDayLog[];
  }>("GET", "/v1/pregnancy/days");
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

export function getTtcDays() {
  return request<{
    days: import("../../../../packages/api-types/src/index").TtcDayLog[];
  }>("GET", "/v1/ttc/days");
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

export function listWalletShares(docId: string) {
  return request<{
    shares: import("../../../../packages/api-types/src/index").WalletShareListItem[];
  }>("GET", `/v1/wallet/docs/${docId}/shares`);
}

export function revokeWalletShare(idOrToken: string) {
  return request("DELETE", `/v1/wallet/shares/${encodeURIComponent(idOrToken)}`);
}

export function getPublicWalletShare(token: string) {
  return publicRequest<
    import("../../../../packages/api-types/src/index").WalletSharePublic
  >("GET", `/v1/wallet/share/${encodeURIComponent(token)}`);
}

export function getPublicWalletObject(token: string) {
  return publicRequest<{
    ciphertextB64: string;
    fileIv: string;
    contentType: string;
    filename: string;
  }>("GET", `/v1/wallet/share/${encodeURIComponent(token)}/object`);
}

/* ——— Phase 6: Alena + HealthLens ——— */

export function getAlenaQuota() {
  return request<{
    quota: {
      used: number;
      limit: number | null;
      remaining: number | null;
    };
  }>("GET", "/v1/alena/quota");
}

export async function postAlenaChat(
  body: {
    message: string;
    mode: "context" | "anonymous";
    openedFrom?: "cycle" | "health" | "mirror" | "home" | "library";
    moduleHint?: import("../../../../packages/api-types/src/index").HealthModule;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    lat?: number;
    lng?: number;
    climate?: "hot" | "temperate" | "cold" | "mixed";
  },
  onDelta?: (text: string) => void,
) {
  if (!apiBaseUrl) {
    throw new ApiError(0, "api_base_url_missing");
  }
  const res = await fetch(apiUrl("/v1/alena/chat"), {
    method: "POST",
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("event-stream")) {
    return readAlenaSse<
      import("../../../../packages/api-types/src/index").AlenaChatResponse
    >(res, onDelta);
  }
  return (await res.json()) as import("../../../../packages/api-types/src/index").AlenaChatResponse;
}

export async function postGuestAlenaChat(
  message: string,
  market: Market,
  onDelta?: (text: string) => void,
) {
  if (!apiBaseUrl) {
    throw new ApiError(0, "api_base_url_missing");
  }
  const res = await fetch(apiUrl("/v1/guest/alena"), {
    method: "POST",
    headers: {
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, market }),
  });
  await throwIfNotOk(res);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("event-stream")) {
    return readAlenaSse<{
      reply: string;
      crisis: boolean;
      stub: boolean;
      remaining: number;
      disclaimer: string;
    }>(res, onDelta);
  }
  return (await res.json()) as {
    reply: string;
    crisis: boolean;
    stub: boolean;
    remaining: number;
    disclaimer: string;
  };
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
  const origin = window.location.origin;
  return request<
    import("../../../../packages/api-types/src/index").CheckoutResponse
  >("POST", "/v1/billing/checkout", {
    provider,
    successUrl: `${origin}/app/account?billing=success`,
    cancelUrl: `${origin}/app/account?billing=cancel`,
  });
}

export function openBillingPortal() {
  return request<{
    portalUrl: string;
    premium: boolean;
    message: string;
    live?: boolean;
  }>("POST", "/v1/billing/portal", {
    returnUrl: `${window.location.origin}/app/account`,
  });
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

export function submitContentReport(
  body: import("../../../../packages/api-types/src/index").CreateContentReportRequest,
) {
  return request<{
    report: import("../../../../packages/api-types/src/index").ContentReport;
  }>("POST", "/v1/content/reports", body);
}

export function getMyContentReports() {
  return request<{
    reports: import("../../../../packages/api-types/src/index").ContentReport[];
  }>("GET", "/v1/content/reports/mine");
}

export function detectMarket(): Market {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Africa/Lagos") return "NG";
    if (tz === "Africa/Accra") return "GH";
    if (tz === "Europe/London") return "UK";
  } catch {
    /* Intl missing */
  }
  const lang = (navigator.language || "en-GB").toUpperCase();
  if (lang.includes("NG") || lang.endsWith("-NG")) return "NG";
  if (lang.includes("GH") || lang.endsWith("-GH")) return "GH";
  if (lang.includes("GB") || lang.endsWith("-GB") || lang.startsWith("EN-UK")) {
    return "UK";
  }
  return "UK";
}

export function detectLocale(): string {
  return navigator.language || "en-GB";
}

/** Public health ping — used for policy version + CloudFront country hint. */
export function getApiHealth() {
  return publicRequest<
    import("../../../../packages/api-types/src/index").HealthResponse
  >("GET", "/v1/health");
}

export function getMirrorStatus() {
  return request<
    import("../../../../packages/api-types/src/index").MirrorStatus
  >("GET", "/v1/mirror/status");
}

export function postMirrorConsent(granted: boolean) {
  return request<
    import("../../../../packages/api-types/src/index").MirrorStatus
  >("POST", "/v1/mirror/consent", { granted });
}

export function getMirrorCatalogue(opts?: {
  kind?: "skincare" | "apparel" | "makeup" | "jewellery" | "eyewear" | "nail_color";
  mode?: "all" | "maternity" | "pmos";
}) {
  const q = new URLSearchParams();
  if (opts?.kind) q.set("kind", opts.kind);
  if (opts?.mode) q.set("mode", opts.mode);
  const qs = q.toString();
  return request<{
    items: import("../../../../packages/api-types/src/index").MirrorCatalogueItem[];
    pregnancyWeek: number | null;
    emptyReason?: string;
  }>("GET", `/v1/mirror/catalogue${qs ? `?${qs}` : ""}`);
}

export function listMirrorScans() {
  return request<{
    scans: import("../../../../packages/api-types/src/index").SkinScan[];
  }>("GET", "/v1/mirror/scans");
}

export function createMirrorScan(imageB64: string) {
  return request<{
    scan: import("../../../../packages/api-types/src/index").SkinScan;
  }>("POST", "/v1/mirror/scans", { imageB64 });
}

export function getMirrorScan(id: string) {
  return request<{
    scan: import("../../../../packages/api-types/src/index").SkinScan;
  }>("GET", `/v1/mirror/scans/${encodeURIComponent(id)}`);
}

export function deleteMirrorScan(id: string) {
  return request<{ ok: boolean }>(
    "DELETE",
    `/v1/mirror/scans/${encodeURIComponent(id)}`,
  );
}

export function getMirrorScanMedia(id: string, kind: "result" | "mask" | "source") {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror/scans/${encodeURIComponent(id)}/media?kind=${kind}`,
  );
}

export function listMirrorTryOns() {
  return request<{
    tryons: import("../../../../packages/api-types/src/index").ApparelTryOn[];
  }>("GET", "/v1/mirror/tryons");
}

export function createMirrorTryOn(imageB64: string, catalogueItemId: string) {
  return request<{
    tryon: import("../../../../packages/api-types/src/index").ApparelTryOn;
  }>("POST", "/v1/mirror/tryons", { imageB64, catalogueItemId });
}

export function getMirrorTryOn(id: string) {
  return request<{
    tryon: import("../../../../packages/api-types/src/index").ApparelTryOn;
  }>("GET", `/v1/mirror/tryons/${encodeURIComponent(id)}`);
}

export function getMirrorTryOnMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror/tryons/${encodeURIComponent(id)}/media`,
  );
}

export function listMakeupLooks() {
  return request<{
    looks: import("../../../../packages/api-types/src/index").MakeupLook[];
  }>("GET", "/v1/mirror-studio/makeup");
}

export function createMakeupLook(
  mode: "live" | "photo" | "transfer",
  body: {
    imageB64?: string;
    scanId?: string;
    referenceB64?: string;
    categories?: string[];
    palettes?: Record<string, string>;
  },
) {
  return request<{
    look: import("../../../../packages/api-types/src/index").MakeupLook;
  }>("POST", `/v1/mirror-studio/makeup/${mode}`, body);
}

export function getMakeupLook(id: string) {
  return request<{
    look: import("../../../../packages/api-types/src/index").MakeupLook;
  }>("GET", `/v1/mirror-studio/makeup/${encodeURIComponent(id)}`);
}

export function getMakeupLookMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/makeup/${encodeURIComponent(id)}/media`,
  );
}

export function saveMakeupLook(id: string, saved: boolean) {
  return request<{
    look: import("../../../../packages/api-types/src/index").MakeupLook;
  }>("PATCH", `/v1/mirror-studio/makeup/${encodeURIComponent(id)}`, { saved });
}

export function listShadeMatches() {
  return request<{
    matches: import("../../../../packages/api-types/src/index").ShadeMatch[];
  }>("GET", "/v1/mirror-studio/shade-matches");
}

export function createShadeMatch(body: { scanId?: string; imageB64?: string }) {
  return request<{
    match: import("../../../../packages/api-types/src/index").ShadeMatch;
  }>("POST", "/v1/mirror-studio/shade-match", body);
}

export function listHairScans() {
  return request<{
    scans: import("../../../../packages/api-types/src/index").HairScan[];
  }>("GET", "/v1/mirror-studio/hair");
}

export function createHairAnalysis(body: { imageB64?: string; scanId?: string }) {
  return request<{
    scan: import("../../../../packages/api-types/src/index").HairScan;
  }>("POST", "/v1/mirror-studio/hair/analysis", body);
}

export function createHairTryOn(body: {
  imageB64?: string;
  scanId?: string;
  hairColor: string;
  hairstyleId?: string;
}) {
  return request<{
    scan: import("../../../../packages/api-types/src/index").HairScan;
  }>("POST", "/v1/mirror-studio/hair/tryon", body);
}

export function getHairScan(id: string) {
  return request<{
    scan: import("../../../../packages/api-types/src/index").HairScan;
  }>("GET", `/v1/mirror-studio/hair/${encodeURIComponent(id)}`);
}

export function getHairScanMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/hair/${encodeURIComponent(id)}/media`,
  );
}

export function listWardrobeItems() {
  return request<{
    items: import("../../../../packages/api-types/src/index").WardrobeItem[];
  }>("GET", "/v1/mirror-studio/wardrobe/items");
}

export function createWardrobeItem(body: {
  imageB64: string;
  name?: string;
  category?: string;
  colourTags?: string[];
  sampleHexes?: string[];
  purchasePriceMinor?: number | null;
}) {
  return request<{
    item: import("../../../../packages/api-types/src/index").WardrobeItem;
  }>("POST", "/v1/mirror-studio/wardrobe/items", body);
}

export function patchWardrobeItem(
  id: string,
  body: {
    name?: string | null;
    category?: string;
    colourTags?: string[];
    purchasePriceMinor?: number | null;
    archived?: boolean;
  },
) {
  return request<{
    item: import("../../../../packages/api-types/src/index").WardrobeItem;
  }>("PATCH", `/v1/mirror-studio/wardrobe/items/${encodeURIComponent(id)}`, body);
}

export function getWardrobeItemMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/wardrobe/items/${encodeURIComponent(id)}/media`,
  );
}

export function listWardrobeOutfits() {
  return request<{
    outfits: import("../../../../packages/api-types/src/index").WardrobeOutfit[];
  }>("GET", "/v1/mirror-studio/wardrobe/outfits");
}

export function createWardrobeOutfit(body: { itemIds: string[]; occasion?: string }) {
  return request<{
    outfit: import("../../../../packages/api-types/src/index").WardrobeOutfit;
  }>("POST", "/v1/mirror-studio/wardrobe/outfits", body);
}

export function getWardrobeOutfit(id: string) {
  return request<{
    outfit: import("../../../../packages/api-types/src/index").WardrobeOutfit;
  }>("GET", `/v1/mirror-studio/wardrobe/outfits/${encodeURIComponent(id)}`);
}

export function markWardrobeOutfitWorn(id: string, wornOn: string) {
  return request<{
    outfit: import("../../../../packages/api-types/src/index").WardrobeOutfit;
  }>("PATCH", `/v1/mirror-studio/wardrobe/outfits/${encodeURIComponent(id)}`, {
    wornOn,
  });
}

export function createWardrobeOutfitTryOn(id: string, body: { imageB64: string }) {
  return request<{
    outfit: import("../../../../packages/api-types/src/index").WardrobeOutfit;
  }>(
    "POST",
    `/v1/mirror-studio/wardrobe/outfits/${encodeURIComponent(id)}/tryon`,
    body,
  );
}

export function getWardrobeOutfitMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/wardrobe/outfits/${encodeURIComponent(id)}/media`,
  );
}

export function createWardrobePackingList(body: {
  nights: number;
  climate: string;
}) {
  return request<{
    list: import("../../../../packages/api-types/src/index").WardrobePackingList;
  }>("POST", "/v1/mirror-studio/wardrobe/packing-list", body);
}

export function suggestWardrobeOutfit(body?: { climate?: string }) {
  return request<{
    suggestion: import("../../../../packages/api-types/src/index").DailyOutfitSuggestion;
    outfit: import("../../../../packages/api-types/src/index").WardrobeOutfit | null;
  }>("POST", "/v1/mirror-studio/wardrobe/outfits/suggest", body ?? {});
}

export function getStyleAnalytics() {
  return request<{
    analytics: import("../../../../packages/api-types/src/index").StyleAnalytics;
  }>("GET", "/v1/mirror-studio/style-analytics");
}

export function listAccessoryLooks() {
  return request<{
    looks: import("../../../../packages/api-types/src/index").AccessoryLook[];
  }>("GET", "/v1/mirror-studio/accessories");
}

export function createAccessoryLook(
  kind: "jewellery" | "eyewear" | "nail",
  body: { catalogueItemId: string; imageB64?: string; scanId?: string },
) {
  return request<{
    look: import("../../../../packages/api-types/src/index").AccessoryLook;
  }>("POST", `/v1/mirror-studio/accessories/${kind}`, body);
}

export function getAccessoryLook(id: string) {
  return request<{
    look: import("../../../../packages/api-types/src/index").AccessoryLook;
  }>("GET", `/v1/mirror-studio/accessories/${encodeURIComponent(id)}`);
}

export function getAccessoryLookMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/accessories/${encodeURIComponent(id)}/media`,
  );
}

export function listMyResale() {
  return request<{
    listings: import("../../../../packages/api-types/src/index").ResaleListing[];
  }>("GET", "/v1/mirror-studio/resale/listings");
}

export function createResaleListing(body: {
  wardrobeItemId: string;
  priceMinor: number;
}) {
  return request<{
    listing: import("../../../../packages/api-types/src/index").ResaleListing;
    message: string;
  }>("POST", "/v1/mirror-studio/resale/listings", body);
}

export function getResaleListing(id: string) {
  return request<{
    listing: import("../../../../packages/api-types/src/index").ResaleListing;
  }>("GET", `/v1/mirror-studio/resale/listings/${encodeURIComponent(id)}`);
}

export function getResaleListingMedia(id: string) {
  return request<{ contentType: string; imageB64: string }>(
    "GET",
    `/v1/mirror-studio/resale/listings/${encodeURIComponent(id)}/media`,
  );
}

export function listMarketplace(query: string) {
  return request<{
    listings: import("../../../../packages/api-types/src/index").MarketplaceListing[];
    resale?: import("../../../../packages/api-types/src/index").ResaleListing[];
    note: string;
  }>("GET", `/v1/marketplace/listings${query}`);
}

export function getMarketplaceListing(id: string, query: string) {
  return request<{
    listing: import("../../../../packages/api-types/src/index").MarketplaceListing | null;
    resale?: import("../../../../packages/api-types/src/index").ResaleListing;
  }>("GET", `/v1/marketplace/listings/${encodeURIComponent(id)}${query}`);
}

export function submitBusinessListing(
  body: import("../../../../packages/api-types/src/index").CreateBusinessListingRequest,
) {
  return request<{
    listing: import("../../../../packages/api-types/src/index").MarketplaceListing;
    message: string;
  }>("POST", "/v1/marketplace/business", body);
}

export function listMyBusinessListings() {
  return request<{
    listings: import("../../../../packages/api-types/src/index").MarketplaceListing[];
  }>("GET", "/v1/marketplace/mine");
}

export function patchMyBusinessListing(
  id: string,
  body: import("../../../../packages/api-types/src/index").PatchOwnedListingRequest,
) {
  return request<{
    listing: import("../../../../packages/api-types/src/index").MarketplaceListing;
  }>("PATCH", `/v1/marketplace/mine/${encodeURIComponent(id)}`, body);
}

export function listListingReviews(id: string) {
  return request<{
    reviews: import("../../../../packages/api-types/src/index").ListingReview[];
  }>("GET", `/v1/marketplace/listings/${encodeURIComponent(id)}/reviews`);
}

export function createListingReview(
  id: string,
  body: import("../../../../packages/api-types/src/index").CreateListingReviewRequest,
) {
  return request<{
    review: import("../../../../packages/api-types/src/index").ListingReview;
    message: string;
  }>("POST", `/v1/marketplace/listings/${encodeURIComponent(id)}/reviews`, body);
}

export function putListingFavourite(id: string) {
  return request<{ ok: boolean }>(
    "PUT",
    `/v1/marketplace/listings/${encodeURIComponent(id)}/favourite`,
  );
}

export function deleteListingFavourite(id: string) {
  return request<{ ok: boolean }>(
    "DELETE",
    `/v1/marketplace/listings/${encodeURIComponent(id)}/favourite`,
  );
}

export function requestListingSponsor(id: string) {
  return request<{
    checkoutUrl: string;
    listingId: string;
    message: string;
  }>("POST", `/v1/marketplace/listings/${encodeURIComponent(id)}/sponsor`);
}

export function listWalletMedications() {
  return request<{
    medications: import("../../../../packages/api-types/src/index").WalletMedication[];
  }>("GET", "/v1/wallet/medications");
}

export function createWalletMedication(
  body: import("../../../../packages/api-types/src/index").CreateWalletMedicationRequest,
) {
  return request<{
    medication: import("../../../../packages/api-types/src/index").WalletMedication;
  }>("POST", "/v1/wallet/medications", body);
}

export function deleteWalletMedication(id: string) {
  return request<{ ok: boolean }>(
    "DELETE",
    `/v1/wallet/medications/${encodeURIComponent(id)}`,
  );
}

export function getSheMatchPrefs() {
  return request<import("../../../../packages/api-types/src/index").SheMatchPrefs>(
    "GET",
    "/v1/shematch/prefs",
  );
}

export function patchSheMatchPrefs(modules: Partial<Record<HealthModule, boolean>>) {
  return request<import("../../../../packages/api-types/src/index").SheMatchPrefs>(
    "PATCH",
    "/v1/shematch/prefs",
    { modules },
  );
}

export function getSheMatchSuggest(
  trigger: import("../../../../packages/api-types/src/index").SheMatchTriggerId,
  extra?: { tags?: string },
) {
  return request<{
    suggestions: import("../../../../packages/api-types/src/index").SheMatchSuggestion[];
  }>(
    "GET",
    `/v1/shematch/suggest${marketplaceQuery({ trigger, tags: extra?.tags })}`,
  );
}

export function getVapidPublicKey() {
  return request<{ publicKey: string | null }>("GET", "/v1/notifications/vapid");
}

export function getInAppInbox() {
  return request<{
    items: import("../../../../packages/api-types/src/index").InAppNotification[];
    unread: number;
    marketingOptIn: boolean;
    note: string;
  }>("GET", "/v1/in-app");
}

export function markInAppRead(id: string) {
  return request<{
    item: import("../../../../packages/api-types/src/index").InAppNotification;
  }>("POST", `/v1/in-app/${encodeURIComponent(id)}/read`);
}

export function markInAppAllRead() {
  return request<{ ok: boolean; unread: number }>("POST", "/v1/in-app/read-all");
}

export function getCommunityGroups() {
  return request<{
    groups: import("../../../../packages/api-types/src/index").CommunityGroupView[];
    note: string;
  }>("GET", "/v1/community/groups");
}

export function joinCommunityGroup(id: string) {
  return request<{
    group: import("../../../../packages/api-types/src/index").CommunityGroupView;
  }>("POST", `/v1/community/groups/${encodeURIComponent(id)}/join`);
}

export function leaveCommunityGroup(id: string) {
  return request<{ ok: boolean }>(
    "DELETE",
    `/v1/community/groups/${encodeURIComponent(id)}/membership`,
  );
}

export function getCommunityPosts(groupId: string) {
  return request<{
    posts: import("../../../../packages/api-types/src/index").CommunityPost[];
  }>("GET", `/v1/community/groups/${encodeURIComponent(groupId)}/posts`);
}

export function createCommunityPost(
  groupId: string,
  body: import("../../../../packages/api-types/src/index").CreateCommunityPostRequest,
) {
  return request<{
    post: import("../../../../packages/api-types/src/index").CommunityPost;
    message: string;
  }>(
    "POST",
    `/v1/community/groups/${encodeURIComponent(groupId)}/posts`,
    body,
  );
}
