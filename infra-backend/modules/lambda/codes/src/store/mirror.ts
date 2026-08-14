import {
  correlateSkinAndCycle,
  cyclePhaseFromDay,
  dayInCycle,
  findDeniedPhrases,
  type CyclePhase,
  type MirrorInsight,
  type MirrorScanPoint,
} from "../../../../../../packages/domain/src/index";
import { converseNova } from "../../../../../../packages/ai-provider/src/index";
import { isDsqlEnabled } from "../db/client";
import { deleteObject, getObject, putObject } from "../db/s3";
import { youcamApiKey } from "../lib/secrets";
import {
  downloadUrl,
  packYoucamIds,
  pollTask,
  requestYoucamFileDeletion,
  startClothTryOn,
  startSkinAnalysis,
  unpackYoucamIds,
  uploadYoucamFile,
  youcamCircuitOpen,
} from "../lib/youcam";
import { catalogueById, filterCatalogue, MIRROR_CATALOGUE } from "../lib/mirrorCatalogue";
import { listCycles, listDays, latestConsentsByPurpose } from "./memory";
import { pregnancyStatus } from "./journey";
import type {
  ApparelTryOn,
  MirrorTaskStatus,
  SkinScan,
} from "../types";
import * as dsql from "./dsql/mirror";

type MemScan = dsql.SkinScanRow;
type MemTry = dsql.TryOnRow;

const scans = new Map<string, MemScan[]>();
const tryons = new Map<string, MemTry[]>();

function publicScan(row: MemScan): SkinScan {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    cycleDayAtScan: row.cycleDayAtScan,
    cyclePhaseAtScan: row.cyclePhaseAtScan,
    overallScore: row.overallScore,
    scores: row.scores,
    hasResultImage: row.hasResultImage,
    hasMask: row.hasMask,
    insight: row.insight,
    seeded: row.seeded,
    scanQuality: row.scanQuality,
  };
}

function publicTryOn(row: MemTry): ApparelTryOn {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    catalogueItemId: row.catalogueItemId,
    hasResultImage: row.hasResultImage,
  };
}

export async function mirrorConsented(sub: string): Promise<boolean> {
  const rows = await latestConsentsByPurpose(sub);
  return rows.find((c) => c.purpose === "mirror_biometric")?.granted === true;
}

export async function mirrorStatus(sub: string) {
  return {
    consented: await mirrorConsented(sub),
    youcamConfigured: Boolean(await youcamApiKey()),
    youcamAvailable: !youcamCircuitOpen(),
  };
}

async function cycleContext(sub: string, whenIso: string) {
  const date = whenIso.slice(0, 10);
  const cycles = await listCycles(sub);
  const day = dayInCycle(
    date,
    cycles.map((c) => c.startDate),
  );
  const phase = cyclePhaseFromDay(day);
  const days = await listDays(sub);
  const log = days.find((d) => d.date === date);
  return { day, phase, symptomIds: log?.symptomIds ?? [] };
}

async function refreshInsights(sub: string, rows: MemScan[]): Promise<MemScan[]> {
  const days = await listDays(sub);
  const points: MirrorScanPoint[] = rows
    .filter((r) => r.status === "success")
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      cyclePhase: r.cyclePhaseAtScan,
      scores: r.scores,
      symptomIds:
        days.find((d) => d.date === r.createdAt.slice(0, 10))?.symptomIds ?? [],
      seeded: r.seeded,
    }));
  const insight = await narrateMirrorInsight(correlateSkinAndCycle(points));
  return Promise.all(
    rows.map(async (row) => {
      if (row.status !== "success") return row;
      const next = { ...row, insight };
      if (isDsqlEnabled()) {
        await dsql.updateScan(sub, row.id, { insight });
      }
      return next;
    }),
  );
}

async function narrateMirrorInsight(insight: MirrorInsight): Promise<MirrorInsight> {
  if (process.env.BEDROCK_ENABLED !== "true") return insight;
  try {
    const result = await converseNova({
      system:
        "Rewrite this wellness skin-and-cycle finding in plain language. Do not diagnose. Do not invent a pattern or a hormonal cause. Keep the same meaning. Two or three short sentences.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            title: insight.title,
            body: insight.body,
            patternFound: insight.patternFound,
            enoughScans: insight.enoughScans,
          }),
        },
      ],
      maxTokens: 220,
    });
    if (result.stub) return insight;
    const text = result.text.trim();
    if (!text || findDeniedPhrases(text).length) return insight;
    return { ...insight, body: text };
  } catch {
    return insight;
  }
}

