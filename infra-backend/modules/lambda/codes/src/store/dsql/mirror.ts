import { query, toIso } from "../../db/client";
import type {
  CyclePhase,
  MirrorInsight,
  MirrorTaskStatus,
  SkinScan,
  ApparelTryOn,
} from "../../types";

export type SkinScanRow = SkinScan & {
  userSub: string;
  youcamTaskId: string;
  resultS3Key: string | null;
  maskS3Key: string | null;
  sourceS3Key: string | null;
  scoresRaw: string;
  insightRaw: string | null;
};

export type TryOnRow = ApparelTryOn & {
  userSub: string;
  youcamTaskId: string;
  resultS3Key: string | null;
};

function mapScan(r: {
  id: string;
  user_sub: string;
  youcam_task_id: string;
  status: string;
  cycle_day_at_scan: number | null;
  cycle_phase_at_scan: string | null;
  overall_score: number | null;
  scores: string;
  mask_overlay_s3_key: string | null;
  result_s3_key: string | null;
  source_s3_key: string | null;
  scan_quality: string;
  insight_json: string | null;
  seeded: boolean;
  created_at: unknown;
}): SkinScanRow {
  let scores: Record<string, number> = {};
  try {
    scores = JSON.parse(r.scores) as Record<string, number>;
  } catch {
    scores = {};
  }
  let insight: MirrorInsight | null = null;
  if (r.insight_json) {
    try {
      insight = JSON.parse(r.insight_json) as MirrorInsight;
    } catch {
      insight = null;
    }
  }
  return {
    id: r.id,
    userSub: r.user_sub,
    youcamTaskId: r.youcam_task_id,
    status: r.status as MirrorTaskStatus,
    createdAt: toIso(r.created_at),
    cycleDayAtScan: r.cycle_day_at_scan,
    cyclePhaseAtScan: (r.cycle_phase_at_scan as CyclePhase) ?? null,
    overallScore: r.overall_score,
    scores,
    hasResultImage: Boolean(r.result_s3_key),
    hasMask: Boolean(r.mask_overlay_s3_key),
    insight,
    seeded: Boolean(r.seeded),
    scanQuality: r.scan_quality === "hd" ? "hd" : "sd",
    resultS3Key: r.result_s3_key,
    maskS3Key: r.mask_overlay_s3_key,
    sourceS3Key: r.source_s3_key,
    scoresRaw: r.scores,
    insightRaw: r.insight_json,
  };
}

export async function insertScan(row: {
  id: string;
  userSub: string;
  youcamTaskId: string;
  status: MirrorTaskStatus;
  cycleDay: number | null;
  cyclePhase: CyclePhase | null;
  overall: number | null;
  scores: Record<string, number>;
  resultKey: string | null;
  maskKey: string | null;
  sourceKey: string | null;
  insight: MirrorInsight | null;
  seeded: boolean;
}): Promise<SkinScanRow> {
  await query(
    `INSERT INTO skin_scans (
      id, user_sub, youcam_task_id, status, cycle_day_at_scan, cycle_phase_at_scan,
      overall_score, scores, mask_overlay_s3_key, result_s3_key, source_s3_key,
      scan_quality, insight_json, seeded
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'sd',$12,$13)`,
    [
      row.id,
      row.userSub,
      row.youcamTaskId,
      row.status,
      row.cycleDay,
      row.cyclePhase,
      row.overall,
      JSON.stringify(row.scores),
      row.maskKey,
      row.resultKey,
      row.sourceKey,
      row.insight ? JSON.stringify(row.insight) : null,
      row.seeded,
    ],
  );
  const got = await getScan(row.userSub, row.id);
  if (!got) throw new Error("SCAN_INSERT_FAILED");
  return got;
}

