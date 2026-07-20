import { query, toIso } from "../../db/client";

export type DeletionRow = {
  id: string;
  requestedAt: string;
  purgeAfter: string;
  cancelledAt: string | null;
  purgedAt: string | null;
  status: "cooling_off" | "cancelled" | "purged";
};

export type ExportJobRow = {
  id: string;
  userSub: string;
  status: "pending" | "ready" | "failed";
  createdAt: string;
  readyAt: string | null;
  payloadUri: string | null;
};

type DelDb = {
  id: string;
  user_sub: string;
  requested_at: unknown;
  purge_after: unknown;
  cancelled_at: unknown | null;
  purged_at: unknown | null;
  status: string;
};

type ExpDb = {
  id: string;
  user_sub: string;
  status: string;
  created_at: unknown;
  ready_at: unknown | null;
  payload_uri: string | null;
};

function mapDeletion(row: DelDb): DeletionRow {
  return {
    id: row.id,
    requestedAt: toIso(row.requested_at),
    purgeAfter: toIso(row.purge_after),
    cancelledAt: row.cancelled_at ? toIso(row.cancelled_at) : null,
    purgedAt: row.purged_at ? toIso(row.purged_at) : null,
    status: row.status as DeletionRow["status"],
  };
}

function mapExport(row: ExpDb): ExportJobRow {
  return {
    id: row.id,
    userSub: row.user_sub,
    status: row.status as ExportJobRow["status"],
    createdAt: toIso(row.created_at),
    readyAt: row.ready_at ? toIso(row.ready_at) : null,
    payloadUri: row.payload_uri,
  };
}

export async function getDeletion(
  sub: string,
): Promise<DeletionRow | undefined> {
  const res = await query<DelDb>(
    `SELECT * FROM deletion_requests WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapDeletion(row) : undefined;
}

export async function upsertDeletion(
  sub: string,
  row: DeletionRow,
): Promise<DeletionRow> {
  const res = await query<DelDb>(
    `INSERT INTO deletion_requests (
       id, user_sub, requested_at, purge_after, cancelled_at, purged_at, status
     ) VALUES (
       $1,$2,$3::timestamptz,$4::timestamptz,$5::timestamptz,$6::timestamptz,$7
     )
     ON CONFLICT (user_sub) DO UPDATE SET
       id = EXCLUDED.id,
       requested_at = EXCLUDED.requested_at,
       purge_after = EXCLUDED.purge_after,
       cancelled_at = EXCLUDED.cancelled_at,
       purged_at = EXCLUDED.purged_at,
       status = EXCLUDED.status
     RETURNING *`,
    [
      row.id,
      sub,
      row.requestedAt,
      row.purgeAfter,
      row.cancelledAt,
      row.purgedAt,
      row.status,
    ],
  );
  return mapDeletion(res.rows[0]!);
}

export async function listDueDeletions(
  nowIso: string,
): Promise<Array<{ userSub: string; row: DeletionRow }>> {
  const res = await query<DelDb>(
    `SELECT * FROM deletion_requests
     WHERE status = 'cooling_off' AND purge_after <= $1::timestamptz`,
    [nowIso],
  );
  return res.rows.map((r) => ({
    userSub: r.user_sub,
    row: mapDeletion(r),
  }));
}

export async function insertExportJob(job: ExportJobRow): Promise<ExportJobRow> {
  const res = await query<ExpDb>(
    `INSERT INTO export_jobs (
       id, user_sub, status, created_at, ready_at, payload_uri
     ) VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6)
     RETURNING *`,
    [
      job.id,
      job.userSub,
      job.status,
      job.createdAt,
      job.readyAt,
      job.payloadUri,
    ],
  );
  return mapExport(res.rows[0]!);
}

export async function getExportJob(
  sub: string,
  id: string,
): Promise<ExportJobRow | undefined> {
  const res = await query<ExpDb>(
    `SELECT * FROM export_jobs WHERE id = $1 AND user_sub = $2`,
    [id, sub],
  );
  const row = res.rows[0];
  return row ? mapExport(row) : undefined;
}

export async function deleteExportJobsForUser(sub: string): Promise<void> {
  await query(`DELETE FROM export_jobs WHERE user_sub = $1`, [sub]);
}

export async function deleteDeletionRequest(sub: string): Promise<void> {
  await query(`DELETE FROM deletion_requests WHERE user_sub = $1`, [sub]);
}
