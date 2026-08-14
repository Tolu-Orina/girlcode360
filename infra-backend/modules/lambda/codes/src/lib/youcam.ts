import { createHmac, timingSafeEqual } from "node:crypto";
import { youcamApiKey, youcamWebhookSecret } from "./secrets";

const BASE =
  process.env.YOUCAM_API_SERVER?.trim() || "https://yce-api-01.makeupar.com";

const SKIN_ACTIONS = [
  "wrinkle",
  "pore",
  "texture",
  "acne",
  "oiliness",
  "redness",
  "radiance",
  "dark_circle",
  "eye_bag",
  "droopy_eyelid",
  "age_spot",
  "tear_trough",
  "firmness",
  "moisture",
  "skin_type",
] as const;

let consecutiveFailures = 0;
const recentCalls: number[] = [];

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

export function youcamCircuitOpen(): boolean {
  return consecutiveFailures >= 5;
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
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers ?? {}) },
  });
  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (res.status === 429) {
    consecutiveFailures += 1;
    throw new Error("YOUCAM_RATE_LIMIT");
  }
  if (!res.ok) {
    consecutiveFailures += 1;
    const err = new Error(`YOUCAM_HTTP_${res.status}`);
    (err as Error & { body?: unknown }).body = json;
    throw err;
  }
  consecutiveFailures = 0;
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

export async function uploadYoucamFile(
  kind: "skin-analysis" | "cloth-v3",
  bytes: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> {
  const { json } = await youcamFetch(`/s2s/v2.0/file/${kind}`, {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
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
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...extraHeaders },
    body: new Uint8Array(bytes),
  });
  if (!put.ok) throw new Error(`YOUCAM_PUT_${put.status}`);
  return fileId;
}

export async function startSkinAnalysis(srcFileId: string): Promise<string> {
  const { json } = await youcamFetch("/s2s/v2.0/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      src_file_id: srcFileId,
      dst_actions: [...SKIN_ACTIONS],
      miniserver_args: { enable_mask_overlay: true },
      format: "json",
    }),
  });
  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  const taskId = String(data?.task_id ?? "");
  if (!taskId) throw new Error("YOUCAM_NO_TASK");
  return taskId;
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
  const body: Record<string, string> = {
    src_file_id: opts.srcFileId,
    garment_category: opts.garmentCategory,
  };
  if (opts.refFileId) body.ref_file_id = opts.refFileId;
  if (opts.refFileUrl) body.ref_file_url = opts.refFileUrl;
  if (opts.prompt) body.prompt = opts.prompt;
  const { json } = await youcamFetch("/s2s/v2.0/task/cloth-v3", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  const taskId = String(data?.task_id ?? "");
  if (!taskId) throw new Error("YOUCAM_NO_TASK");
  return taskId;
}

export type YoucamTaskState = {
  status: "running" | "success" | "error";
  scores: Record<string, number>;
  skinType?: string;
  overall?: number;
  resultUrl?: string;
  maskUrls: Record<string, string>;
  error?: string;
};

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

export async function pollTask(
  capability: "skin-analysis" | "cloth-v3",
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
  const rawStatus = String(
    data.task_status ?? data.status ?? root.task_status ?? "running",
  ).toLowerCase();
  const status: YoucamTaskState["status"] =
    rawStatus.includes("success") || rawStatus === "ok"
      ? "success"
      : rawStatus.includes("error") || rawStatus.includes("fail")
        ? "error"
        : "running";

  const scores: Record<string, number> = {};
  collectScores(data, scores);
  const maskUrls: Record<string, string> = {};
  collectUrls(data, maskUrls);
  const resultUrl =
    maskUrls.result ||
    maskUrls.url ||
    maskUrls.download_url ||
    maskUrls.output_url ||
    (typeof data.url === "string" ? data.url : undefined);

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
  };
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YOUCAM_RESULT_GET_${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export { SKIN_ACTIONS };

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
