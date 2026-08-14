import {
  accessoryTryOnReady,
  isAccessoryJewelleryCategory,
  isNailColorHex,
  requireJewellerySkuUrl,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { deleteObject, getObject } from "../db/s3";
import {
  packYoucamIds,
  pollUntilSettled,
  requestYoucamFileDeletion,
  startAccessoryTryOn,
  startNailTryOn,
  unpackYoucamIds,
  uploadYoucamFile,
  type AccessoryCategory,
  type YoucamCapability,
} from "../lib/youcam";
import { catalogueById } from "../lib/mirrorCatalogue";
import { copyResultToS3, getStudioScanRef } from "./mirror";
import type { AccessoryLook, AccessoryLookKind } from "../types";
import * as dsql from "./dsql/accessories";

export type AccessoryLookRecord = dsql.AccessoryLookRow;

const rowsByUser = new Map<string, AccessoryLookRecord[]>();

function decodeImage(b64: string): { bytes: Buffer; contentType: string } {
  const trimmed = b64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length < 1024) throw new Error("IMAGE_TOO_SMALL");
  if (bytes.length > 6_000_000) throw new Error("IMAGE_TOO_LARGE");
  return { bytes, contentType: "image/jpeg" };
}

function publicLook(row: AccessoryLookRecord): AccessoryLook {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    catalogueItemId: row.catalogueItemId,
    accessoryCategory: row.accessoryCategory,
    hasResultImage: Boolean(row.resultS3Key) && row.status === "success",
    createdAt: row.createdAt,
  };
}

async function listRows(sub: string): Promise<AccessoryLookRecord[]> {
  if (isDsqlEnabled()) return dsql.listAccessoryLooks(sub);
  return rowsByUser.get(sub) ?? [];
}

async function getRow(
  sub: string,
  id: string,
): Promise<AccessoryLookRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getAccessoryLook(sub, id);
  return (rowsByUser.get(sub) ?? []).find((r) => r.id === id);
}

async function insertRow(row: AccessoryLookRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertAccessoryLook(row);
    return;
  }
  rowsByUser.set(row.userSub, [row, ...(rowsByUser.get(row.userSub) ?? [])]);
}

async function putRow(row: AccessoryLookRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.updateAccessoryLook(row.userSub, row.id, {
      status: row.status,
      resultS3Key: row.resultS3Key,
    });
    return;
  }
  rowsByUser.set(
    row.userSub,
    (rowsByUser.get(row.userSub) ?? []).map((r) => (r.id === row.id ? row : r)),
  );
}

function capabilityFor(
  kind: AccessoryLookKind,
  accessoryCategory: string | null,
): YoucamCapability {
  if (kind === "jewellery") {
    if (!isAccessoryJewelleryCategory(accessoryCategory ?? "")) {
      throw new Error("YOUCAM_ACCESSORY_CATEGORY_INVALID");
    }
    return `2d-vto/${accessoryCategory}` as YoucamCapability;
  }
  if (kind === "eyewear") throw new Error("YOUCAM_EYEWEAR_UNAVAILABLE");
  return "nail-vto";
}

async function resolveSrcFileId(
  sub: string,
  opts: { scanId?: string; imageB64?: string },
  uploadKind: YoucamCapability,
): Promise<string> {
  if (opts.imageB64) {
    const { bytes, contentType } = decodeImage(opts.imageB64);
    return uploadYoucamFile(uploadKind, bytes, contentType, `acc-${Date.now()}.jpg`);
  }
  if (uploadKind !== "nail-vto") {
    const scan = await getStudioScanRef(sub, opts.scanId);
    if (scan?.sourceS3Key) {
      const bytes = await getObject(scan.sourceS3Key);
      if (bytes) {
        return uploadYoucamFile(
          uploadKind,
          bytes,
          "image/jpeg",
          `acc-${Date.now()}.jpg`,
        );
      }
    }
  }
  throw new Error(
    uploadKind === "nail-vto" ? "STUDIO_HAND_REQUIRED" : "STUDIO_FACE_REQUIRED",
  );
}

async function settleLook(
  sub: string,
  row: AccessoryLookRecord,
): Promise<AccessoryLookRecord | undefined> {
  if (row.status !== "pending") return row;
  try {
    const task = await pollUntilSettled(
      capabilityFor(row.kind, row.accessoryCategory),
      row.youcamTaskId,
    );
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as const };
      await putRow(next);
      return next;
    }
    let resultKey = row.resultS3Key;
    if (task.resultUrl) {
      try {
        resultKey = `mirror/${row.id}/accessory.jpg`;
        await copyResultToS3(task.resultUrl, resultKey);
      } catch (err) {
        console.error("accessory result copy failed", err);
        resultKey = "";
      }
    }
    const next: AccessoryLookRecord = {
      ...row,
      status: "success",
      resultS3Key: resultKey,
    };
    await putRow(next);
    return next;
  } catch (err) {
    console.error("settle accessory", err);
    return row;
  }
}

