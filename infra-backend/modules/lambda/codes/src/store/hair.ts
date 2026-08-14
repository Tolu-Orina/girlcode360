import {
  correlateHairAndPmos,
  parseHairAnalysisPayload,
  skinScanReusableForShade,
  type HairInsight,
  type HairScores,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { deleteObject, getObject } from "../db/s3";
import {
  packYoucamIds,
  pollTask,
  requestYoucamFileDeletion,
  startHairAnalysis,
  startHairTryOn,
  unpackYoucamIds,
  uploadYoucamFile,
} from "../lib/youcam";
import { copyResultToS3, cycleContextForScan, getStudioScanRef } from "./mirror";
import { listDays } from "./memory";
import type { HairScan, HairScanKind } from "../types";
import * as dsql from "./dsql/hair";

export type HairScanRecord = dsql.HairScanRow;

const rowsByUser = new Map<string, HairScanRecord[]>();

function decodeImage(b64: string): { bytes: Buffer; contentType: string } {
  const trimmed = b64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length < 1024) throw new Error("IMAGE_TOO_SMALL");
  if (bytes.length > 6_000_000) throw new Error("IMAGE_TOO_LARGE");
  return { bytes, contentType: "image/jpeg" };
}

async function listRows(sub: string): Promise<HairScanRecord[]> {
  if (isDsqlEnabled()) return dsql.listHairScans(sub);
  return rowsByUser.get(sub) ?? [];
}

async function getRow(sub: string, id: string): Promise<HairScanRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getHairScan(sub, id);
  return (rowsByUser.get(sub) ?? []).find((r) => r.id === id);
}

async function insertRow(row: HairScanRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertHairScan(row);
    return;
  }
  rowsByUser.set(row.userSub, [row, ...(rowsByUser.get(row.userSub) ?? [])]);
}

async function putRow(row: HairScanRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.updateHairScan(row.userSub, row.id, {
      status: row.status,
      resultS3Key: row.resultS3Key,
      scores: row.scores,
    });
    return;
  }
  rowsByUser.set(
    row.userSub,
    (rowsByUser.get(row.userSub) ?? []).map((r) => (r.id === row.id ? row : r)),
  );
}

async function insightFor(sub: string, rows: HairScanRecord[]): Promise<HairInsight> {
  const days = await listDays(sub);
  return correlateHairAndPmos(
    rows
      .filter((r) => r.status === "success")
      .map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        cyclePhase: r.cyclePhaseAtScan,
        scores: r.scores as HairScores,
        symptomIds:
          days.find((d) => d.date === r.createdAt.slice(0, 10))?.symptomIds ?? [],
        kind: r.kind,
      })),
  );
}

function publicHair(row: HairScanRecord, insight: HairInsight | null): HairScan {
  const scores = row.scores as HairScores;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt,
    cycleDayAtScan: row.cycleDayAtScan,
    cyclePhaseAtScan: row.cyclePhaseAtScan,
    scores: {
      hair_type: scores.hair_type ?? null,
      hair_length: scores.hair_length ?? null,
      hair_frizziness: scores.hair_frizziness ?? null,
      hair_density: scores.hair_density ?? null,
    },
    hairColor: row.hairColor,
    hairstyleId: row.hairstyleId,
    hasResultImage: Boolean(row.resultS3Key) && row.status === "success",
    insight: row.kind === "analysis" ? insight : null,
  };
}

async function resolveFaceFileId(
  sub: string,
  opts: { scanId?: string; imageB64?: string },
  uploadKind: "hair-analysis" | "hair-tryon",
): Promise<string> {
  const scan = await getStudioScanRef(sub, opts.scanId);
  if (scan && skinScanReusableForShade(scan.createdAt)) {
    const packed = unpackYoucamIds(scan.youcamTaskId).fileId;
    if (packed) return packed;
    if (scan.sourceS3Key) {
      const bytes = await getObject(scan.sourceS3Key);
      if (bytes) {
        return uploadYoucamFile(
          uploadKind,
          bytes,
          "image/jpeg",
          `hair-${Date.now()}.jpg`,
        );
      }
    }
  }
  if (!opts.imageB64) throw new Error("STUDIO_FACE_REQUIRED");
  const { bytes, contentType } = decodeImage(opts.imageB64);
  return uploadYoucamFile(uploadKind, bytes, contentType, `hair-${Date.now()}.jpg`);
}

