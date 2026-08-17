import {
  assertWardrobeAllowed,
  buildPackingList,
  garmentCategoryForVto,
  isWardrobeClimate,
  parseWardrobeCategory,
  parseWardrobeColours,
  suggestDailyOutfit,
  suggestWardrobeTags,
  type WardrobeCategory,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { deleteObject, getObject, putObject } from "../db/s3";
import {
  packYoucamIds,
  pollTask,
  requestYoucamFileDeletion,
  startClothTryOn,
  unpackYoucamIds,
  uploadYoucamFile,
} from "../lib/youcam";
import { copyResultToS3 } from "./mirror";
import type {
  DailyOutfitSuggestion,
  WardrobeItem,
  WardrobeOutfit,
  WardrobePackingList,
} from "../types";
import * as dsql from "./dsql/wardrobe";

export type WardrobeItemRecord = dsql.WardrobeItemRow;
export type WardrobeOutfitRecord = dsql.WardrobeOutfitRow;

const itemsByUser = new Map<string, WardrobeItemRecord[]>();
const outfitsByUser = new Map<string, WardrobeOutfitRecord[]>();
const imageBytes = new Map<string, Buffer>();

function decodeImage(b64: string): { bytes: Buffer; contentType: string } {
  const trimmed = b64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length < 1024) throw new Error("IMAGE_TOO_SMALL");
  if (bytes.length > 6_000_000) throw new Error("IMAGE_TOO_LARGE");
  return { bytes, contentType: "image/jpeg" };
}

function publicItem(row: WardrobeItemRecord): WardrobeItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    colourTags: row.colourTags,
    suggestedColourTags: row.tagSuggestions.colourTags,
    suggestedCategory: row.tagSuggestions.category,
    purchasePriceMinor: row.purchasePriceMinor,
    wornCount: row.wornCount,
    archived: row.archived,
    hasImage: Boolean(row.imageS3Key),
    createdAt: row.createdAt,
  };
}

function publicOutfit(row: WardrobeOutfitRecord): WardrobeOutfit {
  return {
    id: row.id,
    itemIds: row.itemIds,
    occasion: row.occasion,
    wornOn: row.wornOn,
    status: row.status,
    hasResultImage: Boolean(row.tryonResultS3Key) && row.status === "success",
    createdAt: row.createdAt,
  };
}

async function listItemRows(sub: string): Promise<WardrobeItemRecord[]> {
  if (isDsqlEnabled()) return dsql.listWardrobeItems(sub);
  return itemsByUser.get(sub) ?? [];
}

async function getItemRow(
  sub: string,
  id: string,
): Promise<WardrobeItemRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getWardrobeItem(sub, id);
  return (itemsByUser.get(sub) ?? []).find((r) => r.id === id);
}

async function insertItem(row: WardrobeItemRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertWardrobeItem(row);
    return;
  }
  itemsByUser.set(row.userSub, [row, ...(itemsByUser.get(row.userSub) ?? [])]);
}

async function putItem(row: WardrobeItemRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.updateWardrobeItem(row.userSub, row.id, {
      name: row.name,
      category: row.category,
      colourTags: row.colourTags,
      purchasePriceMinor: row.purchasePriceMinor,
      youcamFileId: row.youcamFileId,
      wornCount: row.wornCount,
      archived: row.archived,
    });
    return;
  }
  itemsByUser.set(
    row.userSub,
    (itemsByUser.get(row.userSub) ?? []).map((r) => (r.id === row.id ? row : r)),
  );
}

async function listOutfitRows(sub: string): Promise<WardrobeOutfitRecord[]> {
  if (isDsqlEnabled()) return dsql.listWardrobeOutfits(sub);
  return outfitsByUser.get(sub) ?? [];
}

async function getOutfitRow(
  sub: string,
  id: string,
): Promise<WardrobeOutfitRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getWardrobeOutfit(sub, id);
  return (outfitsByUser.get(sub) ?? []).find((r) => r.id === id);
}

async function insertOutfit(row: WardrobeOutfitRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.insertWardrobeOutfit(row);
    return;
  }
  outfitsByUser.set(row.userSub, [row, ...(outfitsByUser.get(row.userSub) ?? [])]);
}

async function putOutfit(row: WardrobeOutfitRecord): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.updateWardrobeOutfit(row.userSub, row.id, {
      wornOn: row.wornOn,
      status: row.status,
      youcamTaskId: row.youcamTaskId,
      tryonResultS3Key: row.tryonResultS3Key,
    });
    return;
  }
  outfitsByUser.set(
    row.userSub,
    (outfitsByUser.get(row.userSub) ?? []).map((r) => (r.id === row.id ? row : r)),
  );
}

