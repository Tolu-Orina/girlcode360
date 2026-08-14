import { query, toIso } from "../../db/client";
import type { CyclePhase, HairScanKind, MirrorTaskStatus } from "../../types";

export type HairScanRow = {
  id: string;
  userSub: string;
  youcamTaskId: string;
  kind: HairScanKind;
  status: MirrorTaskStatus;
  cycleDayAtScan: number | null;
  cyclePhaseAtScan: CyclePhase | null;
  scores: Record<string, unknown>;
  resultS3Key: string;
  hairColor: string | null;
  hairstyleId: string | null;
  createdAt: string;
};

type HairDb = {
  id: string;
  user_sub: string;
  youcam_task_id: string;
  kind: string;
  status: string;
  cycle_day_at_scan: number | null;
  cycle_phase_at_scan: string | null;
  type_score: string;
  result_s3_key: string;
  hair_color: string | null;
  hairstyle_id: string | null;
  created_at: unknown;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRow(r: HairDb): HairScanRow {
  return {
    id: r.id,
    userSub: r.user_sub,
    youcamTaskId: r.youcam_task_id,
    kind: r.kind as HairScanKind,
    status: (r.status as MirrorTaskStatus) || "pending",
    cycleDayAtScan: r.cycle_day_at_scan,
    cyclePhaseAtScan: (r.cycle_phase_at_scan as CyclePhase) || null,
    scores: parseJson(r.type_score, {}),
    resultS3Key: r.result_s3_key,
    hairColor: r.hair_color,
    hairstyleId: r.hairstyle_id,
    createdAt: toIso(r.created_at),
  };
}

export async function insertHairScan(row: HairScanRow): Promise<void> {
  await query(
    `INSERT INTO hair_scans
      (id, user_sub, youcam_task_id, kind, status, cycle_day_at_scan, cycle_phase_at_scan,
       type_score, result_s3_key, hair_color, hairstyle_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)`,
    [
      row.id,
      row.userSub,
      row.youcamTaskId,
      row.kind,
      row.status,
      row.cycleDayAtScan,
      row.cyclePhaseAtScan,
      JSON.stringify(row.scores),
      row.resultS3Key,
      row.hairColor,
      row.hairstyleId,
      row.createdAt,
    ],
  );
}

export async function getHairScan(
  userSub: string,
  id: string,
): Promise<HairScanRow | undefined> {
  const res = await query<HairDb>(
    `SELECT * FROM hair_scans WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}

export async function updateHairScan(
  userSub: string,
  id: string,
  patch: Partial<{
    status: MirrorTaskStatus;
    resultS3Key: string;
    scores: Record<string, unknown>;
  }>,
): Promise<HairScanRow | undefined> {
  const cur = await getHairScan(userSub, id);
  if (!cur) return undefined;
  await query(
    `UPDATE hair_scans SET status = $3, result_s3_key = $4, type_score = $5
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      patch.status ?? cur.status,
      patch.resultS3Key !== undefined ? patch.resultS3Key : cur.resultS3Key,
      JSON.stringify(patch.scores ?? cur.scores),
    ],
  );
  return getHairScan(userSub, id);
}

export async function listHairScans(userSub: string): Promise<HairScanRow[]> {
  const res = await query<HairDb>(
    `SELECT * FROM hair_scans WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userSub],
  );
  return res.rows.map(mapRow);
}

export async function purgeUserHair(userSub: string): Promise<void> {
  await query(`DELETE FROM hair_scans WHERE user_sub = $1`, [userSub]);
}

export async function findPendingHairByTask(
  taskId: string,
): Promise<HairScanRow | undefined> {
  const res = await query<HairDb>(
    `SELECT * FROM hair_scans
     WHERE status = 'pending' AND deleted_at IS NULL
       AND (youcam_task_id = $1 OR youcam_task_id LIKE $2)
     LIMIT 1`,
    [taskId, `${taskId}::yc::%`],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}