async function settleHair(
  sub: string,
  row: HairScanRecord,
): Promise<HairScanRecord | undefined> {
  if (row.status !== "pending") return row;
  const capability = row.kind === "tryon" ? "hair-tryon" : "hair-analysis";
  try {
    const task = await pollTask(capability, row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as const };
      await putRow(next);
      return next;
    }
    let resultKey = row.resultS3Key;
    if (task.resultUrl) {
      try {
        resultKey = `mirror/${row.id}/hair.jpg`;
        await copyResultToS3(task.resultUrl, resultKey);
      } catch (err) {
        console.error("hair result copy failed", err);
        resultKey = "";
      }
    }
    const scores =
      row.kind === "analysis"
        ? parseHairAnalysisPayload(task.data)
        : row.scores;
    const next: HairScanRecord = {
      ...row,
      status: "success",
      resultS3Key: resultKey,
      scores,
    };
    await putRow(next);
    return next;
  } catch (err) {
    console.error("settle hair", err);
    return row;
  }
}

export async function listHairScansForExport(sub: string): Promise<HairScanRecord[]> {
  return listRows(sub);
}

export async function peekHairScans(sub: string): Promise<HairScan[]> {
  const rows = await listRows(sub);
  const insight = await insightFor(sub, rows);
  return rows.map((r) => publicHair(r, insight));
}

export async function listHairScansPublic(sub: string): Promise<HairScan[]> {
  const rows = await listRows(sub);
  const settled = await Promise.all(
    rows.map((row) =>
      row.status === "pending" ? settleHair(sub, row) : row,
    ),
  );
  const ready = settled.filter((r): r is HairScanRecord => Boolean(r));
  const insight = await insightFor(sub, ready);
  return ready.map((r) => publicHair(r, insight));
}

export async function getHairScanPublic(
  sub: string,
  id: string,
): Promise<HairScan | undefined> {
  let row = await getRow(sub, id);
  if (!row) return undefined;
  if (row.status === "pending") row = (await settleHair(sub, row)) ?? row;
  const insight = await insightFor(sub, await listRows(sub));
  return publicHair(row, insight);
}

export async function getHairScanMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getRow(sub, id);
  if (!row?.resultS3Key || row.status !== "success") return undefined;
  const bytes = await getObject(row.resultS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function createHairScan(
  sub: string,
  opts: {
    kind: HairScanKind;
    imageB64?: string;
    scanId?: string;
    hairColor?: string;
    hairstyleId?: string;
  },
): Promise<HairScan> {
  const uploadKind = opts.kind === "tryon" ? "hair-tryon" : "hair-analysis";
  const fileId = await resolveFaceFileId(sub, opts, uploadKind);
  const taskRaw =
    opts.kind === "tryon"
      ? await startHairTryOn({
          srcFileId: fileId,
          hairColor: opts.hairColor ?? "",
          hairstyleId: opts.hairstyleId,
        })
      : await startHairAnalysis(fileId);
  const packed = packYoucamIds(taskRaw, fileId);
  const createdAt = new Date().toISOString();
  const ctx = await cycleContextForScan(sub, createdAt);
  const id = crypto.randomUUID();
  const row: HairScanRecord = {
    id,
    userSub: sub,
    youcamTaskId: packed,
    kind: opts.kind,
    status: "pending",
    cycleDayAtScan: ctx.day,
    cyclePhaseAtScan: ctx.phase,
    scores: {},
    resultS3Key: "",
    hairColor: opts.hairColor?.trim() || null,
    hairstyleId: opts.hairstyleId?.trim() || null,
    createdAt,
  };
  await insertRow(row);
  const settled = await settleHair(sub, row);
  const insight = await insightFor(sub, await listRows(sub));
  return publicHair(settled ?? row, insight);
}

export async function purgeUserHair(sub: string): Promise<void> {
  const rows = await listRows(sub);
  for (const row of rows) {
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
  if (isDsqlEnabled()) await dsql.purgeUserHair(sub);
  rowsByUser.delete(sub);
}

export async function settleHairByYoucamTask(
  taskId: string,
): Promise<{ kind: "hair"; id: string } | null> {
  if (isDsqlEnabled()) {
    const row = await dsql.findPendingHairByTask(taskId);
    if (!row) return null;
    await settleHair(row.userSub, row);
    return { kind: "hair", id: row.id };
  }
  for (const [sub, rows] of rowsByUser) {
    const row = rows.find(
      (s) =>
        s.status === "pending" &&
        unpackYoucamIds(s.youcamTaskId).taskId === taskId,
    );
    if (row) {
      await settleHair(sub, row);
      return { kind: "hair", id: row.id };
    }
  }
  return null;
}
