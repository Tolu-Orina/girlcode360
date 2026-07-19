/** Pure domain helpers — cycle prediction + copy safety */

export function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stddev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = average(nums);
  if (mean === null) return null;
  const variance =
    nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

/** Banned diagnostic phrasing for CI / copy checks */
export const DIAGNOSIS_DENYLIST = [
  "you have pcos",
  "you are pregnant",
  "diagnosed with",
  "this confirms",
  "this diagnoses",
  "you have been diagnosed",
] as const;

export type CycleSpan = {
  /** ISO date YYYY-MM-DD */
  startDate: string;
  /** ISO date YYYY-MM-DD; omit if ongoing */
  endDate?: string | null;
};

export type PredictionResult = {
  /** Mean cycle length used for projection */
  cycleLengthDays: number;
  /** Mean period length (bleeding days); default 5 if unknown */
  periodLengthDays: number;
  /** Next 3 predicted period start dates (YYYY-MM-DD) */
  nextStarts: string[];
  /** ± days confidence band from stddev */
  confidenceBandDays: number;
  /** True when cycle length variance is high */
  highVariance: boolean;
  /** Wellness copy — never diagnostic */
  message: string;
};

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
const HIGH_VARIANCE_THRESHOLD = 4;

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/**
 * Predict next periods from logged cycles.
 * Requires ≥2 completed cycle starts. Uses last N=min(6, count) intervals.
 * Optional irregular override replaces computed cycle length.
 */
export function predictNextPeriods(
  cycles: CycleSpan[],
  opts?: { cycleLengthOverride?: number | null },
): PredictionResult | null {
  const sorted = [...cycles]
    .filter((c) => c.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (sorted.length < 2) return null;

  const starts = sorted.map((c) => c.startDate);
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1]!, starts[i]!);
    if (gap > 0 && gap < 90) intervals.push(gap);
  }
  if (intervals.length === 0) return null;

  const window = intervals.slice(-Math.min(6, intervals.length));
  const meanCycle = average(window) ?? DEFAULT_CYCLE;
  const sd = stddev(window);
  const highVariance = (sd ?? 0) >= HIGH_VARIANCE_THRESHOLD;

  const cycleLengthDays = Math.round(
    opts?.cycleLengthOverride && opts.cycleLengthOverride > 0
      ? opts.cycleLengthOverride
      : meanCycle,
  );

  const periodLengths = sorted
    .filter((c) => c.endDate)
    .map((c) => daysBetween(c.startDate, c.endDate!) + 1)
    .filter((n) => n > 0 && n <= 14);
  const periodLengthDays = Math.round(
    average(periodLengths) ?? DEFAULT_PERIOD,
  );

  const lastStart = starts[starts.length - 1]!;
  const nextStarts = [1, 2, 3].map((i) =>
    addDays(lastStart, cycleLengthDays * i),
  );

  const confidenceBandDays = Math.max(1, Math.round(sd ?? 2));

  const message = highVariance
    ? "Your cycles vary — predictions are approximate."
    : "Predictions are estimates based on your recent logs, not medical advice.";

  return {
    cycleLengthDays,
    periodLengthDays,
    nextStarts,
    confidenceBandDays,
    highVariance,
    message,
  };
}

/** Expand predicted period start into bleeding day ISO dates */
export function predictedPeriodDates(
  start: string,
  periodLengthDays: number,
): string[] {
  const len = Math.max(1, periodLengthDays);
  return Array.from({ length: len }, (_, i) => addDays(start, i));
}

/* ——— Phase 3: PCOS insight stubs (wellness language only) ——— */

export type InsightInput = {
  cycleIntervalsDays: number[];
  recentSymptomIds: string[];
  recentStressScores: number[];
};

export type InsightCard = {
  id: string;
  title: string;
  body: string;
  kind: "irregularity" | "co_occurrence" | "data";
};

/**
 * Rule-based wellness insights — never diagnostic.
 * Feeds HealthLens later; copy must pass DIAGNOSIS_DENYLIST.
 */
