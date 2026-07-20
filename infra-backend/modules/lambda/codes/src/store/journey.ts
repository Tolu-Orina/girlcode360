import {
  calculateEdd,
  calculateFertileWindow,
  EMERGENCY_BY_MARKET,
  gestationalWeek,
  ttcMonthCount,
  ttcTwelveMonthPrompt,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { listCycles } from "./memory";
import { buildPrediction } from "../lib/prediction";
import * as dsqlJourney from "./dsql/journey";
import type {
  Appointment,
  CreateAppointmentRequest,
  InitPregnancyRequest,
  Market,
  MucusType,
  NotificationPrefs,
  PatchNotificationPrefsRequest,
  PregnancyDayLog,
  PregnancyProfile,
  TtcDayLog,
  TtcProfile,
  UpsertPregnancyDayRequest,
  UpsertTtcDayRequest,
} from "../types";

const pregnancyByUser = new Map<string, PregnancyProfile>();
const pregDaysByUser = new Map<string, Map<string, PregnancyDayLog>>();
const appointmentsByUser = new Map<string, Appointment[]>();
const ttcByUser = new Map<string, TtcProfile>();
const ttcDaysByUser = new Map<string, Map<string, TtcDayLog>>();
const notifByUser = new Map<string, NotificationPrefs>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getPregnancy(
  sub: string,
): Promise<PregnancyProfile | undefined> {
  if (isDsqlEnabled()) return dsqlJourney.getPregnancy(sub);
  return pregnancyByUser.get(sub);
}

export async function initPregnancy(
  sub: string,
  body: InitPregnancyRequest,
): Promise<PregnancyProfile> {
  if (isDsqlEnabled()) return dsqlJourney.initPregnancy(sub, body);
  const edd = calculateEdd(body.anchorDate, body.method);
  const now = new Date().toISOString();
  const existing = pregnancyByUser.get(sub);
  const profile: PregnancyProfile = {
    method: body.method,
    anchorDate: body.anchorDate,
    edd: edd.edd,
    eddEarly: edd.eddEarly,
    eddLate: edd.eddLate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  pregnancyByUser.set(sub, profile);
  return profile;
}

export async function pregnancyStatus(sub: string) {
  const profile = await getPregnancy(sub);
  if (!profile) return null;
  const week = gestationalWeek(
    profile.anchorDate,
    profile.method,
    todayIso(),
  );
  return { profile, week };
}

function pregDayMap(sub: string): Map<string, PregnancyDayLog> {
  let m = pregDaysByUser.get(sub);
  if (!m) {
    m = new Map();
    pregDaysByUser.set(sub, m);
  }
  return m;
}

export async function listPregnancyDays(sub: string): Promise<PregnancyDayLog[]> {
  if (isDsqlEnabled()) return dsqlJourney.listPregnancyDays(sub);
  return [...pregDayMap(sub).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export async function upsertPregnancyDay(
  sub: string,
  body: UpsertPregnancyDayRequest,
): Promise<PregnancyDayLog> {
  if (isDsqlEnabled()) return dsqlJourney.upsertPregnancyDay(sub, body);
  const map = pregDayMap(sub);
  const existing = map.get(body.date);
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
    note: body.note !== undefined ? body.note : (existing?.note ?? null),
    updatedAt: now,
  };
  map.set(body.date, next);
  return next;
}

export async function listAppointments(sub: string): Promise<Appointment[]> {
  if (isDsqlEnabled()) return dsqlJourney.listAppointments(sub);
  return [...(appointmentsByUser.get(sub) ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export async function createAppointment(
  sub: string,
  body: CreateAppointmentRequest,
): Promise<Appointment> {
  if (isDsqlEnabled()) return dsqlJourney.createAppointment(sub, body);
  const now = new Date().toISOString();
  const appt: Appointment = {
    id: crypto.randomUUID(),
    date: body.date,
    timeLocal: body.timeLocal ?? null,
    location: body.location ?? null,
    type: body.type,
    notes: body.notes ?? null,
    remindDayBefore: body.remindDayBefore ?? true,
    remindHourBefore: body.remindHourBefore ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const list = appointmentsByUser.get(sub) ?? [];
  list.push(appt);
  appointmentsByUser.set(sub, list);
  return appt;
}

export async function deleteAppointment(
  sub: string,
  id: string,
): Promise<boolean> {
  if (isDsqlEnabled()) return dsqlJourney.deleteAppointment(sub, id);
  const list = appointmentsByUser.get(sub) ?? [];
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  appointmentsByUser.set(sub, next);
  return true;
}

export async function getTtc(sub: string): Promise<TtcProfile | undefined> {
  if (isDsqlEnabled()) return dsqlJourney.getTtc(sub);
  return ttcByUser.get(sub);
}

export async function initTtc(
  sub: string,
  startedOn?: string,
): Promise<{
  profile: TtcProfile;
  monthsTrying: number;
  twelveMonthPrompt: string | null;
}> {
  const start = startedOn ?? todayIso();
  const profile = isDsqlEnabled()
    ? await dsqlJourney.initTtc(sub, start)
    : (() => {
        const now = new Date().toISOString();
        const p: TtcProfile = { startedOn: start, updatedAt: now };
        ttcByUser.set(sub, p);
        return p;
      })();
  const monthsTrying = ttcMonthCount(start, todayIso());
  return {
    profile,
    monthsTrying,
    twelveMonthPrompt: ttcTwelveMonthPrompt(monthsTrying),
  };
}

export async function ttcStatus(sub: string) {
  const profile = await getTtc(sub);
  if (!profile) return null;
  const monthsTrying = ttcMonthCount(profile.startedOn, todayIso());
  return {
    startedOn: profile.startedOn,
    monthsTrying,
    twelveMonthPrompt: ttcTwelveMonthPrompt(monthsTrying),
    updatedAt: profile.updatedAt,
  };
}

function ttcDayMap(sub: string): Map<string, TtcDayLog> {
  let m = ttcDaysByUser.get(sub);
  if (!m) {
    m = new Map();
    ttcDaysByUser.set(sub, m);
  }
  return m;
}

export async function listTtcDays(sub: string): Promise<TtcDayLog[]> {
  if (isDsqlEnabled()) return dsqlJourney.listTtcDays(sub);
  return [...ttcDayMap(sub).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export async function upsertTtcDay(
  sub: string,
  body: UpsertTtcDayRequest,
): Promise<TtcDayLog | { error: string }> {
  const intimacy = body.intimacy ?? false;
  if (intimacy && body.intimacyConsent !== true) {
    return { error: "intimacy_consent_required" };
  }
  if (isDsqlEnabled()) return dsqlJourney.upsertTtcDay(sub, body);
  const map = ttcDayMap(sub);
  const existing = map.get(body.date);
  const now = new Date().toISOString();
  const next: TtcDayLog = {
    date: body.date,
    bbtC: body.bbtC !== undefined ? body.bbtC : (existing?.bbtC ?? null),
    mucus:
      body.mucus !== undefined
        ? (body.mucus as MucusType | null)
        : (existing?.mucus ?? null),
    intimacy:
      body.intimacy !== undefined ? body.intimacy : (existing?.intimacy ?? false),
    note: body.note !== undefined ? body.note : (existing?.note ?? null),
    updatedAt: now,
  };
  if (body.intimacy === false) next.intimacy = false;
  map.set(body.date, next);
  return next;
}

export async function deleteTtcIntimacy(
  sub: string,
  date: string,
): Promise<boolean> {
  if (isDsqlEnabled()) return dsqlJourney.deleteTtcIntimacy(sub, date);
  const map = ttcDayMap(sub);
  const existing = map.get(date);
  if (!existing) return false;
  map.set(date, {
    ...existing,
    intimacy: false,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function fertileForUser(sub: string) {
  const cycles = await listCycles(sub);
  if (cycles.length < 2) {
    return {
      enoughData: false,
      ovulationDay: "",
      fertileStart: "",
      fertileEnd: "",
      fertileDates: [] as string[],
      cycleLengthDays: 28,
      message:
        "Log at least two periods to estimate a fertile window. Estimates are not a guarantee of fertility.",
    };
  }
  const prediction = await buildPrediction(sub);
  const last = cycles[cycles.length - 1]!;
  const window = calculateFertileWindow(
    last.startDate,
    prediction.cycleLengthDays,
  );
  if (!window) {
    return {
      enoughData: false,
      ovulationDay: "",
      fertileStart: "",
      fertileEnd: "",
      fertileDates: [] as string[],
      cycleLengthDays: prediction.cycleLengthDays,
      message: "Could not estimate fertile window from current data.",
    };
  }
  return { ...window, enoughData: true };
}

export async function defaultNotifPrefs(): Promise<NotificationPrefs> {
  return {
    masterEnabled: true,
    period: true,
    ovulation: true,
    appointments: true,
    medication: true,
    weeklyInsights: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    updatedAt: new Date().toISOString(),
  };
}

export async function getNotificationPrefs(
  sub: string,
): Promise<NotificationPrefs> {
  if (isDsqlEnabled()) {
    return (
      (await dsqlJourney.getNotificationPrefs(sub)) ??
      (await defaultNotifPrefs())
    );
  }
  return notifByUser.get(sub) ?? (await defaultNotifPrefs());
}

export async function patchNotificationPrefs(
  sub: string,
  patch: PatchNotificationPrefsRequest,
): Promise<NotificationPrefs> {
  const cur = await getNotificationPrefs(sub);
  if (isDsqlEnabled()) {
    return dsqlJourney.patchNotificationPrefs(sub, cur, patch);
  }
  const next: NotificationPrefs = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  notifByUser.set(sub, next);
  return next;
}

export async function emergencyNumbers(market: Market) {
  return EMERGENCY_BY_MARKET[market] ?? EMERGENCY_BY_MARKET.UK;
}

export async function purgeUserJourney(sub: string): Promise<void> {
  if (isDsqlEnabled()) await dsqlJourney.purgeUserJourney(sub);
  pregnancyByUser.delete(sub);
  pregDaysByUser.delete(sub);
  appointmentsByUser.delete(sub);
  ttcByUser.delete(sub);
  ttcDaysByUser.delete(sub);
  notifByUser.delete(sub);
}
