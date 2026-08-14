import { query, toIso } from "../../db/client";

export type ContentReport = {
  id: string;
  reporterSub: string;
  targetType: "article" | "post" | "listing" | "review";
  targetId: string;
  reason: "inaccurate" | "harmful" | "spam" | "privacy" | "other";
  details: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
};

type Row = {
  id: string;
  reporter_sub: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: unknown;
};

function mapRow(row: Row): ContentReport {
  return {
    id: row.id,
    reporterSub: row.reporter_sub,
    targetType: row.target_type as ContentReport["targetType"],
    targetId: row.target_id,
    reason: row.reason as ContentReport["reason"],
    details: row.details,
    status: row.status as ContentReport["status"],
    createdAt: toIso(row.created_at),
  };
}

export async function insertReport(row: ContentReport): Promise<ContentReport> {
  await query(
    `INSERT INTO content_reports
      (id, reporter_sub, target_type, target_id, reason, details, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
    [
      row.id,
      row.reporterSub,
      row.targetType,
      row.targetId,
      row.reason,
      row.details,
      row.status,
      row.createdAt,
    ],
  );
  return row;
}

export async function listMine(sub: string): Promise<ContentReport[]> {
  const res = await query<Row>(
    `SELECT id, reporter_sub, target_type, target_id, reason, details, status, created_at
     FROM content_reports WHERE reporter_sub = $1
     ORDER BY created_at DESC`,
    [sub],
  );
  return res.rows.map(mapRow);
}

export async function listQueue(
  status?: ContentReport["status"],
): Promise<ContentReport[]> {
  const res = status
    ? await query<Row>(
        `SELECT id, reporter_sub, target_type, target_id, reason, details, status, created_at
         FROM content_reports WHERE status = $1
         ORDER BY created_at ASC`,
        [status],
      )
    : await query<Row>(
        `SELECT id, reporter_sub, target_type, target_id, reason, details, status, created_at
         FROM content_reports
         ORDER BY created_at ASC`,
      );
  return res.rows.map(mapRow);
}

export async function patchStatus(
  id: string,
  status: ContentReport["status"],
): Promise<ContentReport | null> {
  const res = await query<Row>(
    `UPDATE content_reports SET status = $2 WHERE id = $1
     RETURNING id, reporter_sub, target_type, target_id, reason, details, status, created_at`,
    [id, status],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : null;
}

export async function countMine(sub: string): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM content_reports WHERE reporter_sub = $1`,
    [sub],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function purgeUserReports(sub: string): Promise<void> {
  await query(`DELETE FROM content_reports WHERE reporter_sub = $1`, [sub]);
}