export function buildPcosInsights(input: InsightInput): InsightCard[] {
  const cards: InsightCard[] = [];
  const intervals = input.cycleIntervalsDays.filter((n) => n > 0 && n < 90);
  const sd = stddev(intervals);
  const mean = average(intervals);

  if (intervals.length >= 2 && (sd ?? 0) >= 4) {
    cards.push({
      id: "irregularity",
      kind: "irregularity",
      title: "Your cycle lengths vary",
      body: `Recent gaps average about ${Math.round(mean ?? 0)} days with noticeable spread. That can happen for many reasons — consider sharing your log with a clinician if it concerns you. This is a possible pattern, not a diagnosis.`,
    });
  } else if (intervals.length < 2) {
    cards.push({
      id: "need-cycles",
      kind: "data",
      title: "More cycle data helps",
      body: "Log at least two periods to unlock irregularity and timing insights. Estimates stay wellness-only.",
    });
  }

  const counts = new Map<string, number>();
  for (const id of input.recentSymptomIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) {
    cards.push({
      id: "symptom-frequency",
      kind: "co_occurrence",
      title: "A symptom shows up often",
      body: `“${top[0].replace(/_/g, " ")}” appeared ${top[1]} times in your recent diary. Possible patterns can support a clinic conversation — they do not confirm a condition.`,
    });
  }

  const stress = input.recentStressScores.filter((n) => n >= 1 && n <= 5);
  const stressAvg = average(stress);
  if (stressAvg !== null && stressAvg >= 4 && intervals.length >= 2) {
    cards.push({
      id: "stress-cycle",
      kind: "co_occurrence",
      title: "Stress and cycle timing",
      body: "Higher stress scores appear alongside your recent cycle logs. Sleep and stress often move together with cycle changes for some people — a possible correlation to explore with care, not proof of any diagnosis.",
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: "steady",
      kind: "data",
      title: "Keep logging",
      body: "No strong irregularity or co-occurrence flags from the current window. Continue tracking for a clearer wellness picture over time.",
    });
  }

  return cards;
}

/** Scan text for banned diagnostic phrasing (FR-028). */
export function findDeniedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return DIAGNOSIS_DENYLIST.filter((p) => lower.includes(p));
}

/* ——— Phase 4: Pregnancy + TTC ——— */

export type EddResult = {
  /** Midpoint EDD (Naegele from LMP, or conception + 266) */
  edd: string;
  eddEarly: string;
  eddLate: string;
  method: "lmp" | "conception";
};

/** Naegele’s rule: LMP + 280 days; range ±7 days. Conception path: +266 days. */
export function calculateEdd(
  date: string,
  method: "lmp" | "conception",
): EddResult {
  const offset = method === "lmp" ? 280 : 266;
  const edd = addDays(date, offset);
  return {
    edd,
    eddEarly: addDays(edd, -7),
    eddLate: addDays(edd, 7),
    method,
  };
}

/** Gestational week from LMP (or conception+2w equivalent). */
export function gestationalWeek(
  anchorDate: string,
  method: "lmp" | "conception",
  todayIso: string,
): number {
  const lmpEquivalent =
    method === "lmp" ? anchorDate : addDays(anchorDate, -14);
  const days = daysBetween(lmpEquivalent, todayIso);
  return Math.max(1, Math.min(42, Math.floor(days / 7) + 1));
}

export type FertileWindow = {
  ovulationDay: string;
  fertileStart: string;
  fertileEnd: string;
  fertileDates: string[];
  cycleLengthDays: number;
  message: string;
};

/**
 * 5-day fertile window + peak ovulation (cycle length − 14 from period start).
 * Requires a known last period start and cycle length estimate.
 */
export function calculateFertileWindow(
  lastPeriodStart: string,
  cycleLengthDays: number,
): FertileWindow | null {
  const len = Math.round(cycleLengthDays);
  if (!lastPeriodStart || len < 15 || len > 60) return null;
  const ovulationDay = addDays(lastPeriodStart, len - 14);
  const fertileStart = addDays(ovulationDay, -5);
  const fertileEnd = ovulationDay;
  const fertileDates: string[] = [];
  for (let i = 0; i <= 5; i++) fertileDates.push(addDays(fertileStart, i));
  return {
    ovulationDay,
    fertileStart,
    fertileEnd,
    fertileDates,
    cycleLengthDays: len,
    message:
      "Fertile window and ovulation day are estimates from your cycle length — not a guarantee of fertility or pregnancy.",
  };
}