export async function listAccessoryLooksForExport(
  sub: string,
): Promise<AccessoryLookRecord[]> {
  return listRows(sub);
}

export async function listAccessoryLooksPublic(sub: string): Promise<AccessoryLook[]> {
  const rows = await listRows(sub);
  const settled = await Promise.all(
    rows.map((row) =>
      row.status === "pending" ? settleLook(sub, row) : row,
    ),
  );
  return settled.filter((r): r is AccessoryLookRecord => Boolean(r)).map(publicLook);
}

export async function getAccessoryLookPublic(
  sub: string,
  id: string,
): Promise<AccessoryLook | undefined> {
  let row = await getRow(sub, id);
  if (!row) return undefined;
  if (row.status === "pending") row = (await settleLook(sub, row)) ?? row;
  return publicLook(row);
}

export async function getAccessoryLookMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getRow(sub, id);
  if (!row?.resultS3Key || row.status !== "success") return undefined;
  const bytes = await getObject(row.resultS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function createAccessoryLook(
  sub: string,
  opts: {
    kind: AccessoryLookKind;
    catalogueItemId: string;
    imageB64?: string;
    scanId?: string;
  },
): Promise<AccessoryLook> {
  const item = catalogueById(opts.catalogueItemId);
  if (!item) throw new Error("CATALOGUE_ITEM_INVALID");
  const expectedKind =
    opts.kind === "nail" ? "nail_color" : opts.kind;
  if (item.kind !== expectedKind) throw new Error("CATALOGUE_ITEM_INVALID");
  if (
    !accessoryTryOnReady({
      kind: item.kind,
      refImageUrl: item.refImageUrl,
      asset3dId: item.asset3dId,
      frameId: item.frameId,
      nailColor: item.nailColor,
    })
  ) {
    throw new Error("ACCESSORY_3D_REQUIRED");
  }

  const cap = capabilityFor(opts.kind, item.accessoryCategory ?? null);
  const fileId = await resolveSrcFileId(sub, opts, cap);
  let taskRaw: string;
  if (opts.kind === "jewellery") {
    const cat = item.accessoryCategory ?? "";
    if (!isAccessoryJewelleryCategory(cat)) {
      throw new Error("YOUCAM_ACCESSORY_CATEGORY_INVALID");
    }
    const refFileUrl = requireJewellerySkuUrl(item.refImageUrl);
    taskRaw = await startAccessoryTryOn({
      srcFileId: fileId,
      accessoryCategory: cat as AccessoryCategory,
      refFileUrl,
    });
  } else if (opts.kind === "eyewear") {
    throw new Error("YOUCAM_EYEWEAR_UNAVAILABLE");
  } else {
    const nail = item.nailColor ?? "";
    if (!isNailColorHex(nail)) throw new Error("YOUCAM_NAIL_COLOR_REQUIRED");
    taskRaw = await startNailTryOn({ srcFileId: fileId, nailColor: nail });
  }

  const packed = packYoucamIds(taskRaw, fileId);
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const row: AccessoryLookRecord = {
    id,
    userSub: sub,
    youcamTaskId: packed,
    kind: opts.kind,
    accessoryCategory: item.accessoryCategory ?? null,
    catalogueItemId: item.id,
    asset3dId: item.asset3dId ?? null,
    nailColor: item.nailColor ?? null,
    frameId: item.frameId ?? null,
    status: "pending",
    resultS3Key: "",
    createdAt,
  };
  await insertRow(row);
  const settled = await settleLook(sub, row);
  return publicLook(settled ?? row);
}

export async function purgeUserAccessories(sub: string): Promise<void> {
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
  if (isDsqlEnabled()) await dsql.purgeUserAccessories(sub);
  rowsByUser.delete(sub);
}

export async function settleAccessoryByYoucamTask(
  taskId: string,
): Promise<{ kind: "accessory"; id: string } | null> {
  if (isDsqlEnabled()) {
    const row = await dsql.findPendingAccessoryByTask(taskId);
    if (!row) return null;
    await settleLook(row.userSub, row);
    return { kind: "accessory", id: row.id };
  }
  for (const [sub, rows] of rowsByUser) {
    const row = rows.find(
      (s) =>
        s.status === "pending" &&
        unpackYoucamIds(s.youcamTaskId).taskId === taskId,
    );
    if (row) {
      await settleLook(sub, row);
      return { kind: "accessory", id: row.id };
    }
  }
  return null;
}
