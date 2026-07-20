import { parseJsonArray, query, toIso } from "../../db/client";
import type {
  CreateCycleRequest,
  Cycle,
  CycleDay,
  FlowLevel,
  MoodLevel,
  PatchCycleRequest,
  UpsertCycleDayRequest,
} from "../../types";

type CycleRow = {
  id: string;
  user_sub: string;
  start_date: string;
  end_date: string | null;
  cycle_length_override: number | null;
  created_at: unknown;
  updated_at: unknown;
};

type DayRow = {
  user_sub: string;
  day_date: string;
  flow: string;
  mood: number | null;
  symptom_ids: string;
  note: string | null;
  updated_at: unknown;
};

function mapCycle(row: CycleRow): Cycle {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    cycleLengthOverride: row.cycle_length_override,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapDay(row: DayRow): CycleDay {
  return {
    date: row.day_date,
    flow: row.flow as FlowLevel,
    mood: (row.mood as MoodLevel | null) ?? null,
    symptomIds: parseJsonArray(row.symptom_ids),
    note: row.note,
    updatedAt: toIso(row.updated_at),
  };
}

export async function listCycles(sub: string): Promise<Cycle[]> {
  const res = await query<CycleRow>(
    `SELECT * FROM cycles WHERE user_sub = $1 ORDER BY start_date ASC`,
    [sub],
  );
  return res.rows.map(mapCycle);
}

export async function getCycle(
  sub: string,
  id: string,
): Promise<Cycle | undefined> {
  const res = await query<CycleRow>(
    `SELECT * FROM cycles WHERE user_sub = $1 AND id = $2`,
    [sub, id],
  );
  const row = res.rows[0];
  return row ? mapCycle(row) : undefined;
}

export async function createCycle(
  sub: string,
  body: CreateCycleRequest,
): Promise<Cycle> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const res = await query<CycleRow>(
    `INSERT INTO cycles (
       id, user_sub, start_date, end_date, cycle_length_override, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz)
     RETURNING *`,
    [
      id,
      sub,
      body.startDate,
      body.endDate ?? null,
      body.cycleLengthOverride ?? null,
      now,
      now,
    ],
  );
  return mapCycle(res.rows[0]!);
}

export async function upsertCycleWithId(
  sub: string,
  id: string,
  body: CreateCycleRequest,
): Promise<Cycle> {
  const existing = await getCycle(sub, id);
  if (existing) {
    return (await patchCycle(sub, id, {
      startDate: body.startDate,
      endDate: body.endDate,
      cycleLengthOverride: body.cycleLengthOverride,
    }))!;
  }
  const now = new Date().toISOString();
  const res = await query<CycleRow>(
    `INSERT INTO cycles (
       id, user_sub, start_date, end_date, cycle_length_override, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz)
     RETURNING *`,
    [
      id,
      sub,
      body.startDate,
      body.endDate ?? null,
      body.cycleLengthOverride ?? null,
      now,
      now,
    ],
  );
  return mapCycle(res.rows[0]!);
}

export async function patchCycle(
  sub: string,
  id: string,
  patch: PatchCycleRequest,
): Promise<Cycle | undefined> {
  const cur = await getCycle(sub, id);
  if (!cur) return undefined;
  const next = {
    startDate: patch.startDate ?? cur.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : cur.endDate,
    cycleLengthOverride:
      patch.cycleLengthOverride !== undefined
        ? patch.cycleLengthOverride
        : cur.cycleLengthOverride,
    updatedAt: new Date().toISOString(),
  };
  const res = await query<CycleRow>(
    `UPDATE cycles SET
       start_date = $3,
       end_date = $4,
       cycle_length_override = $5,
       updated_at = $6::timestamptz
     WHERE user_sub = $1 AND id = $2
     RETURNING *`,
    [
      sub,
      id,
      next.startDate,
      next.endDate,
      next.cycleLengthOverride,
      next.updatedAt,
    ],
  );
  const row = res.rows[0];
  return row ? mapCycle(row) : undefined;
}

export async function deleteCycle(sub: string, id: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM cycles WHERE user_sub = $1 AND id = $2`,
    [sub, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listDays(
  sub: string,
  from?: string,
  to?: string,
): Promise<CycleDay[]> {
  const clauses = ["user_sub = $1"];
  const params: unknown[] = [sub];
  if (from) {
    params.push(from);
    clauses.push(`day_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`day_date <= $${params.length}`);
  }
  const res = await query<DayRow>(
    `SELECT * FROM cycle_days WHERE ${clauses.join(" AND ")} ORDER BY day_date ASC`,
    params,
  );
  return res.rows.map(mapDay);
}

export async function upsertDay(
  sub: string,
  body: UpsertCycleDayRequest,
): Promise<CycleDay> {
  const existingRows = await query<DayRow>(
    `SELECT * FROM cycle_days WHERE user_sub = $1 AND day_date = $2`,
    [sub, body.date],
  );
  const existing = existingRows.rows[0]
    ? mapDay(existingRows.rows[0])
    : undefined;
  const now = new Date().toISOString();
  const next: CycleDay = {
    date: body.date,
    flow: (body.flow ?? existing?.flow ?? "none") as FlowLevel,
    mood:
      body.mood !== undefined
        ? (body.mood as MoodLevel | null)
        : (existing?.mood ?? null),
    symptomIds: body.symptomIds ?? existing?.symptomIds ?? [],
    note: body.note !== undefined ? body.note : (existing?.note ?? null),
    updatedAt: now,
  };

  const res = await query<DayRow>(
    `INSERT INTO cycle_days (
       user_sub, day_date, flow, mood, symptom_ids, note, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)
     ON CONFLICT (user_sub, day_date) DO UPDATE SET
       flow = EXCLUDED.flow,
       mood = EXCLUDED.mood,
       symptom_ids = EXCLUDED.symptom_ids,
       note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      next.date,
      next.flow,
      next.mood,
      JSON.stringify(next.symptomIds),
      next.note,
      next.updatedAt,
    ],
  );
  return mapDay(res.rows[0]!);
}

export async function getIdempotent(
  sub: string,
  key: string,
): Promise<unknown | undefined> {
  const res = await query<{ response_json: string }>(
    `SELECT response_json FROM sync_idempotency
     WHERE user_sub = $1 AND idempotency_key = $2`,
    [sub, key],
  );
  const raw = res.rows[0]?.response_json;
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function setIdempotent(
  sub: string,
  key: string,
  response: unknown,
): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO sync_idempotency (user_sub, idempotency_key, response_json, created_at)
     VALUES ($1,$2,$3,$4::timestamptz)
     ON CONFLICT (user_sub, idempotency_key) DO UPDATE SET
       response_json = EXCLUDED.response_json`,
    [sub, key, JSON.stringify(response), now],
  );
}
