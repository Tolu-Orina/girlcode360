import {
  buildMakeupVtoEffects,
  MAKEUP_TRYON_SHADES,
  parseMakeupCategories,
  parseMakeupPalettes,
  detectCrisis,
  crisisMessage,
  parseHairAnalysisPayload,
  accessoryTryOnReady,
  youcamClientFailCopy,
} from "../../../packages/domain/src/index.ts";
import { CURRENT_POLICY_VERSION } from "../../../packages/api-types/src/index.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const POLICY = CURRENT_POLICY_VERSION;

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

type ScanRow = {
  id: string;
  status: "pending" | "success" | "error";
  createdAt: string;
  overallScore: number | null;
  scores: Record<string, number>;
  hasResultImage: boolean;
  hasMask: boolean;
  youcamTaskId: string;
  resultB64: string | null;
  maskB64: string | null;
  failReason: string | null;
  srcB64: string | null;
};

type MediaJob = {
  id: string;
  status: "pending" | "success" | "error";
  createdAt: string;
  cap: string;
  youcamTaskId: string;
  resultB64: string | null;
  sourceKind?: "live" | "photo" | "transfer";
  categories?: string[];
  saved?: boolean;
  kind?: "analysis" | "tryon";
  hairColor?: string | null;
  hairstyleId?: string | null;
  scores?: Record<string, number>;
  hairType?: string | null;
  failReason?: string | null;
  accKind?: "jewellery" | "eyewear" | "nail";
  catalogueItemId?: string;
};

const LOCAL_APPAREL = [
  {
    id: "ap-wrap-dress",
    kind: "apparel",
    title: "Soft wrap dress",
    subtitle: "Easy waist — tagged for second-trimester ease",
    tags: ["full_body", "maternity"],
    garmentCategory: "full_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png",
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    trimester: 2,
    pmosFit: true,
    tryOnPrompt: "ease through the waist, second-trimester comfortable fit",
  },
  {
    id: "ap-soft-blouse",
    kind: "apparel",
    title: "Soft everyday blouse",
    subtitle: "Mix with a bottom without taking a new photo",
    tags: ["upper_body"],
    garmentCategory: "upper_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_upper_01_5a000d999f.png",
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: true,
    tryOnPrompt: "soft drape, comfortable through the chest, not clingy",
  },
  {
    id: "ap-wide-trousers",
    kind: "apparel",
    title: "Wide-leg trousers",
    subtitle: "Ease through the hip — tagged for PMOS comfort days",
    tags: ["lower_body", "pmos"],
    garmentCategory: "lower_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_lower_01_5a000d999f.png",
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: true,
    tryOnPrompt: "easy waist, wide leg, not tight through the midsection",
  },
] as const;