async function persistGarment(
  id: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const key = `wardrobe/${id}/garment.jpg`;
  try {
    await putObject(key, bytes, contentType);
  } catch {
    imageBytes.set(id, bytes);
  }
  return key;
}

export async function listWardrobeItemsPublic(sub: string): Promise<WardrobeItem[]> {
  return (await listItemRows(sub)).filter((r) => !r.archived).map(publicItem);
}

export async function listWardrobeItemsForExport(
  sub: string,
): Promise<WardrobeItemRecord[]> {
  return listItemRows(sub);
}

export async function getWardrobeItemRecord(
  sub: string,
  id: string,
): Promise<WardrobeItemRecord | undefined> {
  return getItemRow(sub, id);
}

export async function getWardrobeItemPublic(
  sub: string,
  id: string,
): Promise<WardrobeItem | undefined> {
  const row = await getItemRow(sub, id);
  return row ? publicItem(row) : undefined;
}

export async function getWardrobeItemMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getItemRow(sub, id);
  if (!row) return undefined;
  const mem = imageBytes.get(id);
  if (mem) return { contentType: "image/jpeg", bytes: mem };
  const bytes = await getObject(row.imageS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function createWardrobeItem(
  sub: string,
  opts: {
    imageB64: string;
    name?: string;
    category?: string;
    colourTags?: string[];
    sampleHexes?: string[];
    purchasePriceMinor?: number | null;
  },
): Promise<WardrobeItem> {
  const label = `${opts.name ?? ""} ${opts.category ?? ""}`;
  assertWardrobeAllowed(label);
  const suggested = suggestWardrobeTags({
    sampleHexes: opts.sampleHexes,
    label: opts.category || opts.name,
  });
  if (suggested.banned) throw new Error("WARDROBE_CATEGORY_BANNED");
  const category =
    parseWardrobeCategory(opts.category ?? "") ?? suggested.category;
  if (category) assertWardrobeAllowed(category);
  const colourTags =
    parseWardrobeColours(opts.colourTags).length > 0
      ? parseWardrobeColours(opts.colourTags)
      : suggested.colourTags;
  const { bytes, contentType } = decodeImage(opts.imageB64);
  const id = crypto.randomUUID();
  const imageS3Key = await persistGarment(id, bytes, contentType);
  let youcamFileId: string | null = null;
  try {
    youcamFileId = await uploadYoucamFile(
      "cloth-v3",
      bytes,
      contentType,
      `wardrobe-${Date.now()}.jpg`,
    );
  } catch {
    youcamFileId = null;
  }
  const row: WardrobeItemRecord = {
    id,
    userSub: sub,
    name: opts.name?.trim() || null,
    category,
    colourTags,
    tagSuggestions: {
      category: suggested.category,
      colourTags: suggested.colourTags,
    },
    purchasePriceMinor:
      typeof opts.purchasePriceMinor === "number"
        ? Math.max(0, Math.round(opts.purchasePriceMinor))
        : null,
    imageS3Key,
    youcamFileId,
    wornCount: 0,
    archived: false,
    createdAt: new Date().toISOString(),
  };
  await insertItem(row);
  return publicItem(row);
}

export async function patchWardrobeItem(
  sub: string,
  id: string,
  patch: {
    name?: string | null;
    category?: string;
    colourTags?: string[];
    purchasePriceMinor?: number | null;
    archived?: boolean;
  },
): Promise<WardrobeItem | undefined> {
  const row = await getItemRow(sub, id);
  if (!row) return undefined;
  if (patch.category) assertWardrobeAllowed(patch.category);
  if (patch.name) assertWardrobeAllowed(patch.name);
  const next: WardrobeItemRecord = {
    ...row,
    name: patch.name !== undefined ? patch.name : row.name,
    category:
      patch.category !== undefined
        ? parseWardrobeCategory(patch.category)
        : row.category,
    colourTags:
      patch.colourTags !== undefined
        ? parseWardrobeColours(patch.colourTags)
        : row.colourTags,
    purchasePriceMinor:
      patch.purchasePriceMinor !== undefined
        ? patch.purchasePriceMinor
        : row.purchasePriceMinor,
    archived: patch.archived ?? row.archived,
  };
  await putItem(next);
  return publicItem(next);
}

export async function deleteWardrobeItem(sub: string, id: string): Promise<boolean> {
  const row = await getItemRow(sub, id);
  if (!row) return false;
  if (row.youcamFileId) await requestYoucamFileDeletion(row.youcamFileId);
  if (row.imageS3Key) {
    try {
      await deleteObject(row.imageS3Key);
    } catch {
      /* best-effort */
    }
  }
  imageBytes.delete(id);
  if (isDsqlEnabled()) return dsql.softDeleteWardrobeItem(sub, id);
  itemsByUser.set(
    sub,
    (itemsByUser.get(sub) ?? []).filter((r) => r.id !== id),
  );
  return true;
}

export async function listWardrobeOutfitsPublic(
  sub: string,
): Promise<WardrobeOutfit[]> {
  const rows = await listOutfitRows(sub);
  const settled = await Promise.all(
    rows.map((row) =>
      row.status === "pending" ? settleOutfitTryOn(sub, row) : row,
    ),
  );
  return settled
    .filter((r): r is WardrobeOutfitRecord => Boolean(r))
    .map(publicOutfit);
}

export async function listWardrobeOutfitsForExport(
  sub: string,
): Promise<WardrobeOutfitRecord[]> {
  return listOutfitRows(sub);
}

export async function createWardrobeOutfit(
  sub: string,
  opts: { itemIds: string[]; occasion?: string },
): Promise<WardrobeOutfit> {
  const ids = [...new Set(opts.itemIds.filter(Boolean))].slice(0, 6);
  if (!ids.length) throw new Error("WARDROBE_ITEMS_REQUIRED");
  const owned = await listItemRows(sub);
  for (const id of ids) {
    const row = owned.find((r) => r.id === id && !r.archived);
    if (!row) throw new Error("WARDROBE_ITEM_NOT_FOUND");
    assertWardrobeAllowed(`${row.category ?? ""} ${row.name ?? ""}`);
  }
  const created: WardrobeOutfitRecord = {
    id: crypto.randomUUID(),
    userSub: sub,
    itemIds: ids,
    occasion: opts.occasion?.trim() || null,
    wornOn: null,
    status: "ready",
    youcamTaskId: null,
    tryonResultS3Key: null,
    createdAt: new Date().toISOString(),
  };
  await insertOutfit(created);
  return publicOutfit(created);
}

export async function markOutfitWorn(
  sub: string,
  id: string,
  wornOn: string,
): Promise<WardrobeOutfit | undefined> {
  const row = await getOutfitRow(sub, id);
  if (!row) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wornOn)) throw new Error("WARDROBE_DATE_INVALID");
  if (row.wornOn === wornOn) return publicOutfit(row);
  const next = { ...row, wornOn };
  await putOutfit(next);
  if (!row.wornOn) {
    for (const itemId of row.itemIds) {
      const item = await getItemRow(sub, itemId);
      if (!item) continue;
      await putItem({ ...item, wornCount: item.wornCount + 1 });
    }
  }
  return publicOutfit(next);
}

