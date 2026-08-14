import {
  matchShadeTwins,
  parseFoundationFamily,
  parseMakeupCategories,
  parseMakeupPalettes,
  skinScanReusableForShade,
  type ShadeCatalogueEntry,
  type StudioMakeupCategory,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { deleteObject, getObject } from "../db/s3";
import { MIRROR_CATALOGUE } from "../lib/mirrorCatalogue";
import {
  packYoucamIds,
  pollTask,
  pollUntilSettled,
  requestYoucamFileDeletion,
  startMakeupTransfer,
  startMakeupVto,
  startShadeFinder,
  type YoucamCapability,
  unpackYoucamIds,
  uploadYoucamFile,
} from "../lib/youcam";
import { copyResultToS3, getStudioScanRef } from "./mirror";
import type { MakeupLook, ShadeMatch } from "../types";
import * as dsql from "./dsql/studio";

export type MakeupLookRecord = dsql.MakeupLookRow;
export type ShadeMatchRecord = dsql.ShadeMatchRow;

const looks = new Map<string, MakeupLookRecord[]>();
const shades = new Map<string, ShadeMatchRecord[]>();

function decodeImage(b64: string): { bytes: Buffer; contentType: string } {
  const trimmed = b64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length < 1024) throw new Error("IMAGE_TOO_SMALL");
  if (bytes.length > 6_000_000) throw new Error("IMAGE_TOO_LARGE");
  return { bytes, contentType: "image/jpeg" };
}

function publicLook(row: MakeupLookRecord): MakeupLook {
  return {
    id: row.id,
    status: row.status,
    sourceKind: row.sourceKind,
    categories: row.categories,
    saved: row.saved,
    hasResultImage: Boolean(row.resultS3Key) && row.status === "success",
    createdAt: row.createdAt,
  };
}

function shadeCatalogue(): ShadeCatalogueEntry[] {
  const out: ShadeCatalogueEntry[] = [];
  for (const i of MIRROR_CATALOGUE) {
    if (i.kind !== "makeup" || !i.brandCode || !i.shadeCode) continue;
    const family = parseFoundationFamily(i.shadeFamily);
    if (!family) continue;
    out.push({
      id: i.id,
      brandCode: i.brandCode,
      shadeCode: i.shadeCode,
      family,
      boutiqueName: i.boutiqueName,
      boutiqueArea: i.boutiqueArea,
    });
  }
  return out;
}

function publicShade(row: ShadeMatchRecord): ShadeMatch {
  const parsed = matchShadeTwins(row.matches, shadeCatalogue());
  return {
    id: row.id,
    sourceScanId: row.sourceScanId,
    fitzpatrickType: row.fitzpatrickType,
    wellnessNote: parsed.wellnessNote,
    overallConfidence: parsed.overallConfidence,
    twins: parsed.twins.map((t) => ({
      catalogueId: t.id,
      brandCode: t.brandCode,
      shadeCode: t.shadeCode,
      family: t.family,
      boutiqueName: t.boutiqueName,
      boutiqueArea: t.boutiqueArea,
      confidence: t.confidence,
    })),
    createdAt: row.createdAt,
  };
}

async function getLookRow(
  sub: string,
  id: string,
): Promise<MakeupLookRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getMakeupLook(sub, id);
  return (looks.get(sub) ?? []).find((r) => r.id === id);
}

async function putLook(row: MakeupLookRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.updateMakeupLook(row.userSub, row.id, {
      status: row.status,
      resultS3Key: row.resultS3Key,
      saved: row.saved,
    });
    return;
  }
  looks.set(
    row.userSub,
    (looks.get(row.userSub) ?? []).map((r) => (r.id === row.id ? row : r)),
  );
}

export async function insertMakeupLook(row: MakeupLookRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertMakeupLook(row);
    return;
  }
  looks.set(row.userSub, [row, ...(looks.get(row.userSub) ?? [])]);
}

export async function insertShadeMatch(row: ShadeMatchRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertShadeMatch(row);
    return;
  }
  shades.set(row.userSub, [row, ...(shades.get(row.userSub) ?? [])]);
}

export async function listMakeupLooksForExport(
  sub: string,
): Promise<MakeupLookRecord[]> {
  if (isDsqlEnabled()) return dsql.listMakeupLooks(sub);
  return looks.get(sub) ?? [];
}

export async function listShadeMatchesForExport(
  sub: string,
): Promise<ShadeMatchRecord[]> {
  if (isDsqlEnabled()) return dsql.listShadeMatches(sub);
  return shades.get(sub) ?? [];
}

