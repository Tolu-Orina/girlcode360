import { query, toIso } from "../../db/client";
import type { MirrorTaskStatus } from "../../types";

export type WardrobeItemRow = {
  id: string;
  userSub: string;
  name: string | null;
  category: string | null;
  colourTags: string[];
  tagSuggestions: { category: string | null; colourTags: string[] };
  purchasePriceMinor: number | null;
  imageS3Key: string;
  youcamFileId: string | null;
  wornCount: number;
  archived: boolean;
  createdAt: string;
};

export type WardrobeOutfitRow = {
  id: string;
  userSub: string;
  itemIds: string[];
  occasion: string | null;
  wornOn: string | null;
  status: MirrorTaskStatus | "ready";
  youcamTaskId: string | null;
  tryonResultS3Key: string | null;
  createdAt: string;
};

type ItemDb = {
  id: string;
  user_sub: string;
  name: string | null;
  category: string | null;
  colour_tags: string;
  tag_suggestions: string;
  purchase_price_minor: number | null;
  image_s3_key: string;
  youcam_file_id: string | null;
  worn_count: number;
  archived: boolean;
  created_at: unknown;
};

type OutfitDb = {
  id: string;
  user_sub: string;
  item_ids: string;
  occasion: string | null;
  worn_on: string | null;
  status: string;
  youcam_task_id: string | null;
  tryon_result_s3_key: string | null;
  created_at: unknown;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapItem(r: ItemDb): WardrobeItemRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    name: r.name,
    category: r.category,
    colourTags: parseJson<string[]>(r.colour_tags, []),
    tagSuggestions: parseJson(r.tag_suggestions, {
      category: null,
      colourTags: [] as string[],
    }),
    purchasePriceMinor: r.purchase_price_minor,
    imageS3Key: r.image_s3_key,
    youcamFileId: r.youcam_file_id,
    wornCount: r.worn_count ?? 0,
    archived: Boolean(r.archived),
    createdAt: toIso(r.created_at),
  };
}

function mapOutfit(r: OutfitDb): WardrobeOutfitRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    itemIds: parseJson<string[]>(r.item_ids, []),
    occasion: r.occasion,
    wornOn: r.worn_on,
    status: (r.status as WardrobeOutfitRow["status"]) || "ready",
    youcamTaskId: r.youcam_task_id,
    tryonResultS3Key: r.tryon_result_s3_key,
    createdAt: toIso(r.created_at),
  };
}

export async function insertWardrobeItem(row: WardrobeItemRow): Promise<void> {
  await query(
    `INSERT INTO wardrobe_items
      (id, user_sub, name, category, colour_tags, tag_suggestions, purchase_price_minor,
       image_s3_key, youcam_file_id, worn_count, archived, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.name,
      row.category,
      JSON.stringify(row.colourTags),
      JSON.stringify(row.tagSuggestions),
      row.purchasePriceMinor,
      row.imageS3Key,
      row.youcamFileId,
      row.wornCount,
      row.archived,
      row.createdAt,
    ],
  );
}

export async function getWardrobeItem(
  userSub: string,
  id: string,
): Promise<WardrobeItemRow | undefined> {
  const res = await query<ItemDb>(
    `SELECT * FROM wardrobe_items WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapItem(row) : undefined;
}

export async function updateWardrobeItem(
  userSub: string,
  id: string,
  patch: Partial<{
    name: string | null;
    category: string | null;
    colourTags: string[];
    purchasePriceMinor: number | null;
    youcamFileId: string | null;
    wornCount: number;
    archived: boolean;
  }>,
): Promise<WardrobeItemRow | undefined> {
  const cur = await getWardrobeItem(userSub, id);
  if (!cur) return undefined;
  const next = {
    name: patch.name !== undefined ? patch.name : cur.name,
    category: patch.category !== undefined ? patch.category : cur.category,
    colourTags: patch.colourTags ?? cur.colourTags,
    purchasePriceMinor:
      patch.purchasePriceMinor !== undefined
        ? patch.purchasePriceMinor
        : cur.purchasePriceMinor,
    youcamFileId:
      patch.youcamFileId !== undefined ? patch.youcamFileId : cur.youcamFileId,
    wornCount: patch.wornCount ?? cur.wornCount,
    archived: patch.archived ?? cur.archived,
  };
  await query(
    `UPDATE wardrobe_items SET name = $3, category = $4, colour_tags = $5,
       purchase_price_minor = $6, youcam_file_id = $7, worn_count = $8, archived = $9
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      next.name,
      next.category,
      JSON.stringify(next.colourTags),
      next.purchasePriceMinor,
      next.youcamFileId,
      next.wornCount,
      next.archived,
    ],
  );
  return getWardrobeItem(userSub, id);
}

export async function listWardrobeItems(userSub: string): Promise<WardrobeItemRow[]> {
  const res = await query<ItemDb>(
    `SELECT * FROM wardrobe_items WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapItem);
}

export async function softDeleteWardrobeItem(userSub: string, id: string): Promise<boolean> {
  const res = await query(
    `UPDATE wardrobe_items SET deleted_at = NOW() WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function insertWardrobeOutfit(row: WardrobeOutfitRow): Promise<void> {
  await query(
    `INSERT INTO wardrobe_outfits
      (id, user_sub, item_ids, occasion, worn_on, status, youcam_task_id, tryon_result_s3_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
    [
      row.id,
      row.userSub,
      JSON.stringify(row.itemIds),
      row.occasion,
      row.wornOn,
      row.status,
      row.youcamTaskId,
      row.tryonResultS3Key,
      row.createdAt,
    ],
  );
}

export async function getWardrobeOutfit(
  userSub: string,
  id: string,
): Promise<WardrobeOutfitRow | undefined> {
  const res = await query<OutfitDb>(
    `SELECT * FROM wardrobe_outfits WHERE id = $1 AND user_sub = $2`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapOutfit(row) : undefined;
}

export async function updateWardrobeOutfit(
  userSub: string,
  id: string,
  patch: Partial<{
    wornOn: string | null;
    status: WardrobeOutfitRow["status"];
    youcamTaskId: string | null;
    tryonResultS3Key: string | null;
  }>,
): Promise<WardrobeOutfitRow | undefined> {
  const cur = await getWardrobeOutfit(userSub, id);
  if (!cur) return undefined;
  await query(
    `UPDATE wardrobe_outfits SET worn_on = $3, status = $4, youcam_task_id = $5, tryon_result_s3_key = $6
     WHERE id = $1 AND user_sub = $2`,
    [
      id,
      userSub,
      patch.wornOn !== undefined ? patch.wornOn : cur.wornOn,
      patch.status ?? cur.status,
      patch.youcamTaskId !== undefined ? patch.youcamTaskId : cur.youcamTaskId,
      patch.tryonResultS3Key !== undefined
        ? patch.tryonResultS3Key
        : cur.tryonResultS3Key,
    ],
  );
  return getWardrobeOutfit(userSub, id);
}

export async function listWardrobeOutfits(
  userSub: string,
): Promise<WardrobeOutfitRow[]> {
  const res = await query<OutfitDb>(
    `SELECT * FROM wardrobe_outfits WHERE user_sub = $1 ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapOutfit);
}

export async function purgeUserWardrobe(userSub: string): Promise<void> {
  await query(`DELETE FROM wardrobe_outfits WHERE user_sub = $1`, [userSub]);
  await query(`DELETE FROM wardrobe_items WHERE user_sub = $1`, [userSub]);
}
