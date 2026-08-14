import { query, toIso } from "../../db/client";
import type { HealthLensFinding } from "../../../../../../../packages/domain/src/index";

export type HealthLensReportRow = {
  id: string;
  createdAt: string;
  narrative: string;
  confidence: "Low" | "Medium" | "High";
  findings: HealthLensFinding[];
  stub: boolean;
};

export type HealthLensPrefs = {
  populationLearningConsent: boolean;
  lastOndemandAt: string | null;
};

type QuotaRow = { user_sub: string; day_key: string; used: number };
type ReportDbRow = {
  id: string;
  user_sub: string;
  narrative: string;
  confidence: string;
  findings_json: string;
  created_at: unknown;
};
type PrefsRow = {
  user_sub: string;
  population_learning_consent: boolean;
  last_ondemand_at: unknown | null;
  updated_at: unknown;
};

function parseFindings(raw: string): HealthLensFinding[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HealthLensFinding[]) : [];
  } catch {
    return [];
  }
}

function mapReport(row: ReportDbRow): HealthLensReportRow {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    narrative: row.narrative,
    confidence: row.confidence as HealthLensReportRow["confidence"],
    findings: parseFindings(row.findings_json),
    stub: false,
  };
}

export async function getAlenaUsed(
  sub: string,
  dayKey: string,
): Promise<number> {
  const res = await query<QuotaRow>(
    `SELECT * FROM alena_quota WHERE user_sub = $1 AND day_key = $2`,
    [sub, dayKey],
  );
  return res.rows[0]?.used ?? 0;
}

export async function incrementAlenaUsed(
  sub: string,
  dayKey: string,
): Promise<number> {
  const res = await query<QuotaRow>(
    `INSERT INTO alena_quota (user_sub, day_key, used)
     VALUES ($1,$2,1)
     ON CONFLICT (user_sub, day_key) DO UPDATE SET
       used = alena_quota.used + 1
     RETURNING *`,
    [sub, dayKey],
  );
  return res.rows[0]?.used ?? 1;
}

export async function tryIncrementAlenaUsed(
  sub: string,
  dayKey: string,
  limit: number,
): Promise<boolean> {
  const res = await query<QuotaRow>(
    `INSERT INTO alena_quota (user_sub, day_key, used)
     VALUES ($1,$2,1)
     ON CONFLICT (user_sub, day_key) DO UPDATE SET
       used = alena_quota.used + 1
       WHERE alena_quota.used < $3
     RETURNING *`,
    [sub, dayKey, limit],
  );
  return Boolean(res.rows[0]);
}

export async function getHealthLensPrefs(
  sub: string,
): Promise<HealthLensPrefs> {
  const res = await query<PrefsRow>(
    `SELECT * FROM healthlens_prefs WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  if (!row) {
    return { populationLearningConsent: false, lastOndemandAt: null };
  }
  return {
    populationLearningConsent: row.population_learning_consent,
    lastOndemandAt: row.last_ondemand_at ? toIso(row.last_ondemand_at) : null,
  };
}

export async function setHealthLensPrefs(
  sub: string,
  prefs: HealthLensPrefs,
): Promise<HealthLensPrefs> {
  await query(
    `INSERT INTO healthlens_prefs (
       user_sub, population_learning_consent, last_ondemand_at, updated_at
     ) VALUES ($1,$2,$3::timestamptz,NOW())
     ON CONFLICT (user_sub) DO UPDATE SET
       population_learning_consent = EXCLUDED.population_learning_consent,
       last_ondemand_at = EXCLUDED.last_ondemand_at,
       updated_at = NOW()`,
    [sub, prefs.populationLearningConsent, prefs.lastOndemandAt],
  );
  return prefs;
}

export async function insertHealthLensReport(
  sub: string,
  report: Omit<HealthLensReportRow, "stub"> & { stub?: boolean },
): Promise<HealthLensReportRow> {
  await query(
    `INSERT INTO healthlens_reports (
       id, user_sub, narrative, confidence, findings_json, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz)`,
    [
      report.id,
      sub,
      report.narrative,
      report.confidence,
      JSON.stringify(report.findings),
      report.createdAt,
    ],
  );
  return { ...report, stub: report.stub ?? false };
}

export async function latestHealthLensReport(
  sub: string,
): Promise<HealthLensReportRow | null> {
  const res = await query<ReportDbRow>(
    `SELECT * FROM healthlens_reports
     WHERE user_sub = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapReport(row) : null;
}

export async function listHealthLensReports(
  sub: string,
): Promise<HealthLensReportRow[]> {
  const res = await query<ReportDbRow>(
    `SELECT * FROM healthlens_reports
     WHERE user_sub = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [sub],
  );
  return res.rows.map(mapReport);
}

export async function countHealthLensReports(sub: string): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM healthlens_reports WHERE user_sub = $1`,
    [sub],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function purgeUserAi(sub: string): Promise<void> {
  await query(`DELETE FROM healthlens_reports WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM healthlens_prefs WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM alena_quota WHERE user_sub = $1`, [sub]);
}
