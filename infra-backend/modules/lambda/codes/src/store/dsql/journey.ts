import { parseJsonArray, query, toIso } from "../../db/client";
import type {
  Appointment,
  CreateAppointmentRequest,
  InitPregnancyRequest,
  PatchPregnancyRequest,
  MucusType,
  NotificationPrefs,
  PatchNotificationPrefsRequest,
  PregnancyDayLog,
  PregnancyProfile,
  TtcDayLog,
  TtcProfile,
  UpsertPregnancyDayRequest,
  UpsertTtcDayRequest,
} from "../../types";
import { calculateEdd, clampPeriodLeadDays } from "../../../../../../../packages/domain/src/index";

type PregRow = {
  user_sub: string;
  method: string;
  anchor_date: string;
  edd: string;
  edd_early: string;
  edd_late: string;
  pre_pregnancy_weight_kg: number | null;
  height_cm: number | null;
  created_at: unknown;
  updated_at: unknown;
};

type PregDayRow = {
  user_sub: string;
  day_date: string;
  symptoms: string;
  wellbeing: number | null;
  weight_kg: number | null;
  kicks: number | null;
  kick_session_minutes: number | null;
  note: string | null;
  updated_at: unknown;
};

type ApptRow = {
  id: string;
  user_sub: string;
  appt_date: string;
  time_local: string | null;
  location: string | null;
  appt_type: string;
  notes: string | null;
  remind_day_before: boolean;
  remind_hour_before: boolean;
  created_at: unknown;
  updated_at: unknown;
};

type TtcRow = {
  user_sub: string;
  started_on: string;
  updated_at: unknown;
};

type TtcDayRow = {
  user_sub: string;
  day_date: string;
  bbt_c: number | null;
  mucus: string | null;
  intimacy: boolean;
  intimacy_ciphertext: string | null;
  intimacy_iv: string | null;
  note: string | null;
  updated_at: unknown;
};

type NotifRow = {
  user_sub: string;
  master_enabled: boolean;
  period_enabled: boolean;
  ovulation_enabled: boolean;
  appointments_enabled: boolean;
  medication_enabled: boolean;
  weekly_insights_enabled: boolean;
  period_lead_days: number | null;
  quiet_hours_start: string;
  quiet_hours_end: string;
  updated_at: unknown;
};

