import {
  buildPrepCardText,
  correlateSkinAndCycle,
  crisisMessage,
  daysBetween,
  detectCrisis,
  findDeniedPhrases,
  healthLensActivation,
  redactPii,
  runHealthLensRules,
  type HealthLensFinding,
} from "../../../../../../packages/domain/src/index";
import { converseNova } from "../../../../../../packages/ai-provider/src/index";
import { alenaGuestSystemPrompt, alenaSystemPrompt, healthLensNarrativeSystem } from "../../../../../../packages/ai-provider/src/prompts";
import { isDsqlEnabled } from "../db/client";
import { listCycles, listDays, getUser, listMedications } from "./memory";
import { listPregnancyDays, listTtcDays, pregnancyStatus, ttcStatus } from "./journey";
import { peekSkinScans } from "./mirror";
import { listWalletDocs } from "./wallet";
import { listMarketplace } from "./marketplace";
import type { Market } from "../types";
import { isPremium } from "./billing";
import * as dsqlAi from "./dsql/ai";

const FREE_ALENA_LIMIT = 3;
const FREE_HL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

const quota = new Map<string, number>(); // `${sub}:${day}`
const reports = new Map<
  string,
  Array<{
    id: string;
    createdAt: string;
    narrative: string;
    confidence: "Low" | "Medium" | "High";
    findings: HealthLensFinding[];
    stub: boolean;
  }>
>();
const hlPrefs = new Map<
  string,
  { populationLearningConsent: boolean; lastOndemandAt: string | null }
>();

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAlenaQuota(sub: string) {
  const used = isDsqlEnabled()
    ? await dsqlAi.getAlenaUsed(sub, dayKey())
    : (quota.get(`${sub}:${dayKey()}`) ?? 0);
  if (await isPremium(sub)) {
    return { used, limit: null as number | null, remaining: null as number | null };
  }
  return {
    used,
    limit: FREE_ALENA_LIMIT,
    remaining: Math.max(0, FREE_ALENA_LIMIT - used),
  };
}

async function consumeAlenaQuota(sub: string): Promise<boolean> {
  if (await isPremium(sub)) return true;
  const q = await getAlenaQuota(sub);
  if ((q.remaining ?? 0) <= 0) return false;
  if (isDsqlEnabled()) {
    await dsqlAi.incrementAlenaUsed(sub, dayKey());
  } else {
    const key = `${sub}:${dayKey()}`;
    quota.set(key, (quota.get(key) ?? 0) + 1);
  }
  return true;
}

const guestHits = new Map<string, { n: number; resetAt: number }>();
const GUEST_LIMIT = 8;
const GUEST_WINDOW_MS = 60 * 60 * 1000;

function guestAllowed(ip: string): boolean {
  const now = Date.now();
  const cur = guestHits.get(ip);
  if (!cur || now > cur.resetAt) {
    guestHits.set(ip, { n: 1, resetAt: now + GUEST_WINDOW_MS });
    return true;
  }
  if (cur.n >= GUEST_LIMIT) return false;
  cur.n += 1;
  return true;
}

export async function alenaGuestChat(
  message: string,
  market: Market,
  ip: string,
): Promise<{
  reply: string;
  crisis: boolean;
  stub: boolean;
  remaining: number;
}> {
  const clean = redactPii(message).slice(0, 2000);
  if (detectCrisis(clean)) {
    return {
      reply: crisisMessage(market),
      crisis: true,
      stub: false,
      remaining: GUEST_LIMIT,
    };
  }
  if (!guestAllowed(ip)) {
    return {
      reply:
        "I’ve hit the guest chat limit for this hour. Create a free account to keep talking with Alena in the app.",
      crisis: false,
      stub: true,
      remaining: 0,
    };
  }
  const result = await converseNova({
    system: alenaGuestSystemPrompt(market),
    messages: [{ role: "user", content: clean }],
    maxTokens: 400,
  });
  const cur = guestHits.get(ip);
  let reply = result.text;
  if (findDeniedPhrases(reply).length) {
    reply =
      "I need to stay on the wellness side of this. Create an account if you want Alena to use logs you allow — still not a diagnosis.";
  }
  return {
    reply,
    crisis: false,
    stub: result.stub,
    remaining: Math.max(0, GUEST_LIMIT - (cur?.n ?? 0)),
  };
}

