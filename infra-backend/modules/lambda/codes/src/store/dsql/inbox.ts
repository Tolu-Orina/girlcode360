import { query, toIso } from "../../db/client";
import type { InAppKind, InAppNotification } from "../../types";

type Row = {
  id: string;
  user_sub: string;
  kind: string;
  title: string;
  body: string;
  listing_id: string | null;
  read_at: unknown | null;
  created_at: unknown;
};

function mapRow(row: Row): InAppNotification {
  return {
    id: row.id,
    kind: row.kind as InAppKind,
    title: row.title,
    body: row.body,
    listingId: row.listing_id,
    readAt: row.read_at ? toIso(row.read_at) : null,
    createdAt: toIso(row.created_at),
  };
}

export async function hasListingNotice(
  sub: string,
  kind: string,
  listingId: string,
): Promise<boolean> {
  const res = await query<{ id: string }>(
    `SELECT id FROM in_app_notifications
     WHERE user_sub = $1 AND kind = $2 AND listing_id = $3 LIMIT 1`,
    [sub, kind, listingId],
  );
  return Boolean(res.rows[0]);
}

export async function insertNotice(row: {
  id: string;
  userSub: string;
  kind: string;
  title: string;
  body: string;
  listingId: string | null;
  createdAt: string;
}): Promise<void> {
  await query(
    `INSERT INTO in_app_notifications (
       id, user_sub, kind, title, body, listing_id, read_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.kind,
      row.title,
      row.body,
      row.listingId,
      row.createdAt,
    ],
  );
}

export async function listForUser(sub: string): Promise<InAppNotification[]> {
  const res = await query<Row>(
    `SELECT * FROM in_app_notifications WHERE user_sub = $1
     ORDER BY created_at DESC LIMIT 100`,
    [sub],
  );
  return res.rows.map(mapRow);
}

export async function markRead(
  sub: string,
  id: string,
): Promise<InAppNotification | undefined> {
  const res = await query<Row>(
    `UPDATE in_app_notifications SET read_at = NOW()
     WHERE id = $1 AND user_sub = $2
     RETURNING *`,
    [id, sub],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}

export async function markAllRead(sub: string): Promise<number> {
  const res = await query(
    `UPDATE in_app_notifications SET read_at = NOW()
     WHERE user_sub = $1 AND read_at IS NULL`,
    [sub],
  );
  return res.rowCount ?? 0;
}

export async function unreadCount(sub: string): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM in_app_notifications
     WHERE user_sub = $1 AND read_at IS NULL`,
    [sub],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function purgeUserInbox(sub: string): Promise<void> {
  await query(`DELETE FROM in_app_notifications WHERE user_sub = $1`, [sub]);
}
