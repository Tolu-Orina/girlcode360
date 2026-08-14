import { query, toIso } from "../../db/client";
import type { AccessoryLookKind, MirrorTaskStatus } from "../../types";

export type AccessoryLookRow = {
  id: string;
  userSub: string;
  youcamTaskId: string;
  kind: AccessoryLookKind;
  accessoryCategory: string | null;
  catalogueItemId: string;
  asset3dId: string | null;
  nailColor: string | null;
  frameId: string | null;
  status: MirrorTaskStatus;
  resultS3Key: string;
  createdAt: string;
};

type Db = {
  id: string;
  user_sub: string;
  youcam_task_id: string;
  kind: string;
  accessory_category: string | null;
  catalogue_item_id: string;
  asset_3d_id: string | null;
  nail_color: string | null;
  frame_id: string | null;
  status: string;
  result_s3_key: string;
  created_at: unknown;
};

function mapRow(r: Db): AccessoryLookRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    youcamTaskId: r.youcam_task_id,
    kind: r.kind as AccessoryLookKind,
    accessoryCategory: r.accessory_category,
    catalogueItemId: r.catalogue_item_id,
    asset3dId: r.asset_3d_id,
    nailColor: r.nail_color,
    frameId: r.frame_id,
    status: (r.status as MirrorTaskStatus) || "pending",
    resultS3Key: r.result_s3_key,
    createdAt: toIso(r.created_at),
  };
}

export async function insertAccessoryLook(row: AccessoryLookRow): Promise<void> {
  await query(
    `INSERT INTO accessory_looks
      (id, user_sub, youcam_task_id, kind, accessory_category, catalogue_item_id,
       asset_3d_id, nail_color, frame_id, status, result_s3_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.youcamTaskId,
      row.kind,
      row.accessoryCategory,
      row.catalogueItemId,
      row.asset3dId,
      row.nailColor,
      row.frameId,
      row.status,
      row.resultS3Key,
      row.createdAt,
    ],
  );
}

export async function getAccessoryLook(
  userSub: string,
  id: string,
): Promise<AccessoryLookRow | undefined> {
  const res = await query<Db>(
    `SELECT * FROM accessory_looks WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}

export async function updateAccessoryLook(
  userSub: string,
  id: string,
  patch: Partial<{ status: MirrorTaskStatus; resultS3Key: string }>,
): Promise<AccessoryLookRow | undefined> {
  const cur = await getAccessoryLook(userSub, id);
  if (!cur) return undefined;
  await query(
    `UPDATE accessory_looks SET status = $3, result_s3_key = $4
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      patch.status ?? cur.status,
      patch.resultS3Key !== undefined ? patch.resultS3Key : cur.resultS3Key,
    ],
  );
  return getAccessoryLook(userSub, id);
}

export async function listAccessoryLooks(userSub: string): Promise<AccessoryLookRow[]> {
  const res = await query<Db>(
    `SELECT * FROM accessory_looks WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapRow);
}

export async function purgeUserAccessories(userSub: string): Promise<void> {
  await query(`DELETE FROM accessory_looks WHERE user_sub = $1`, [userSub]);
}
