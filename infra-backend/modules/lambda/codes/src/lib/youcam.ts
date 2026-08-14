import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildMakeupVtoEffects,
  type StudioMakeupCategory,
} from "../../../../../../packages/domain/src/index.ts";
import { youcamApiKey, youcamWebhookSecret } from "./secrets.ts";

const BASE =
  process.env.YOUCAM_API_SERVER?.trim() || "https://yce-api-01.makeupar.com";

/** Official SD-only dst_actions. HD names (or invented aliases) 400 the task. */
const SKIN_ACTIONS = [
  "wrinkle",
  "droopy_upper_eyelid",
  "droopy_lower_eyelid",
  "firmness",
  "acne",
  "moisture",
  "eye_bag",
  "dark_circle_v2",
  "age_spot",
  "radiance",
  "redness",
  "oiliness",
  "pore",
  "texture",
  "tear_trough",
  "skin_type",
] as const;

export const MAKEUP_CATEGORIES = [
  "lip",
  "eyeshadow",
  "blush",
  "foundation",
  "eyebrow",
  "eyeliner",
  "eyelash",
] as const;

export const ACCESSORY_CATEGORIES = [
  "ring",
  "bracelet",
  "watch",
  "earring",
  "necklace",
] as const;

export type YoucamCapability =
  | "skin-analysis"
  | "cloth-v3"
  | "makeup-vto"
  | "mu-transfer"
  | "shade-finder"
  | "hair-analysis"
  | "hair-length-detection"
  | "hair-tryon"
  | "nail-vto"
  | "2d-vto/ring"
  | "2d-vto/bracelet"
  | "2d-vto/watch"
  | "2d-vto/earring"
  | "2d-vto/necklace";

export type MakeupCategory = (typeof MAKEUP_CATEGORIES)[number];
export type AccessoryCategory = (typeof ACCESSORY_CATEGORIES)[number];

let consecutiveFailures = 0;
let circuitOpenedAt = 0;
const recentCalls: number[] = [];
const CIRCUIT_TTL_MS = 60_000;

function paceOk(): boolean {
  const now = Date.now();
  while (recentCalls.length && now - recentCalls[0]! > 300_000) {
    recentCalls.shift();
  }
  return recentCalls.length < 240;
}

function noteCall(): void {
  recentCalls.push(Date.now());
}

function noteUpstreamFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 5) circuitOpenedAt = Date.now();
}

export function youcamCircuitOpen(): boolean {
  if (consecutiveFailures < 5) return false;
  if (Date.now() - circuitOpenedAt >= CIRCUIT_TTL_MS) {
    consecutiveFailures = 0;
    circuitOpenedAt = 0;
    return false;
  }
  return true;
}

async function authHeaders(): Promise<Record<string, string>> {
  const key = await youcamApiKey();
  if (!key) throw new Error("YOUCAM_UNCONFIGURED");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function youcamFetch(
  path: string,
  init: RequestInit,
): Promise<{ status: number; json: unknown }> {
  if (youcamCircuitOpen()) throw new Error("YOUCAM_UNAVAILABLE");
  if (!paceOk()) throw new Error("YOUCAM_RATE_LIMIT");
  noteCall();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(await authHeaders()), ...(init.headers ?? {}) },
    });
  } catch (err) {
    noteUpstreamFailure();
    console.error("youcam network", path, err);
    throw new Error("YOUCAM_NETWORK");
  }
  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (res.status === 429) {
    noteUpstreamFailure();
    throw new Error("YOUCAM_RATE_LIMIT");
  }
  if (res.status >= 500) {
    noteUpstreamFailure();
    console.error("youcam http", res.status, path, json);
    const err = new Error(`YOUCAM_HTTP_${res.status}`);
    (err as Error & { body?: unknown }).body = json;
    throw err;
  }
  if (!res.ok) {
    console.error("youcam http", res.status, path, json);
    const err = new Error(`YOUCAM_HTTP_${res.status}`);
    (err as Error & { body?: unknown }).body = json;
    throw err;
  }
  consecutiveFailures = 0;
  circuitOpenedAt = 0;
  return { status: res.status, json };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function firstFile(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json);
  const data = asRecord(root?.data) ?? root;
  const files = data?.files;
  if (Array.isArray(files) && files[0]) return asRecord(files[0]);
  return asRecord(data);
}

function youcamContentType(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpg";
  if (t === "image/png") return "image/png";
  return contentType;
}