function mapPreg(row: PregRow): PregnancyProfile {
  return {
    method: row.method as PregnancyProfile["method"],
    anchorDate: row.anchor_date,
    edd: row.edd,
    eddEarly: row.edd_early,
    eddLate: row.edd_late,
    prePregnancyWeightKg: row.pre_pregnancy_weight_kg ?? null,
    heightCm: row.height_cm ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPregDay(row: PregDayRow): PregnancyDayLog {
  return {
    date: row.day_date,
    symptoms: parseJsonArray(row.symptoms),
    wellbeing: (row.wellbeing as PregnancyDayLog["wellbeing"]) ?? null,
    weightKg: row.weight_kg,
    kicks: row.kicks,
    kickSessionMinutes: row.kick_session_minutes ?? null,
    note: row.note,
    updatedAt: toIso(row.updated_at),
  };
}

function mapAppt(row: ApptRow): Appointment {
  return {
    id: row.id,
    date: row.appt_date,
    timeLocal: row.time_local,
    location: row.location,
    type: row.appt_type,
    notes: row.notes,
    remindDayBefore: row.remind_day_before,
    remindHourBefore: row.remind_hour_before,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapTtc(row: TtcRow): TtcProfile {
  return {
    startedOn: row.started_on,
    updatedAt: toIso(row.updated_at),
  };
}

function mapTtcDay(row: TtcDayRow): TtcDayLog {
  return {
    date: row.day_date,
    bbtC: row.bbt_c,
    mucus: (row.mucus as MucusType | null) ?? null,
    intimacy: Boolean(row.intimacy) && !row.intimacy_ciphertext,
    intimacyCiphertext: row.intimacy_ciphertext ?? null,
    intimacyIv: row.intimacy_iv ?? null,
    note: row.note,
    updatedAt: toIso(row.updated_at),
  };
}

function mapNotif(row: NotifRow): NotificationPrefs {
  return {
    masterEnabled: row.master_enabled,
    period: row.period_enabled,
    ovulation: row.ovulation_enabled,
    appointments: row.appointments_enabled,
    medication: row.medication_enabled,
    weeklyInsights: row.weekly_insights_enabled,
    periodLeadDays: clampPeriodLeadDays(row.period_lead_days),
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    updatedAt: toIso(row.updated_at),
  };
}

export async function getPregnancy(
  sub: string,
): Promise<PregnancyProfile | undefined> {
  const res = await query<PregRow>(
    `SELECT * FROM pregnancy_profiles WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapPreg(row) : undefined;
}

export async function initPregnancy(
  sub: string,
  body: InitPregnancyRequest,
): Promise<PregnancyProfile> {
  const edd = calculateEdd(body.anchorDate, body.method);
  const now = new Date().toISOString();
  const existing = await getPregnancy(sub);
  const res = await query<PregRow>(
    `INSERT INTO pregnancy_profiles (
       user_sub, method, anchor_date, edd, edd_early, edd_late, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz)
     ON CONFLICT (user_sub) DO UPDATE SET
       method = EXCLUDED.method,
       anchor_date = EXCLUDED.anchor_date,
       edd = EXCLUDED.edd,
       edd_early = EXCLUDED.edd_early,
       edd_late = EXCLUDED.edd_late,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      body.method,
      body.anchorDate,
      edd.edd,
      edd.eddEarly,
      edd.eddLate,
      existing?.createdAt ?? now,
      now,
    ],
  );
  return mapPreg(res.rows[0]!);
}

export async function patchPregnancy(
  sub: string,
  body: PatchPregnancyRequest,
): Promise<PregnancyProfile | null> {
  const existing = await getPregnancy(sub);
  if (!existing) return null;
  const next = {
    prePregnancyWeightKg:
      body.prePregnancyWeightKg !== undefined
        ? body.prePregnancyWeightKg
        : (existing.prePregnancyWeightKg ?? null),
    heightCm:
      body.heightCm !== undefined ? body.heightCm : (existing.heightCm ?? null),
  };
  const res = await query<PregRow>(
    `UPDATE pregnancy_profiles
     SET pre_pregnancy_weight_kg = $2, height_cm = $3, updated_at = NOW()
     WHERE user_sub = $1
     RETURNING *`,
    [sub, next.prePregnancyWeightKg, next.heightCm],
  );
  const row = res.rows[0];
  return row ? mapPreg(row) : null;
}

export async function listPregnancyDays(
  sub: string,
): Promise<PregnancyDayLog[]> {
  const res = await query<PregDayRow>(
    `SELECT * FROM pregnancy_days WHERE user_sub = $1 ORDER BY day_date ASC`,
    [sub],
  );
  return res.rows.map(mapPregDay);
}

export async function upsertPregnancyDay(
  sub: string,
  body: UpsertPregnancyDayRequest,
): Promise<PregnancyDayLog> {
  const existingRows = await query<PregDayRow>(
    `SELECT * FROM pregnancy_days WHERE user_sub = $1 AND day_date = $2`,
    [sub, body.date],
  );
  const existing = existingRows.rows[0]
    ? mapPregDay(existingRows.rows[0])
    : undefined;
  const now = new Date().toISOString();
  const next: PregnancyDayLog = {
    date: body.date,
    symptoms: body.symptoms ?? existing?.symptoms ?? [],
    wellbeing:
      body.wellbeing !== undefined
        ? body.wellbeing
        : (existing?.wellbeing ?? null),
    weightKg:
      body.weightKg !== undefined
        ? body.weightKg
        : (existing?.weightKg ?? null),
    kicks: body.kicks !== undefined ? body.kicks : (existing?.kicks ?? null),
    kickSessionMinutes:
      body.kickSessionMinutes !== undefined
        ? body.kickSessionMinutes
        : (existing?.kickSessionMinutes ?? null),
    note: body.note !== undefined ? body.note : (existing?.note ?? null),
    updatedAt: now,
  };
  const res = await query<PregDayRow>(
    `INSERT INTO pregnancy_days (
       user_sub, day_date, symptoms, wellbeing, weight_kg, kicks, kick_session_minutes, note, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)
     ON CONFLICT (user_sub, day_date) DO UPDATE SET
       symptoms = EXCLUDED.symptoms,
       wellbeing = EXCLUDED.wellbeing,
       weight_kg = EXCLUDED.weight_kg,
       kicks = EXCLUDED.kicks,
       kick_session_minutes = EXCLUDED.kick_session_minutes,
       note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      next.date,
      JSON.stringify(next.symptoms),
      next.wellbeing,
      next.weightKg,
      next.kicks,
      next.kickSessionMinutes,
      next.note,
      next.updatedAt,
    ],
  );
  return mapPregDay(res.rows[0]!);
}

export async function listAppointments(sub: string): Promise<Appointment[]> {
  const res = await query<ApptRow>(
    `SELECT * FROM appointments WHERE user_sub = $1 ORDER BY appt_date ASC`,
    [sub],
  );
  return res.rows.map(mapAppt);
}

export async function createAppointment(
  sub: string,
  body: CreateAppointmentRequest,
): Promise<Appointment> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const res = await query<ApptRow>(
    `INSERT INTO appointments (
       id, user_sub, appt_date, time_local, location, appt_type, notes,
       remind_day_before, remind_hour_before, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz)
     RETURNING *`,
    [
      id,
      sub,
      body.date,
      body.timeLocal ?? null,
      body.location ?? null,
      body.type,
      body.notes ?? null,
      body.remindDayBefore ?? true,
      body.remindHourBefore ?? true,
      now,
      now,
    ],
  );
  return mapAppt(res.rows[0]!);
}

export async function deleteAppointment(
  sub: string,
  id: string,
): Promise<boolean> {
  const res = await query(
    `DELETE FROM appointments WHERE user_sub = $1 AND id = $2`,
    [sub, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getTtc(sub: string): Promise<TtcProfile | undefined> {
  const res = await query<TtcRow>(
    `SELECT * FROM ttc_profiles WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapTtc(row) : undefined;
}

export async function initTtc(
  sub: string,
  startedOn: string,
): Promise<TtcProfile> {
  const now = new Date().toISOString();
  const res = await query<TtcRow>(
    `INSERT INTO ttc_profiles (user_sub, started_on, updated_at)
     VALUES ($1,$2,$3::timestamptz)
     ON CONFLICT (user_sub) DO UPDATE SET
       started_on = EXCLUDED.started_on,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [sub, startedOn, now],
  );
  return mapTtc(res.rows[0]!);
}

export async function listTtcDays(sub: string): Promise<TtcDayLog[]> {
  const res = await query<TtcDayRow>(
    `SELECT * FROM ttc_days WHERE user_sub = $1 ORDER BY day_date ASC`,
    [sub],
  );
  return res.rows.map(mapTtcDay);
}

export async function upsertTtcDay(
  sub: string,
  body: UpsertTtcDayRequest,
): Promise<TtcDayLog> {
  const existingRows = await query<TtcDayRow>(
    `SELECT * FROM ttc_days WHERE user_sub = $1 AND day_date = $2`,
    [sub, body.date],
  );
  const existing = existingRows.rows[0]
    ? mapTtcDay(existingRows.rows[0])
    : undefined;
  const now = new Date().toISOString();
  const hasCipher = Boolean(body.intimacyCiphertext && body.intimacyIv);
  const next: TtcDayLog = {
    date: body.date,
    bbtC: body.bbtC !== undefined ? body.bbtC : (existing?.bbtC ?? null),
    mucus:
      body.mucus !== undefined
        ? (body.mucus as MucusType | null)
        : (existing?.mucus ?? null),
    intimacy: false,
    intimacyCiphertext:
      body.intimacyCiphertext !== undefined
        ? body.intimacyCiphertext
        : (existing?.intimacyCiphertext ?? null),
    intimacyIv:
      body.intimacyIv !== undefined
        ? body.intimacyIv
        : (existing?.intimacyIv ?? null),
    note: body.note !== undefined ? body.note : (existing?.note ?? null),
    updatedAt: now,
  };
  if (hasCipher) {
    next.intimacyCiphertext = body.intimacyCiphertext ?? null;
    next.intimacyIv = body.intimacyIv ?? null;
  }
  const res = await query<TtcDayRow>(
    `INSERT INTO ttc_days (
       user_sub, day_date, bbt_c, mucus, intimacy, intimacy_ciphertext, intimacy_iv, note, updated_at
     ) VALUES ($1,$2,$3,$4,FALSE,$5,$6,$7,$8::timestamptz)
     ON CONFLICT (user_sub, day_date) DO UPDATE SET
       bbt_c = EXCLUDED.bbt_c,
       mucus = EXCLUDED.mucus,
       intimacy = FALSE,
       intimacy_ciphertext = EXCLUDED.intimacy_ciphertext,
       intimacy_iv = EXCLUDED.intimacy_iv,
       note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      next.date,
      next.bbtC,
      next.mucus,
      next.intimacyCiphertext,
      next.intimacyIv,
      next.note,
      next.updatedAt,
    ],
  );
  return mapTtcDay(res.rows[0]!);
}

export async function deleteTtcIntimacy(
  sub: string,
  date: string,
): Promise<boolean> {
  const res = await query(
    `UPDATE ttc_days SET intimacy = FALSE, intimacy_ciphertext = NULL, intimacy_iv = NULL, updated_at = NOW()
     WHERE user_sub = $1 AND day_date = $2
     RETURNING day_date`,
    [sub, date],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getNotificationPrefs(
  sub: string,
): Promise<NotificationPrefs | undefined> {
  const res = await query<NotifRow>(
    `SELECT * FROM notification_prefs WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapNotif(row) : undefined;
}

export async function patchNotificationPrefs(
  sub: string,
  cur: NotificationPrefs,
  patch: PatchNotificationPrefsRequest,
): Promise<NotificationPrefs> {
  const next: NotificationPrefs = {
    ...cur,
    ...patch,
    periodLeadDays: clampPeriodLeadDays(
      patch.periodLeadDays ?? cur.periodLeadDays,
    ),
    updatedAt: new Date().toISOString(),
  };
  const res = await query<NotifRow>(
    `INSERT INTO notification_prefs (
       user_sub, master_enabled, period_enabled, ovulation_enabled,
       appointments_enabled, medication_enabled, weekly_insights_enabled,
       period_lead_days, quiet_hours_start, quiet_hours_end, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz)
     ON CONFLICT (user_sub) DO UPDATE SET
       master_enabled = EXCLUDED.master_enabled,
       period_enabled = EXCLUDED.period_enabled,
       ovulation_enabled = EXCLUDED.ovulation_enabled,
       appointments_enabled = EXCLUDED.appointments_enabled,
       medication_enabled = EXCLUDED.medication_enabled,
       weekly_insights_enabled = EXCLUDED.weekly_insights_enabled,
       period_lead_days = EXCLUDED.period_lead_days,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      sub,
      next.masterEnabled,
      next.period,
      next.ovulation,
      next.appointments,
      next.medication,
      next.weeklyInsights,
      clampPeriodLeadDays(next.periodLeadDays),
      next.quietHoursStart,
      next.quietHoursEnd,
      next.updatedAt,
    ],
  );
  return mapNotif(res.rows[0]!);
}

export async function purgeUserJourney(sub: string): Promise<void> {
  await query(`DELETE FROM notification_prefs WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM ttc_days WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM ttc_profiles WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM appointments WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM pregnancy_days WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM pregnancy_profiles WHERE user_sub = $1`, [sub]);
}
