import { query, toIso } from "../../db/client";
import type {
  BiometricLog,
  CreateMedicationRequest,
  MedicationReminder,
  PatchMedicationRequest,
  PushSubscriptionRequest,
  UpsertBiometricRequest,
} from "../../types";

type BioRow = {
  user_sub: string;
  day_date: string;
  weight_kg: number | null;
  sleep_hours: number | null;
  water_glasses: number | null;
  stress: number | null;
  updated_at: unknown;
};

type MedRow = {
  id: string;
  user_sub: string;
  name: string;
  dosage: string | null;
  time_local: string;
  frequency: string;
  enabled: boolean;
  created_at: unknown;
  updated_at: unknown;
};

type PushRow = {
  id: string;
  user_sub: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: unknown;
};

function mapBio(row: BioRow): BiometricLog {
  return {
    date: row.day_date,
    weightKg: row.weight_kg,
    sleepHours: row.sleep_hours,
    waterGlasses: row.water_glasses,
    stress: (row.stress as BiometricLog["stress"]) ?? null,
    updatedAt: toIso(row.updated_at),
  };
}

function mapMed(row: MedRow): MedicationReminder {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    timeLocal: row.time_local,
    frequency: row.frequency as MedicationReminder["frequency"],
    enabled: row.enabled,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBiometrics(
  sub: string,
  from?: string,
  to?: string,
): Promise<BiometricLog[]> {
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
  const res = await query<BioRow>(
    `SELECT * FROM pcos_biometrics WHERE ${clauses.join(" AND ")} ORDER BY day_date ASC`,
    params,
  );
  return res.rows.map(mapBio);
}

export async function upsertBiometric(
  sub: string,
  body: UpsertBiometricRequest,
): Promise<BiometricLog> {
  const existingRows = await query<BioRow>(
    `SELECT * FROM pcos_biometrics WHERE user_sub = $1 AND day_date = $2`,
    [sub, body.date],
  );
  const existing = existingRows.rows[0]
    ? mapBio(existingRows.rows[0])
    : undefined;
  const now = new Date().toISOString();
  const next: BiometricLog = {
    date: body.date,
    weightKg:
      body.weightKg !== undefined
        ? body.weightKg
        : (existing?.weightKg ?? null),
    sleepHours:
      body.sleepHours !== undefined
        ? body.sleepHours
        : (existing?.sleepHours ?? null),
    waterGlasses:
      body.waterGlasses !== undefined
        ? body.waterGlasses
        : (existing?.waterGlasses ?? null),
    stress:
      body.stress !== undefined ? body.stress : (existing?.stress ?? null),
    updatedAt: now,
  };
  const res = await query<BioRow>(
    `INSERT INTO pcos_biometrics (
       user_sub, day_date, weight_kg, sleep_hours, water_glasses, stress, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)
     ON CONFLICT (user_sub, day_date) DO UPDATE SET
       weight_kg = EXCLUDED.weight_kg,
       sleep_hours = EXCLUDED.sleep_hours,
       water_glasses = EXCLUDED.water_glasses,
       stress = EXCLUDED.stress,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      next.date,
      next.weightKg,
      next.sleepHours,
      next.waterGlasses,
      next.stress,
      next.updatedAt,
    ],
  );
  return mapBio(res.rows[0]!);
}

export async function listMedications(
  sub: string,
): Promise<MedicationReminder[]> {
  const res = await query<MedRow>(
    `SELECT * FROM pcos_medications WHERE user_sub = $1 ORDER BY time_local ASC`,
    [sub],
  );
  return res.rows.map(mapMed);
}

export async function createMedication(
  sub: string,
  body: CreateMedicationRequest,
): Promise<MedicationReminder> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const res = await query<MedRow>(
    `INSERT INTO pcos_medications (
       id, user_sub, name, dosage, time_local, frequency, enabled, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
     RETURNING *`,
    [
      id,
      sub,
      body.name.trim(),
      body.dosage ?? null,
      body.timeLocal,
      body.frequency ?? "daily",
      body.enabled ?? true,
      now,
      now,
    ],
  );
  return mapMed(res.rows[0]!);
}

export async function patchMedication(
  sub: string,
  id: string,
  patch: PatchMedicationRequest,
): Promise<MedicationReminder | undefined> {
  const list = await listMedications(sub);
  const cur = list.find((m) => m.id === id);
  if (!cur) return undefined;
  const next: MedicationReminder = {
    ...cur,
    name: patch.name ?? cur.name,
    dosage: patch.dosage !== undefined ? patch.dosage : cur.dosage,
    timeLocal: patch.timeLocal ?? cur.timeLocal,
    frequency: patch.frequency ?? cur.frequency,
    enabled: patch.enabled ?? cur.enabled,
    updatedAt: new Date().toISOString(),
  };
  const res = await query<MedRow>(
    `UPDATE pcos_medications SET
       name = $3,
       dosage = $4,
       time_local = $5,
       frequency = $6,
       enabled = $7,
       updated_at = $8::timestamptz
     WHERE user_sub = $1 AND id = $2
     RETURNING *`,
    [
      sub,
      id,
      next.name,
      next.dosage,
      next.timeLocal,
      next.frequency,
      next.enabled,
      next.updatedAt,
    ],
  );
  const row = res.rows[0];
  return row ? mapMed(row) : undefined;
}

export async function deleteMedication(
  sub: string,
  id: string,
): Promise<boolean> {
  const res = await query(
    `DELETE FROM pcos_medications WHERE user_sub = $1 AND id = $2`,
    [sub, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function savePushSubscription(
  sub: string,
  body: PushSubscriptionRequest,
): Promise<{ id: string; endpoint: string }> {
  const existing = await query<PushRow>(
    `SELECT * FROM push_subscriptions WHERE user_sub = $1 AND endpoint = $2`,
    [sub, body.endpoint],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    await query(
      `UPDATE push_subscriptions SET p256dh = $3, auth = $4 WHERE id = $1 AND user_sub = $2`,
      [row.id, sub, body.keys.p256dh, body.keys.auth],
    );
    return { id: row.id, endpoint: row.endpoint };
  }
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO push_subscriptions (id, user_sub, endpoint, p256dh, auth, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [id, sub, body.endpoint, body.keys.p256dh, body.keys.auth],
  );
  return { id, endpoint: body.endpoint };
}

export async function listPushSubscriptions(sub: string) {
  const res = await query<PushRow>(
    `SELECT * FROM push_subscriptions WHERE user_sub = $1 ORDER BY created_at ASC`,
    [sub],
  );
  return res.rows.map((r) => ({
    id: r.id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
  }));
}

export async function purgeUserPcos(sub: string): Promise<void> {
  await query(`DELETE FROM push_subscriptions WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM pcos_medications WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM pcos_biometrics WHERE user_sub = $1`, [sub]);
}