export async function uploadYoucamFile(
  kind: YoucamCapability,
  bytes: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> {
  const mime = youcamContentType(contentType);
  const { json } = await youcamFetch(`/s2s/v2.0/file/${kind}`, {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          content_type: mime,
          file_name: fileName,
          file_size: bytes.length,
        },
      ],
    }),
  });
  const file = firstFile(json);
  const fileId = String(file?.file_id ?? "");
  const requests = file?.requests;
  let uploadUrl = "";
  let extraHeaders: Record<string, string> = {};
  if (Array.isArray(requests) && requests[0]) {
    const r = asRecord(requests[0]);
    uploadUrl = String(r?.url ?? "");
    const h = asRecord(r?.headers);
    if (h) {
      extraHeaders = Object.fromEntries(
        Object.entries(h).filter(([, v]) => typeof v === "string") as [
          string,
          string,
        ][],
      );
    }
  } else if (asRecord(requests)?.url) {
    uploadUrl = String(asRecord(requests)!.url);
  }
  if (!fileId || !uploadUrl) {
    throw new Error("YOUCAM_UPLOAD_INIT_FAILED");
  }
  const putHeaders: Record<string, string> = { "Content-Type": mime };
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (/^content-length$/i.test(k)) continue;
    putHeaders[k] = v;
  }
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: putHeaders,
    body: new Uint8Array(bytes),
  });
  if (!put.ok) throw new Error(`YOUCAM_PUT_${put.status}`);
  await new Promise((r) => setTimeout(r, 800));
  return fileId;
}

function taskIdFromJson(json: unknown): string {
  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  const taskId = String(data?.task_id ?? "");
  if (!taskId) throw new Error("YOUCAM_NO_TASK");
  return taskId;
}

export async function submitTask(
  capability: YoucamCapability,
  body: Record<string, unknown>,
): Promise<string> {
  const { json } = await youcamFetch(`/s2s/v2.0/task/${capability}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return taskIdFromJson(json);
}

export async function startSkinAnalysis(srcFileId: string): Promise<string> {
  return submitTask("skin-analysis", {
    src_file_id: srcFileId,
    dst_actions: [...SKIN_ACTIONS],
    miniserver_args: { enable_mask_overlay: true },
    format: "json",
  });
}

const VENDOR_SEP = "::yc::";

export function packYoucamIds(taskId: string, fileId: string): string {
  return `${taskId}${VENDOR_SEP}${fileId}`;
}

export function unpackYoucamIds(packed: string): {
  taskId: string;
  fileId: string | null;
} {
  const i = packed.indexOf(VENDOR_SEP);
  if (i < 0) return { taskId: packed, fileId: null };
  return {
    taskId: packed.slice(0, i),
    fileId: packed.slice(i + VENDOR_SEP.length) || null,
  };
}

/** Best-effort processor deletion (MIR-F-07). Never throws. */
export async function requestYoucamFileDeletion(fileId: string): Promise<void> {
  if (!fileId || fileId === "seed") return;
  try {
    await youcamFetch(`/s2s/v2.0/file/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("youcam file deletion request failed", fileId, err);
  }
}

export async function startClothTryOn(opts: {
  srcFileId: string;
  refFileId?: string;
  refFileUrl?: string;
  garmentCategory: string;
  prompt?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    src_file_id: opts.srcFileId,
    garment_category: opts.garmentCategory,
  };
  if (opts.refFileId) body.ref_file_id = opts.refFileId;
  if (opts.refFileUrl) body.ref_file_url = opts.refFileUrl;
  if (opts.prompt) body.prompt = opts.prompt;
  return submitTask("cloth-v3", body);
}

function makeupEffectsFor(
  categories?: StudioMakeupCategory[],
  palettes?: Partial<Record<StudioMakeupCategory, string>>,
): Record<string, unknown>[] {
  return buildMakeupVtoEffects(categories, palettes);
}

/** Photo / live still try-on — Perfect Corp AI Makeup VTO. */
export async function startMakeupVto(opts: {
  srcFileId: string;
  makeupCategories?: StudioMakeupCategory[];
  palettes?: Partial<Record<StudioMakeupCategory, string>>;
}): Promise<string> {
  return submitTask("makeup-vto", {
    src_file_id: opts.srcFileId,
    version: "1.0",
    effects: makeupEffectsFor(opts.makeupCategories, opts.palettes),
  });
}

/** Copy a look from a reference selfie — requires both file IDs. */
export async function startMakeupTransfer(opts: {
  srcFileId: string;
  referenceFileId: string;
}): Promise<string> {
  if (!opts.referenceFileId) throw new Error("YOUCAM_REF_REQUIRED");
  return submitTask("mu-transfer", {
    src_file_id: opts.srcFileId,
    ref_file_id: opts.referenceFileId,
  });
}