export async function listMakeupLooksPublic(sub: string): Promise<MakeupLook[]> {
  const rows = await listMakeupLooksForExport(sub);
  const settled = await Promise.all(
    rows.map((row) =>
      row.status === "pending" ? settleMakeupLook(sub, row) : row,
    ),
  );
  return settled.filter(Boolean).map((r) => publicLook(r!));
}

export async function getMakeupLookPublic(
  sub: string,
  id: string,
): Promise<MakeupLook | undefined> {
  let row = await getLookRow(sub, id);
  if (!row) return undefined;
  if (row.status === "pending") row = (await settleMakeupLook(sub, row)) ?? row;
  return publicLook(row);
}

export async function getMakeupLookMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getLookRow(sub, id);
  if (!row?.resultS3Key || row.status !== "success") return undefined;
  const bytes = await getObject(row.resultS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function saveMakeupLook(
  sub: string,
  id: string,
  saved: boolean,
): Promise<MakeupLook | undefined> {
  const row = await getLookRow(sub, id);
  if (!row) return undefined;
  const next = { ...row, saved };
  await putLook(next);
  return publicLook(next);
}

export async function deleteMakeupLook(sub: string, id: string): Promise<boolean> {
  const row = await getLookRow(sub, id);
  if (!row) return false;
  const fileId = unpackYoucamIds(row.youcamTaskId).fileId;
  if (fileId) await requestYoucamFileDeletion(fileId);
  if (row.resultS3Key) {
    try {
      await deleteObject(row.resultS3Key);
    } catch {
      /* best-effort */
    }
  }
  if (isDsqlEnabled()) return dsql.softDeleteMakeupLook(sub, id);
  looks.set(
    sub,
    (looks.get(sub) ?? []).filter((r) => r.id !== id),
  );
  return true;
}

async function settleMakeupLook(
  sub: string,
  row: MakeupLookRecord,
): Promise<MakeupLookRecord | undefined> {
  if (row.status !== "pending") return row;
  try {
    const task = await pollUntilSettled(makeupCapability(row.sourceKind), row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as const };
      await putLook(next);
      return next;
    }
    let resultKey = row.resultS3Key;
    if (task.resultUrl) {
      try {
        resultKey = `mirror/${row.id}/makeup.jpg`;
        await copyResultToS3(task.resultUrl, resultKey);
      } catch (err) {
        console.error("makeup result copy failed", err);
        resultKey = "";
      }
    }
    const next: MakeupLookRecord = {
      ...row,
      status: "success",
      resultS3Key: resultKey,
    };
    await putLook(next);
    return next;
  } catch (err) {
    console.error("settle makeup", err);
    return row;
  }
}

function makeupCapability(kind: "live" | "photo" | "transfer"): YoucamCapability {
  return kind === "transfer" ? "mu-transfer" : "makeup-vto";
}

async function resolveFaceFileId(
  sub: string,
  opts: { scanId?: string; imageB64?: string; uploadKind: YoucamCapability },
): Promise<{ fileId: string; scanId: string | null }> {
  const scan = await getStudioScanRef(sub, opts.scanId);
  if (opts.imageB64) {
    const { bytes, contentType } = decodeImage(opts.imageB64);
    const fileId = await uploadYoucamFile(
      opts.uploadKind,
      bytes,
      contentType,
      `studio-${Date.now()}.jpg`,
    );
    return { fileId, scanId: scan?.id ?? null };
  }
  // Skin-analysis file_ids are not valid for makeup-vto / mu-transfer.
  if (scan && skinScanReusableForShade(scan.createdAt) && scan.sourceS3Key) {
    const bytes = await getObject(scan.sourceS3Key);
    if (bytes) {
      const fileId = await uploadYoucamFile(
        opts.uploadKind,
        bytes,
        "image/jpeg",
        `studio-${Date.now()}.jpg`,
      );
      return { fileId, scanId: scan.id };
    }
  }
  throw new Error("STUDIO_FACE_REQUIRED");
}