export async function assembleAlenaContext(
  sub: string,
): Promise<Record<string, unknown>> {
  const profile = await getUser(sub);
  const cycles = await listCycles(sub);
  const starts = cycles.map((c) => c.startDate).sort();
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    intervals.push(daysBetween(starts[i - 1]!, starts[i]!));
  }
  const days = (await listDays(sub)).slice(-45);
  const symptomCounts = new Map<string, number>();
  for (const d of days) {
    for (const s of d.symptomIds) {
      symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
    }
  }
  const recent_symptoms = [...symptomCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, n]) => `${id.replace(/_/g, " ")} (${n} days)`);

  const avg =
    intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : null;

  const ttc = await ttcStatus(sub);
  const preg = await pregnancyStatus(sub);

  const ctx = {
    market: profile?.market ?? "UK",
    modules_active: profile?.modules ?? [],
    cycle_summary: {
      avg_length: avg,
      last_6_cycles: intervals.slice(-6),
      cycle_count: cycles.length,
    },
    recent_symptoms,
    ttc_months: ttc?.monthsTrying ?? null,
    pregnancy_active: Boolean(preg),
    pregnancy_week: preg?.week ?? null,
    last_logged: days[days.length - 1]?.date ?? null,
  };
  const json = JSON.stringify(ctx);
  return json.length > 4000
    ? { ...ctx, recent_symptoms: recent_symptoms.slice(0, 3), _truncated: true }
    : ctx;
}

const alenaGlobalHits: number[] = [];

function alenaGlobalOk(): boolean {
  const now = Date.now();
  while (alenaGlobalHits.length && now - alenaGlobalHits[0]! > 60_000) {
    alenaGlobalHits.shift();
  }
  return alenaGlobalHits.length < 120;
}

function noteAlenaGlobal(): void {
  alenaGlobalHits.push(Date.now());
}

const SAFE_ALENA_FALLBACK =
  "I need to stay on the wellness side of this. I can help you list what you have logged and questions for a clinician, but I cannot say what condition you have.";

export async function alenaChat(
  sub: string,
  message: string,
  mode: "context" | "anonymous",
  opts?: {
    openedFrom?: string;
    moduleHint?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    lat?: number;
    lng?: number;
  },
): Promise<{
  reply: string;
  crisis: boolean;
  stub: boolean;
  quota: Awaited<ReturnType<typeof getAlenaQuota>>;
  error?: "quota_exceeded" | "alena_busy";
}> {
  const profile = await getUser(sub);
  const market = (profile?.market ?? "UK") as Market;
  const cleanMessage = redactPii(message).slice(0, 2000);

  if (detectCrisis(cleanMessage)) {
    let nearby: { name: string; distanceKm: number } | null = null;
    if (typeof opts?.lat === "number" && typeof opts?.lng === "number") {
      const clinics = await listMarketplace({
        origin: { lat: opts.lat, lng: opts.lng },
        category: "clinic",
        radiusKm: 5,
        weekday: new Date().getUTCDay(),
        hhmm: "12:00",
      });
      const first = clinics[0];
      if (first?.distanceKm != null) {
        nearby = { name: first.name, distanceKm: first.distanceKm };
      }
    }
    return {
      reply: crisisMessage(market, nearby),
      crisis: true,
      stub: false,
      quota: await getAlenaQuota(sub),
    };
  }

  if (!alenaGlobalOk()) {
    return {
      reply: "",
      crisis: false,
      stub: true,
      quota: await getAlenaQuota(sub),
      error: "alena_busy",
    };
  }

  if (!(await consumeAlenaQuota(sub))) {
    return {
      reply: "",
      crisis: false,
      stub: true,
      quota: await getAlenaQuota(sub),
      error: "quota_exceeded",
    };
  }

  noteAlenaGlobal();

  const history = (opts?.history ?? [])
    .slice(-6)
    .map((m) => ({
      role: m.role,
      content: redactPii(m.content).slice(0, 800),
    }))
    .filter((m) => m.content.length > 0);

  const system = alenaSystemPrompt(market, mode);
  const question = cleanMessage;
  const messages =
    mode === "context"
      ? [
          ...history,
          {
            role: "user" as const,
            content: `Health summary (pseudonymised JSON):\n${JSON.stringify({
              ...(await assembleAlenaContext(sub)),
              opened_from: opts?.openedFrom ?? null,
              module_hint: opts?.moduleHint ?? null,
            })}\n\nQuestion: ${question}`,
          },
        ]
      : [...history, { role: "user" as const, content: question }];

  const result = await converseNova({ system, messages });
  let reply = result.text;
  if (findDeniedPhrases(reply).length) reply = SAFE_ALENA_FALLBACK;
  return {
    reply,
    crisis: false,
    stub: result.stub,
    quota: await getAlenaQuota(sub),
  };
}