export async function startShadeFinder(opts: {
  srcFileId: string;
  brandFilter?: string[];
}): Promise<string> {
  const body: Record<string, unknown> = {
    src_file_id: opts.srcFileId,
    dst_actions: ["shade_match", "fitzpatrick_type"],
  };
  if (opts.brandFilter?.length) body.brand_filter = opts.brandFilter;
  return submitTask("shade-finder", body);
}

export async function startHairAnalysis(srcFileId: string): Promise<string> {
  return submitTask("hair-length-detection", {
    src_file_id: srcFileId,
  });
}

export async function startHairTryOn(opts: {
  srcFileId: string;
  hairColor: string;
  hairstyleId?: string;
}): Promise<string> {
  const color = opts.hairColor.trim();
  if (!color) throw new Error("YOUCAM_HAIR_COLOR_REQUIRED");
  const body: Record<string, unknown> = {
    src_file_id: opts.srcFileId,
    hair_color: color,
  };
  if (opts.hairstyleId) body.hairstyle_id = opts.hairstyleId;
  return submitTask("hair-tryon", body);
}

export async function startNailTryOn(opts: {
  srcFileId: string;
  nailColor: string;
}): Promise<string> {
  const nailColor = opts.nailColor.trim();
  if (!nailColor) throw new Error("YOUCAM_NAIL_COLOR_REQUIRED");
  return submitTask("nail-vto", {
    src_file_id: opts.srcFileId,
    nail_color: nailColor,
  });
}

export async function startAccessoryTryOn(opts: {
  srcFileId: string;
  accessoryCategory: AccessoryCategory;
  refFileUrl: string;
}): Promise<string> {
  const refFileUrl = opts.refFileUrl.trim();
  if (!refFileUrl) throw new Error("YOUCAM_3D_ASSET_REQUIRED");
  if (!ACCESSORY_CATEGORIES.includes(opts.accessoryCategory)) {
    throw new Error("YOUCAM_ACCESSORY_CATEGORY_INVALID");
  }
  const cap = `2d-vto/${opts.accessoryCategory}` as YoucamCapability;
  return submitTask(cap, {
    src_file_id: opts.srcFileId,
    ref_file_urls: [refFileUrl],
    source_info: { name: opts.srcFileId },
    object_infos: [
      {
        name: refFileUrl,
        parameter: {
          [`${opts.accessoryCategory}_need_remove_background`]: true,
        },
      },
    ],
  });
}

export async function startEyewearTryOn(_opts: {
  srcFileId: string;
  frameId: string;
}): Promise<string> {
  throw new Error("YOUCAM_EYEWEAR_UNAVAILABLE");
}

export type YoucamTaskState = {
  status: "running" | "success" | "error";
  scores: Record<string, number>;
  skinType?: string;
  overall?: number;
  resultUrl?: string;
  maskUrls: Record<string, string>;
  error?: string;
  data: Record<string, unknown>;
};

