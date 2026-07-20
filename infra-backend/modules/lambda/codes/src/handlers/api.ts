import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { buildPrediction } from "../lib/prediction";
import { articlesForMarket, pcosInsightsForUser } from "../lib/pcos";
import { contentArticles } from "../lib/content";
import { allWeekContent, weekContent } from "../lib/weeks";
import {
  assembleZaraContext,
  buildPrepCard,
  generateHealthLensReport,
  getHealthLensStatus,
  getZaraQuota,
  latestHealthLensReport,
  setPopulationLearningConsent,
  zaraChat,
  ZARA_DISCLAIMER,
} from "../store/ai";
import {
  activatePremium,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  handleBillingWebhook,
} from "../store/billing";
import {
  cancelDeletion,
  createExportJob,
  getDeletion,
  getExportJob,
  getMyData,
  requestDeletion,
  runDeletionPurge,
} from "../store/privacy";
import {
  createWalletShare,
  createWalletUpload,
  getPublicShare,
  getWalletDoc,
  getWalletObject,
  listSharesForDoc,
  listWalletDocs,
  lookupShareCiphertext,
  patchWalletMeta,
  putWalletObject,
  revokeWalletShare,
  runWalletPurge,
  softDeleteWalletDoc,
} from "../store/wallet";
import {
  createAppointment,
  deleteAppointment,
  deleteTtcIntimacy,
  emergencyNumbers,
  fertileForUser,
  getNotificationPrefs,
  initPregnancy,
  initTtc,
  listAppointments,
  listPregnancyDays,
  listTtcDays,
  patchNotificationPrefs,
  pregnancyStatus,
  ttcStatus,
  upsertPregnancyDay,
  upsertTtcDay,
} from "../store/journey";
import {
  addConsents,
  createCycle,
  createMedication,
  deleteCycle,
  deleteMedication,
  dueMedications,
  getCycle,
  getIdempotent,
  getUser,
  latestConsentsByPurpose,
  listBiometrics,
  listConsents,
  listCycles,
  listDays,
  listMedications,
  listPushSubscriptions,
  patchCycle,
  patchMedication,
  savePushSubscription,
  setIdempotent,
  setModules,
  upsertBiometric,
  upsertCycleWithId,
  upsertDay,
  upsertUser,
} from "../store/memory";
import type {
  BootstrapRequest,
  CreateAppointmentRequest,
  CreateCycleRequest,
  CreateMedicationRequest,
  CreateWalletShareRequest,
  CreateWalletUploadRequest,
  HealthModule,
  InitPregnancyRequest,
  Market,
  PatchCycleRequest,
  PatchMedicationRequest,
  PatchModulesRequest,
  PatchNotificationPrefsRequest,
  PatchUserRequest,
  PostConsentsRequest,
  PushSubscriptionRequest,
  SyncOp,
  SyncRequest,
  UpsertBiometricRequest,
  UpsertCycleDayRequest,
  UpsertPregnancyDayRequest,
  UpsertTtcDayRequest,
  WalletCategory,
} from "../types";
import { CURRENT_POLICY_VERSION, GENERIC_PUSH_BODY } from "../types";
import { isDsqlEnabled } from "../db/client";
import { isDataBucketEnabled } from "../db/s3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization,Content-Type,Idempotency-Key,idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