export async function createMakeupLook(
  sub: string,
  opts: {
    sourceKind: "live" | "photo" | "transfer";
    imageB64?: string;
    scanId?: string;
    referenceB64?: string;
    categories?: unknown;
    palettes?: unknown;
  },
): Promise<MakeupLook> {
  const categories = parseMakeupCategories(opts.categories) as StudioMakeupCategory[];
  const palettes = parseMakeupPalettes(opts.palettes);
  const uploadKind = makeupCapability(opts.sourceKind);
  const face = await resolveFaceFileId(sub, {
    scanId: opts.scanId,
    imageB64: opts.imageB64,
    uploadKind,
  });
  let vendorTaskId: string;
  if (opts.sourceKind === "transfer") {
    if (!opts.referenceB64) throw new Error("STUDIO_REFERENCE_REQUIRED");
    const ref = decodeImage(opts.referenceB64);
    const referenceFileId = await uploadYoucamFile(
      "mu-transfer",
      ref.bytes,
      ref.contentType,
      `look-ref-${Date.now()}.jpg`,
    );
    vendorTaskId = await startMakeupTransfer({
      srcFileId: face.fileId,
      referenceFileId,
    });
  } else {
    vendorTaskId = await startMakeupVto({
      srcFileId: face.fileId,
      makeupCategories: categories,
      palettes,
    });
  }
  const taskId = packYoucamIds(vendorTaskId, face.fileId);
  const id = crypto.randomUUID();
  const row: MakeupLookRecord = {
    id,
    userSub: sub,
    youcamTaskId: taskId,
    categories,
    sourceKind: opts.sourceKind,
    status: "pending",
    resultS3Key: "",
    saved: false,
    createdAt: new Date().toISOString(),
  };
  await insertMakeupLook(row);
  const settled = await settleMakeupLook(sub, row);
  return publicLook(settled ?? row);
}

export async function createShadeMatch(
  sub: string,
  opts: { scanId?: string; imageB64?: string },
): Promise<ShadeMatch> {
  const scan = await getStudioScanRef(sub, opts.scanId);
  if (!scan || !skinScanReusableForShade(scan.createdAt)) {
    throw new Error("STUDIO_SCAN_REQUIRED");
  }
  let fileId: string | null = null;
  if (scan.sourceS3Key) {
    const bytes = await getObject(scan.sourceS3Key);
    if (bytes) {
      fileId = await uploadYoucamFile(
        "shade-finder",
        bytes,
        "image/jpeg",
        `shade-${Date.now()}.jpg`,
      );
    }
  }
  if (!fileId && opts.imageB64) {
    const img = decodeImage(opts.imageB64);
    fileId = await uploadYoucamFile(
      "shade-finder",
      img.bytes,
      img.contentType,
      `shade-${Date.now()}.jpg`,
    );
  }
  if (!fileId) throw new Error("STUDIO_SCAN_REQUIRED");
  const brands = [...new Set(shadeCatalogue().map((c) => c.brandCode))];
  const taskId = await startShadeFinder({
    srcFileId: fileId,
    brandFilter: brands,
  });
  const packed = packYoucamIds(taskId, fileId);
  let polled = await pollTask("shade-finder", packed);
  for (let i = 0; i < 8 && polled.status === "running"; i++) {
    await new Promise((r) => setTimeout(r, 400));
    polled = await pollTask("shade-finder", packed);
  }
  if (polled.status !== "success") {
    throw new Error("STUDIO_SHADE_PENDING");
  }
  const payload = polled.data;
  const scored = matchShadeTwins(payload, shadeCatalogue());
  const id = crypto.randomUUID();
  const row: ShadeMatchRecord = {
    id,
    userSub: sub,
    sourceScanId: scan.id,
    fitzpatrickType: scored.fitzpatrick,
    matches: payload,
    createdAt: new Date().toISOString(),
  };
  await insertShadeMatch(row);
  return publicShade(row);
}

export async function listShadeMatchesPublic(sub: string): Promise<ShadeMatch[]> {
  const rows = await listShadeMatchesForExport(sub);
  return rows.map(publicShade);
}

export async function purgeUserStudio(sub: string): Promise<void> {
  const lookRows = await listMakeupLooksForExport(sub);
  for (const row of lookRows) {
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
  if (isDsqlEnabled()) await dsql.purgeUserStudio(sub);
  looks.delete(sub);
  shades.delete(sub);
}

export async function settleMakeupByYoucamTask(
  taskId: string,
): Promise<{ kind: "makeup"; id: string } | null> {
  if (isDsqlEnabled()) {
    const row = await dsql.findPendingMakeupByTask(taskId);
    if (!row) return null;
    await settleMakeupLook(row.userSub, row);
    return { kind: "makeup", id: row.id };
  }
  for (const [sub, rows] of looks) {
    const row = rows.find(
      (s) =>
        s.status === "pending" &&
        unpackYoucamIds(s.youcamTaskId).taskId === taskId,
    );
    if (row) {
      await settleMakeupLook(sub, row);
      return { kind: "makeup", id: row.id };
    }
  }
  return null;
}
