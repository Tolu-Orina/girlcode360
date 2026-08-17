import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { marketFromCountry } from "../lib/geo";
import { buildPrediction } from "../lib/prediction";
import { articlesForMarket, pcosInsightsForUser } from "../lib/pcos";
import { contentArticles } from "../lib/content";
import {
  createContentReport,
  isReportReason,
  isReportStatus,
  isReportTarget,
  listModerationQueue,
  listMyReports,
  patchReportStatus,
} from "../store/contentReports";
import { allWeekContent, weekContent } from "../lib/weeks";
import {
  assembleAlenaContext,
  buildPrepCard,
  maybeMonthlyHealthLensReport,
  generateHealthLensReport,
  getHealthLensStatus,
  getAlenaQuota,
  latestHealthLensReport,
  runMonthlyHealthLensTick,
  setPopulationLearningConsent,
  alenaChat,
  alenaGuestChat,
  ALENA_DISCLAIMER,
} from "../store/ai";
import {
  activatePremium,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  handleBillingWebhook,
  handlePaystackSignedWebhook,
  handleStripeSignedWebhook,
} from "../store/billing";
import {
  CORS,
  claims,
  header,
  internalAuthorized,
  json,
  mapYoucamErr,
  parseBody,
  pathOf,
} from "../http";
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
  listWalletMedications,
  createWalletMedication,
  deleteWalletMedication,
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
  patchPregnancy,
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
  PatchPregnancyRequest,
  PatchUserRequest,
  PostConsentsRequest,
  ConsentPurpose,
  PushSubscriptionRequest,
  SyncOp,
  SyncRequest,
  UpsertBiometricRequest,
  UpsertCycleDayRequest,
  UpsertPregnancyDayRequest,
  UpsertTtcDayRequest,
  WalletCategory,
} from "../types";
import { ALL_MODULES, CURRENT_POLICY_VERSION, GENERIC_PUSH_BODY } from "../types";
import { isDsqlEnabled } from "../db/client";
import { isDataBucketEnabled } from "../db/s3";
import { youcamApiKey } from "../lib/secrets";
import {
  extractYoucamTaskId,
  verifyYoucamWebhookSignature,
} from "../lib/youcam";
import {
  createSkinScan,
  createTryOn,
  deleteSkinScan,
  getScanMedia,
  getSkinScan,
  getTryOnMedia,
  getTryOnPublic,
  listCatalogue,
  listSkinScans,
  listTryOnsPublic,
  mirrorConsented,
  mirrorLiveCameraConsented,
  mirrorStatus,
  pregnancyWeek,
  settleYoucamWebhook,
  wardrobeConsented,
} from "../store/mirror";
import {
  createMakeupLook,
  createShadeMatch,
  deleteMakeupLook,
  getMakeupLookMedia,
  getMakeupLookPublic,
  listMakeupLooksPublic,
  listShadeMatchesPublic,
  saveMakeupLook,
  settleMakeupByYoucamTask,
} from "../store/studio";
import {
  createHairScan,
  getHairScanMedia,
  getHairScanPublic,
  listHairScansPublic,
  settleHairByYoucamTask,
} from "../store/hair";
import {
  createWardrobeItem,
  createWardrobeOutfit,
  deleteWardrobeItem,
  getWardrobeItemMedia,
  getWardrobeItemPublic,
  getWardrobeOutfitMedia,
  getWardrobeOutfitPublic,
  listWardrobeItemsPublic,
  listWardrobeOutfitsPublic,
  markOutfitWorn,
  packingListForUser,
  patchWardrobeItem,
  startWardrobeOutfitTryOn,
  settleWardrobeByYoucamTask,
  suggestOutfitForToday,
} from "../store/wardrobe";
import { getStyleAnalytics } from "../store/style";
import {
  createAccessoryLook,
  getAccessoryLookMedia,
  getAccessoryLookPublic,
  listAccessoryLooksPublic,
  settleAccessoryByYoucamTask,
} from "../store/accessories";
import {
  createResaleListing,
  getLiveResale,
  getResaleForOwner,
  getResaleMedia,
  listLiveResalePublic,
  listMyResale,
  listPendingResale,
  moderateResale,
} from "../store/resale";
import {
  addFavourite,
  createListingReview,
  getMarketplaceListing,
  getSheMatchPrefs,
  listFavouriteIds,
  listListingReviews,
  listMarketplace,
  listMyListings,
  moderateListing,
  moderateReview,
  patchOwnedListing,
  patchSheMatchPrefs,
  removeFavourite,
  submitBusinessListing,
  suggestSheMatch,
} from "../store/marketplace";
import { runNotificationTick, vapidPublicKey } from "../store/notify";
import {
  createPost,
  joinGroup,
  leaveGroup,
  listGroups,
  listPendingPosts,
  listPosts,
  moderatePost,
} from "../store/community";
import {
  fanOutListingLive,
  fanOutPromo,
  inboxUnreadCount,
  listInbox,
  markInboxAllRead,
  markInboxRead,
} from "../store/inbox";
import type {
  CreateBusinessListingRequest,
  CreateListingReviewRequest,
  CreateWalletMedicationRequest,
  MarketplaceCategory,
  PatchOwnedListingRequest,
} from "../types";
import type { SheMatchTriggerId } from "../../../../../../packages/domain/src/index";
import {
  climateFromMarket,
  isWardrobeClimate,
  sheMatchTrigger,
} from "../../../../../../packages/domain/src/index";


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
async function requireMirrorConsent(sub: string) {
  if (!(await mirrorConsented(sub))) {
    return json(403, { error: "mirror_consent_required" });
  }
  return null;
}

async function requireLiveCameraConsent(sub: string) {
  if (!(await mirrorLiveCameraConsented(sub))) {
    return json(403, { error: "live_camera_consent_required" });
  }
  return null;
}