function firstHttpsUrl(node: unknown, depth = 0): string | undefined {
  if (depth > 8 || node == null) return undefined;
  if (typeof node === "string" && /^https:\/\//i.test(node)) return node;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstHttpsUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const rec = asRecord(node);
  if (!rec) return undefined;
  if (typeof rec.url === "string" && /^https:\/\//i.test(rec.url)) return rec.url;
  if (typeof rec.download_url === "string" && /^https:\/\//i.test(rec.download_url)) {
    return rec.download_url;
  }
  for (const v of Object.values(rec)) {
    const found = firstHttpsUrl(v, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function collectUrls(node: unknown, into: Record<string, string>, prefix = ""): void {
  if (!node) return;
  if (typeof node === "string" && /^https?:\/\//.test(node)) {
    if (prefix) into[prefix] = node;
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectUrls(n, into, prefix ? `${prefix}_${i}` : String(i)));
    return;
  }
  const rec = asRecord(node);
  if (!rec) return;
  for (const [k, v] of Object.entries(rec)) {
    collectUrls(v, into, k);
  }
}

function collectScores(node: unknown, into: Record<string, number>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectScores(n, into));
    return;
  }
  const rec = asRecord(node);
  if (!rec) return;
  const name = String(rec.name ?? rec.action ?? rec.concern ?? rec.key ?? "");
  const score = rec.score ?? rec.value ?? rec.severity;
  if (name && typeof score === "number") into[name] = score;
  for (const key of SKIN_ACTIONS) {
    const v = rec[key];
    if (typeof v === "number") into[key] = v;
    const nested = asRecord(v);
    if (nested && typeof nested.score === "number") into[key] = nested.score;
  }
  for (const v of Object.values(rec)) collectScores(v, into);
}

function aliasSkinScores(scores: Record<string, number>): void {
  if (scores.dark_circle == null && typeof scores.dark_circle_v2 === "number") {
    scores.dark_circle = scores.dark_circle_v2;
  }
  if (scores.droopy_eyelid == null) {
    const upper = scores.droopy_upper_eyelid;
    const lower = scores.droopy_lower_eyelid;
    if (typeof upper === "number" && typeof lower === "number") {
      scores.droopy_eyelid = Math.round((upper + lower) / 2);
    } else if (typeof upper === "number") {
      scores.droopy_eyelid = upper;
    } else if (typeof lower === "number") {
      scores.droopy_eyelid = lower;
    }
  }
}

export async function pollTask(
  capability: YoucamCapability,
  packedTaskId: string,
): Promise<YoucamTaskState> {
  const taskId = unpackYoucamIds(packedTaskId).taskId;
  const encoded = encodeURIComponent(taskId);
  const { json } = await youcamFetch(
    `/s2s/v2.0/task/${capability}/${encoded}`,
    { method: "GET" },
  );
  const root = asRecord(json) ?? {};
  const data = asRecord(root.data) ?? root;
  const rawStatus = String(data.task_status ?? "running").toLowerCase();
  const status: YoucamTaskState["status"] =
    rawStatus === "success" || rawStatus === "ok"
      ? "success"
      : rawStatus === "error" || rawStatus === "failed" || rawStatus === "fail"
        ? "error"
        : "running";

  const scores: Record<string, number> = {};
  collectScores(data, scores);
  aliasSkinScores(scores);
  const maskUrls: Record<string, string> = {};
  collectUrls(data, maskUrls);
  const resultList = Array.isArray(data.results) ? data.results : [];
  const firstResult = asRecord(resultList[0]);
  const resultsObj = asRecord(data.results);
  const resultUrl =
    (typeof resultsObj?.url === "string" ? resultsObj.url : undefined) ||
    (typeof firstResult?.download_url === "string"
      ? firstResult.download_url
      : undefined) ||
    maskUrls.result ||
    maskUrls.url ||
    maskUrls.download_url ||
    maskUrls.output_url ||
    (typeof data.url === "string" ? data.url : undefined) ||
    firstHttpsUrl(data.results) ||
    firstHttpsUrl(data);

  const numeric = Object.entries(scores).filter(([k]) => k !== "skin_type");
  const overall =
    typeof data.overall_score === "number"
      ? data.overall_score
      : numeric.length
        ? Math.round(numeric.reduce((s, [, n]) => s + n, 0) / numeric.length)
        : undefined;

  return {
    status,
    scores,
    skinType: typeof data.skin_type === "string" ? data.skin_type : undefined,
    overall,
    resultUrl,
    maskUrls,
    error: status === "error" ? String(data.error ?? data.message ?? "task_error") : undefined,
    data,
  };
}

/** Stay inside API Gateway's 29s. Frontend GET still polls if we return pending. */
const SETTLE_POLL_ATTEMPTS = 7;
const SETTLE_POLL_MS = 2_000;

export async function pollUntilSettled(
  capability: YoucamCapability,
  packedTaskId: string,
): Promise<YoucamTaskState> {
  let last = await pollTask(capability, packedTaskId);
  for (let i = 0; i < SETTLE_POLL_ATTEMPTS && last.status === "running"; i += 1) {
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    last = await pollTask(capability, packedTaskId);
  }
  return last;
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YOUCAM_RESULT_GET_${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export { SKIN_ACTIONS };

/** Test-only: pace + circuit are module-scoped. */
export function resetYoucamForTests(): void {
  consecutiveFailures = 0;
  circuitOpenedAt = 0;
  recentCalls.length = 0;
}

export async function verifyYoucamWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  const secret = await youcamWebhookSecret();
  if (!secret) return false;
  const given = (signatureHeader ?? "").trim();
  if (!given) return false;
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const prefixed = given.startsWith("sha256=") ? given.slice(7) : given;
  const a = Buffer.from(prefixed, "hex");
  const b = Buffer.from(hex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractYoucamTaskId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  const data =
    rec.data && typeof rec.data === "object"
      ? (rec.data as Record<string, unknown>)
      : rec;
  const id = data.task_id ?? data.taskId ?? rec.task_id ?? rec.taskId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