const SYMPTOM_LIBRARY = [
  { id: "cramps", label: "Cramps", category: "pain" },
  { id: "backache", label: "Backache", category: "pain" },
  { id: "headache", label: "Headache", category: "pain" },
  { id: "breast_tenderness", label: "Breast tenderness", category: "pain" },
  { id: "joint_aches", label: "Joint aches", category: "pain" },
  { id: "pelvic_pain", label: "Pelvic pain", category: "pain" },
  { id: "ovulation_pain", label: "Mid-cycle pain", category: "pain" },
  { id: "bloating", label: "Bloating", category: "digestive" },
  { id: "nausea", label: "Nausea", category: "digestive" },
  { id: "constipation", label: "Constipation", category: "digestive" },
  { id: "diarrhoea", label: "Diarrhoea", category: "digestive" },
  { id: "appetite_change", label: "Appetite change", category: "digestive" },
  { id: "sugar_cravings", label: "Sugar cravings", category: "digestive" },
  { id: "irritability", label: "Irritability", category: "mood" },
  { id: "anxiety", label: "Anxiety", category: "mood" },
  { id: "low_mood", label: "Low mood", category: "mood" },
  { id: "mood_swings", label: "Mood swings", category: "mood" },
  { id: "brain_fog", label: "Brain fog", category: "mood" },
  { id: "acne", label: "Acne", category: "skin" },
  { id: "oily_skin", label: "Oily skin", category: "skin" },
  { id: "dry_skin", label: "Dry skin", category: "skin" },
  { id: "hirsutism", label: "Unwanted facial/body hair", category: "skin" },
  { id: "hair_thinning", label: "Hair thinning", category: "skin" },
  { id: "dark_patches", label: "Dark skin patches", category: "skin" },
  { id: "fatigue", label: "Fatigue", category: "energy" },
  { id: "insomnia", label: "Insomnia", category: "energy" },
  { id: "restlessness", label: "Restlessness", category: "energy" },
  { id: "weight_gain", label: "Weight gain feeling", category: "other" },
  { id: "weight_loss", label: "Weight loss feeling", category: "other" },
  { id: "irregular_bleeding", label: "Irregular bleeding", category: "other" },
  { id: "hot_flashes", label: "Hot flashes", category: "other" },
  { id: "dizziness", label: "Dizziness", category: "other" },
  { id: "cravings", label: "Cravings", category: "other" },
  { id: "swelling", label: "Swelling", category: "other" },
];
function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function claims(event: APIGatewayProxyEvent): {
  sub: string;
  email?: string;
} | null {
  const c = event.requestContext.authorizer?.claims as
    | Record<string, string>
    | undefined;
  if (c?.sub) return { sub: c.sub, email: c.email };

  const auth = event.headers?.Authorization ?? event.headers?.authorization;
  if (auth?.startsWith("Bearer dev.")) {
    try {
      const payload = JSON.parse(
        Buffer.from(auth.slice("Bearer dev.".length), "base64url").toString(
          "utf8",
        ),
      ) as { sub: string; email?: string };
      if (payload.sub) return payload;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function parseBody<T>(event: APIGatewayProxyEvent): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw) as T;
}

function pathOf(event: APIGatewayProxyEvent): string {
  const p = event.path ?? "";
  const idx = p.indexOf("/v1");
  return idx >= 0 ? p.slice(idx) : p;
}

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === lower && v) return v;
  }
  return undefined;
}

async function requireUser(sub: string) {
  return await getUser(sub);
}

async function applySyncOp(sub: string, op: SyncOp): Promise<void> {
  switch (op.op) {
    case "upsert_cycle":
      if (op.cycle.id) await upsertCycleWithId(sub, op.cycle.id, op.cycle);
      else await createCycle(sub, op.cycle);
      break;
    case "patch_cycle":
      await patchCycle(sub, op.id, op.patch);
      break;
    case "delete_cycle":
      await deleteCycle(sub, op.id);
      break;
    case "upsert_day":
      await upsertDay(sub, op.day);
      break;
  }
}