async function ensureGarmentFileId(row: WardrobeItemRecord): Promise<string> {
  if (row.youcamFileId) return row.youcamFileId;
  const media = await getWardrobeItemMedia(row.userSub, row.id);
  if (!media) throw new Error("WARDROBE_IMAGE_MISSING");
  const fileId = await uploadYoucamFile(
    "cloth-v3",
    media.bytes,
    media.contentType,
    `wardrobe-${Date.now()}.jpg`,
  );
  await putItem({ ...row, youcamFileId: fileId });
  return fileId;
}

export async function startWardrobeOutfitTryOn(
  sub: string,
  outfitId: string,
  imageB64: string,
): Promise<WardrobeOutfit> {
  const outfit = await getOutfitRow(sub, outfitId);
  if (!outfit) throw new Error("WARDROBE_OUTFIT_NOT_FOUND");
  const items = await Promise.all(outfit.itemIds.map((id) => getItemRow(sub, id)));
  const garments = items.filter((r): r is WardrobeItemRecord => Boolean(r));
  const primary =
    garments.find((g) => g.category === "one_piece") ??
    garments.find((g) => g.category === "top" || g.category === "outerwear") ??
    garments.find((g) => g.category === "bottom");
  if (!primary) throw new Error("WARDROBE_VTO_UNSUPPORTED");
  const garmentCategory = garmentCategoryForVto(
    primary.category as WardrobeCategory | null,
  );
  const { bytes, contentType } = decodeImage(imageB64);
  const srcId = await uploadYoucamFile(
    "cloth-v3",
    bytes,
    contentType,
    `body-${Date.now()}.jpg`,
  );
  const refId = await ensureGarmentFileId(primary);
  const taskRaw = await startClothTryOn({
    srcFileId: srcId,
    refFileId: refId,
    garmentCategory,
  });
  const next: WardrobeOutfitRecord = {
    ...outfit,
    status: "pending",
    youcamTaskId: packYoucamIds(taskRaw, srcId),
  };
  await putOutfit(next);
  return publicOutfit(next);
}