export type EmergencyContact = {
  label: string;
  number: string;
};

export const EMERGENCY_BY_MARKET: Record<
  "UK" | "NG" | "GH",
  EmergencyContact[]
> = {
  UK: [
    { label: "Emergency services", number: "999" },
    { label: "NHS non-emergency", number: "111" },
  ],
  NG: [{ label: "Emergency services", number: "112" }],
  GH: [
    { label: "Emergency services", number: "999" },
    { label: "Ambulance", number: "193" },
  ],
};

/** Months since TTC start; prompt after 12 months (compassionate, non-diagnostic). */
export function ttcMonthCount(ttcStartedOn: string, todayIso: string): number {
  const start = parseYmd(ttcStartedOn);
  const today = parseYmd(todayIso);
  const months =
    (today.y - start.y) * 12 + (today.m - start.m) - (today.d < start.d ? 1 : 0);
  return Math.max(0, months);
}

export function ttcTwelveMonthPrompt(months: number): string | null {
  if (months < 12) return null;
  return "You have been trying for about a year. Many people choose to speak with a clinician about next steps — when you feel ready. This is support, not a diagnosis.";
}

function parseYmd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/* ——— Phase 6: crisis + HealthLens rules ——— */

export const CRISIS_PHRASES = [
  "kill myself",
  "suicide",
  "end my life",
  "want to die",
  "self harm",
  "self-harm",
  "hurt myself",
] as const;

export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_PHRASES.some((p) => lower.includes(p));
}

export function crisisMessage(market: "UK" | "NG" | "GH"): string {
  const numbers = EMERGENCY_BY_MARKET[market]
    .map((n) => `${n.label}: ${n.number}`)
    .join(" · ");
  return [
    "I’m concerned about your safety. Please seek help right now — contact emergency services or someone you trust.",
    numbers,
    "GirlCode360 cannot provide crisis counselling. Local emergency services and clinicians are the right next step.",
  ].join("\n\n");
}

export type HealthLensInput = {
  cycleIntervalsDays: number[];
  /** days since first log */
  loggingSpanDays: number;
  cycleCount: number;
  recentSymptomIds: string[];
  pregnancyWeek?: number | null;
  kicksLast7Days?: number | null;
  pcosModule: boolean;
};

export type HealthLensFinding = {
  id: string;
  title: string;
  body: string;
  confidence: "Low" | "Medium" | "High";
  discussWithProvider: boolean;
  kind:
    | "irregularity"
    | "pcos_cluster"
    | "co_occurrence"
    | "foetal_movement"
    | "activation"
    | "steady";
};

export type HealthLensActivation = {
  activated: boolean;
  cyclesLogged: number;
  cyclesNeeded: number;
  loggingSpanDays: number;
  daysNeeded: number;
  progressLabel: string;
};

export function healthLensActivation(
  cycleCount: number,
  loggingSpanDays: number,
): HealthLensActivation {
  const cyclesNeeded = 3;
  const daysNeeded = 90;
  const activated = cycleCount >= cyclesNeeded || loggingSpanDays >= daysNeeded;
  const progressLabel = activated
    ? "HealthLens is ready"
    : `Keep logging — activates after ${cyclesNeeded} cycles or ${daysNeeded} days (${cycleCount}/${cyclesNeeded} cycles, ${loggingSpanDays}/${daysNeeded} days)`;
  return {
    activated,
    cyclesLogged: cycleCount,
    cyclesNeeded,
    loggingSpanDays,
    daysNeeded,
    progressLabel,
  };
}

const PCOS_CLUSTER = new Set([
  "acne",
  "hirsutism",
  "hair_thinning",
  "irregular_bleeding",
  "weight_gain",
  "fatigue",
]);

/**
 * Clinical-advisor-shaped rules — wellness language only (FR-092, FR-093).
 */