async function cycleSnapshot(sub: string) {
  return {
    cycles: await listCycles(sub),
    days: await listDays(sub),
    prediction: await buildPrediction(sub),
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const path = pathOf(event);
  const method = event.httpMethod;

  if (method === "GET" && path === "/v1/health") {
    return json(200, {
      ok: true,
      service: "girlcode360-api",
      environment: process.env.ENVIRONMENT ?? "unknown",
      ts: new Date().toISOString(),
      policyVersion: process.env.CONSENT_POLICY_VERSION ?? CURRENT_POLICY_VERSION,
      dsql: isDsqlEnabled(),
      dataBucket: isDataBucketEnabled(),
    });
  }

  // Public wallet share (no Cognito) — key stays in URL fragment on the client
  const publicShareMatch = path.match(/^\/v1\/wallet\/share\/([^/]+)$/);
  if (publicShareMatch && method === "GET") {
    const host = event.headers?.Host ?? event.headers?.host ?? "api.local";
    const apiBase = process.env.API_BASE_URL ?? `https://${host}`;
    const result = await getPublicShare(publicShareMatch[1]!, apiBase);
    if ("error" in result) return json(404, { error: result.error });
    return json(200, result);
  }
  const publicShareObj = path.match(/^\/v1\/wallet\/share\/([^/]+)\/object$/);
  if (publicShareObj && method === "GET") {
    const meta = await getPublicShare(publicShareObj[1]!, "https://api.local");
    if ("error" in meta) return json(404, { error: meta.error });
    const ct = await lookupShareCiphertext(publicShareObj[1]!);
    if (!ct) return json(404, { error: "object_missing" });
    return json(200, {
      ciphertextB64: ct,
      fileIv: meta.fileIv,
      contentType: meta.contentType,
      filename: meta.filename,
    });
  }

  // Billing webhooks (signature verification when provider secrets are live)
  const stripeHook = path === "/v1/billing/webhooks/stripe";
  const paystackHook = path === "/v1/billing/webhooks/paystack";
  if (method === "POST" && (stripeHook || paystackHook)) {
    const provider = stripeHook ? "stripe" : "paystack";
    const body = parseBody<{
      sub?: string;
      customerId?: string;
      event?: string;
    }>(event);
    const result = await handleBillingWebhook(provider, body);
    if (!result.ok) return json(400, { error: result.error });
    return json(200, result);
  }

  // Internal purge tick (EventBridge later; open in local with header)
  if (method === "POST" && path === "/v1/privacy/purge-tick") {
    const key = event.headers?.["x-internal-key"] ?? event.headers?.["X-Internal-Key"];
    if (key !== (process.env.INTERNAL_PURGE_KEY ?? "dev-purge")) {
      return json(401, { error: "unauthorized" });
    }
    return json(200, { purged: await runDeletionPurge() });
  }

  const user = claims(event);
  if (!user) return json(401, { error: "unauthorized" });

  if (method === "POST" && path === "/v1/users/me/bootstrap") {
    const body = parseBody<BootstrapRequest>(event);
    if (!body.ageConfirmed18) return json(400, { error: "age_gate_required" });
    return json(
      200,
      await upsertUser(user.sub, {
        email: user.email,
        ageConfirmed18: true,
        market: body.market,
        locale: body.locale,
      }),
    );
  }

  if (method === "GET" && path === "/v1/users/me") {
    const profile = await getUser(user.sub);
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, profile);
  }

  if (method === "PATCH" && path === "/v1/users/me") {
    if (!(await getUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await upsertUser(user.sub, parseBody<PatchUserRequest>(event)));
  }

  if (method === "PATCH" && path === "/v1/users/me/modules") {
    if (!(await getUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<PatchModulesRequest>(event);
    if (!Array.isArray(body.modules) || body.modules.length === 0) {
      return json(400, { error: "modules_required" });
    }
    return json(200, await setModules(user.sub, body.modules as HealthModule[]));
  }

  if (method === "POST" && path === "/v1/consents") {
    if (!(await getUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<PostConsentsRequest>(event);
    if (!body.jurisdiction || !body.items?.length) {
      return json(400, { error: "invalid_consent_payload" });
    }
    const health = body.items.find((i) => i.purpose === "health_data");
    if (!health?.granted) return json(400, { error: "health_consent_required" });
    const policyVersion =
      body.policyVersion ||
      process.env.CONSENT_POLICY_VERSION ||
      CURRENT_POLICY_VERSION;
    const created = await addConsents(
      user.sub,
      body.jurisdiction as Market,
      policyVersion,
      body.items,
    );
    return json(201, {
      created,
      current: await latestConsentsByPurpose(user.sub),
    });
  }

  if (method === "GET" && path === "/v1/consents") {
    if (!(await getUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    return json(200, {
      current: await latestConsentsByPurpose(user.sub),
      history: await listConsents(user.sub),
    });
  }

  /* ——— Phase 2: cycles ——— */

  if (method === "GET" && path === "/v1/symptoms/library") {
    return json(200, { symptoms: SYMPTOM_LIBRARY });
  }

  if (!(await requireUser(user.sub)) && path.startsWith("/v1/cycles")) {
    return json(404, { error: "user_not_bootstrapped" });
  }

  if (method === "GET" && path === "/v1/cycles") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await cycleSnapshot(user.sub));
  }

  if (method === "POST" && path === "/v1/cycles") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<CreateCycleRequest>(event);
    if (!body.startDate) return json(400, { error: "start_date_required" });
    const cycle = await createCycle(user.sub, body);
    return json(201, { cycle, prediction: await buildPrediction(user.sub) });
  }

  if (method === "GET" && path === "/v1/cycles/predictions") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await buildPrediction(user.sub));
  }

  if (method === "GET" && path === "/v1/cycles/days") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;
    return json(200, { days: await listDays(user.sub, from, to) });
  }

  if (method === "PUT" && path === "/v1/cycles/days") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<UpsertCycleDayRequest>(event);
    if (!body.date) return json(400, { error: "date_required" });
    return json(200, { day: await upsertDay(user.sub, body) });
  }

  if (method === "POST" && path === "/v1/cycles/sync") {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const key = header(event, "Idempotency-Key");
    if (!key) return json(400, { error: "idempotency_key_required" });
    const cached = await getIdempotent(user.sub, key);
    if (cached) return json(200, cached);

    const body = parseBody<SyncRequest>(event);
    const ops = body.ops ?? [];
    for (const op of ops) await applySyncOp(user.sub, op);
    const response = {
      idempotencyKey: key,
      applied: ops.length,
      ...(await cycleSnapshot(user.sub)),
    };
    await setIdempotent(user.sub, key, response);
    return json(200, response);
  }

  const cycleMatch = path.match(/^\/v1\/cycles\/([^/]+)$/);
  if (cycleMatch) {
    if (!(await requireUser(user.sub))) return json(404, { error: "user_not_bootstrapped" });
    const id = cycleMatch[1]!;
    if (id === "predictions" || id === "days" || id === "sync") {
      /* handled above */
    } else if (method === "GET") {
      const cycle = await getCycle(user.sub, id);
      if (!cycle) return json(404, { error: "cycle_not_found" });
      return json(200, { cycle });
    } else if (method === "PATCH") {
      const cycle = await patchCycle(user.sub, id, parseBody<PatchCycleRequest>(event));
      if (!cycle) return json(404, { error: "cycle_not_found" });
      return json(200, { cycle, prediction: await buildPrediction(user.sub) });
    } else if (method === "DELETE") {
      if (!(await deleteCycle(user.sub, id))) return json(404, { error: "cycle_not_found" });
      return json(200, { ok: true, prediction: await buildPrediction(user.sub) });
    }
  }

  /* ——— Phase 3: PCOS ——— */

  const profile = await getUser(user.sub);
  if (path.startsWith("/v1/pcos")) {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if (!profile.modules.includes("pcos_manager")) {
      return json(403, { error: "pcos_module_disabled" });
    }
  }

  if (method === "GET" && path === "/v1/pcos/biometrics") {
    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;
    return json(200, { biometrics: await listBiometrics(user.sub, from, to) });
  }

  if (method === "PUT" && path === "/v1/pcos/biometrics") {
    const body = parseBody<UpsertBiometricRequest>(event);
    if (!body.date) return json(400, { error: "date_required" });
    return json(200, { biometric: await upsertBiometric(user.sub, body) });
  }

  if (method === "GET" && path === "/v1/pcos/medications") {
    return json(200, { medications: await listMedications(user.sub) });
  }

  if (method === "POST" && path === "/v1/pcos/medications") {
    const body = parseBody<CreateMedicationRequest>(event);
    if (!body.name?.trim() || !body.timeLocal) {
      return json(400, { error: "name_and_time_required" });
    }
    return json(201, { medication: await createMedication(user.sub, body) });
  }

  const medMatch = path.match(/^\/v1\/pcos\/medications\/([^/]+)$/);
  if (medMatch) {
    const id = medMatch[1]!;
    if (method === "PATCH") {
      const med = await patchMedication(
        user.sub,
        id,
        parseBody<PatchMedicationRequest>(event),
      );
      if (!med) return json(404, { error: "medication_not_found" });
      return json(200, { medication: med });
    }
    if (method === "DELETE") {
      if (!(await deleteMedication(user.sub, id))) {
        return json(404, { error: "medication_not_found" });
      }
      return json(200, { ok: true });
    }
  }

  if (method === "GET" && path === "/v1/pcos/insights") {
    return json(200, {
      insights: await pcosInsightsForUser(user.sub),
      disclaimer:
        "Possible patterns only — not a diagnosis or medical advice.",
    });
  }

  if (method === "GET" && path === "/v1/pcos/articles") {
    const market = (event.queryStringParameters?.market ??
      profile?.market ??
      "UK") as Market;
    return json(200, { articles: articlesForMarket(market) });
  }

  if (method === "POST" && path === "/v1/pcos/push-subscription") {
    const body = parseBody<PushSubscriptionRequest>(event);
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return json(400, { error: "invalid_subscription" });
    }
    const saved = await savePushSubscription(user.sub, body);
    return json(201, { subscription: saved });
  }

  if (method === "GET" && path === "/v1/pcos/reminders/due") {
    const nowLocal =
      event.queryStringParameters?.nowLocal ??
      new Date().toISOString().slice(11, 16);
    const due = await dueMedications(user.sub, nowLocal);
    return json(200, {
      due,
      pushPayload: {
        title: "GirlCode360",
        body: GENERIC_PUSH_BODY,
        data: { deepLink: "/app/health" },
      },
      subscriptions: (await listPushSubscriptions(user.sub)).length,
    });
  }

  /* ——— Phase 4: pregnancy / TTC / notifications / emergency ——— */

  if (method === "GET" && path === "/v1/emergency") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, {
      market: profile.market,
      numbers: await emergencyNumbers(profile.market),
    });
  }

  if (method === "GET" && path === "/v1/notifications/prefs") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { prefs: await getNotificationPrefs(user.sub) });
  }

  if (method === "PATCH" && path === "/v1/notifications/prefs") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, {
      prefs: await patchNotificationPrefs(
        user.sub,
        parseBody<PatchNotificationPrefsRequest>(event),
      ),
    });
  }

  if (path.startsWith("/v1/pregnancy")) {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if (!profile.modules.includes("pregnancy")) {
      return json(403, { error: "pregnancy_module_disabled" });
    }
  }

  if (method === "GET" && path === "/v1/pregnancy") {
    const status = await pregnancyStatus(user.sub);
    if (!status) return json(404, { error: "pregnancy_not_started" });
    return json(200, status);
  }

  if (method === "POST" && path === "/v1/pregnancy") {
    const body = parseBody<InitPregnancyRequest>(event);
    if (!body.anchorDate || !body.method) {
      return json(400, { error: "anchor_and_method_required" });
    }
    const profilePreg = await initPregnancy(user.sub, body);
    const week = (await pregnancyStatus(user.sub))?.week ?? 1;
    return json(201, { profile: profilePreg, week });
  }

  if (method === "GET" && path === "/v1/pregnancy/weeks") {
    const weekParam = event.queryStringParameters?.week;
    if (weekParam) {
      const w = weekContent(Number(weekParam));
      if (!w) return json(404, { error: "week_not_found" });
      return json(200, { week: w });
    }
    return json(200, { weeks: allWeekContent() });
  }

  if (method === "GET" && path === "/v1/pregnancy/days") {
    return json(200, { days: await listPregnancyDays(user.sub) });
  }

  if (method === "PUT" && path === "/v1/pregnancy/days") {
    const body = parseBody<UpsertPregnancyDayRequest>(event);
    if (!body.date) return json(400, { error: "date_required" });
    return json(200, { day: await upsertPregnancyDay(user.sub, body) });
  }

  if (method === "GET" && path === "/v1/pregnancy/appointments") {
    return json(200, { appointments: await listAppointments(user.sub) });
  }

  if (method === "POST" && path === "/v1/pregnancy/appointments") {
    const body = parseBody<CreateAppointmentRequest>(event);
    if (!body.date || !body.type) {
      return json(400, { error: "date_and_type_required" });
    }
    return json(201, { appointment: await createAppointment(user.sub, body) });
  }

  const apptMatch = path.match(/^\/v1\/pregnancy\/appointments\/([^/]+)$/);
  if (apptMatch && method === "DELETE") {
    if (!(await deleteAppointment(user.sub, apptMatch[1]!))) {
      return json(404, { error: "appointment_not_found" });
    }
    return json(200, { ok: true });
  }

  if (path.startsWith("/v1/ttc")) {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if (!profile.modules.includes("ttc")) {
      return json(403, { error: "ttc_module_disabled" });
    }
  }

  if (method === "GET" && path === "/v1/ttc") {
    const status = await ttcStatus(user.sub);
    if (!status) return json(404, { error: "ttc_not_started" });
    return json(200, status);
  }

  if (method === "POST" && path === "/v1/ttc") {
    const body = parseBody<{ startedOn?: string }>(event);
    return json(201, await initTtc(user.sub, body.startedOn));
  }

  if (method === "GET" && path === "/v1/ttc/fertile-window") {
    return json(200, await fertileForUser(user.sub));
  }

  if (method === "GET" && path === "/v1/ttc/days") {
    return json(200, { days: await listTtcDays(user.sub) });
  }

  if (method === "PUT" && path === "/v1/ttc/days") {
    const body = parseBody<UpsertTtcDayRequest>(event);
    if (!body.date) return json(400, { error: "date_required" });
    const result = await upsertTtcDay(user.sub, body);
    if ("error" in result) return json(400, { error: result.error });
    return json(200, { day: result });
  }

  const intimacyMatch = path.match(/^\/v1\/ttc\/days\/([^/]+)\/intimacy$/);
  if (intimacyMatch && method === "DELETE") {
    if (!(await deleteTtcIntimacy(user.sub, intimacyMatch[1]!))) {
      return json(404, { error: "day_not_found" });
    }
    return json(200, { ok: true });
  }

  /* ——— Phase 5: Health Wallet (authenticated) ——— */

  if (path.startsWith("/v1/wallet")) {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if (!profile.modules.includes("wallet")) {
      return json(403, { error: "wallet_module_disabled" });
    }
  }

  if (method === "GET" && path === "/v1/wallet/docs") {
    await runWalletPurge();
    return json(200, { docs: await listWalletDocs(user.sub) });
  }

  if (method === "POST" && path === "/v1/wallet/uploads") {
    const body = parseBody<CreateWalletUploadRequest>(event);
    try {
      const host = event.headers?.Host ?? event.headers?.host ?? "api.local";
      const apiBase = process.env.API_BASE_URL ?? `https://${host}`;
      const result = await createWalletUpload(user.sub, body, apiBase);
      return json(201, {
        doc: result.doc,
        uploadUrl: result.uploadUrl,
        uploadPath: result.uploadPath,
        uploadMethod: "PUT",
        uploadHeaders: result.uploadHeaders,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "upload_failed";
      if (msg === "SIZE_LIMIT") return json(400, { error: "file_too_large" });
      return json(400, { error: "invalid_upload" });
    }
  }

  const objMatch = path.match(/^\/v1\/wallet\/objects\/([^/]+)$/);
  if (objMatch) {
    const id = objMatch[1]!;
    if (method === "PUT") {
      const body = parseBody<{ ciphertextB64?: string }>(event);
      const b64 =
        body.ciphertextB64 ??
        (typeof event.body === "string" && !event.body.startsWith("{")
          ? event.body
          : null);
      if (!b64) return json(400, { error: "ciphertext_required" });
      if (!(await putWalletObject(user.sub, id, b64))) {
        return json(404, { error: "doc_not_found" });
      }
      return json(200, { ok: true });
    }
    if (method === "GET") {
      const ct = await getWalletObject(user.sub, id);
      if (!ct) return json(404, { error: "object_missing" });
      const doc = await getWalletDoc(user.sub, id);
      return json(200, {
        ciphertextB64: ct,
        fileIv: doc?.fileIv,
        contentType: doc?.contentType,
        filename: doc?.filename,
      });
    }
  }

  const docMatch = path.match(/^\/v1\/wallet\/docs\/([^/]+)$/);
  if (docMatch) {
    const id = docMatch[1]!;
    if (method === "GET") {
      const doc = await getWalletDoc(user.sub, id);
      if (!doc || doc.deletedAt) return json(404, { error: "doc_not_found" });
      return json(200, { doc });
    }
    if (method === "PATCH") {
      const body = parseBody<{
        category?: WalletCategory;
        noteCiphertext?: string | null;
        noteIv?: string | null;
      }>(event);
      const doc = await patchWalletMeta(user.sub, id, body);
      if (!doc) return json(404, { error: "doc_not_found" });
      return json(200, { doc });
    }
    if (method === "DELETE") {
      const doc = await softDeleteWalletDoc(user.sub, id);
      if (!doc) return json(404, { error: "doc_not_found" });
      return json(200, {
        doc,
        purgePolicy:
          "Ciphertext retained until purge_after (deleted_at + 30 days), then permanently removed.",
      });
    }
  }

  const shareCreateMatch = path.match(/^\/v1\/wallet\/docs\/([^/]+)\/shares$/);
  if (shareCreateMatch && method === "POST") {
    const result = await createWalletShare(
      user.sub,
      shareCreateMatch[1]!,
      parseBody<CreateWalletShareRequest>(event),
    );
    if ("error" in result) return json(400, { error: result.error });
    return json(201, {
      share: result,
      hint: "Put the DEK in the URL fragment (#k=...) so it never hits the server.",
    });
  }

  if (shareCreateMatch && method === "GET") {
    return json(200, {
      shares: await listSharesForDoc(user.sub, shareCreateMatch[1]!),
    });
  }

  const revokeMatch = path.match(/^\/v1\/wallet\/shares\/([^/]+)$/);
  if (revokeMatch && method === "DELETE") {
    if (!(await revokeWalletShare(user.sub, revokeMatch[1]!))) {
      return json(404, { error: "share_not_found" });
    }
    return json(200, { ok: true });
  }

  /* ——— Phase 6: Zara + HealthLens ——— */

  if (method === "GET" && path === "/v1/zara/quota") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { quota: await getZaraQuota(user.sub) });
  }

  if (method === "POST" && path === "/v1/zara/chat") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{
      message?: string;
      mode?: "context" | "anonymous";
    }>(event);
    if (!body.message?.trim()) return json(400, { error: "message_required" });
    const mode = body.mode === "anonymous" ? "anonymous" : "context";
    if (mode === "context") {
      const consents = await latestConsentsByPurpose(user.sub);
      const zara = consents.find((c) => c.purpose === "ai_zara");
      if (!zara?.granted) {
        return json(403, { error: "zara_consent_required" });
      }
    }
    const result = await zaraChat(user.sub, body.message.trim(), mode);
    return json(200, {
      ...result,
      disclaimer: ZARA_DISCLAIMER,
      actions: [{ id: "prep_card", label: "Generate appointment Prep Card" }],
      // Client may animate tokens from full reply until APIGW STREAM is enabled
      streamHint: "full_reply_v1",
    });
  }

  if (method === "GET" && path === "/v1/zara/context-preview") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { context: await assembleZaraContext(user.sub) });
  }

  if (method === "GET" && path === "/v1/healthlens/status") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await getHealthLensStatus(user.sub));
  }

  if (method === "POST" && path === "/v1/healthlens/population-consent") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{ granted?: boolean }>(event);
    return json(200, {
      status: await setPopulationLearningConsent(user.sub, Boolean(body.granted)),
    });
  }

  if (method === "POST" && path === "/v1/healthlens/report") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const consents = await latestConsentsByPurpose(user.sub);
    const hl = consents.find((c) => c.purpose === "ai_healthlens");
    if (!hl?.granted) return json(403, { error: "healthlens_consent_required" });
    const report = await generateHealthLensReport(user.sub);
    if ("error" in report) return json(400, { error: report.error });
    return json(201, { report });
  }

  if (method === "GET" && path === "/v1/healthlens/report") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const report = await latestHealthLensReport(user.sub);
    if (!report) return json(404, { error: "no_report" });
    return json(200, { report });
  }

  if (method === "POST" && path === "/v1/healthlens/prep-card") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{ questions?: string[] }>(event);
    const card = await buildPrepCard(user.sub, body.questions ?? []);
    return json(200, card);
  }

  /* ——— Phase 7: Privacy, billing, content ——— */

  if (method === "GET" && path === "/v1/privacy/my-data") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const snap = await getMyData(user.sub);
    if (!snap) return json(404, { error: "user_not_bootstrapped" });
    return json(200, snap);
  }

  if (method === "POST" && path === "/v1/privacy/export") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(201, { job: await createExportJob(user.sub) });
  }

  const exportMatch = path.match(/^\/v1\/privacy\/export\/([^/]+)$/);
  if (exportMatch && method === "GET") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const job = await getExportJob(user.sub, exportMatch[1]!);
    if (!job) return json(404, { error: "export_not_found" });
    return json(200, { job });
  }

  if (method === "POST" && path === "/v1/privacy/delete") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(201, { deletion: await requestDeletion(user.sub) });
  }

  if (method === "POST" && path === "/v1/privacy/delete/cancel") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const deletion = await cancelDeletion(user.sub);
    if (!deletion) return json(400, { error: "no_active_deletion" });
    return json(200, { deletion });
  }

  if (method === "GET" && path === "/v1/privacy/delete") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { deletion: await getDeletion(user.sub) });
  }

  if (method === "GET" && path === "/v1/billing/status") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await getBillingStatus(user.sub));
  }

  if (method === "POST" && path === "/v1/billing/checkout") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{
      provider?: "stripe" | "paystack";
      successUrl?: string;
      cancelUrl?: string;
    }>(event);
    const provider = body.provider === "paystack" ? "paystack" : "stripe";
    return json(200, await createCheckoutSession(user.sub, provider, body.successUrl));
  }

  if (method === "POST" && path === "/v1/billing/portal") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, await createPortalSession(user.sub));
  }

  if (method === "POST" && path === "/v1/billing/dev-activate") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if ((process.env.ENVIRONMENT ?? "dev") === "prod") {
      return json(403, { error: "dev_only" });
    }
    return json(200, { status: await activatePremium(user.sub, "dev") });
  }

  if (method === "GET" && path === "/v1/content/articles") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const market = (event.queryStringParameters?.market ??
      profile.market) as "UK" | "NG" | "GH";
    const topic = event.queryStringParameters?.topic;
    return json(200, { articles: contentArticles(market, topic) });
  }

  return json(404, { error: "not_found", path, method });
};
