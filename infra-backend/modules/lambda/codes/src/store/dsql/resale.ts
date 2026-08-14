import { query, toIso } from "../../db/client";
import type { ResaleListingStatus } from "../../types";

export type ResaleListingRow = {
  id: string;
  userSub: string;
  wardrobeItemId: string;
  priceMinor: number;
  status: ResaleListingStatus;
  title: string;
  details: string;
  market: string;
  moderationRef: string | null;
  createdAt: string;
};

type Db = {
  id: string;
  user_sub: string;
  wardrobe_item_id: string;
  price_minor: number;
  status: string;
  title: string;
  details: string;
  market: string;
  moderation_ref: string | null;
  created_at: unknown;
};

function mapRow(r: Db): ResaleListingRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    wardrobeItemId: r.wardrobe_item_id,
    priceMinor: Number(r.price_minor),
    status: r.status as ResaleListingStatus,
    title: r.title,
    details: r.details,
    market: r.market,
    moderationRef: r.moderation_ref,
    createdAt: toIso(r.created_at),
  };
}

export async function insertResale(row: ResaleListingRow): Promise<void> {
  await query(
    `INSERT INTO resale_listings
      (id, user_sub, wardrobe_item_id, price_minor, status, title, details, market, moderation_ref, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.wardrobeItemId,
      row.priceMinor,
      row.status,
      row.title,
      row.details,
      row.market,
      row.moderationRef,
      row.createdAt,
    ],
  );
}

export async function getResale(
  id: string,
): Promise<ResaleListingRow | undefined> {
  const res = await query<Db>(`SELECT * FROM resale_listings WHERE id = $1`, [id]);
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}

export async function listResaleForUser(userSub: string): Promise<ResaleListingRow[]> {
  const res = await query<Db>(
    `SELECT * FROM resale_listings WHERE user_sub = $1 ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapRow);
}

export async function listLiveResale(market?: string): Promise<ResaleListingRow[]> {
  if (market) {
    const res = await query<Db>(
      `SELECT * FROM resale_listings WHERE status = 'live' AND market = $1 ORDER BY created_at DESC`,
      [market],
    );
    return res.rows.map(mapRow);
  }
  const res = await query<Db>(
    `SELECT * FROM resale_listings WHERE status = 'live' ORDER BY created_at DESC`,
  );
  return res.rows.map(mapRow);
}

export async function listPendingResale(): Promise<ResaleListingRow[]> {
  const res = await query<Db>(
    `SELECT * FROM resale_listings WHERE status = 'pending_moderation' ORDER BY created_at ASC`,
  );
  return res.rows.map(mapRow);
}

export async function updateResaleStatus(
  id: string,
  status: ResaleListingStatus,
  moderationRef?: string | null,
): Promise<ResaleListingRow | undefined> {
  const cur = await getResale(id);
  if (!cur) return undefined;
  await query(
    `UPDATE resale_listings SET status = $2, moderation_ref = $3 WHERE id = $1`,
    [id, status, moderationRef !== undefined ? moderationRef : cur.moderationRef],
  );
  return getResale(id);
}

export async function purgeUserResale(userSub: string): Promise<void> {
  await query(`DELETE FROM resale_listings WHERE user_sub = $1`, [userSub]);
}
