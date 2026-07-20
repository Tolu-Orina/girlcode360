import {
  buildPrepCardText,
  crisisMessage,
  daysBetween,
  detectCrisis,
  healthLensActivation,
  runHealthLensRules,
  type HealthLensFinding,
} from "../../../../../../packages/domain/src/index";
import { converseNova } from "../../../../../../packages/ai-provider/src/index";
import { zaraSystemPrompt } from "../../../../../../packages/ai-provider/src/prompts";
import { isDsqlEnabled } from "../db/client";
import { listCycles, listDays, getUser } from "./memory";
import { getPregnancy, listPregnancyDays, ttcStatus } from "./journey";
import type { Market } from "../types";
import { isPremium } from "./billing";
import * as dsqlAi from "./dsql/ai";

const FREE_ZARA_LIMIT = 3;
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

export async function getZaraQuota(sub: string) {
  const used = isDsqlEnabled()
    ? await dsqlAi.getZaraUsed(sub, dayKey())
    : (quota.get(`${sub}:${dayKey()}`) ?? 0);
  if (await isPremium(sub)) {
    return { used, limit: null as number | null, remaining: null as number | null };
  }
  return {
    used,
    limit: FREE_ZARA_LIMIT,
    remaining: Math.max(0, FREE_ZARA_LIMIT - used),
  };
}

async function consumeZaraQuota(sub: string): Promise<boolean> {
  if (await isPremium(sub)) return true;
  const q = await getZaraQuota(sub);
  if ((q.remaining ?? 0) <= 0) return false;
  if (isDsqlEnabled()) {
    await dsqlAi.incrementZaraUsed(sub, dayKey());
  } else {
    const key = `${sub}:${dayKey()}`;
    quota.set(key, (quota.get(key) ?? 0) + 1);
  }
  return true;
}

export async function assembleZaraContext(
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
  const preg = await getPregnancy(sub);

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
    last_logged: days[days.length - 1]?.date ?? null,
  };
  const json = JSON.stringify(ctx);
  return json.length > 4000
    ? { ...ctx, recent_symptoms: recent_symptoms.slice(0, 3), _truncated: true }
    : ctx;
}

export async function zaraChat(
  sub: string,
  message: string,
  mode: "context" | "anonymous",
): Promise<{
  reply: string;
  crisis: boolean;
  stub: boolean;
  quota: Awaited<ReturnType<typeof getZaraQuota>>;
}> {
  const profile = await getUser(sub);
  const market = (profile?.market ?? "UK") as Market;

  if (detectCrisis(message)) {
    return {
      reply: crisisMessage(market),
      crisis: true,
      stub: false,
      quota: await getZaraQuota(sub),
    };
  }

  if (!(await consumeZaraQuota(sub))) {
    return {
      reply:
        "You’ve reached today’s free Zara conversations (3). Premium unlocks unlimited chats, or try again tomorrow.",
      crisis: false,
      stub: true,
      quota: await getZaraQuota(sub),
    };
  }

  const system = zaraSystemPrompt(market, mode);
  const messages =
    mode === "context"
      ? [
          {
            role: "user" as const,
            content: `Health summary (pseudonymised JSON):\n${JSON.stringify(await assembleZaraContext(sub))}\n\nQuestion: ${message}`,
          },
        ]
      : [{ role: "user" as const, content: message }];

  const result = await converseNova({ system, messages });
  return {
    reply: result.text,
    crisis: false,
    stub: result.stub,
    quota: await getZaraQuota(sub),
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
  const first = days[0]?.date ?? starts[0];
  const last = days[days.length - 1]?.date ?? starts[starts.length - 1];
  const loggingSpanDays =
    first && last ? Math.max(0, daysBetween(first, last)) : 0;
  const pregDays = await listPregnancyDays(sub);
  const kicksLast7Days = pregDays
    .slice(-7)
    .reduce((n, d) => n + (d.kicks ?? 0), 0);

  return {
    cycleIntervalsDays: intervals,
    loggingSpanDays,
    cycleCount: cycles.length,
    recentSymptomIds: days.slice(-60).flatMap((d) => d.symptomIds),
    pregnancyWeek: null as number | null,
    kicksLast7Days: pregDays.some((d) => d.kicks != null)
      ? kicksLast7Days
      : null,
    pcosModule: profile?.modules.includes("pcos_manager") ?? false,
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

export async function generateHealthLensReport(sub: string): Promise<
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

  if (!(await isPremium(sub))) {
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
  const system = `Summarise these wellness rule findings for the user. Never diagnose. Market=${market}.`;
  const result = await converseNova({
    system,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ confidence, findings }),
      },
    ],
    maxTokens: 600,
  });

  const report = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    narrative: result.text,
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

  const prefs = await getHlPrefs(sub);
  await setHlPrefs(sub, { ...prefs, lastOndemandAt: report.createdAt });

  return report;
}

export async function latestHealthLensReport(sub: string) {
  if (isDsqlEnabled()) return dsqlAi.latestHealthLensReport(sub);
  return (reports.get(sub) ?? [])[0] ?? null;
}

export async function buildPrepCard(sub: string, questions: string[]) {
  const findings = runHealthLensRules(await lensInput(sub));
  const cycles = await listCycles(sub);
  const profile = await getUser(sub);
  const cycleSummary = `${cycles.length} cycles logged; modules: ${(profile?.modules ?? []).join(", ") || "none"}`;
  const text = buildPrepCardText({
    market: profile?.market ?? "UK",
    findings,
    cycleSummary,
    questions,
  });
  return {
    text,
    filename: `girlcode360-prep-card-${new Date().toISOString().slice(0, 10)}.txt`,
    createdAt: new Date().toISOString(),
  };
}

export const ZARA_DISCLAIMER =
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