function seedRows(sub: string): MemScan[] {
  const now = Date.now();
  const mk = (
    daysAgo: number,
    phase: CyclePhase,
    acne: number,
    oil: number,
  ): MemScan => {
    const created = new Date(now - daysAgo * 86400000).toISOString();
    return {
      id: crypto.randomUUID(),
      userSub: sub,
      youcamTaskId: "seed",
      status: "success",
      createdAt: created,
      cycleDayAtScan: phase === "luteal" ? 22 : phase === "follicular" ? 8 : 14,
      cyclePhaseAtScan: phase,
      overallScore: Math.round((acne + oil + 40) / 3),
      scores: { acne, oiliness: oil, redness: 30, texture: 35, pore: 40 },
      hasResultImage: false,
      hasMask: false,
      insight: null,
      seeded: true,
      scanQuality: "sd",
      resultS3Key: null,
      maskS3Key: null,
      sourceS3Key: null,
      scoresRaw: "",
      insightRaw: null,
    };
  };
  return [
    mk(42, "follicular", 28, 30),
    mk(35, "luteal", 62, 58),
    mk(28, "follicular", 31, 33),
    mk(21, "ovulation", 40, 38),
    mk(14, "luteal", 68, 64),
    mk(7, "follicular", 34, 32),
  ];
}

async function ensureSeed(sub: string, existing: MemScan[]): Promise<MemScan[]> {
  if (existing.length > 0) return existing;
  const seeded = seedRows(sub);
  if (isDsqlEnabled()) {
    for (const row of seeded) {
      await dsql.insertScan({
        id: row.id,
        userSub: sub,
        youcamTaskId: row.youcamTaskId,
        status: "success",
        cycleDay: row.cycleDayAtScan,
        cyclePhase: row.cyclePhaseAtScan,
        overall: row.overallScore,
        scores: row.scores,
        resultKey: null,
        maskKey: null,
        sourceKey: null,
        insight: null,
        seeded: true,
      });
    }
    return dsql.listScans(sub);
  }
  scans.set(sub, seeded);
  return seeded;
}

export async function listSkinScans(sub: string): Promise<SkinScan[]> {
  let rows = isDsqlEnabled()
    ? await dsql.listScans(sub)
    : (scans.get(sub) ?? []);
  rows = await ensureSeed(sub, rows);
  rows = await refreshInsights(sub, rows);
  if (!isDsqlEnabled()) scans.set(sub, rows);
  return rows.map(publicScan);
}

export async function getSkinScan(sub: string, id: string): Promise<SkinScan | undefined> {
  let row = isDsqlEnabled()
    ? await dsql.getScan(sub, id)
    : (scans.get(sub) ?? []).find((s) => s.id === id);
  if (!row) return undefined;
  if (row.status === "pending") {
    row = (await settleScan(sub, row)) ?? row;
  }
  return publicScan(row);
}

function decodeImage(b64: string): { bytes: Buffer; contentType: string } {
  const trimmed = b64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length < 1024) throw new Error("IMAGE_TOO_SMALL");
  if (bytes.length > 6_000_000) throw new Error("IMAGE_TOO_LARGE");
  return { bytes, contentType: "image/jpeg" };
}

async function settleScan(sub: string, row: MemScan): Promise<MemScan | undefined> {
  if (row.status !== "pending") return row;
  try {
    const task = await pollTask("skin-analysis", row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as const };
      if (isDsqlEnabled()) await dsql.updateScan(sub, row.id, { status: "error" });
      else {
        const list = (scans.get(sub) ?? []).map((s) => (s.id === row.id ? next : s));
        scans.set(sub, list);
      }
      return next;
    }
    let resultKey: string | null = null;
    let maskKey: string | null = null;
    if (task.resultUrl) {
      try {
        const buf = await downloadUrl(task.resultUrl);
        resultKey = `mirror/${row.id}/result.jpg`;
        await putObject(resultKey, buf, "image/jpeg");
      } catch (err) {
        console.error("mirror result copy failed", err);
      }
    }
    const maskUrl = Object.entries(task.maskUrls).find(([k]) =>
      /mask|overlay|acne/i.test(k),
    )?.[1];
    if (maskUrl && maskUrl !== task.resultUrl) {
      try {
        const buf = await downloadUrl(maskUrl);
        maskKey = `mirror/${row.id}/mask.jpg`;
        await putObject(maskKey, buf, "image/jpeg");
      } catch {
        /* optional */
      }
    }
    const next: MemScan = {
      ...row,
      status: "success",
      scores: task.scores,
      overallScore: task.overall ?? row.overallScore,
      resultS3Key: resultKey,
      maskS3Key: maskKey,
      hasResultImage: Boolean(resultKey),
      hasMask: Boolean(maskKey),
    };
    if (isDsqlEnabled()) {
      await dsql.updateScan(sub, row.id, {
        status: "success",
        scores: task.scores,
        overall: next.overallScore,
        resultKey,
        maskKey,
      });
    } else {
      scans.set(
        sub,
        (scans.get(sub) ?? []).map((s) => (s.id === row.id ? next : s)),
      );
    }
    return next;
  } catch (err) {
    console.error("settle scan", err);
    return row;
  }
}