export function runHealthLensRules(input: HealthLensInput): HealthLensFinding[] {
  const findings: HealthLensFinding[] = [];
  const activation = healthLensActivation(
    input.cycleCount,
    input.loggingSpanDays,
  );
  if (!activation.activated) {
    findings.push({
      id: "not-ready",
      kind: "activation",
      title: "Not ready yet",
      body: activation.progressLabel,
      confidence: "Low",
      discussWithProvider: false,
    });
    return findings;
  }

  const intervals = input.cycleIntervalsDays.filter((n) => n > 0 && n < 90);
  const sd = stddev(intervals);
  const mean = average(intervals);
  if (intervals.length >= 3 && (sd ?? 0) > 10) {
    findings.push({
      id: "high-variance",
      kind: "irregularity",
      title: "Cycle length varies a lot",
      body: `Across recent cycles, length spread is wide (about ±${Math.round(sd ?? 0)} days around ${Math.round(mean ?? 0)}). This is a possible pattern worth discussing with a clinician — not a diagnosis.`,
      confidence: "High",
      discussWithProvider: true,
    });
  } else if (intervals.length >= 2 && (sd ?? 0) >= 4) {
    findings.push({
      id: "moderate-variance",
      kind: "irregularity",
      title: "Some cycle irregularity",
      body: "Your recent cycle lengths are not all the same. Tracking more months can clarify whether this is a stable pattern.",
      confidence: "Medium",
      discussWithProvider: false,
    });
  }

  if (input.pcosModule) {
    const clusterHits = input.recentSymptomIds.filter((id) =>
      PCOS_CLUSTER.has(id),
    );
    const unique = new Set(clusterHits);
    if (unique.size >= 3) {
      findings.push({
        id: "pcos-cluster",
        kind: "pcos_cluster",
        title: "Several PCOS-related wellness signs logged",
        body: "Multiple signs often discussed in PCOS wellness contexts appear in your recent diary. Only a clinician can assess what this means for you.",
        confidence: "Medium",
        discussWithProvider: true,
      });
    }
  }

  const counts = new Map<string, number>();
  for (const id of input.recentSymptomIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 5) {
    findings.push({
      id: "symptom-cluster",
      kind: "co_occurrence",
      title: "A symptom shows up frequently",
      body: `“${top[0].replace(/_/g, " ")}” appeared often in the recent window. Consider noting triggers and bringing the timeline to a clinician if it concerns you.`,
      confidence: "Medium",
      discussWithProvider: true,
    });
  }

  if (
    input.pregnancyWeek != null &&
    input.pregnancyWeek >= 24 &&
    input.kicksLast7Days != null &&
    input.kicksLast7Days === 0
  ) {
    findings.push({
      id: "foetal-movement",
      kind: "foetal_movement",
      title: "Reduced movement logging",
      body: "If baby movements feel reduced, contact maternity triage or emergency services promptly. This flag is informational from your logs, not a clinical reading.",
      confidence: "High",
      discussWithProvider: true,
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: "steady",
      kind: "steady",
      title: "No strong rule flags",
      body: "Current rules did not surface high-priority patterns. Keep logging for a clearer wellness picture over time. This is not a medical clearance.",
      confidence: "Low",
      discussWithProvider: false,
    });
  }

  return findings;
}

export function buildPrepCardText(opts: {
  market: string;
  findings: HealthLensFinding[];
  cycleSummary: string;
  questions: string[];
}): string {
  const lines = [
    "GirlCode360 — Doctor Appointment Prep Card",
    `(Wellness summary — not a medical assessment) · Market: ${opts.market}`,
    "",
    "Cycle summary",
    opts.cycleSummary,
    "",
    "Possible patterns from rules",
    ...opts.findings.map(
      (f) =>
        `• [${f.confidence}] ${f.title}: ${f.body}${f.discussWithProvider ? " (worth discussing)" : ""}`,
    ),
    "",
    "Questions for my clinician",
    ...(opts.questions.length
      ? opts.questions.map((q, i) => `${i + 1}. ${q}`)
      : ["1. What investigations, if any, would you recommend based on this timeline?"]),
    "",
    "Generated by GirlCode360 HealthLens. AI-assisted wellness tool.",
  ];
  return lines.join("\n");
}