async function requireWardrobeConsent(sub: string) {
  if (!(await wardrobeConsented(sub))) {
    return json(403, { error: "wardrobe_consent_required" });
  }
  return null;
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
    const viewerCountry =
      header(event, "CloudFront-Viewer-Country") ??
      header(event, "cloudfront-viewer-country");
    return json(200, {
      ok: true,
      service: "girlcode360-api",
      environment: process.env.ENVIRONMENT ?? "unknown",
      ts: new Date().toISOString(),
      policyVersion: process.env.CONSENT_POLICY_VERSION ?? CURRENT_POLICY_VERSION,
      dsql: isDsqlEnabled(),
      dataBucket: isDataBucketEnabled(),
      viewerCountry: viewerCountry ?? null,
      suggestedMarket: marketFromCountry(viewerCountry) ?? null,
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

  if (method === "POST" && path === "/v1/guest/alena") {
    const body = parseBody<{ message?: string; market?: Market }>(event);
    if (!body.message?.trim()) return json(400, { error: "message_required" });
    const msg = body.message.trim().slice(0, 500);
    const market: Market =
      body.market === "NG" || body.market === "GH" || body.market === "UK"
        ? body.market
        : marketFromCountry(
            header(event, "CloudFront-Viewer-Country") ??
              header(event, "cloudfront-viewer-country"),
          ) ?? "UK";
    const ip =
      header(event, "X-Forwarded-For")?.split(",")[0]?.trim() ||
      event.requestContext.identity?.sourceIp ||
      "unknown";
    const result = await alenaGuestChat(msg, market, ip);
    return json(200, {
      ...result,
      disclaimer: ALENA_DISCLAIMER,
    });
  }

  const stripeHook = path === "/v1/billing/webhooks/stripe";
  const paystackHook = path === "/v1/billing/webhooks/paystack";
  if (method === "POST" && stripeHook) {
    const raw = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body
      : "";
    const result = await handleStripeSignedWebhook(
      raw,
      header(event, "Stripe-Signature"),
    );
    if (!result.ok) {
      const status = result.error === "invalid_signature" ? 401 : 400;
      return json(status, { error: result.error });
    }
    return json(200, { received: true, ignored: result.ignored === true });
  }
  if (method === "POST" && paystackHook) {
    const raw = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body
      : "";
    const result = await handlePaystackSignedWebhook(
      raw,
      header(event, "x-paystack-signature"),
    );
    if (!result.ok) {
      const status = result.error === "invalid_signature" ? 401 : 400;
      return json(status, { error: result.error });
    }
    return json(200, { received: true, ignored: result.ignored === true });
  }

  if (method === "POST" && path === "/v1/webhooks/youcam") {
    const raw = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body
      : "";
    const sig =
      header(event, "X-YouCam-Signature") ??
      header(event, "webhook-signature") ??
      header(event, "X-Hub-Signature-256");
    if (!(await verifyYoucamWebhookSignature(raw, sig))) {
      return json(401, { error: "invalid_signature" });
    }
    let payload: unknown = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: "invalid_json" });
    }
    const taskId = extractYoucamTaskId(payload);
    if (!taskId) return json(400, { error: "task_id_required" });
    const settled =
      (await settleYoucamWebhook(taskId)) ??
      (await settleMakeupByYoucamTask(taskId)) ??
      (await settleHairByYoucamTask(taskId)) ??
      (await settleAccessoryByYoucamTask(taskId)) ??
      (await settleWardrobeByYoucamTask(taskId));
    return json(200, { ok: true, settled });
  }

  // Internal purge tick (EventBridge later; open in local with header)
  if (method === "POST" && path === "/v1/privacy/purge-tick") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    return json(200, {
      purged: await runDeletionPurge(),
      wallet: await runWalletPurge(),
    });
  }

  if (method === "POST" && path === "/v1/notifications/tick") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    return json(200, await runNotificationTick());
  }

  if (method === "POST" && path === "/v1/healthlens/monthly-tick") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    return json(200, await runMonthlyHealthLensTick());
  }

  if (method === "POST" && path === "/v1/marketplace/moderate") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const body = parseBody<{ id?: string; action?: "approve" | "reject" }>(event);
    if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
      return json(400, { error: "id_and_action_required" });
    }
    const listing = await moderateListing(body.id, body.action);
    if (listing) {
      let inAppNotified = 0;
      if (body.action === "approve") {
        inAppNotified = await fanOutListingLive(listing);
      }
      return json(200, { listing, inAppNotified });
    }
    const resale = await moderateResale(body.id, body.action);
    if (!resale) return json(404, { error: "listing_not_found" });
    return json(200, { resale });
  }

  if (method === "POST" && path === "/v1/marketplace/reviews/moderate") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const body = parseBody<{ id?: string; action?: "approve" | "reject" }>(event);
    if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
      return json(400, { error: "id_and_action_required" });
    }
    const review = await moderateReview(body.id, body.action);
    if (!review) return json(404, { error: "review_not_found" });
    return json(200, { review });
  }

  if (method === "POST" && path === "/v1/community/posts/moderate") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const body = parseBody<{ id?: string; action?: "approve" | "reject" }>(event);
    if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
      return json(400, { error: "id_and_action_required" });
    }
    const post = await moderatePost(body.id, body.action);
    if (!post) return json(404, { error: "post_not_found" });
    return json(200, { post });
  }

  if (method === "POST" && path === "/v1/in-app/promo") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const body = parseBody<{ market?: "UK" | "NG" | "GH"; listingId?: string }>(
      event,
    );
    if (body.market !== "UK" && body.market !== "NG" && body.market !== "GH") {
      return json(400, { error: "market_required" });
    }
    return json(200, {
      notified: await fanOutPromo({
        market: body.market,
        listingId: body.listingId ?? null,
      }),
    });
  }

  if (method === "GET" && path === "/v1/content/moderation-queue") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const statusRaw = event.queryStringParameters?.status;
    if (statusRaw && !isReportStatus(statusRaw)) {
      return json(400, { error: "invalid_status" });
    }
    return json(200, {
      reports: await listModerationQueue(
        statusRaw && isReportStatus(statusRaw) ? statusRaw : undefined,
      ),
      pendingCommunityPosts: await listPendingPosts(),
      pendingResale: await listPendingResale(),
    });
  }

  if (method === "PATCH" && path === "/v1/content/moderation-queue") {
    if (!(await internalAuthorized(event))) {
      return json(401, { error: "unauthorized" });
    }
    const body = parseBody<{ id?: string; status?: string }>(event);
    if (!body.id || !body.status || !isReportStatus(body.status)) {
      return json(400, { error: "id_and_status_required" });
    }
    const report = await patchReportStatus(body.id, body.status);
    if (!report) return json(404, { error: "report_not_found" });
    return json(200, { report });
  }

  const user = claims(event);
  if (!user) return json(401, { error: "unauthorized" });

  if (method === "POST" && path === "/v1/users/me/bootstrap") {
    const body = parseBody<BootstrapRequest>(event);
    const existing = await getUser(user.sub);
    if (existing && !existing.ageConfirmed18) {
      return json(403, { error: "minor_blocked" });
    }
    if (!body.ageConfirmed18) {
      await upsertUser(user.sub, {
        email: user.email,
        ageConfirmed18: false,
        onboardingComplete: false,
        market: body.market,
        locale: body.locale,
      });
      return json(403, { error: "minor_blocked" });
    }
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
    const existing = await getUser(user.sub);
    if (!existing) return json(404, { error: "user_not_bootstrapped" });
    if (!existing.ageConfirmed18) return json(403, { error: "minor_blocked" });
    const body = parseBody<PatchUserRequest>(event);
    if (body.onboardingComplete && !existing.ageConfirmed18) {
      return json(403, { error: "age_gate_required" });
    }
    return json(
      200,
      await upsertUser(user.sub, {
        market: body.market,
        locale: body.locale,
        onboardingComplete: body.onboardingComplete,
      }),
    );
  }

  if (method === "PATCH" && path === "/v1/users/me/modules") {
    const existing = await getUser(user.sub);
    if (!existing) return json(404, { error: "user_not_bootstrapped" });
    if (!existing.ageConfirmed18) return json(403, { error: "minor_blocked" });
    const body = parseBody<PatchModulesRequest>(event);
    if (!Array.isArray(body.modules) || body.modules.length === 0) {
      return json(400, { error: "modules_required" });
    }
    const allowed = new Set<string>(ALL_MODULES);
    if (body.modules.some((m) => !allowed.has(m))) {
      return json(400, { error: "modules_invalid" });
    }
    return json(200, await setModules(user.sub, body.modules as HealthModule[]));
  }

  if (method === "POST" && path === "/v1/consents") {
    const existing = await getUser(user.sub);
    if (!existing) return json(404, { error: "user_not_bootstrapped" });
    if (!existing.ageConfirmed18) return json(403, { error: "minor_blocked" });
    const body = parseBody<PostConsentsRequest>(event);
    if (!body.jurisdiction || !body.items?.length) {
      return json(400, { error: "invalid_consent_payload" });
    }
    const allowed: ConsentPurpose[] = [
      "health_data",
      "analytics",
      "marketing",
      "location",
      "ai_alena",
      "ai_healthlens",
      "mirror_biometric",
      "mirror_live_camera",
      "wardrobe",
      "shematch",
    ];
    if (
      body.items.some(
        (i) => !allowed.includes(i.purpose as ConsentPurpose),
      )
    ) {
      return json(400, { error: "invalid_consent_purpose" });
    }
    const health = body.items.find((i) => i.purpose === "health_data");
    const current = await latestConsentsByPurpose(user.sub);
    const healthOnFile = current.find((c) => c.purpose === "health_data")?.granted;
    if (health) {
      // grant or revoke is explicit
    } else if (!healthOnFile) {
      return json(400, { error: "health_consent_required" });
    }
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

  {
    const adult = await getUser(user.sub);
    const sensitive =
      path.startsWith("/v1/cycles") ||
      path.startsWith("/v1/symptoms") ||
      path.startsWith("/v1/pcos") ||
      path.startsWith("/v1/pregnancy") ||
      path.startsWith("/v1/ttc") ||
      path.startsWith("/v1/wallet") ||
      path.startsWith("/v1/alena") ||
      path.startsWith("/v1/zara") ||
      path.startsWith("/v1/healthlens") ||
      path.startsWith("/v1/mirror") ||
      path.startsWith("/v1/privacy") ||
      path.startsWith("/v1/billing") ||
      path.startsWith("/v1/content") ||
      path.startsWith("/v1/notifications") ||
      path.startsWith("/v1/emergency") ||
      path.startsWith("/v1/marketplace") ||
      path.startsWith("/v1/shematch") ||
      path.startsWith("/v1/community") ||
      path.startsWith("/v1/in-app");
    if (sensitive && adult && !adult.ageConfirmed18) {
      return json(403, { error: "minor_blocked" });
    }
    const healthPaths =
      path.startsWith("/v1/cycles") ||
      path.startsWith("/v1/pcos") ||
      path.startsWith("/v1/pregnancy") ||
      path.startsWith("/v1/ttc") ||
      path.startsWith("/v1/wallet");
    if (healthPaths && adult) {
      const consents = await latestConsentsByPurpose(user.sub);
      if (!consents.find((c) => c.purpose === "health_data")?.granted) {
        return json(403, { error: "health_consent_required" });
      }
    }
  }

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

  if (method === "PATCH" && path === "/v1/pregnancy") {
    const body = parseBody<PatchPregnancyRequest>(event);
    const profilePreg = await patchPregnancy(user.sub, body);
    if (!profilePreg) return json(404, { error: "pregnancy_not_started" });
    const week = (await pregnancyStatus(user.sub))?.week ?? 1;
    return json(200, { profile: profilePreg, week });
  }

  if (method === "GET" && path === "/v1/pregnancy/weeks") {
    const weekParam = event.queryStringParameters?.week;
    if (weekParam) {
      const w = weekContent(
        Number(weekParam),
        (profile?.market ?? "UK") as "UK" | "NG" | "GH",
      );
      if (!w) return json(404, { error: "week_not_found" });
      return json(200, { week: w });
    }
    return json(200, {
      weeks: allWeekContent((profile?.market ?? "UK") as "UK" | "NG" | "GH"),
    });
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

  if (method === "GET" && path === "/v1/wallet/medications") {
    return json(200, { medications: await listWalletMedications(user.sub) });
  }

  if (method === "POST" && path === "/v1/wallet/medications") {
    const body = parseBody<CreateWalletMedicationRequest>(event);
    const row = await createWalletMedication(user.sub, body);
    if ("error" in row) return json(400, { error: row.error });
    return json(201, { medication: row });
  }

  const walletMedMatch = path.match(/^\/v1\/wallet\/medications\/([^/]+)$/);
  if (walletMedMatch && method === "DELETE") {
    if (!(await deleteWalletMedication(user.sub, walletMedMatch[1]!))) {
      return json(404, { error: "medication_not_found" });
    }
    return json(200, { ok: true });
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
      if (msg === "TYPE_LIMIT") return json(400, { error: "unsupported_file_type" });
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
        customLabel?: string | null;
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

  /* ——— Phase 1.4 Mirror ——— */

  if (path.startsWith("/v1/mirror")) {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    if (!profile.ageConfirmed18) return json(403, { error: "age_gate_required" });
  }

  if (method === "GET" && path === "/v1/mirror/status") {
    return json(200, await mirrorStatus(user.sub));
  }

  if (method === "POST" && path === "/v1/mirror/consent") {
    const body = parseBody<{ granted?: boolean; jurisdiction?: Market }>(event);
    if (typeof body.granted !== "boolean") {
      return json(400, { error: "granted_required" });
    }
    const policyVersion =
      process.env.CONSENT_POLICY_VERSION || CURRENT_POLICY_VERSION;
    await addConsents(
      user.sub,
      (body.jurisdiction ?? profile!.market) as Market,
      policyVersion,
      [{ purpose: "mirror_biometric", granted: body.granted }],
    );
    return json(200, await mirrorStatus(user.sub));
  }

  if (method === "GET" && path === "/v1/mirror/catalogue") {
    if (!(await mirrorConsented(user.sub))) {
      return json(403, { error: "mirror_consent_required" });
    }
    const kind = event.queryStringParameters?.kind as
      | "skincare"
      | "apparel"
      | "makeup"
      | "jewellery"
      | "eyewear"
      | "nail_color"
      | undefined;
    const mode = (event.queryStringParameters?.mode ?? "all") as
      | "all"
      | "maternity"
      | "pmos";
    const week =
      mode === "maternity" ? await pregnancyWeek(user.sub) : null;
    if (mode === "maternity" && week == null) {
      return json(200, {
        items: [],
        pregnancyWeek: null,
        emptyReason: "pregnancy_week_unknown",
      });
    }
    return json(200, {
      items: listCatalogue({ kind, mode, week }),
      pregnancyWeek: week,
    });
  }

  if (method === "GET" && path === "/v1/mirror/scans") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { scans: await listSkinScans(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror/scans") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{ imageB64?: string }>(event);
    if (!body.imageB64) return json(400, { error: "image_required" });
    try {
      const scan = await createSkinScan(user.sub, body.imageB64);
      return json(202, { scan });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("create scan", err);
      return json(502, { error: "scan_failed" });
    }
  }

  const scanMatch = path.match(/^\/v1\/mirror\/scans\/([^/]+)$/);
  if (scanMatch && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const scan = await getSkinScan(user.sub, scanMatch[1]!);
    if (!scan) return json(404, { error: "scan_not_found" });
    return json(200, { scan });
  }
  if (scanMatch && method === "DELETE") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await deleteSkinScan(user.sub, scanMatch[1]!))) {
      return json(404, { error: "scan_not_found" });
    }
    return json(200, { ok: true });
  }

  const scanMedia = path.match(/^\/v1\/mirror\/scans\/([^/]+)\/media$/);
  if (scanMedia && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const kind =
      event.queryStringParameters?.kind === "mask"
        ? "mask"
        : event.queryStringParameters?.kind === "source"
          ? "source"
          : "result";
    const media = await getScanMedia(user.sub, scanMedia[1]!, kind);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  if (method === "GET" && path === "/v1/mirror/tryons") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { tryons: await listTryOnsPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror/tryons") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{ imageB64?: string; catalogueItemId?: string }>(
      event,
    );
    if (!body.imageB64 || !body.catalogueItemId) {
      return json(400, { error: "image_and_item_required" });
    }
    try {
      const tryon = await createTryOn(
        user.sub,
        body.imageB64,
        body.catalogueItemId,
      );
      return json(202, { tryon });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("create tryon", err);
      return json(502, { error: "tryon_failed" });
    }
  }

  const tryMatch = path.match(/^\/v1\/mirror\/tryons\/([^/]+)$/);
  if (tryMatch && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const tryon = await getTryOnPublic(user.sub, tryMatch[1]!);
    if (!tryon) return json(404, { error: "tryon_not_found" });
    return json(200, { tryon });
  }

  const tryMedia = path.match(/^\/v1\/mirror\/tryons\/([^/]+)\/media$/);
  if (tryMedia && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const media = await getTryOnMedia(user.sub, tryMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  /* ——— P3.2 Mirror Studio (makeup + shade) ——— */

  if (method === "GET" && path === "/v1/mirror-studio/makeup") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { looks: await listMakeupLooksPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/makeup/photo") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{
      imageB64?: string;
      scanId?: string;
      categories?: unknown;
      palettes?: unknown;
    }>(event);
    try {
      const look = await createMakeupLook(user.sub, {
        sourceKind: "photo",
        imageB64: body.imageB64,
        scanId: body.scanId,
        categories: body.categories,
        palettes: body.palettes,
      });
      return json(202, { look });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("makeup photo", err);
      return json(502, { error: "makeup_failed" });
    }
  }

  if (method === "POST" && path === "/v1/mirror-studio/makeup/live") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const live = await requireLiveCameraConsent(user.sub);
    if (live) return live;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{
      imageB64?: string;
      categories?: unknown;
      palettes?: unknown;
    }>(event);
    if (!body.imageB64) return json(400, { error: "image_required" });
    try {
      const look = await createMakeupLook(user.sub, {
        sourceKind: "live",
        imageB64: body.imageB64,
        categories: body.categories,
        palettes: body.palettes,
      });
      return json(202, { look });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("makeup live", err);
      return json(502, { error: "makeup_failed" });
    }
  }

  if (method === "POST" && path === "/v1/mirror-studio/makeup/transfer") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{
      imageB64?: string;
      scanId?: string;
      referenceB64?: string;
      categories?: unknown;
    }>(event);
    try {
      const look = await createMakeupLook(user.sub, {
        sourceKind: "transfer",
        imageB64: body.imageB64,
        scanId: body.scanId,
        referenceB64: body.referenceB64,
        categories: body.categories,
      });
      return json(202, { look });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("makeup transfer", err);
      return json(502, { error: "makeup_failed" });
    }
  }

  const makeupOne = path.match(/^\/v1\/mirror-studio\/makeup\/([^/]+)$/);
  if (makeupOne && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const look = await getMakeupLookPublic(user.sub, makeupOne[1]!);
    if (!look) return json(404, { error: "look_not_found" });
    return json(200, { look });
  }
  if (makeupOne && method === "PATCH") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ saved?: boolean }>(event);
    if (typeof body.saved !== "boolean") return json(400, { error: "saved_required" });
    const look = await saveMakeupLook(user.sub, makeupOne[1]!, body.saved);
    if (!look) return json(404, { error: "look_not_found" });
    return json(200, { look });
  }
  if (makeupOne && method === "DELETE") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await deleteMakeupLook(user.sub, makeupOne[1]!))) {
      return json(404, { error: "look_not_found" });
    }
    return json(200, { ok: true });
  }

  const makeupMedia = path.match(/^\/v1\/mirror-studio\/makeup\/([^/]+)\/media$/);
  if (makeupMedia && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const media = await getMakeupLookMedia(user.sub, makeupMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  if (method === "GET" && path === "/v1/mirror-studio/shade-matches") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { matches: await listShadeMatchesPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/shade-match") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{ scanId?: string; imageB64?: string }>(event);
    try {
      const match = await createShadeMatch(user.sub, {
        scanId: body.scanId,
        imageB64: body.imageB64,
      });
      return json(202, { match });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("shade match", err);
      return json(502, { error: "shade_match_failed" });
    }
  }

  if (method === "GET" && path === "/v1/mirror-studio/hair") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { scans: await listHairScansPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/hair/analysis") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{ imageB64?: string; scanId?: string }>(event);
    try {
      const scan = await createHairScan(user.sub, {
        kind: "analysis",
        imageB64: body.imageB64,
        scanId: body.scanId,
      });
      return json(202, { scan });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("hair analysis", err);
      return json(502, { error: "hair_failed" });
    }
  }

  if (method === "POST" && path === "/v1/mirror-studio/hair/tryon") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{
      imageB64?: string;
      scanId?: string;
      hairColor?: string;
      hairstyleId?: string;
    }>(event);
    try {
      const scan = await createHairScan(user.sub, {
        kind: "tryon",
        imageB64: body.imageB64,
        scanId: body.scanId,
        hairColor: body.hairColor,
        hairstyleId: body.hairstyleId,
      });
      return json(202, { scan });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("hair tryon", err);
      return json(502, { error: "hair_failed" });
    }
  }

  const hairOne = path.match(/^\/v1\/mirror-studio\/hair\/([^/]+)$/);
  if (hairOne && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const scan = await getHairScanPublic(user.sub, hairOne[1]!);
    if (!scan) return json(404, { error: "hair_not_found" });
    return json(200, { scan });
  }

  const hairMedia = path.match(/^\/v1\/mirror-studio\/hair\/([^/]+)\/media$/);
  if (hairMedia && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const media = await getHairScanMedia(user.sub, hairMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  /* ——— P3.4 My Wardrobe ——— */

  if (method === "GET" && path === "/v1/mirror-studio/wardrobe/items") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { items: await listWardrobeItemsPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/wardrobe/items") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{
      imageB64?: string;
      name?: string;
      category?: string;
      colourTags?: string[];
      sampleHexes?: string[];
      purchasePriceMinor?: number | null;
    }>(event);
    if (!body.imageB64) return json(400, { error: "image_required" });
    try {
      const item = await createWardrobeItem(user.sub, {
        imageB64: body.imageB64,
        name: body.name,
        category: body.category,
        colourTags: body.colourTags,
        sampleHexes: body.sampleHexes,
        purchasePriceMinor: body.purchasePriceMinor,
      });
      return json(201, { item });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("wardrobe item", err);
      return json(502, { error: "wardrobe_failed" });
    }
  }

  const wardrobeItemMedia = path.match(
    /^\/v1\/mirror-studio\/wardrobe\/items\/([^/]+)\/media$/,
  );
  if (wardrobeItemMedia && method === "GET") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const media = await getWardrobeItemMedia(user.sub, wardrobeItemMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  const wardrobeItemOne = path.match(
    /^\/v1\/mirror-studio\/wardrobe\/items\/([^/]+)$/,
  );
  if (wardrobeItemOne && method === "GET") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const item = await getWardrobeItemPublic(user.sub, wardrobeItemOne[1]!);
    if (!item) return json(404, { error: "wardrobe_item_not_found" });
    return json(200, { item });
  }
  if (wardrobeItemOne && method === "PATCH") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{
      name?: string | null;
      category?: string;
      colourTags?: string[];
      purchasePriceMinor?: number | null;
      archived?: boolean;
    }>(event);
    try {
      const item = await patchWardrobeItem(user.sub, wardrobeItemOne[1]!, body);
      if (!item) return json(404, { error: "wardrobe_item_not_found" });
      return json(200, { item });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "wardrobe_failed" });
    }
  }
  if (wardrobeItemOne && method === "DELETE") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    if (!(await deleteWardrobeItem(user.sub, wardrobeItemOne[1]!))) {
      return json(404, { error: "wardrobe_item_not_found" });
    }
    return json(200, { ok: true });
  }

  if (method === "POST" && path === "/v1/mirror-studio/wardrobe/packing-list") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ nights?: number; climate?: string }>(event);
    try {
      const list = await packingListForUser(user.sub, {
        nights: Number(body.nights) || 3,
        climate: body.climate ?? "temperate",
      });
      return json(200, { list });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "wardrobe_failed" });
    }
  }

  if (method === "GET" && path === "/v1/mirror-studio/wardrobe/outfits") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { outfits: await listWardrobeOutfitsPublic(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/wardrobe/outfits") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ itemIds?: string[]; occasion?: string }>(event);
    try {
      const outfit = await createWardrobeOutfit(user.sub, {
        itemIds: body.itemIds ?? [],
        occasion: body.occasion,
      });
      return json(201, { outfit });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "wardrobe_failed" });
    }
  }

  if (method === "POST" && path === "/v1/mirror-studio/wardrobe/outfits/suggest") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ climate?: string }>(event);
    const sessionClimate =
      typeof body.climate === "string" && isWardrobeClimate(body.climate)
        ? body.climate
        : null;
    const market = profile?.market === "NG" || profile?.market === "GH" ? profile.market : "UK";
    try {
      const { suggestion, outfit } = await suggestOutfitForToday(user.sub, {
        climate: sessionClimate ?? climateFromMarket(market),
        climateSource: sessionClimate ? "session" : "market_default",
      });
      return json(200, { suggestion, outfit });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "wardrobe_failed" });
    }
  }

  if (method === "GET" && path === "/v1/mirror-studio/style-analytics") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { analytics: await getStyleAnalytics(user.sub) });
  }

  if (method === "GET" && path === "/v1/mirror-studio/accessories") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { looks: await listAccessoryLooksPublic(user.sub) });
  }

  const accKind = path.match(
    /^\/v1\/mirror-studio\/accessories\/(jewellery|eyewear|nail)$/,
  );
  if (accKind && method === "POST") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{
      catalogueItemId?: string;
      imageB64?: string;
      scanId?: string;
    }>(event);
    if (!body.catalogueItemId) return json(400, { error: "catalogue_item_invalid" });
    try {
      const look = await createAccessoryLook(user.sub, {
        kind: accKind[1] as "jewellery" | "eyewear" | "nail",
        catalogueItemId: body.catalogueItemId,
        imageB64: body.imageB64,
        scanId: body.scanId,
      });
      return json(202, { look });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("accessory tryon", err);
      return json(502, { error: "accessory_failed" });
    }
  }

  const accMedia = path.match(/^\/v1\/mirror-studio\/accessories\/([^/]+)\/media$/);
  if (accMedia && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const media = await getAccessoryLookMedia(user.sub, accMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  const accOne = path.match(/^\/v1\/mirror-studio\/accessories\/([^/]+)$/);
  if (accOne && method === "GET") {
    const blocked = await requireMirrorConsent(user.sub);
    if (blocked) return blocked;
    const look = await getAccessoryLookPublic(user.sub, accOne[1]!);
    if (!look) return json(404, { error: "accessory_not_found" });
    return json(200, { look });
  }

  if (method === "GET" && path === "/v1/mirror-studio/resale/listings") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    return json(200, { listings: await listMyResale(user.sub) });
  }

  if (method === "POST" && path === "/v1/mirror-studio/resale/listings") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ wardrobeItemId?: string; priceMinor?: number }>(event);
    if (!body.wardrobeItemId) return json(400, { error: "wardrobe_item_not_found" });
    try {
      const listing = await createResaleListing(user.sub, {
        wardrobeItemId: body.wardrobeItemId,
        priceMinor: body.priceMinor ?? 0,
      });
      return json(201, {
        listing,
        message:
          "Held for moderation before it appears on Marketplace. Labelled as from a GirlCode360 member.",
      });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "resale_failed" });
    }
  }

  const resaleMedia = path.match(
    /^\/v1\/mirror-studio\/resale\/listings\/([^/]+)\/media$/,
  );
  if (resaleMedia && method === "GET") {
    const mine = await getResaleForOwner(user.sub, resaleMedia[1]!);
    const live = mine ? null : await getLiveResale(resaleMedia[1]!);
    if (!mine && !live) return json(404, { error: "resale_not_found" });
    const media = await getResaleMedia(resaleMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  const resaleOne = path.match(/^\/v1\/mirror-studio\/resale\/listings\/([^/]+)$/);
  if (resaleOne && method === "GET") {
    const mine = await getResaleForOwner(user.sub, resaleOne[1]!);
    if (mine) return json(200, { listing: mine });
    const live = await getLiveResale(resaleOne[1]!);
    if (!live) return json(404, { error: "resale_not_found" });
    return json(200, { listing: live });
  }

  const wardrobeTryOn = path.match(
    /^\/v1\/mirror-studio\/wardrobe\/outfits\/([^/]+)\/tryon$/,
  );
  if (wardrobeTryOn && method === "POST") {
    const blockedW = await requireWardrobeConsent(user.sub);
    if (blockedW) return blockedW;
    const blockedM = await requireMirrorConsent(user.sub);
    if (blockedM) return blockedM;
    if (!(await youcamApiKey())) return json(503, { error: "youcam_unconfigured" });
    const body = parseBody<{ imageB64?: string }>(event);
    if (!body.imageB64) return json(400, { error: "image_required" });
    try {
      const outfit = await startWardrobeOutfitTryOn(
        user.sub,
        wardrobeTryOn[1]!,
        body.imageB64,
      );
      return json(202, { outfit });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      console.error("wardrobe tryon", err);
      return json(502, { error: "wardrobe_failed" });
    }
  }

  const wardrobeOutfitMedia = path.match(
    /^\/v1\/mirror-studio\/wardrobe\/outfits\/([^/]+)\/media$/,
  );
  if (wardrobeOutfitMedia && method === "GET") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const media = await getWardrobeOutfitMedia(user.sub, wardrobeOutfitMedia[1]!);
    if (!media) return json(404, { error: "media_not_found" });
    return json(200, {
      contentType: media.contentType,
      imageB64: media.bytes.toString("base64"),
    });
  }

  const wardrobeOutfitOne = path.match(
    /^\/v1\/mirror-studio\/wardrobe\/outfits\/([^/]+)$/,
  );
  if (wardrobeOutfitOne && method === "GET") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const outfit = await getWardrobeOutfitPublic(user.sub, wardrobeOutfitOne[1]!);
    if (!outfit) return json(404, { error: "wardrobe_outfit_not_found" });
    return json(200, { outfit });
  }
  if (wardrobeOutfitOne && method === "PATCH") {
    const blocked = await requireWardrobeConsent(user.sub);
    if (blocked) return blocked;
    const body = parseBody<{ wornOn?: string }>(event);
    if (!body.wornOn) return json(400, { error: "wardrobe_date_invalid" });
    try {
      const outfit = await markOutfitWorn(
        user.sub,
        wardrobeOutfitOne[1]!,
        body.wornOn,
      );
      if (!outfit) return json(404, { error: "wardrobe_outfit_not_found" });
      return json(200, { outfit });
    } catch (err) {
      const mapped = mapYoucamErr(err);
      if (mapped) return mapped;
      return json(502, { error: "wardrobe_failed" });
    }
  }

  /* ——— Phase 6: Alena + HealthLens ——— */

  // Legacy /v1/zara/* aliases (pre-rename)
  const alenaPath =
    path.startsWith("/v1/zara/")
      ? path.replace("/v1/zara/", "/v1/alena/")
      : path;

  if (method === "GET" && alenaPath === "/v1/alena/quota") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { quota: await getAlenaQuota(user.sub) });
  }

  if (method === "POST" && alenaPath === "/v1/alena/chat") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{
      message?: string;
      mode?: "context" | "anonymous";
      openedFrom?: string;
      moduleHint?: string;
      lat?: number;
      lng?: number;
      climate?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    }>(event);
    if (!body.message?.trim()) return json(400, { error: "message_required" });
    const mode = body.mode === "anonymous" ? "anonymous" : "context";
    {
      const consents = await latestConsentsByPurpose(user.sub);
      const alena = consents.find(
        (c) => c.purpose === "ai_alena" || (c.purpose as string) === "ai_zara",
      );
      if (!alena?.granted) {
        return json(403, { error: "alena_consent_required" });
      }
    }
    const result = await alenaChat(user.sub, body.message.trim(), mode, {
      openedFrom: body.openedFrom,
      moduleHint: body.moduleHint,
      history: Array.isArray(body.history) ? body.history : undefined,
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
      climate:
        typeof body.climate === "string" && isWardrobeClimate(body.climate)
          ? body.climate
          : undefined,
    });
    if (result.error === "quota_exceeded") {
      return json(429, { error: "quota_exceeded", quota: result.quota });
    }
    if (result.error === "alena_busy") {
      return json(503, { error: "alena_busy" });
    }
    return json(200, {
      reply: result.reply,
      crisis: result.crisis,
      stub: result.stub,
      quota: result.quota,
      disclaimer: ALENA_DISCLAIMER,
      actions: result.crisis
        ? [{ id: "emergency", label: "Use emergency numbers" }]
        : [{ id: "prep_card", label: "Generate appointment Prep Card" }],
    });
  }

  if (method === "GET" && alenaPath === "/v1/alena/context-preview") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const consents = await latestConsentsByPurpose(user.sub);
    const alena = consents.find(
      (c) => c.purpose === "ai_alena" || (c.purpose as string) === "ai_zara",
    );
    if (!alena?.granted) {
      return json(403, { error: "alena_consent_required" });
    }
    return json(200, { context: await assembleAlenaContext(user.sub) });
  }

  if (method === "GET" && path === "/v1/healthlens/status") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const consents = await latestConsentsByPurpose(user.sub);
    const hl = consents.find((c) => c.purpose === "ai_healthlens");
    if (hl?.granted) {
      try {
        await maybeMonthlyHealthLensReport(user.sub);
      } catch (err) {
        console.error("monthly healthlens", err);
      }
    }
    return json(200, await getHealthLensStatus(user.sub));
  }

  if (method === "POST" && path === "/v1/healthlens/population-consent") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const consents = await latestConsentsByPurpose(user.sub);
    const hl = consents.find((c) => c.purpose === "ai_healthlens");
    if (!hl?.granted) return json(403, { error: "healthlens_consent_required" });
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
    const consents = await latestConsentsByPurpose(user.sub);
    const hl = consents.find((c) => c.purpose === "ai_healthlens");
    if (!hl?.granted) return json(403, { error: "healthlens_consent_required" });
    const report = await latestHealthLensReport(user.sub);
    if (!report) return json(404, { error: "no_report" });
    return json(200, { report });
  }

  if (method === "POST" && path === "/v1/healthlens/prep-card") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const consents = await latestConsentsByPurpose(user.sub);
    const hl = consents.find((c) => c.purpose === "ai_healthlens");
    if (!hl?.granted) return json(403, { error: "healthlens_consent_required" });
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
    const session = await createCheckoutSession(user.sub, provider, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      email: profile.email,
      market: profile.market,
    });
    if ("error" in session && session.error) {
      return json(502, { error: session.error, message: session.message });
    }
    return json(200, session);
  }

  if (method === "POST" && path === "/v1/billing/portal") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{ returnUrl?: string }>(event);
    return json(200, await createPortalSession(user.sub, body.returnUrl));
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

  if (method === "POST" && path === "/v1/content/reports") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<{
      targetType?: string;
      targetId?: string;
      reason?: string;
      details?: string;
    }>(event);
    if (
      !body.targetType ||
      !isReportTarget(body.targetType) ||
      !body.targetId ||
      !body.reason ||
      !isReportReason(body.reason)
    ) {
      return json(400, { error: "target_and_reason_required" });
    }
    const created = await createContentReport({
      reporterSub: user.sub,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: body.details,
    });
    if (!created.ok) return json(400, { error: created.error });
    return json(201, { report: created.report });
  }

  if (method === "GET" && path === "/v1/content/reports/mine") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { reports: await listMyReports(user.sub) });
  }

  /* ——— Phase 1.7 marketplace / SheMatch / notifications ——— */

  if (method === "GET" && path === "/v1/notifications/vapid") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    return json(200, { publicKey: await vapidPublicKey() });
  }

  if (method === "POST" && path === "/v1/notifications/push-subscription") {
    if (!profile) return json(404, { error: "user_not_bootstrapped" });
    const body = parseBody<PushSubscriptionRequest>(event);
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return json(400, { error: "subscription_required" });
    }
    const saved = await savePushSubscription(user.sub, body);
    return json(201, { subscription: saved, pushPayload: { body: GENERIC_PUSH_BODY } });
  }

  if (!profile && (path.startsWith("/v1/marketplace") || path.startsWith("/v1/shematch"))) {
    return json(404, { error: "user_not_bootstrapped" });
  }

  if (method === "GET" && path === "/v1/marketplace/listings") {
    const q = event.queryStringParameters ?? {};
    const lat = q.lat != null ? Number(q.lat) : NaN;
    const lng = q.lng != null ? Number(q.lng) : NaN;
    const origin =
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    const radius = q.radiusKm != null ? Number(q.radiusKm) : undefined;
    const listings = await listMarketplace({
      origin,
      category: (q.category as MarketplaceCategory | undefined) || undefined,
      radiusKm: Number.isFinite(radius) ? radius : undefined,
      minRating: q.minRating != null ? Number(q.minRating) : undefined,
      openNow: q.openNow === "1" || q.openNow === "true",
      q: q.q,
      weekday: q.weekday != null ? Number(q.weekday) : new Date().getUTCDay(),
      hhmm: q.hhmm || "12:00",
      market: profile?.market,
      viewerSub: user.sub,
    });
    return json(200, {
      listings,
      resale: await listLiveResalePublic(profile?.market),
      note: "Seeded public directory plus listings that passed moderation. Member resale is labelled from a GirlCode360 member. Confirm before you travel. Not a prescription. Paid placements are labelled Sponsored.",
    });
  }

  if (method === "GET" && path === "/v1/marketplace/favourites") {
    const ids = await listFavouriteIds(user.sub);
    return json(200, { listingIds: ids });
  }

  const listingReviewMatch = path.match(
    /^\/v1\/marketplace\/listings\/([^/]+)\/reviews$/,
  );
  if (listingReviewMatch && method === "GET") {
    return json(200, {
      reviews: await listListingReviews(listingReviewMatch[1]!, user.sub),
    });
  }
  if (listingReviewMatch && method === "POST") {
    const body = parseBody<CreateListingReviewRequest>(event);
    const review = await createListingReview(
      user.sub,
      listingReviewMatch[1]!,
      body,
    );
    if ("error" in review) return json(400, { error: review.error });
    return json(201, {
      review,
      message: "Held for moderation before it appears on the listing.",
    });
  }

  const favMatch = path.match(/^\/v1\/marketplace\/listings\/([^/]+)\/favourite$/);
  if (favMatch && method === "PUT") {
    if (!(await addFavourite(user.sub, favMatch[1]!))) {
      return json(404, { error: "listing_not_found" });
    }
    return json(200, { ok: true });
  }
  if (favMatch && method === "DELETE") {
    await removeFavourite(user.sub, favMatch[1]!);
    return json(200, { ok: true });
  }

  const sponsorMatch = path.match(
    /^\/v1\/marketplace\/listings\/([^/]+)\/sponsor$/,
  );
  if (sponsorMatch && method === "POST") {
    const mine = await listMyListings(user.sub);
    if (!mine.some((l) => l.id === sponsorMatch[1])) {
      return json(403, { error: "not_listing_owner" });
    }
    const checkout = await createCheckoutSession(user.sub, "paystack");
    return json(200, {
      ...checkout,
      listingId: sponsorMatch[1],
      message:
        "Sponsored placement checkout is a stub until live Paystack/Stripe keys. POST /v1/billing/webhooks/paystack with listingId to mark Sponsored in this environment.",
    });
  }

  const listingMatch = path.match(/^\/v1\/marketplace\/listings\/([^/]+)$/);
  if (listingMatch && method === "GET") {
    const q = event.queryStringParameters ?? {};
    const lat = q.lat != null ? Number(q.lat) : NaN;
    const lng = q.lng != null ? Number(q.lng) : NaN;
    const origin =
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    const listing = await getMarketplaceListing(
      listingMatch[1]!,
      origin,
      q.weekday != null ? Number(q.weekday) : new Date().getUTCDay(),
      q.hhmm || "12:00",
      user.sub,
    );
    if (!listing || listing.status !== "live") {
      const resale = await getLiveResale(listingMatch[1]!);
      if (!resale) return json(404, { error: "listing_not_found" });
      return json(200, { listing: null, resale });
    }
    return json(200, { listing });
  }

  if (method === "POST" && path === "/v1/marketplace/business") {
    const body = parseBody<CreateBusinessListingRequest>(event);
    if (!body.name?.trim() || !body.address?.trim() || !body.phone?.trim()) {
      return json(400, { error: "name_address_phone_required" });
    }
    if (!body.category || !body.market) {
      return json(400, { error: "category_and_market_required" });
    }
    if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
      return json(400, { error: "coordinates_required" });
    }
    if (
      (body.category === "pharmacy" || body.category === "clinic") &&
      !body.registrationNumber?.trim()
    ) {
      return json(400, { error: "registration_number_required" });
    }
    const listing = await submitBusinessListing(user.sub, body);
    return json(201, {
      listing,
      message: "Submitted for moderation. Health listings need a registration number. Aim is review within 48 hours.",
    });
  }

  if (method === "GET" && path === "/v1/marketplace/mine") {
    return json(200, { listings: await listMyListings(user.sub) });
  }

  const minePatch = path.match(/^\/v1\/marketplace\/mine\/([^/]+)$/);
  if (minePatch && method === "PATCH") {
    const body = parseBody<PatchOwnedListingRequest>(event);
    const listing = await patchOwnedListing(user.sub, minePatch[1]!, body);
    if (listing && "error" in listing) return json(400, { error: listing.error });
    if (!listing) return json(404, { error: "listing_not_found" });
    return json(200, { listing });
  }

  if (method === "GET" && path === "/v1/shematch/prefs") {
    return json(200, await getSheMatchPrefs(user.sub));
  }

  if (method === "PATCH" && path === "/v1/shematch/prefs") {
    const body = parseBody<{ modules?: Partial<Record<string, boolean>> }>(event);
    const modules = await patchSheMatchPrefs(
      user.sub,
      (body.modules ?? {}) as Partial<Record<import("../types").HealthModule, boolean>>,
    );
    return json(200, { ...(await getSheMatchPrefs(user.sub)), modules });
  }

  if (method === "GET" && path === "/v1/shematch/suggest") {
    const q = event.queryStringParameters ?? {};
    const triggerId = q.trigger as SheMatchTriggerId | undefined;
    if (!triggerId || !sheMatchTrigger(triggerId)) {
      return json(400, { error: "trigger_required" });
    }
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json(200, { suggestions: [] });
    }
    const extraTags = q.tags ? q.tags.split(",").filter(Boolean) : undefined;
    const listings = await suggestSheMatch({
      sub: user.sub,
      triggerId,
      origin: { lat, lng },
      extraTags,
      weekday: q.weekday != null ? Number(q.weekday) : new Date().getUTCDay(),
      hhmm: q.hhmm || "12:00",
    });
    const trigger = sheMatchTrigger(triggerId)!;
    return json(200, {
      suggestions: listings.map((listing) => ({
        listing,
        triggerId,
        why: trigger.why,
        label: "Suggested based on your health activity" as const,
        sponsoredLabel: listing.sponsored ? ("Sponsored" as const) : null,
      })),
    });
  }

  /* ——— Phase 2.3 community + in-app marketing inbox ——— */

  if (!profile && (path.startsWith("/v1/community") || path.startsWith("/v1/in-app"))) {
    return json(404, { error: "user_not_bootstrapped" });
  }

  if (method === "GET" && path === "/v1/in-app") {
    const consents = await latestConsentsByPurpose(user.sub);
    const marketing =
      consents.find((c) => c.purpose === "marketing")?.granted === true;
    const items = await listInbox(user.sub);
    return json(200, {
      items,
      unread: await inboxUnreadCount(user.sub),
      marketingOptIn: marketing,
      note: marketing
        ? "Listing and partner notices stay in-app. They are never sent as lock-screen push."
        : "Marketing inbox is empty unless you opt in under Account. Health reminders stay on the Notifications toggles.",
    });
  }

  if (method === "POST" && path === "/v1/in-app/read-all") {
    await markInboxAllRead(user.sub);
    return json(200, { ok: true, unread: 0 });
  }

  const inAppRead = path.match(/^\/v1\/in-app\/([^/]+)\/read$/);
  if (inAppRead && method === "POST") {
    const item = await markInboxRead(user.sub, inAppRead[1]!);
    if (!item) return json(404, { error: "not_found" });
    return json(200, { item });
  }

  if (method === "GET" && path === "/v1/community/groups") {
    return json(200, {
      groups: await listGroups(user.sub),
      note: "Opt-in peer groups. Text only. Anonymised names. Leave any time. Not a diagnosis space.",
    });
  }

  const communityJoin = path.match(/^\/v1\/community\/groups\/([^/]+)\/join$/);
  if (communityJoin && method === "POST") {
    const group = await joinGroup(user.sub, communityJoin[1]!);
    if ("error" in group) return json(400, { error: group.error });
    return json(200, { group });
  }

  const communityLeave = path.match(
    /^\/v1\/community\/groups\/([^/]+)\/membership$/,
  );
  if (communityLeave && method === "DELETE") {
    const left = await leaveGroup(user.sub, communityLeave[1]!);
    if ("error" in left) return json(400, { error: left.error });
    return json(200, { ok: true });
  }

  const communityPosts = path.match(/^\/v1\/community\/groups\/([^/]+)\/posts$/);
  if (communityPosts && method === "GET") {
    const posts = await listPosts(user.sub, communityPosts[1]!);
    if ("error" in posts) {
      const status = posts.error === "not_a_member" ? 403 : 400;
      return json(status, { error: posts.error });
    }
    return json(200, { posts });
  }
  if (communityPosts && method === "POST") {
    const body = parseBody<{ body?: string }>(event);
    const post = await createPost(
      user.sub,
      communityPosts[1]!,
      body.body ?? "",
    );
    if ("error" in post) return json(400, { error: post.error });
    return json(201, {
      post,
      message: "Held for moderation. No photos or links.",
    });
  }

  return json(404, { error: "not_found", path, method });
};