export async function createSkinScan(
  sub: string,
  imageB64: string,
): Promise<SkinScan> {
  const { bytes, contentType } = decodeImage(imageB64);
  const ctx = await cycleContext(sub, new Date().toISOString());
  const fileId = await uploadYoucamFile(
    "skin-analysis",
    bytes,
    contentType,
    `scan-${Date.now()}.jpg`,
  );
  const taskId = packYoucamIds(await startSkinAnalysis(fileId), fileId);
  const id = crypto.randomUUID();
  const sourceKey = `mirror/${id}/source.jpg`;
  try {
    await putObject(sourceKey, bytes, contentType);
  } catch {
    /* bucket optional in local */
  }
  const row: MemScan = {
    id,
    userSub: sub,
    youcamTaskId: taskId,
    status: "pending",
    createdAt: new Date().toISOString(),
    cycleDayAtScan: ctx.day,
    cyclePhaseAtScan: ctx.phase,
    overallScore: null,
    scores: {},
    hasResultImage: false,
    hasMask: false,
    insight: null,
    seeded: false,
    scanQuality: "sd",
    resultS3Key: null,
    maskS3Key: null,
    sourceS3Key: sourceKey,
    scoresRaw: "{}",
    insightRaw: null,
  };
  if (isDsqlEnabled()) {
    await dsql.insertScan({
      id,
      userSub: sub,
      youcamTaskId: taskId,
      status: "pending",
      cycleDay: ctx.day,
      cyclePhase: ctx.phase,
      overall: null,
      scores: {},
      resultKey: null,
      maskKey: null,
      sourceKey,
      insight: null,
      seeded: false,
    });
  } else {
    scans.set(sub, [...(scans.get(sub) ?? []), row]);
  }
  const settled = await settleScan(sub, row);
  return publicScan(settled ?? row);
}

export async function deleteSkinScan(sub: string, id: string): Promise<boolean> {
  const row = isDsqlEnabled()
    ? await dsql.getScan(sub, id)
    : (scans.get(sub) ?? []).find((s) => s.id === id);
  if (!row) return false;
  const fileId = unpackYoucamIds(row.youcamTaskId).fileId;
  if (fileId) await requestYoucamFileDeletion(fileId);
  for (const key of [row.resultS3Key, row.maskS3Key, row.sourceS3Key]) {
    if (key) {
      try {
        await deleteObject(key);
      } catch {
        /* best-effort */
      }
    }
  }
  if (isDsqlEnabled()) return dsql.softDeleteScan(sub, id);
  const list = scans.get(sub) ?? [];
  const next = list.filter((s) => s.id !== id);
  scans.set(sub, next);
  return next.length !== list.length;
}

export async function listSkinScansForExport(sub: string): Promise<SkinScan[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listScans(sub)
    : (scans.get(sub) ?? []);
  return rows.map(publicScan);
}

export async function listTryOnsForExport(sub: string): Promise<ApparelTryOn[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listTryOns(sub)
    : (tryons.get(sub) ?? []);
  return rows.map(publicTryOn);
}

export async function purgeUserMirror(sub: string): Promise<void> {
  const scanRows = isDsqlEnabled()
    ? await dsql.listScans(sub)
    : (scans.get(sub) ?? []);
  const tryRows = isDsqlEnabled()
    ? await dsql.listTryOns(sub)
    : (tryons.get(sub) ?? []);
  for (const row of scanRows) {
    const fileId = unpackYoucamIds(row.youcamTaskId).fileId;
    if (fileId) await requestYoucamFileDeletion(fileId);
    for (const key of [row.resultS3Key, row.maskS3Key, row.sourceS3Key]) {
      if (key) {
        try {
          await deleteObject(key);
        } catch {
          /* best-effort */
        }
      }
    }
  }
  for (const row of tryRows) {
    const fileId = unpackYoucamIds(row.youcamTaskId).fileId;
    if (fileId) await requestYoucamFileDeletion(fileId);
    if (row.resultS3Key) {
      try {
        await deleteObject(row.resultS3Key);
      } catch {
        /* best-effort */
      }
    }
  }
  if (isDsqlEnabled()) await dsql.purgeUserMirror(sub);
  scans.delete(sub);
  tryons.delete(sub);
}