const LOCAL_ACCESSORIES = [
  {
    id: "jw-hoop",
    kind: "jewellery" as const,
    title: "Gold hoop earring",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "earring"],
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "earring" as const,
    refImageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-band",
    kind: "jewellery" as const,
    title: "Slim ring",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "ring"],
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "ring" as const,
    refImageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-bangle",
    kind: "jewellery" as const,
    title: "Everyday bracelet",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "bracelet"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "bracelet" as const,
    refImageUrl:
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-watch",
    kind: "jewellery" as const,
    title: "Slim watch",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "watch"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "watch" as const,
    refImageUrl:
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-pendant",
    kind: "jewellery" as const,
    title: "Fine necklace",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "necklace"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "necklace" as const,
    refImageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-photo-only",
    kind: "jewellery" as const,
    title: "Statement earring (photo only)",
    subtitle: "No SKU still on file — try-on stays off. We do not invent a model.",
    tags: ["jewellery", "earring"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: false,
    accessoryCategory: "earring" as const,
  },
  {
    id: "ew-round",
    kind: "eyewear" as const,
    title: "Round frame",
    subtitle: "Glasses try-on is not on this YouCam S2S path yet",
    tags: ["eyewear", "optician"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: false,
  },
  {
    id: "nl-rose",
    kind: "nail_color" as const,
    title: "Rose nail",
    subtitle: "Hand-photo try-on. Find a salon nearby through SheMatch.",
    tags: ["nail", "salon"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: false,
    nailColor: "#c45c6a",
  },
  {
    id: "nl-ink",
    kind: "nail_color" as const,
    title: "Ink nail",
    subtitle: "Hand-photo try-on. Find a salon nearby through SheMatch.",
    tags: ["nail", "salon"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: false,
    nailColor: "#1a1a1a",
  },
].map((row) => ({
  ...row,
  tryOnReady:
    row.kind === "jewellery"
      ? Boolean("refImageUrl" in row && row.refImageUrl)
      : accessoryTryOnReady({
          kind: row.kind,
          nailColor: "nailColor" in row ? row.nailColor : null,
        }),
}));

const nowIso = () => new Date().toISOString();

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function localYoucamPlugin(opts: {
  apiKey: string;
  apiServer: string;
}): Plugin {
  const base = opts.apiServer.replace(/\/$/, "");
  const key = opts.apiKey.trim();

  const scans = new Map<string, ScanRow>();
  const makeupLooks = new Map<string, MediaJob>();
  const hairRows = new Map<string, MediaJob>();
  const tryons = new Map<string, MediaJob>();
  const accessoryLooks = new Map<string, MediaJob>();
  const shadeMatches: Record<string, unknown>[] = [];
  const wardrobeItems: Record<string, unknown>[] = [];
  let mirrorConsented = false;
  let liveCameraConsented = false;
  let wardrobeConsented = false;
  let healthConsented = true;

  async function youcamFetch(path: string, init: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    let parsed: unknown = {};
    try {
      parsed = await res.json();
    } catch {
      parsed = {};
    }
    if (!res.ok) {
      console.error("[local-youcam] YouCam", res.status, path, parsed);
      const err = new Error(`YOUCAM_HTTP_${res.status}`);
      (err as Error & { body?: unknown }).body = parsed;
      throw err;
    }
    return parsed;
  }

  async function uploadFile(kind: string, bytes: Buffer): Promise<string> {
    const json = await youcamFetch(`/s2s/v2.0/file/${kind}`, {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            content_type: "image/jpg",
            file_name: `${kind}-${Date.now()}.jpg`,
            file_size: bytes.length,
          },
        ],
      }),
    });
    const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
    const files = data?.files;
    const file = Array.isArray(files) ? asRecord(files[0]) : data;
    const fileId = String(file?.file_id ?? "");
    const requests = file?.requests;
    let uploadUrl = "";
    const extra: Record<string, string> = {};
    if (Array.isArray(requests) && requests[0]) {
      const r = asRecord(requests[0]);
      uploadUrl = String(r?.url ?? "");
      const h = asRecord(r?.headers);
      if (h) {
        for (const [k, v] of Object.entries(h)) {
          if (typeof v === "string" && !/^content-length$/i.test(k)) extra[k] = v;
        }
      }
    }
    if (!fileId || !uploadUrl) throw new Error("YOUCAM_UPLOAD_INIT_FAILED");
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpg", ...extra },
      body: new Uint8Array(bytes),
    });
    if (!put.ok) throw new Error(`YOUCAM_PUT_${put.status}`);
    await new Promise((r) => setTimeout(r, 800));
    return fileId;
  }

  async function startTask(
    cap: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const json = await youcamFetch(`/s2s/v2.0/task/${cap}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
    const taskId = String(data?.task_id ?? "");
    if (!taskId) throw new Error("YOUCAM_NO_TASK");
    return taskId;
  }

  async function startSkin(fileId: string): Promise<string> {
    return startTask("skin-analysis", {
      src_file_id: fileId,
      dst_actions: [...SKIN_ACTIONS],
      miniserver_args: { enable_mask_overlay: true },
      format: "json",
    });
  }

  function collectScores(node: unknown, into: Record<string, number>) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) collectScores(item, into);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    const type = String(rec.type ?? rec.name ?? rec.action ?? rec.concern ?? rec.key ?? "");
    const score = rec.ui_score ?? rec.score ?? rec.value ?? rec.severity;
    if (type && typeof score === "number") into[type] = score;
    for (const k of SKIN_ACTIONS) {
      const v = rec[k];
      if (typeof v === "number") into[k] = v;
      const nested = asRecord(v);
      if (nested && typeof nested.score === "number") into[k] = nested.score;
      if (nested && typeof nested.ui_score === "number") into[k] = nested.ui_score;
    }
    const output = rec.output;
    if (Array.isArray(output)) collectScores(output, into);
    for (const [key, v] of Object.entries(rec)) {
      if (key === "output") continue;
      collectScores(v, into);
    }
  }

  function firstHttpUrl(node: unknown, depth = 0): string | undefined {
    if (depth > 8 || node == null) return undefined;
    if (typeof node === "string" && /^https?:\/\//i.test(node)) return node;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = firstHttpUrl(item, depth + 1);
        if (found) return found;
      }
      return undefined;
    }
    const rec = asRecord(node);
    if (!rec) return undefined;
    for (const key of [
      "url",
      "download_url",
      "result_url",
      "output_url",
      "file_url",
      "image_url",
    ]) {
      const v = rec[key];
      if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
    }
    for (const v of Object.values(rec)) {
      const found = firstHttpUrl(v, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  function resultUrlFrom(data: Record<string, unknown>): string | undefined {
    const results = data.results;
    const asObj = asRecord(results);
    if (typeof asObj?.url === "string") return asObj.url;
    const output = Array.isArray(asObj?.output)
      ? asObj.output
      : Array.isArray(results)
        ? results
        : [];
    for (const item of output) {
      const rec = asRecord(item);
      const urls = rec?.mask_urls;
      if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
      if (typeof rec?.download_url === "string") return rec.download_url;
      if (typeof rec?.url === "string") return rec.url;
    }
    if (typeof data.url === "string") return data.url;
    return firstHttpUrl(results) ?? firstHttpUrl(data);
  }

  async function pollSkin(taskId: string) {
    const json = await youcamFetch(
      `/s2s/v2.0/task/skin-analysis/${encodeURIComponent(taskId)}`,
      { method: "GET" },
    );
    const root = asRecord(json) ?? {};
    const data = asRecord(root.data) ?? root;
    const raw = String(data.task_status ?? "running").toLowerCase();
    const status =
      raw === "success" || raw === "ok"
        ? "success"
        : raw === "error" || raw === "fail" || raw === "failed"
          ? "error"
          : "running";
    const scores: Record<string, number> = {};
    collectScores(data, scores);
    const numeric = Object.entries(scores).filter(([k]) => k !== "skin_type");
    const overall =
      typeof data.overall_score === "number"
        ? data.overall_score
        : numeric.length
          ? Math.round(numeric.reduce((s, [, n]) => s + n, 0) / numeric.length)
          : null;
    const failReason =
      status === "error"
        ? String(data.error ?? data.error_code ?? data.message ?? "task_error")
        : null;
    if (status !== "running") {
      console.info("[local-youcam] poll", taskId.slice(0, 8), status, failReason ?? Object.keys(scores).length);
    }
    return { status, scores, overall, resultUrl: resultUrlFrom(data), failReason };
  }

  async function downloadB64(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YOUCAM_RESULT_GET_${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  function publicScan(row: ScanRow) {
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      cycleDayAtScan: null,
      cyclePhaseAtScan: null,
      overallScore: row.overallScore,
      scores: row.scores,
      hasResultImage: row.hasResultImage,
      hasMask: row.hasMask,
      hasSourceImage: Boolean(row.srcB64),
      insight:
        row.status === "error" && row.failReason
          ? {
              title: "Scan could not finish",
              body: youcamFailCopy(row.failReason),
              confidence: "Low",
              enoughScans: false,
              patternFound: false,
            }
          : null,
      seeded: false,
      scanQuality: "sd",
    };
  }

  function youcamFailCopy(reason: string): string {
    return youcamClientFailCopy(reason);
  }

  async function settle(row: ScanRow): Promise<ScanRow> {
    if (row.status !== "pending") return row;
    const task = await pollSkin(row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      row.status = "error";
      row.failReason = task.failReason;
      return row;
    }
    row.status = "success";
    row.scores = task.scores;
    row.overallScore = task.overall;
    if (task.resultUrl) {
      try {
        row.resultB64 = await downloadB64(task.resultUrl);
        row.hasResultImage = true;
      } catch (err) {
        console.error("[local-youcam] result download failed", err);
      }
    }
    return row;
  }

  async function pollCap(cap: string, taskId: string) {
    return pollSkinPath(cap, taskId);
  }

  async function pollSkinPath(cap: string, taskId: string) {
    const json = await youcamFetch(
      `/s2s/v2.0/task/${cap}/${encodeURIComponent(taskId)}`,
      { method: "GET" },
    );
    const root = asRecord(json) ?? {};
    const data = asRecord(root.data) ?? root;
    const raw = String(data.task_status ?? "running").toLowerCase();
    const status =
      raw === "success" || raw === "ok"
        ? "success"
        : raw === "error" || raw === "fail" || raw === "failed"
          ? "error"
          : "running";
    const scores: Record<string, number> = {};
    collectScores(data, scores);
    const failReason =
      status === "error" ? youcamErrorText(data) : null;
    if (status !== "running") {
      console.info(
        "[local-youcam] studio poll",
        cap,
        taskId.slice(0, 8),
        status,
        failReason,
        resultUrlFrom(data) ? "result" : `keys:${Object.keys(asRecord(data.results) ?? data).join(",")}`,
      );
    }
    if (typeof data.hair_type === "string") {
      scores.hair_type_flag = 1;
    }
    return {
      status,
      scores,
      overall: null as number | null,
      resultUrl: resultUrlFrom(data),
      failReason,
      hairType: typeof data.hair_type === "string" ? data.hair_type : null,
      data,
    };
  }

  function youcamErrorText(data: Record<string, unknown>): string {
    const err = data.failure_reason ?? data.error_message ?? data.error ?? data.error_code ?? data.message;
    if (err && typeof err === "object") return JSON.stringify(err);
    return String(err ?? "task_error");
  }

  async function settleJob(job: MediaJob): Promise<MediaJob> {
    if (job.status !== "pending") return job;
    const task = await pollCap(job.cap, job.youcamTaskId);
    if (task.status === "running") return job;
    if (task.status === "error") {
      job.status = "error";
      job.failReason = task.failReason;
      console.error("[local-youcam] studio task failed", job.cap, task.failReason, task.data);
      return job;
    }
    job.status = "success";
    if (job.cap === "hair-length-detection" || job.cap === "hair-analysis") {
      const parsed = parseHairAnalysisPayload(task.data);
      job.scores = {
        ...task.scores,
        ...(typeof parsed.hair_length === "number"
          ? { hair_length: parsed.hair_length }
          : {}),
        ...(typeof parsed.hair_density === "number"
          ? { hair_density: parsed.hair_density }
          : {}),
        ...(typeof parsed.hair_frizziness === "number"
          ? { hair_frizziness: parsed.hair_frizziness }
          : {}),
      };
      job.hairType = parsed.hair_type ?? task.hairType;
    } else {
      job.scores = task.scores;
      job.hairType = task.hairType;
    }
    if (task.resultUrl) {
      try {
        job.resultB64 = await downloadB64(task.resultUrl);
      } catch (err) {
        console.error("[local-youcam] studio result download failed", err);
      }
    } else {
      console.error("[local-youcam] studio success with no result URL", job.cap, Object.keys(task.data));
    }
    return job;
  }

  function imageBytes(body: Record<string, unknown>): Buffer | null {
    const raw = String(body.imageB64 ?? "");
    if (raw) {
      const b64 = raw.replace(/^data:[^;]+;base64,/, "");
      const bytes = Buffer.from(b64, "base64");
      return bytes.length >= 1024 ? bytes : null;
    }
    const scan = scans.get(String(body.scanId ?? ""));
    if (scan?.srcB64) {
      const bytes = Buffer.from(scan.srcB64, "base64");
      return bytes.length >= 1024 ? bytes : null;
    }
    return null;
  }

  function makeupEffects(body: Record<string, unknown>): Record<string, unknown>[] {
    const categories = parseMakeupCategories(body.categories);
    const palettes = parseMakeupPalettes(body.palettes);
    return buildMakeupVtoEffects(categories, palettes);
  }

  function publicMakeup(job: MediaJob) {
    return {
      id: job.id,
      status: job.status,
      sourceKind: job.sourceKind ?? "photo",
      categories: job.categories ?? ["lip", "blush", "foundation"],
      saved: Boolean(job.saved),
      hasResultImage: Boolean(job.resultB64),
      createdAt: job.createdAt,
      failReason: job.failReason ?? null,
    };
  }

  function publicHair(job: MediaJob) {
    return {
      id: job.id,
      kind: job.kind ?? "analysis",
      status: job.status,
      createdAt: job.createdAt,
      cycleDayAtScan: null,
      cyclePhaseAtScan: null,
      scores: {
        hair_type: job.hairType,
        hair_length: job.scores?.hair_length ?? null,
        hair_frizziness: job.scores?.hair_frizziness ?? null,
        hair_density: job.scores?.hair_density ?? null,
      },
      hairColor: job.hairColor ?? null,
      hairstyleId: job.hairstyleId ?? null,
      hasResultImage: Boolean(job.resultB64),
      insight: null,
      failReason: job.failReason ?? null,
    };
  }

  function publicAccessory(job: MediaJob) {
    return {
      id: job.id,
      kind: job.accKind ?? "jewellery",
      status: job.status,
      catalogueItemId: job.catalogueItemId ?? "",
      accessoryCategory: null,
      hasResultImage: Boolean(job.resultB64),
      createdAt: job.createdAt,
    };
  }

  const me = {
    sub: "local-youcam-user",
    email: "local@girlcode360.dev",
    market: "UK",
    locale: "en-GB",
    ageConfirmed18: true,
    onboardingComplete: true,
    modules: [
      "mirror",
      "period_tracker",
      "pcos_manager",
      "pregnancy",
      "ttc",
      "wallet",
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  function consents() {
    const items = [
      { purpose: "health_data", granted: healthConsented },
      { purpose: "mirror_biometric", granted: mirrorConsented },
      { purpose: "mirror_live_camera", granted: liveCameraConsented },
      { purpose: "wardrobe", granted: wardrobeConsented },
    ].map((c) => ({
      id: c.purpose,
      purpose: c.purpose,
      granted: c.granted,
      policyVersion: POLICY,
      jurisdiction: "UK",
      recordedAt: nowIso(),
    }));
    return { current: items, history: items };
  }

  function status() {
    return {
      consented: mirrorConsented,
      liveCameraConsented,
      wardrobeConsented,
      youcamConfigured: true,
      youcamAvailable: true,
    };
  }

  return {
    name: "local-youcam",
    configureServer(server) {
      if (key.length <= 8) return;
      console.info(
        "[local-youcam] localhost Mirror talks to YouCam from Vite. Cognito is skipped.",
      );
      server.middlewares.use((req, res, next) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          if (!url.pathname.startsWith("/v1")) {
            next();
            return;
          }
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }
          try {
            const path = url.pathname;
            const method = req.method ?? "GET";

            if (method === "GET" && path === "/v1/health") {
              json(res, 200, { ok: true, localYoucam: true });
              return;
            }
            if (
              (method === "GET" && path === "/v1/users/me") ||
              (method === "POST" && path === "/v1/users/me/bootstrap") ||
              (method === "PATCH" && path === "/v1/users/me") ||
              (method === "PATCH" && path === "/v1/users/me/modules")
            ) {
              if (method !== "GET") await readJson(req);
              json(res, 200, me);
              return;
            }
            if (method === "GET" && path === "/v1/emergency") {
              json(res, 200, {
                market: "UK",
                numbers: [{ label: "Emergency", number: "999" }],
              });
              return;
            }
            if (method === "GET" && path === "/v1/consents") {
              json(res, 200, consents());
              return;
            }
            if (method === "POST" && path === "/v1/consents") {
              const body = await readJson(req);
              const items = Array.isArray(body.items) ? body.items : [];
              for (const item of items) {
                const rec = asRecord(item);
                if (!rec) continue;
                const purpose = String(rec.purpose ?? "");
                const granted = rec.granted !== false;
                if (purpose === "health_data") healthConsented = granted;
                if (purpose === "mirror_biometric") mirrorConsented = granted;
                if (purpose === "mirror_live_camera") liveCameraConsented = granted;
                if (purpose === "wardrobe") wardrobeConsented = granted;
              }
              json(res, 200, consents());
              return;
            }
            if (method === "GET" && path === "/v1/mirror/status") {
              json(res, 200, status());
              return;
            }
            if (method === "POST" && path === "/v1/mirror/consent") {
              const body = await readJson(req);
              mirrorConsented = body.granted !== false;
              json(res, 200, status());
              return;
            }
            if (method === "GET" && path === "/v1/mirror/catalogue") {
              const kind = url.searchParams.get("kind");
              const makeupItems = MAKEUP_TRYON_SHADES.map((shade) => ({
                id: shade.id,
                kind: "makeup" as const,
                title: shade.title,
                subtitle: `Stocked by ${shade.boutiqueName}`,
                tags: [shade.category, shade.brandCode],
                boutiqueName: shade.boutiqueName,
                boutiqueArea: shade.boutiqueArea,
                trimester: null,
                pmosFit: false,
                brandCode: shade.brandCode,
                shadeCode: shade.shadeCode,
                shadeFamily: shade.shadeFamily,
                makeupCategory: shade.category,
                swatchHex: shade.hex,
              }));
              const items =
                kind === "makeup"
                  ? makeupItems
                  : kind === "apparel" || !kind
                    ? LOCAL_APPAREL
                    : kind === "jewellery" || kind === "eyewear" || kind === "nail_color"
                      ? LOCAL_ACCESSORIES.filter((i) => i.kind === kind)
                      : [];
              json(res, 200, { items, pregnancyWeek: null });
              return;
            }
            if (method === "GET" && path === "/v1/mirror/scans") {
              for (const row of scans.values()) {
                if (row.status === "pending") await settle(row);
              }
              json(res, 200, {
                scans: [...scans.values()].map(publicScan),
              });
              return;
            }
            if (method === "POST" && path === "/v1/mirror/scans") {
              const body = await readJson(req);
              const raw = String(body.imageB64 ?? "");
              const b64 = raw.replace(/^data:[^;]+;base64,/, "");
              const bytes = Buffer.from(b64, "base64");
              if (bytes.length < 1024) {
                json(res, 400, { error: "image_too_small" });
                return;
              }
              const fileId = await uploadFile("skin-analysis", bytes);
              const taskId = await startSkin(fileId);
              const row: ScanRow = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                overallScore: null,
                scores: {},
                hasResultImage: false,
                hasMask: false,
                youcamTaskId: taskId,
                resultB64: null,
                maskB64: null,
                failReason: null,
                srcB64: b64,
              };
              await settle(row);
              scans.set(row.id, row);
              json(res, 202, { scan: publicScan(row) });
              return;
            }
            const scanOne = path.match(/^\/v1\/mirror\/scans\/([^/]+)$/);
            if (scanOne && method === "GET") {
              const row = scans.get(decodeURIComponent(scanOne[1]!));
              if (!row) {
                json(res, 404, { error: "scan_not_found" });
                return;
              }
              await settle(row);
              json(res, 200, { scan: publicScan(row) });
              return;
            }
            if (scanOne && method === "DELETE") {
              const id = decodeURIComponent(scanOne[1]!);
              scans.delete(id);
              json(res, 200, { ok: true });
              return;
            }
            const media = path.match(/^\/v1\/mirror\/scans\/([^/]+)\/media$/);
            if (media && method === "GET") {
              const row = scans.get(decodeURIComponent(media[1]!));
              const kindParam = url.searchParams.get("kind");
              const b64 =
                kindParam === "mask"
                  ? row?.maskB64
                  : kindParam === "source"
                    ? row?.srcB64
                    : row?.resultB64;
              if (!row || !b64) {
                json(res, 404, { error: "media_not_found" });
                return;
              }
              json(res, 200, { contentType: "image/jpeg", imageB64: b64 });
              return;
            }
            if (method === "GET" && path === "/v1/mirror/tryons") {
              for (const job of tryons.values()) {
                if (job.status === "pending") await settleJob(job);
              }
              json(res, 200, {
                tryons: [...tryons.values()].map((job) => ({
                  id: job.id,
                  status: job.status,
                  createdAt: job.createdAt,
                  catalogueItemId: job.hairstyleId ?? "",
                  hasResultImage: Boolean(job.resultB64),
                })),
              });
              return;
            }
            if (method === "POST" && path === "/v1/mirror/tryons") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              const item = LOCAL_APPAREL.find((i) => i.id === String(body.catalogueItemId ?? ""));
              if (!bytes) {
                json(res, 400, { error: "image_required" });
                return;
              }
              if (!item) {
                json(res, 400, { error: "catalogue_item_invalid" });
                return;
              }
              const fileId = await uploadFile("cloth-v3", bytes);
              const taskId = await startTask("cloth-v3", {
                src_file_id: fileId,
                garment_category: item.garmentCategory,
                ref_file_url: item.refImageUrl,
                prompt: item.tryOnPrompt,
              });
              const job: MediaJob = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                cap: "cloth-v3",
                youcamTaskId: taskId,
                resultB64: null,
                hairstyleId: item.id,
              };
              await settleJob(job);
              tryons.set(job.id, job);
              json(res, 202, {
                tryon: {
                  id: job.id,
                  status: job.status,
                  createdAt: job.createdAt,
                  catalogueItemId: item.id,
                  hasResultImage: Boolean(job.resultB64),
                },
              });
              return;
            }
            const tryonOne = path.match(/^\/v1\/mirror\/tryons\/([^/]+)$/);
            if (tryonOne && method === "GET") {
              const job = tryons.get(decodeURIComponent(tryonOne[1]!));
              if (!job) {
                json(res, 404, { error: "tryon_not_found" });
                return;
              }
              await settleJob(job);
              json(res, 200, {
                tryon: {
                  id: job.id,
                  status: job.status,
                  createdAt: job.createdAt,
                  catalogueItemId: job.hairstyleId ?? "",
                  hasResultImage: Boolean(job.resultB64),
                },
              });
              return;
            }
            const tryonMedia = path.match(/^\/v1\/mirror\/tryons\/([^/]+)\/media$/);
            if (tryonMedia && method === "GET") {
              const job = tryons.get(decodeURIComponent(tryonMedia[1]!));
              if (!job?.resultB64) {
                json(res, 404, { error: "media_not_found" });
                return;
              }
              json(res, 200, { contentType: "image/jpeg", imageB64: job.resultB64 });
              return;
            }

            if (method === "GET" && path === "/v1/mirror-studio/makeup") {
              for (const job of makeupLooks.values()) {
                if (job.status === "pending") await settleJob(job);
              }
              json(res, 200, {
                looks: [...makeupLooks.values()].reverse().map(publicMakeup),
              });
              return;
            }
            const makeupMode = path.match(/^\/v1\/mirror-studio\/makeup\/(live|photo|transfer)$/);
            if (makeupMode && method === "POST") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              if (!bytes) {
                json(res, 400, { error: "image_required" });
                return;
              }
              const mode = makeupMode[1] as "live" | "photo" | "transfer";
              if (mode === "transfer") {
                const refRaw = String(body.referenceB64 ?? "");
                const refB64 = refRaw.replace(/^data:[^;]+;base64,/, "");
                const refBytes = Buffer.from(refB64, "base64");
                if (refBytes.length < 1024) {
                  json(res, 400, { error: "reference_required" });
                  return;
                }
                const srcId = await uploadFile("mu-transfer", bytes);
                const refId = await uploadFile("mu-transfer", refBytes);
                const taskId = await startTask("mu-transfer", {
                  src_file_id: srcId,
                  ref_file_id: refId,
                });
                const job: MediaJob = {
                  id: crypto.randomUUID(),
                  status: "pending",
                  createdAt: nowIso(),
                  cap: "mu-transfer",
                  youcamTaskId: taskId,
                  resultB64: null,
                  sourceKind: "transfer",
                };
                await settleJob(job);
                makeupLooks.set(job.id, job);
                json(res, 202, { look: publicMakeup(job) });
                return;
              }
              const categories = parseMakeupCategories(body.categories);
              const fileId = await uploadFile("makeup-vto", bytes);
              await new Promise((r) => setTimeout(r, 1500));
              const taskId = await startTask("makeup-vto", {
                src_file_id: fileId,
                version: "1.0",
                effects: makeupEffects(body),
              });
              const job: MediaJob = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                cap: "makeup-vto",
                youcamTaskId: taskId,
                resultB64: null,
                sourceKind: mode,
                categories,
              };
              for (let i = 0; i < 10; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                await settleJob(job);
                if (job.status !== "pending") break;
              }
              makeupLooks.set(job.id, job);
              json(res, 202, { look: publicMakeup(job) });
              return;
            }
            const makeupOne = path.match(/^\/v1\/mirror-studio\/makeup\/([^/]+)$/);
            if (makeupOne && method === "GET") {
              const job = makeupLooks.get(decodeURIComponent(makeupOne[1]!));
              if (!job) {
                json(res, 404, { error: "look_not_found" });
                return;
              }
              await settleJob(job);
              json(res, 200, { look: publicMakeup(job) });
              return;
            }
            if (makeupOne && method === "PATCH") {
              const job = makeupLooks.get(decodeURIComponent(makeupOne[1]!));
              if (!job) {
                json(res, 404, { error: "look_not_found" });
                return;
              }
              const body = await readJson(req);
              job.saved = body.saved !== false;
              json(res, 200, { look: publicMakeup(job) });
              return;
            }
            const makeupMedia = path.match(/^\/v1\/mirror-studio\/makeup\/([^/]+)\/media$/);
            if (makeupMedia && method === "GET") {
              const job = makeupLooks.get(decodeURIComponent(makeupMedia[1]!));
              if (!job?.resultB64) {
                json(res, 404, { error: "media_not_found" });
                return;
              }
              json(res, 200, { contentType: "image/jpeg", imageB64: job.resultB64 });
              return;
            }

            if (method === "GET" && path === "/v1/mirror-studio/shade-matches") {
              json(res, 200, { matches: shadeMatches });
              return;
            }
            if (method === "POST" && path === "/v1/mirror-studio/shade-match") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              if (!bytes) {
                json(res, 400, { error: "scan_required" });
                return;
              }
              const fileId = await uploadFile("shade-finder", bytes);
              const taskId = await startTask("shade-finder", {
                src_file_id: fileId,
                dst_actions: ["shade_match", "fitzpatrick_type"],
              });
              let fitz: string | null = null;
              for (let i = 0; i < 12; i++) {
                const polled = await pollCap("shade-finder", taskId);
                if (polled.status === "running") {
                  await new Promise((r) => setTimeout(r, 1500));
                  continue;
                }
                const rec = polled.data;
                fitz =
                  typeof rec.fitzpatrick_type === "string"
                    ? rec.fitzpatrick_type
                    : null;
                break;
              }
              const match = {
                id: crypto.randomUUID(),
                sourceScanId: String(body.scanId ?? ""),
                fitzpatrickType: fitz,
                wellnessNote:
                  "Shade codes are a matching aid from this still. Not a diagnosis.",
                overallConfidence: "Medium" as const,
                twins: [] as unknown[],
                createdAt: nowIso(),
              };
              shadeMatches.unshift(match);
              json(res, 200, { match });
              return;
            }

            if (method === "GET" && path === "/v1/mirror-studio/hair") {
              for (const job of hairRows.values()) {
                if (job.status === "pending") await settleJob(job);
              }
              json(res, 200, { scans: [...hairRows.values()].map(publicHair) });
              return;
            }
            if (method === "POST" && path === "/v1/mirror-studio/hair/analysis") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              if (!bytes) {
                json(res, 400, { error: "image_required" });
                return;
              }
              const fileId = await uploadFile("hair-length-detection", bytes);
              await new Promise((r) => setTimeout(r, 1500));
              const taskId = await startTask("hair-length-detection", {
                src_file_id: fileId,
              });
              const job: MediaJob = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                cap: "hair-length-detection",
                youcamTaskId: taskId,
                resultB64: null,
                kind: "analysis",
              };
              hairRows.set(job.id, job);
              json(res, 202, { scan: publicHair(job) });
              return;
            }
            if (method === "POST" && path === "/v1/mirror-studio/hair/tryon") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              if (!bytes) {
                json(res, 400, { error: "image_required" });
                return;
              }
              const color = String(body.hairColor ?? "").trim();
              if (!color) {
                json(res, 400, { error: "hair_color_required" });
                return;
              }
              const fileId = await uploadFile("hair-color", bytes);
              const taskId = await startTask("hair-color", {
                src_file_id: fileId,
                pattern: { name: "full" },
                palettes: [
                  {
                    color: color.startsWith("#") ? color : `#${color}`,
                    color_intensity: 70,
                    shine_intensity: 35,
                  },
                ],
              });
              const job: MediaJob = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                cap: "hair-color",
                youcamTaskId: taskId,
                resultB64: null,
                kind: "tryon",
                hairColor: color,
                hairstyleId: body.hairstyleId ? String(body.hairstyleId) : null,
              };
              hairRows.set(job.id, job);
              json(res, 202, { scan: publicHair(job) });
              return;
            }
            const hairOne = path.match(/^\/v1\/mirror-studio\/hair\/([^/]+)$/);
            if (hairOne && method === "GET") {
              const job = hairRows.get(decodeURIComponent(hairOne[1]!));
              if (!job) {
                json(res, 404, { error: "scan_not_found" });
                return;
              }
              await settleJob(job);
              json(res, 200, { scan: publicHair(job) });
              return;
            }
            const hairMedia = path.match(/^\/v1\/mirror-studio\/hair\/([^/]+)\/media$/);
            if (hairMedia && method === "GET") {
              const job = hairRows.get(decodeURIComponent(hairMedia[1]!));
              if (!job?.resultB64) {
                json(res, 404, { error: "media_not_found" });
                return;
              }
              json(res, 200, { contentType: "image/jpeg", imageB64: job.resultB64 });
              return;
            }

            if (method === "GET" && path === "/v1/mirror-studio/wardrobe/items") {
              json(res, 200, { items: wardrobeItems });
              return;
            }
            if (method === "POST" && path === "/v1/mirror-studio/wardrobe/items") {
              await readJson(req);
              json(res, 501, {
                error: "local_youcam_only",
                detail: "Wardrobe tagging is not on the local YouCam proxy. Try Makeup or Hair.",
              });
              return;
            }
            if (method === "GET" && path === "/v1/mirror-studio/wardrobe/outfits") {
              json(res, 200, { outfits: [] });
              return;
            }
            if (method === "GET" && path === "/v1/mirror-studio/accessories") {
              for (const job of accessoryLooks.values()) {
                if (job.status === "pending") await settleJob(job);
              }
              json(res, 200, {
                looks: [...accessoryLooks.values()].reverse().map(publicAccessory),
              });
              return;
            }
            const accMode = path.match(
              /^\/v1\/mirror-studio\/accessories\/(jewellery|eyewear|nail)$/,
            );
            if (accMode && method === "POST") {
              const body = await readJson(req);
              const bytes = imageBytes(body);
              if (!bytes) {
                json(res, 400, { error: "image_required" });
                return;
              }
              const mode = accMode[1] as "jewellery" | "eyewear" | "nail";
              const expectedKind = mode === "nail" ? "nail_color" : mode;
              const item = LOCAL_ACCESSORIES.find(
                (i) => i.id === String(body.catalogueItemId ?? ""),
              );
              if (!item || item.kind !== expectedKind) {
                json(res, 400, { error: "catalogue_item_invalid" });
                return;
              }
              if (!item.tryOnReady) {
                json(res, 400, { error: "accessory_3d_required" });
                return;
              }
              let cap = "nail-vto";
              let taskBody: Record<string, unknown> = {};
              if (mode === "jewellery") {
                const cat = String(
                  "accessoryCategory" in item ? item.accessoryCategory : "",
                );
                cap = `2d-vto/${cat}`;
                const srcId = await uploadFile(cap, bytes);
                const refUrl =
                  "refImageUrl" in item ? String(item.refImageUrl) : "";
                if (!refUrl) {
                  json(res, 400, { error: "accessory_3d_required" });
                  return;
                }
                taskBody = {
                  src_file_id: srcId,
                  ref_file_urls: [refUrl],
                  source_info: { name: srcId },
                  object_infos: [
                    {
                      name: refUrl,
                      parameter: {
                        [`${cat}_need_remove_background`]: true,
                      },
                    },
                  ],
                };
              } else if (mode === "eyewear") {
                json(res, 400, { error: "accessory_3d_required" });
                return;
              } else {
                cap = "nail-vto";
                const srcId = await uploadFile(cap, bytes);
                taskBody = {
                  src_file_id: srcId,
                  nail_color:
                    "nailColor" in item ? item.nailColor : undefined,
                };
              }
              await new Promise((r) => setTimeout(r, 800));
              const taskId = await startTask(cap, taskBody);
              const job: MediaJob = {
                id: crypto.randomUUID(),
                status: "pending",
                createdAt: nowIso(),
                cap,
                youcamTaskId: taskId,
                resultB64: null,
                accKind: mode,
                catalogueItemId: item.id,
              };
              for (let i = 0; i < 8; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                await settleJob(job);
                if (job.status !== "pending") break;
              }
              accessoryLooks.set(job.id, job);
              json(res, 202, { look: publicAccessory(job) });
              return;
            }
            const accOne = path.match(/^\/v1\/mirror-studio\/accessories\/([^/]+)$/);
            if (accOne && method === "GET") {
              const job = accessoryLooks.get(decodeURIComponent(accOne[1]!));
              if (!job) {
                json(res, 404, { error: "accessory_not_found" });
                return;
              }
              await settleJob(job);
              json(res, 200, { look: publicAccessory(job) });
              return;
            }
            const accMedia = path.match(
              /^\/v1\/mirror-studio\/accessories\/([^/]+)\/media$/,
            );
            if (accMedia && method === "GET") {
              const job = accessoryLooks.get(decodeURIComponent(accMedia[1]!));
              if (!job?.resultB64) {
                json(res, 404, { error: "media_not_found" });
                return;
              }
              json(res, 200, { contentType: "image/jpeg", imageB64: job.resultB64 });
              return;
            }
            if (method === "GET" && path === "/v1/mirror-studio/style-analytics") {
              json(res, 200, {
                analytics: {
                  windowDays: 30,
                  utilisationPct: null,
                  itemsCatalogued: 0,
                  itemsWornInWindow: 0,
                  costPerWear: [],
                  skinTrend: [],
                  hairTrend: [],
                  shadeHistory: [],
                },
              });
              return;
            }

            if (method === "POST" && path === "/v1/guest/alena") {
              const body = await readJson(req);
              const message = String(body.message ?? "").trim().slice(0, 500);
              if (!message) {
                json(res, 400, { error: "message_required" });
                return;
              }
              const market =
                body.market === "NG" || body.market === "GH" || body.market === "UK"
                  ? body.market
                  : "UK";
              const crisis = detectCrisis(message);
              json(res, 200, {
                reply: crisis
                  ? crisisMessage(market)
                  : [
                      "I'm Alena. This landing chat does not use health records.",
                      "",
                      "I can talk about general skincare habits, optional cycle logging, and the private Health Wallet.",
                      "I don't diagnose. Create an account to talk with Alena using the logs you allow.",
                    ].join("\n"),
                crisis,
                stub: true,
                remaining: 5,
                disclaimer:
                  "This is AI-generated wellness guidance, not medical advice.",
              });
              return;
            }

            if (method === "GET" && path === "/v1/cycles") {
              json(res, 200, {
                cycles: [],
                days: [],
                prediction: {
                  cycleLengthDays: 28,
                  periodLengthDays: 5,
                  nextStarts: [],
                  confidenceBandDays: 0,
                  highVariance: false,
                  message: "Local YouCam mode. Cycle API is not connected.",
                  predictedDates: [],
                  enoughData: false,
                },
              });
              return;
            }

            json(res, 501, {
              error: "local_youcam_only",
              detail: `${method} ${path} is not on the local YouCam proxy. Skin, Makeup, Hair, and shade match are.`,
            });
          } catch (err) {
            console.error("[local-youcam]", err);
            const msg = err instanceof Error ? err.message : "local_youcam_failed";
            if (msg.startsWith("YOUCAM_HTTP_401") || msg.startsWith("YOUCAM_HTTP_403")) {
              json(res, 503, { error: "youcam_unconfigured" });
              return;
            }
            json(res, 502, { error: "scan_failed", detail: msg });
          }
        })();
      });
    },
  };
}