async function lensInput(sub: string) {
  const profile = await getUser(sub);
  const cycles = await listCycles(sub);
  const starts = cycles.map((c) => c.startDate).sort();
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    intervals.push(daysBetween(starts[i - 1]!, starts[i]!));
  }
  const days = await listDays(sub);
  const pregDays = await listPregnancyDays(sub);
  const ttcDays = await listTtcDays(sub);
  const allDates = [
    ...starts,
    ...days.map((d) => d.date),
    ...pregDays.map((d) => d.date),
    ...ttcDays.map((d) => d.date),
  ]
    .filter(Boolean)
    .sort();
  const first = allDates[0];
  const last = allDates[allDates.length - 1];
  const loggingSpanDays =
    first && last ? Math.max(0, daysBetween(first, last)) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const countIn = (from: number, to: number) =>
    days
      .filter((d) => {
        const dist = daysBetween(d.date, today);
        return dist >= from && dist <= to;
      })
      .reduce((n, d) => n + d.symptomIds.length, 0);

  const kicksLast7Days = pregDays
    .filter((d) => daysBetween(d.date, today) <= 7)
    .reduce((n, d) => n + (d.kicks ?? 0), 0);
  const movementLogs = pregDays.filter(
    (d) =>
      daysBetween(d.date, today) <= 7 &&
      d.symptoms.some((s) => s === "movement_felt" || s === "movement_reduced"),
  );
  const movementReducedLast7 = movementLogs.length
    ? movementLogs.every((d) => d.symptoms.includes("movement_reduced"))
    : null;

  const preg = await pregnancyStatus(sub);
  const mirrorScans = await peekSkinScans(sub);
  const mirrorInsight = correlateSkinAndCycle(
    mirrorScans
      .filter((s) => s.status === "success")
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        cyclePhase: s.cyclePhaseAtScan,
        scores: s.scores,
        symptomIds:
          days.find((d) => d.date === s.createdAt.slice(0, 10))?.symptomIds ??
          [],
        seeded: s.seeded,
      })),
  );

  return {
    cycleIntervalsDays: intervals,
    loggingSpanDays,
    cycleCount: cycles.length,
    recentSymptomIds: days.slice(-60).flatMap((d) => d.symptomIds),
    pregnancyWeek: preg?.week ?? null,
    kicksLast7Days: pregDays.some((d) => d.kicks != null)
      ? kicksLast7Days
      : null,
    movementReducedLast7,
    symptomCountRecent30: countIn(0, 30),
    symptomCountPrev30: countIn(31, 60),
    pcosModule: profile?.modules.includes("pcos_manager") ?? false,
    mirrorInsight,
  };
}

async function getHlPrefs(sub: string) {
  if (isDsqlEnabled()) return dsqlAi.getHealthLensPrefs(sub);
  return (
    hlPrefs.get(sub) ?? {
      populationLearningConsent: false,
      lastOndemandAt: null,
    }
  );
}

async function setHlPrefs(
  sub: string,
  prefs: { populationLearningConsent: boolean; lastOndemandAt: string | null },
) {
  if (isDsqlEnabled()) return dsqlAi.setHealthLensPrefs(sub, prefs);
  hlPrefs.set(sub, prefs);
  return prefs;
}

export async function getHealthLensStatus(sub: string) {
  const input = await lensInput(sub);
  const act = healthLensActivation(input.cycleCount, input.loggingSpanDays);
  const prefs = await getHlPrefs(sub);
  return { ...act, populationLearningConsent: prefs.populationLearningConsent };
}

export async function setPopulationLearningConsent(
  sub: string,
  granted: boolean,
) {
  const cur = await getHlPrefs(sub);
  await setHlPrefs(sub, { ...cur, populationLearningConsent: granted });
  return getHealthLensStatus(sub);
}

export async function generateHealthLensReport(
  sub: string,
  opts?: { monthly?: boolean },
): Promise<
  | {
      id: string;
      createdAt: string;
      narrative: string;
      confidence: "Low" | "Medium" | "High";
      findings: HealthLensFinding[];
      stub: boolean;
    }
  | { error: string }