export async function getScanMedia(
  sub: string,
  id: string,
  kind: "result" | "mask",
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = isDsqlEnabled()
    ? await dsql.getScan(sub, id)
    : (scans.get(sub) ?? []).find((s) => s.id === id);
  const key = kind === "mask" ? row?.maskS3Key : row?.resultS3Key;
  if (!key) return undefined;
  const bytes = await getObject(key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export function listCatalogue(opts: {
  kind?: "skincare" | "apparel";
  mode?: "all" | "maternity" | "pmos";
  week?: number | null;
}) {
  return filterCatalogue(opts).map(({ tryOnPrompt: _hidden, ...item }) => item);
}

export async function createTryOn(
  sub: string,
  imageB64: string,
  catalogueItemId: string,
): Promise<ApparelTryOn> {
  const item = catalogueById(catalogueItemId);
  if (!item || item.kind !== "apparel" || !item.refImageUrl) {
    throw new Error("CATALOGUE_ITEM_INVALID");
  }
  const { bytes, contentType } = decodeImage(imageB64);
  const srcId = await uploadYoucamFile(
    "cloth-v3",
    bytes,
    contentType,
    `body-${Date.now()}.jpg`,
  );
  const taskId = packYoucamIds(
    await startClothTryOn({
      srcFileId: srcId,
      refFileUrl: item.refImageUrl,
      garmentCategory: item.garmentCategory ?? "full_body",
      prompt: item.tryOnPrompt,
    }),
    srcId,
  );
  const id = crypto.randomUUID();
  const row: MemTry = {
    id,
    userSub: sub,
    youcamTaskId: taskId,
    status: "pending",
    createdAt: new Date().toISOString(),
    catalogueItemId,
    hasResultImage: false,
    resultS3Key: null,
  };
  if (isDsqlEnabled()) {
    await dsql.insertTryOn({
      id,
      userSub: sub,
      youcamTaskId: taskId,
      status: "pending",
      catalogueItemId,
      resultKey: null,
    });
  } else {
    tryons.set(sub, [row, ...(tryons.get(sub) ?? [])]);
  }
  const settled = await settleTryOn(sub, row);
  return publicTryOn(settled ?? row);
}

async function settleTryOn(sub: string, row: MemTry): Promise<MemTry | undefined> {
  if (row.status !== "pending") return row;
  try {
    const task = await pollTask("cloth-v3", row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as MirrorTaskStatus };
      if (isDsqlEnabled()) await dsql.updateTryOn(sub, row.id, { status: "error" });
      else {
        tryons.set(
          sub,
          (tryons.get(sub) ?? []).map((t) => (t.id === row.id ? next : t)),
        );
      }
      return next;
    }
    let resultKey: string | null = null;
    if (task.resultUrl) {
      const buf = await downloadUrl(task.resultUrl);
      resultKey = `mirror/${row.id}/tryon.jpg`;
      await putObject(resultKey, buf, "image/jpeg");
    }
    const next: MemTry = {
      ...row,
      status: "success",
      resultS3Key: resultKey,
      hasResultImage: Boolean(resultKey),
    };
    if (isDsqlEnabled()) {
      await dsql.updateTryOn(sub, row.id, { status: "success", resultKey });
    } else {
      tryons.set(
        sub,
        (tryons.get(sub) ?? []).map((t) => (t.id === row.id ? next : t)),
      );
    }
    return next;
  } catch (err) {
    console.error("settle tryon", err);
    return row;
  }
}

export async function getTryOnPublic(
  sub: string,
  id: string,
): Promise<ApparelTryOn | undefined> {
  let row = isDsqlEnabled()
    ? await dsql.getTryOn(sub, id)
    : (tryons.get(sub) ?? []).find((t) => t.id === id);
  if (!row) return undefined;
  if (row.status === "pending") row = (await settleTryOn(sub, row)) ?? row;
  return publicTryOn(row);
}

export async function listTryOnsPublic(sub: string): Promise<ApparelTryOn[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listTryOns(sub)
    : (tryons.get(sub) ?? []);
  const settled = await Promise.all(
    rows.map(async (r) =>
      r.status === "pending" ? ((await settleTryOn(sub, r)) ?? r) : r,
    ),
  );
  return settled.map(publicTryOn);
}

export async function getTryOnMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = isDsqlEnabled()
    ? await dsql.getTryOn(sub, id)
    : (tryons.get(sub) ?? []).find((t) => t.id === id);
  if (!row?.resultS3Key) return undefined;
  const bytes = await getObject(row.resultS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function peekSkinScans(sub: string): Promise<SkinScan[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listScans(sub)
    : (scans.get(sub) ?? []);
  return rows.map(publicScan);
}

export async function pregnancyWeek(sub: string): Promise<number | null> {
  const st = await pregnancyStatus(sub);
  return st?.week ?? null;
}

export { MIRROR_CATALOGUE };
