import { isDsqlEnabled } from "../db/client";
import * as dsqlCycles from "./dsql/cycles";
import * as dsqlPcos from "./dsql/pcos";
import * as dsqlUsers from "./dsql/users";
import type {
  BiometricLog,
  ConsentPurpose,
  ConsentRecord,
  CreateCycleRequest,
  CreateMedicationRequest,
  Cycle,
  CycleDay,
  FlowLevel,
  HealthModule,
  Market,
  MedicationReminder,
  MoodLevel,
  PatchCycleRequest,
  PatchMedicationRequest,
  PushSubscriptionRequest,
  UpsertBiometricRequest,
  UpsertCycleDayRequest,
  UserProfile,
} from "../types";

const users = new Map<string, UserProfile>();
const consents = new Map<string, ConsentRecord[]>();
const cyclesByUser = new Map<string, Cycle[]>();
const daysByUser = new Map<string, Map<string, CycleDay>>();
const idempotency = new Map<string, unknown>();

export async function getUser(sub: string): Promise<UserProfile | undefined> {
  if (isDsqlEnabled()) return dsqlUsers.getUser(sub);
  return users.get(sub);
}

export async function upsertUser(
  sub: string,
  patch: Partial<UserProfile> & { email?: string },
): Promise<UserProfile> {
  if (isDsqlEnabled()) return dsqlUsers.upsertUser(sub, patch);
  const now = new Date().toISOString();
  const existing = users.get(sub);
  const next: UserProfile = {
    sub,
    email: patch.email ?? existing?.email,
    market: patch.market ?? existing?.market ?? "UK",
    locale: patch.locale ?? existing?.locale ?? "en-GB",
    ageConfirmed18: patch.ageConfirmed18 ?? existing?.ageConfirmed18 ?? false,
    onboardingComplete:
      patch.onboardingComplete ?? existing?.onboardingComplete ?? false,
    modules: patch.modules ?? existing?.modules ?? ["period_tracker"],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  users.set(sub, next);
  return next;
}

export async function setModules(
  sub: string,
  modules: HealthModule[],
): Promise<UserProfile> {
  if (isDsqlEnabled()) return dsqlUsers.setModules(sub, modules);
  if (!users.get(sub)) throw new Error("USER_NOT_FOUND");
  return upsertUser(sub, { modules });
}

export async function addConsents(
  sub: string,
  jurisdiction: Market,
  policyVersion: string,
  items: Array<{ purpose: ConsentPurpose; granted: boolean }>,
): Promise<ConsentRecord[]> {
  if (isDsqlEnabled()) {
    return dsqlUsers.addConsents(sub, jurisdiction, policyVersion, items);
  }
  const now = new Date().toISOString();
  const rows: ConsentRecord[] = items.map((item) => ({
    id: crypto.randomUUID(),
    purpose: item.purpose,
    granted: item.granted,
    policyVersion,
    jurisdiction,
    recordedAt: now,
  }));
  const prev = consents.get(sub) ?? [];
  consents.set(sub, [...prev, ...rows]);
  return rows;
}

export async function listConsents(sub: string): Promise<ConsentRecord[]> {
  if (isDsqlEnabled()) return dsqlUsers.listConsents(sub);
  return consents.get(sub) ?? [];
}

export async function latestConsentsByPurpose(
  sub: string,
): Promise<ConsentRecord[]> {
  if (isDsqlEnabled()) return dsqlUsers.latestConsentsByPurpose(sub);
  const all = await listConsents(sub);
  const map = new Map<ConsentPurpose, ConsentRecord>();
  for (const row of all) map.set(row.purpose, row);
  return [...map.values()];
}

function sortCycles(list: Cycle[]): Cycle[] {
  return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function listCycles(sub: string): Promise<Cycle[]> {
  if (isDsqlEnabled()) return dsqlCycles.listCycles(sub);
  return sortCycles(cyclesByUser.get(sub) ?? []);
}

export async function getCycle(
  sub: string,
  id: string,
): Promise<Cycle | undefined> {
  if (isDsqlEnabled()) return dsqlCycles.getCycle(sub, id);
  return (cyclesByUser.get(sub) ?? []).find((c) => c.id === id);
}

export async function createCycle(
  sub: string,
  body: CreateCycleRequest,
): Promise<Cycle> {
  if (isDsqlEnabled()) return dsqlCycles.createCycle(sub, body);
  const now = new Date().toISOString();
  const cycle: Cycle = {
    id: crypto.randomUUID(),
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    cycleLengthOverride: body.cycleLengthOverride ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const list = cyclesByUser.get(sub) ?? [];
  list.push(cycle);
  cyclesByUser.set(sub, list);
  return cycle;
}

export async function upsertCycleWithId(
  sub: string,
  id: string,
  body: CreateCycleRequest,
): Promise<Cycle> {
  if (isDsqlEnabled()) return dsqlCycles.upsertCycleWithId(sub, id, body);
  const existing = await getCycle(sub, id);
  if (existing) {
    return (await patchCycle(sub, id, {
      startDate: body.startDate,
      endDate: body.endDate,
      cycleLengthOverride: body.cycleLengthOverride,
    }))!;
  }
  const now = new Date().toISOString();
  const cycle: Cycle = {
    id,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    cycleLengthOverride: body.cycleLengthOverride ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const list = cyclesByUser.get(sub) ?? [];
  list.push(cycle);
  cyclesByUser.set(sub, list);
  return cycle;
}

export async function patchCycle(
  sub: string,
  id: string,
  patch: PatchCycleRequest,
): Promise<Cycle | undefined> {
  if (isDsqlEnabled()) return dsqlCycles.patchCycle(sub, id, patch);
  const list = cyclesByUser.get(sub) ?? [];
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const cur = list[idx]!;
  const next: Cycle = {
    ...cur,
    startDate: patch.startDate ?? cur.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : cur.endDate,
    cycleLengthOverride:
      patch.cycleLengthOverride !== undefined
        ? patch.cycleLengthOverride
        : cur.cycleLengthOverride,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  cyclesByUser.set(sub, list);
  return next;
}

export async function deleteCycle(sub: string, id: string): Promise<boolean> {
  if (isDsqlEnabled()) return dsqlCycles.deleteCycle(sub, id);
  const list = cyclesByUser.get(sub) ?? [];
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  cyclesByUser.set(sub, next);
  return true;
}

function dayMap(sub: string): Map<string, CycleDay> {
  let m = daysByUser.get(sub);
  if (!m) {
    m = new Map();
    daysByUser.set(sub, m);
  }
  return m;
}

export async function listDays(
  sub: string,
  from?: string,
  to?: string,
): Promise<CycleDay[]> {
  if (isDsqlEnabled()) return dsqlCycles.listDays(sub, from, to);
  const all = [...dayMap(sub).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return all.filter((d) => {
    if (from && d.date < from) return false;
    if (to && d.date > to) return false;
    return true;
  });
}

export async function upsertDay(
  sub: string,
  body: UpsertCycleDayRequest,
): Promise<CycleDay> {
  if (isDsqlEnabled()) return dsqlCycles.upsertDay(sub, body);
  const map = dayMap(sub);
  const existing = map.get(body.date);
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
  map.set(body.date, next);
  return next;
}

export async function getIdempotent(
  sub: string,
  key: string,
): Promise<unknown | undefined> {
  if (isDsqlEnabled()) return dsqlCycles.getIdempotent(sub, key);
  return idempotency.get(`${sub}:${key}`);
}

export async function setIdempotent(
  sub: string,
  key: string,
  response: unknown,
): Promise<void> {
  if (isDsqlEnabled()) return dsqlCycles.setIdempotent(sub, key, response);
  idempotency.set(`${sub}:${key}`, response);
}

/* ——— Phase 3: PCOS ——— */

const biometricsByUser = new Map<string, Map<string, BiometricLog>>();
const medsByUser = new Map<string, MedicationReminder[]>();
const pushByUser = new Map<
  string,
  Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
>();

function bioMap(sub: string): Map<string, BiometricLog> {
  let m = biometricsByUser.get(sub);
  if (!m) {
    m = new Map();
    biometricsByUser.set(sub, m);
  }
  return m;
}

export async function listBiometrics(
  sub: string,
  from?: string,
  to?: string,
): Promise<BiometricLog[]> {
  if (isDsqlEnabled()) return dsqlPcos.listBiometrics(sub, from, to);
  return [...bioMap(sub).values()]
    .filter((b) => {
      if (from && b.date < from) return false;
      if (to && b.date > to) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function upsertBiometric(
  sub: string,
  body: UpsertBiometricRequest,
): Promise<BiometricLog> {
  if (isDsqlEnabled()) return dsqlPcos.upsertBiometric(sub, body);
  const map = bioMap(sub);
  const existing = map.get(body.date);
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
  map.set(body.date, next);
  return next;
}

export async function listMedications(
  sub: string,
): Promise<MedicationReminder[]> {
  if (isDsqlEnabled()) return dsqlPcos.listMedications(sub);
  return [...(medsByUser.get(sub) ?? [])].sort((a, b) =>
    a.timeLocal.localeCompare(b.timeLocal),
  );
}

export async function createMedication(
  sub: string,
  body: CreateMedicationRequest,
): Promise<MedicationReminder> {
  if (isDsqlEnabled()) return dsqlPcos.createMedication(sub, body);
  const now = new Date().toISOString();
  const med: MedicationReminder = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    dosage: body.dosage ?? null,
    timeLocal: body.timeLocal,
    frequency: body.frequency ?? "daily",
    enabled: body.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const list = medsByUser.get(sub) ?? [];
  list.push(med);
  medsByUser.set(sub, list);
  return med;
}

export async function patchMedication(
  sub: string,
  id: string,
  patch: PatchMedicationRequest,
): Promise<MedicationReminder | undefined> {
  if (isDsqlEnabled()) return dsqlPcos.patchMedication(sub, id, patch);
  const list = medsByUser.get(sub) ?? [];
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return undefined;
  const cur = list[idx]!;
  const next: MedicationReminder = {
    ...cur,
    name: patch.name ?? cur.name,
    dosage: patch.dosage !== undefined ? patch.dosage : cur.dosage,
    timeLocal: patch.timeLocal ?? cur.timeLocal,
    frequency: patch.frequency ?? cur.frequency,
    enabled: patch.enabled ?? cur.enabled,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  medsByUser.set(sub, list);
  return next;
}

export async function deleteMedication(
  sub: string,
  id: string,
): Promise<boolean> {
  if (isDsqlEnabled()) return dsqlPcos.deleteMedication(sub, id);
  const list = medsByUser.get(sub) ?? [];
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  medsByUser.set(sub, next);
  return true;
}

export async function savePushSubscription(
  sub: string,
  body: PushSubscriptionRequest,
): Promise<{ id: string; endpoint: string }> {
  if (isDsqlEnabled()) return dsqlPcos.savePushSubscription(sub, body);
  const list = pushByUser.get(sub) ?? [];
  const existing = list.find((s) => s.endpoint === body.endpoint);
  if (existing) {
    existing.p256dh = body.keys.p256dh;
    existing.auth = body.keys.auth;
    return { id: existing.id, endpoint: existing.endpoint };
  }
  const row = {
    id: crypto.randomUUID(),
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  };
  list.push(row);
  pushByUser.set(sub, list);
  return { id: row.id, endpoint: row.endpoint };
}

export async function listPushSubscriptions(sub: string) {
  if (isDsqlEnabled()) return dsqlPcos.listPushSubscriptions(sub);
  return pushByUser.get(sub) ?? [];
}

/** Due reminders for scheduling (generic push body applied at send time). */
export async function dueMedications(
  sub: string,
  nowLocalHhMm: string,
): Promise<MedicationReminder[]> {
  const meds = await listMedications(sub);
  return meds.filter((m) => m.enabled && m.timeLocal <= nowLocalHhMm);
}

/** Art.17 purge — wipe profile + health maps for this user (DSQL when enabled). */
export async function purgeUserMemory(sub: string): Promise<void> {
  if (isDsqlEnabled()) {
    await dsqlPcos.purgeUserPcos(sub);
    await dsqlUsers.purgeUser(sub);
  }
  users.delete(sub);
  consents.delete(sub);
  cyclesByUser.delete(sub);
  daysByUser.delete(sub);
  biometricsByUser.delete(sub);
  medsByUser.delete(sub);
  pushByUser.delete(sub);
  for (const key of [...idempotency.keys()]) {
    if (key.startsWith(`${sub}:`)) idempotency.delete(key);
  }
}