export async function updateScan(
  userSub: string,
  id: string,
  patch: Partial<{
    status: MirrorTaskStatus;
    overall: number | null;
    scores: Record<string, number>;
    resultKey: string | null;
    maskKey: string | null;
    insight: MirrorInsight | null;
  }>,
): Promise<SkinScanRow | undefined> {
  const cur = await getScan(userSub, id);
  if (!cur) return undefined;
  const scores = patch.scores ?? cur.scores;
  const insight = patch.insight === undefined ? cur.insight : patch.insight;
  await query(
    `UPDATE skin_scans SET
      status = $3,
      overall_score = $4,
      scores = $5,
      result_s3_key = $6,
      mask_overlay_s3_key = $7,
      insight_json = $8
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      patch.status ?? cur.status,
      patch.overall !== undefined ? patch.overall : cur.overallScore,
      JSON.stringify(scores),
      patch.resultKey !== undefined ? patch.resultKey : cur.resultS3Key,
      patch.maskKey !== undefined ? patch.maskKey : cur.maskS3Key,
      insight ? JSON.stringify(insight) : cur.insightRaw,
    ],
  );
  return getScan(userSub, id);
}

export async function getScan(
  userSub: string,
  id: string,
): Promise<SkinScanRow | undefined> {
  const res = await query(
    `SELECT * FROM skin_scans WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const row = res.rows[0];
  return row ? mapScan(row as never) : undefined;
}

export async function listScans(userSub: string): Promise<SkinScanRow[]> {
  const res = await query(
    `SELECT * FROM skin_scans WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
    [userSub],
  );
  return res.rows.map((r) => mapScan(r as never));
}

export async function softDeleteScan(userSub: string, id: string): Promise<boolean> {
  const res = await query(
    `UPDATE skin_scans SET deleted_at = NOW() WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function insertTryOn(row: {
  id: string;
  userSub: string;
  youcamTaskId: string;
  status: MirrorTaskStatus;
  catalogueItemId: string;
  resultKey: string | null;
}): Promise<TryOnRow> {
  await query(
    `INSERT INTO apparel_tryons (
      id, user_sub, youcam_task_id, status, catalogue_item_id, result_s3_key
    ) VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      row.id,
      row.userSub,
      row.youcamTaskId,
      row.status,
      row.catalogueItemId,
      row.resultKey,
    ],
  );
  const got = await getTryOn(row.userSub, row.id);
  if (!got) throw new Error("TRYON_INSERT_FAILED");
  return got;
}

export async function updateTryOn(
  userSub: string,
  id: string,
  patch: Partial<{ status: MirrorTaskStatus; resultKey: string | null }>,
): Promise<TryOnRow | undefined> {
  const cur = await getTryOn(userSub, id);
  if (!cur) return undefined;
  await query(
    `UPDATE apparel_tryons SET status = $3, result_s3_key = $4
     WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [
      id,
      userSub,
      patch.status ?? cur.status,
      patch.resultKey !== undefined ? patch.resultKey : cur.resultS3Key,
    ],
  );
  return getTryOn(userSub, id);
}

export async function getTryOn(
  userSub: string,
  id: string,
): Promise<TryOnRow | undefined> {
  const res = await query(
    `SELECT * FROM apparel_tryons WHERE id = $1 AND user_sub = $2 AND deleted_at IS NULL`,
    [id, userSub],
  );
  const r = res.rows[0] as
    | {
        id: string;
        user_sub: string;
        youcam_task_id: string;
        status: string;
        catalogue_item_id: string;
        result_s3_key: string | null;
        created_at: unknown;
      }
    | undefined;
  if (!r) return undefined;
  return {
    id: r.id,
    userSub: r.user_sub,
    youcamTaskId: r.youcam_task_id,
    status: r.status as MirrorTaskStatus,
    createdAt: toIso(r.created_at),
    catalogueItemId: r.catalogue_item_id,
    hasResultImage: Boolean(r.result_s3_key),
    resultS3Key: r.result_s3_key,
  };
}

export async function purgeUserMirror(userSub: string): Promise<void> {
  await query(`DELETE FROM skin_scans WHERE user_sub = $1`, [userSub]);
  await query(`DELETE FROM apparel_tryons WHERE user_sub = $1`, [userSub]);
}

export async function listTryOns(userSub: string): Promise<TryOnRow[]> {
  const res = await query(
    `SELECT * FROM apparel_tryons WHERE user_sub = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userSub],
  );
  const rows = await Promise.all(
    res.rows.map((row) => getTryOn(userSub, (row as { id: string }).id)),
  );
  return rows.filter((x): x is TryOnRow => Boolean(x));
}

