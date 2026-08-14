import { query, toIso } from "../../db/client";
import type { MirrorTaskStatus } from "../../types";

export type MakeupLookRow = {
  id: string;
  userSub: string;
  youcamTaskId: string;
  categories: string[];
  sourceKind: "live" | "photo" | "transfer";
  status: MirrorTaskStatus;
  resultS3Key: string;
  saved: boolean;
  createdAt: string;
};

export type ShadeMatchRow = {
  id: string;
  userSub: string;
  sourceScanId: string;
  fitzpatrickType: string | null;
  matches: unknown;
  createdAt: string;
};

type MakeupDb = {
  id: string;
  user_sub: string;
  youcam_task_id: string;
  categories: string;
  source_kind: string;
  status: string;
  result_s3_key: string;
  saved: boolean;
  created_at: unknown;
};

type ShadeDb = {
  id: string;
  user_sub: string;
  source_scan_id: string;
  fitzpatrick_type: string | null;
  matches: string;
  created_at: unknown;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapMakeup(r: MakeupDb): MakeupLookRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    youcamTaskId: r.youcam_task_id,
    categories: parseJson<string[]>(r.categories, []),
    sourceKind: r.source_kind as MakeupLookRow["sourceKind"],
    status: (r.status as MirrorTaskStatus) || "pending",
    resultS3Key: r.result_s3_key,
    saved: r.saved,
    createdAt: toIso(r.created_at),
  };
}

export async function insertMakeupLook(row: MakeupLookRow): Promise<void> {
  await query(
    `INSERT INTO makeup_looks
      (id, user_sub, youcam_task_id, categories, source_kind, status, result_s3_key, saved, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.youcamTaskId,
      JSON.stringify(row.categories),
      row.sourceKind,
      row.status,
      row.resultS3Key,
      row.saved,
      row.createdAt,
    ],
  );
}

export async function insertShadeMatch(row: ShadeMatchRow): Promise<void> {
  await query(
    `INSERT INTO shade_matches
      (id, user_sub, source_scan_id, fitzpatrick_type, matches, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.sourceScanId,
      row.fitzpatrickType,
      JSON.stringify(row.matches),
      row.createdAt,
    ],
  );
}

export async function getMakeupLook(
  userSub: string,
  id: string,
): Promise<MakeupLookRow | undefined> {
  const res = await query<MakeupDb>(
    `SELECT * FROM makeup_looks WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapMakeup(row) : undefined;
}

export async function updateMakeupLook(
  userSub: string,
  id: string,
  patch: Partial<{
    status: MirrorTaskStatus;
    resultS3Key: string;
    saved: boolean;
  }>,
): Promise<MakeupLookRow | undefined> {
  const cur = await getMakeupLook(userSub, id);
  if (!cur) return undefined;
  await query(
    `UPDATE makeup_looks SET status = $3, result_s3_key = $4, saved = $5
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      patch.status ?? cur.status,
      patch.resultS3Key !== undefined ? patch.resultS3Key : cur.resultS3Key,
      patch.saved ?? cur.saved,
    ],
  );
  return getMakeupLook(userSub, id);
}

export async function softDeleteMakeupLook(
  userSub: string,
  id: string,
): Promise<boolean> {
  const res = await query(
    `UPDATE makeup_looks SET deleted_at = NOW()
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listMakeupLooks(userSub: string): Promise<MakeupLookRow[]> {
  const res = await query<MakeupDb>(
    `SELECT * FROM makeup_looks WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapMakeup);
}

export async function listShadeMatches(userSub: string): Promise<ShadeMatchRow[]> {
  const res = await query<ShadeDb>(
    `SELECT * FROM shade_matches WHERE user_sub = $1 ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map((r) => ({
    id: r.id,
    userSub: r.user_sub,
    sourceScanId: r.source_scan_id,
    fitzpatrickType: r.fitzpatrick_type,
    matches: parseJson(r.matches, []),
    createdAt: toIso(r.created_at),
  }));
}

export async function getShadeMatch(
  userSub: string,
  id: string,
): Promise<ShadeMatchRow | undefined> {
  const res = await query<ShadeDb>(
    `SELECT * FROM shade_matches WHERE id = $1 AND user_sub = $2`,
    [id, userSub],
  );
  const r = res.rows[0];
  if (!r) return undefined;
  return {
    id: r.id,
    userSub: r.user_sub,
    sourceScanId: r.source_scan_id,
    fitzpatrickType: r.fitzpatrick_type,
    matches: parseJson(r.matches, []),
    createdAt: toIso(r.created_at),
  };
}

export async function purgeUserStudio(userSub: string): Promise<void> {
  await query(`DELETE FROM makeup_looks WHERE user_sub = $1`, [userSub]);
  await query(`DELETE FROM shade_matches WHERE user_sub = $1`, [userSub]);
}

export async function findPendingMakeupByTask(
  taskId: string,
): Promise<MakeupLookRow | undefined> {
  const res = await query<MakeupDb>(
    `SELECT * FROM makeup_looks
     WHERE status = 'pending' AND deleted_at IS NULL
       AND (youcam_task_id = $1 OR youcam_task_id LIKE $2)
     LIMIT 1`,
    [taskId, `${taskId}::yc::%`],
  );
  const row = res.rows[0];
  return row ? mapMakeup(row) : undefined;
}