> {
  const status = await getHealthLensStatus(sub);
  if (!status.activated) return { error: "not_activated" };

  if (!opts?.monthly && !(await isPremium(sub))) {
    const prefs = await getHlPrefs(sub);
    if (
      prefs.lastOndemandAt &&
      Date.now() - Date.parse(prefs.lastOndemandAt) < FREE_HL_COOLDOWN_MS
    ) {
      return { error: "ondemand_cooldown" };
    }
  }

  const findings = runHealthLensRules(await lensInput(sub));
  const confidence =
    findings.find((f) => f.confidence === "High")?.confidence ??
    findings.find((f) => f.confidence === "Medium")?.confidence ??
    "Low";

  const profile = await getUser(sub);
  const market = (profile?.market ?? "UK") as Market;
  const result = await converseNova({
    system: healthLensNarrativeSystem(market),
    messages: [
      {
        role: "user",
        content: JSON.stringify({ confidence, findings }),
      },
    ],
    maxTokens: 600,
  });

  let narrative = result.text;
  if (findDeniedPhrases(narrative).length) {
    narrative = findings.map((f) => `${f.title}: ${f.body}`).join("\n\n");
  }

  const report = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    narrative,
    confidence,
    findings,
    stub: result.stub,
  };

  if (isDsqlEnabled()) {
    await dsqlAi.insertHealthLensReport(sub, report);
  } else {
    const list = reports.get(sub) ?? [];
    list.unshift(report);
    reports.set(sub, list.slice(0, 20));
  }

  if (!opts?.monthly) {
    const prefs = await getHlPrefs(sub);
    await setHlPrefs(sub, { ...prefs, lastOndemandAt: report.createdAt });
  }

  return report;
}

export async function maybeMonthlyHealthLensReport(sub: string): Promise<void> {
  const status = await getHealthLensStatus(sub);
  if (!status.activated) return;
  const latest = await latestHealthLensReport(sub);
  const ym = new Date().toISOString().slice(0, 7);
  if (latest?.createdAt.startsWith(ym)) return;
  await generateHealthLensReport(sub, { monthly: true });
}

export async function latestHealthLensReport(sub: string) {
  if (isDsqlEnabled()) return dsqlAi.latestHealthLensReport(sub);
  return (reports.get(sub) ?? [])[0] ?? null;
}

export async function buildPrepCard(sub: string, questions: string[]) {
  const findings = runHealthLensRules(await lensInput(sub));
  const cycles = await listCycles(sub);
  const days = await listDays(sub);
  const profile = await getUser(sub);
  const meds = await listMedications(sub);
  const wallet = await listWalletDocs(sub);
  const recentSymptoms = days.slice(-90).flatMap((d) => d.symptomIds);
  const symptomCounts = new Map<string, number>();
  for (const id of recentSymptoms) {
    symptomCounts.set(id, (symptomCounts.get(id) ?? 0) + 1);
  }
  const symptomSummary = [...symptomCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, n]) => `${id.replace(/_/g, " ")} × ${n}`)
    .join("; ") || "No symptoms logged in the recent window.";
  const medicationSummary = meds.length
    ? meds
        .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""} (${m.frequency})`)
        .join("; ")
    : "No medication reminders logged.";
  const walletSummary = wallet.length
    ? wallet.map((d) => d.filename).join("; ")
    : "No Health Wallet documents.";
  const cycleSummary = `${cycles.length} cycles logged; last start ${cycles[cycles.length - 1]?.startDate ?? "—"}; modules: ${(profile?.modules ?? []).join(", ") || "none"}`;
  const text = buildPrepCardText({
    market: profile?.market ?? "UK",
    findings,
    cycleSummary,
    symptomSummary,
    medicationSummary,
    walletSummary,
    questions,
  });
  return {
    text,
    filename: `girlcode360-prep-card-${new Date().toISOString().slice(0, 10)}.txt`,
    createdAt: new Date().toISOString(),
  };
}

export const ALENA_DISCLAIMER =
  "AI-generated wellness guidance — not a diagnosis or medical advice. Speak with a clinician for personal medical decisions.";

export async function countHealthLensReports(sub: string): Promise<number> {
  if (isDsqlEnabled()) return dsqlAi.countHealthLensReports(sub);
  return (reports.get(sub) ?? []).length;
}

export async function listHealthLensReportsForExport(sub: string) {
  if (isDsqlEnabled()) return dsqlAi.listHealthLensReports(sub);
  return reports.get(sub) ?? [];
}

export async function purgeUserAi(sub: string): Promise<void> {
  if (isDsqlEnabled()) await dsqlAi.purgeUserAi(sub);
  reports.delete(sub);
  hlPrefs.delete(sub);
  for (const key of [...quota.keys()]) {
    if (key.startsWith(`${sub}:`)) quota.delete(key);
  }
}