async function settleOutfitTryOn(
  sub: string,
  row: WardrobeOutfitRecord,
): Promise<WardrobeOutfitRecord | undefined> {
  if (row.status !== "pending" || !row.youcamTaskId) return row;
  try {
    const task = await pollTask("cloth-v3", row.youcamTaskId);
    if (task.status === "running") return row;
    if (task.status === "error") {
      const next = { ...row, status: "error" as const };
      await putOutfit(next);
      return next;
    }
    let resultKey = row.tryonResultS3Key;
    if (task.resultUrl) {
      try {
        resultKey = `wardrobe/${row.id}/tryon.jpg`;
        await copyResultToS3(task.resultUrl, resultKey);
      } catch (err) {
        console.error("wardrobe tryon copy failed", err);
        resultKey = null;
      }
    }
    const next: WardrobeOutfitRecord = {
      ...row,
      status: "success",
      tryonResultS3Key: resultKey,
    };
    await putOutfit(next);
    return next;
  } catch (err) {
    console.error("settle wardrobe tryon", err);
    return row;
  }
}

export async function getWardrobeOutfitPublic(
  sub: string,
  id: string,
): Promise<WardrobeOutfit | undefined> {
  let row = await getOutfitRow(sub, id);
  if (!row) return undefined;
  if (row.status === "pending") row = (await settleOutfitTryOn(sub, row)) ?? row;
  return publicOutfit(row);
}

export async function getWardrobeOutfitMedia(
  sub: string,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getOutfitRow(sub, id);
  if (!row?.tryonResultS3Key || row.status !== "success") return undefined;
  const bytes = await getObject(row.tryonResultS3Key);
  if (!bytes) return undefined;
  return { contentType: "image/jpeg", bytes };
}

export async function packingListForUser(
  sub: string,
  opts: { nights: number; climate: string },
): Promise<WardrobePackingList> {
  if (!isWardrobeClimate(opts.climate)) throw new Error("WARDROBE_CLIMATE_INVALID");
  const rows = await listItemRows(sub);
  return buildPackingList(
    rows.map((r) => ({
      id: r.id,
      category: r.category as WardrobeCategory | null,
      name: r.name,
      colourTags: r.colourTags,
      wornCount: r.wornCount,
      archived: r.archived,
    })),
    { nights: opts.nights, climate: opts.climate },
  );
}

export async function suggestOutfitForToday(
  sub: string,
  opts: { climate: string; climateSource: "session" | "market_default" },
): Promise<{
  suggestion: DailyOutfitSuggestion;
  outfit: WardrobeOutfit | null;
}> {
  if (!isWardrobeClimate(opts.climate)) throw new Error("WARDROBE_CLIMATE_INVALID");
  const rows = await listItemRows(sub);
  const suggestion = suggestDailyOutfit(
    rows.map((r) => ({
      id: r.id,
      category: r.category as WardrobeCategory | null,
      name: r.name,
      colourTags: r.colourTags,
      wornCount: r.wornCount,
      archived: r.archived,
    })),
    { climate: opts.climate },
  );
  const wrapped: DailyOutfitSuggestion = {
    ...suggestion,
    climate: opts.climate,
    climateSource: opts.climateSource,
  };
  if (!suggestion.enoughItems) {
    return { suggestion: wrapped, outfit: null };
  }
  const outfit = await createWardrobeOutfit(sub, {
    itemIds: suggestion.itemIds,
    occasion: "today",
  });
  return { suggestion: wrapped, outfit };
}

export async function purgeUserWardrobe(sub: string): Promise<void> {
  const items = await listItemRows(sub);
  for (const row of items) {
    if (row.youcamFileId) await requestYoucamFileDeletion(row.youcamFileId);
    if (row.imageS3Key) {
      try {
        await deleteObject(row.imageS3Key);
      } catch {
        /* best-effort */
      }
    }
    imageBytes.delete(row.id);
  }
  const outfits = await listOutfitRows(sub);
  for (const row of outfits) {
    if (row.tryonResultS3Key) {
      try {
        await deleteObject(row.tryonResultS3Key);
      } catch {
        /* best-effort */
      }
    }
  }
  if (isDsqlEnabled()) await dsql.purgeUserWardrobe(sub);
  itemsByUser.delete(sub);
  outfitsByUser.delete(sub);
}

export async function settleWardrobeByYoucamTask(
  taskId: string,
): Promise<{ kind: "wardrobe"; id: string } | null> {
  if (isDsqlEnabled()) {
    const row = await dsql.findPendingOutfitByTask(taskId);
    if (!row) return null;
    await settleOutfitTryOn(row.userSub, row);
    return { kind: "wardrobe", id: row.id };
  }
  for (const [sub, rows] of outfitsByUser) {
    const row = rows.find(
      (s) =>
        s.status === "pending" &&
        s.youcamTaskId &&
        unpackYoucamIds(s.youcamTaskId).taskId === taskId,
    );
    if (row) {
      await settleOutfitTryOn(sub, row);
      return { kind: "wardrobe", id: row.id };
    }
  }
  return null;
}
