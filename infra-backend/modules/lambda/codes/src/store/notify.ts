import {
  inQuietHours,
  lockScreenSafePush,
  periodReminderDue,
  pushBodyIsLockSafe,
} from "../../../../../../packages/domain/src/index";
import { tzForMarket } from "../lib/marketplaceSeed";
import { buildPrediction } from "../lib/prediction";
import {
  dueMedications,
  getUser,
} from "./memory";
import {
  fertileForUser,
  getNotificationPrefs,
  listAppointments,
} from "./journey";
import { dueWalletMedicationIds } from "./wallet";
import {
  claimNotificationSend,
  listAllPushSubscriptions,
} from "./marketplace";
import { vapidKeys } from "../lib/secrets";

function localStamp(now: Date, timeZone: string): {
  date: string;
  hhmm: string;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${pick("year")}-${pick("month")}-${pick("day")}`;
  const hhmm = `${pick("hour")}:${pick("minute")}`;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { date, hhmm, weekday: map[pick("weekday")] ?? now.getUTCDay() };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function dueSlots(
  sub: string,
  date: string,
  hhmm: string,
  weekday: number,
): Promise<Array<{ kind: string; slot: string }>> {
  const prefs = await getNotificationPrefs(sub);
  if (!prefs.masterEnabled) return [];
  const out: Array<{ kind: string; slot: string }> = [];
  if (prefs.period) {
    const pred = await buildPrediction(sub);
    const next = pred.nextStarts[0];
    if (next) {
      const due = periodReminderDue(next, date, prefs.periodLeadDays ?? 1);
      if (due.lead) out.push({ kind: "period", slot: `period:${next}:lead` });
      if (due.dayOf) out.push({ kind: "period", slot: `period:${next}:day` });
    }
  }
  if (prefs.ovulation) {
    const fertile = await fertileForUser(sub);
    if (fertile.enoughData && fertile.fertileDates.includes(date)) {
      out.push({ kind: "ovulation", slot: `ovulation:${date}` });
    }
  }
  if (prefs.appointments) {
    const appts = await listAppointments(sub);
    for (const a of appts) {
      if (a.remindDayBefore && a.date === addDays(date, 1)) {
        out.push({ kind: "appointments", slot: `appt:${a.id}:day` });
      }
      if (
        a.remindHourBefore &&
        a.date === date &&
        a.timeLocal &&
        hourMatch(a.timeLocal, hhmm)
      ) {
        out.push({ kind: "appointments", slot: `appt:${a.id}:hour:${date}` });
      }
    }
  }
  if (prefs.medication) {
    const due = await dueMedications(sub, hhmm);
    const hour = hhmm.slice(0, 2);
    for (const m of due) {
      if (m.timeLocal.slice(0, 2) !== hour) continue;
      out.push({ kind: "medication", slot: `med:${m.id}:${date}:${hour}` });
    }
    const walletIds = await dueWalletMedicationIds(sub, hhmm, weekday);
    for (const id of walletIds) {
      out.push({ kind: "medication", slot: `wmed:${id}:${date}:${hour}` });
    }
  }
  if (prefs.weeklyInsights && weekday === 1 && hhmm >= "10:00" && hhmm < "11:00") {
    out.push({ kind: "weeklyInsights", slot: `weekly:${date}` });
  }
  return out;
}

function hourMatch(target: string, hhmm: string): boolean {
  return target.slice(0, 2) === hhmm.slice(0, 2);
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<boolean> {
  const keys = await vapidKeys();
  const publicKey = keys.publicKey;
  const privateKey = keys.privateKey;
  if (!publicKey || !privateKey) return false;
  const payload = lockScreenSafePush();
  if (!pushBodyIsLockSafe(payload.body)) return false;
  try {
    const mod = (await Function('return import("web-push")')()) as {
      default?: {
        setVapidDetails: (s: string, p: string, k: string) => void;
        sendNotification: (sub: unknown, payload: string) => Promise<unknown>;
      };
      setVapidDetails?: (s: string, p: string, k: string) => void;
      sendNotification?: (sub: unknown, payload: string) => Promise<unknown>;
    };
    const lib = mod.default ?? mod;
    if (!lib.setVapidDetails || !lib.sendNotification) return false;
    lib.setVapidDetails("mailto:privacy@girlcode360.local", publicKey, privateKey);
    await lib.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch {
    return false;
  }
}

export async function vapidPublicKey(): Promise<string | null> {
  return (await vapidKeys()).publicKey;
}

export async function runNotificationTick(now = new Date()): Promise<{
  users: number;
  claimed: number;
  sent: number;
  quiet: number;
  vapid: boolean;
}> {
  const subs = await listAllPushSubscriptions();
  const users = [...new Set(subs.map((s) => s.userSub))];
  let claimed = 0;
  let sent = 0;
  let quiet = 0;
  const keys = await vapidKeys();
  const vapid = Boolean(keys.publicKey && keys.privateKey);

  for (const sub of users) {
    const profile = await getUser(sub);
    const tz = tzForMarket(profile?.market ?? "UK");
    const local = localStamp(now, tz);
    const prefs = await getNotificationPrefs(sub);
    if (!prefs.masterEnabled) continue;
    if (inQuietHours(local.hhmm, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      quiet += 1;
      continue;
    }
    const slots = await dueSlots(sub, local.date, local.hhmm, local.weekday);
    const userSubs = subs.filter((s) => s.userSub === sub);
    for (const slot of slots) {
      if (!(await claimNotificationSend(sub, slot.kind, slot.slot))) continue;
      claimed += 1;
      if (!vapid) continue;
      for (const row of userSubs) {
        if (row.endpoint.startsWith("local://")) continue;
        if (await sendWebPush(row.endpoint, row.p256dh, row.auth)) sent += 1;
      }
    }
  }
  return { users: users.length, claimed, sent, quiet, vapid };
}
