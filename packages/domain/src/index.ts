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
  "you likely have pcos",
  "sounds like you have pcos",
  "this means you have",
  "consistent with pcos",
  "you have endometriosis",
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

/** Strip emails/phones before any model payload (ALN-F-02). */
export function redactPii(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?\d[\d\s.-]{8,}\d)\b/g, "[redacted]");
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
  NG: [
    { label: "Emergency services", number: "112" },
    { label: "Lagos State Emergency", number: "767" },
  ],
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
  "killing myself",
  "suicide",
  "suicidal",
  "end my life",
  "end it all",
  "take my life",
  "want to die",
  "wish i was dead",
  "wish i were dead",
  "don't want to live",
  "dont want to live",
  "do not want to live",
  "don't wanna live",
  "dont wanna live",
  "no reason to live",
  "self harm",
  "self-harm",
  "hurt myself",
  "cut myself",
  "cutting myself",
  "slit my",
  "hang myself",
  "overdose",
] as const;

export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  if (CRISIS_PHRASES.some((p) => lower.includes(p))) return true;
  const bleeding = /heavy bleeding|soaking through|haemorrhage|hemorrhage/.test(
    lower,
  );
  const shock = /dizz|faint|passed out|pass out/.test(lower);
  if (bleeding && shock) return true;
  if (
    /(baby|foetal|fetal).{0,24}(not moving|hasn't moved|hasnt moved|stopped moving)/.test(
      lower,
    ) ||
    /no (foetal|fetal) movement/.test(lower)
  ) {
    return true;
  }
  return false;
}

export function crisisMessage(
  market: "UK" | "NG" | "GH",
  nearby?: { name: string; distanceKm: number } | null,
): string {
  const numbers = EMERGENCY_BY_MARKET[market]
    .map((n) => `${n.label}: ${n.number}`)
    .join(" · ");
  const hospitalLine = nearby
    ? `A seeded directory listing within 5 km: ${nearby.name} (${nearby.distanceKm.toFixed(1)} km). Confirm the address before you travel — this is not an emergency dispatch.`
    : "No clinic listing is within 5 km of the location you shared this session. Use the numbers above, or someone with you, to get to urgent care.";
  return [
    "I’m concerned about your safety. Please seek help right now — contact emergency services or someone you trust.",
    numbers,
    hospitalLine,
    "GirlCode360 cannot provide crisis counselling. Local emergency services and clinicians are the right next step.",
  ].join("\n\n");
}

export * from "./shematch.ts";
export * from "./library.ts";
export * from "./tracking.ts";
export * from "./community.ts";
export * from "./fitzpatrick.ts";
export * from "./studio.ts";
export * from "./hair.ts";
export * from "./wardrobe.ts";
export * from "./stylist.ts";
export * from "./accessories.ts";

export type HealthLensInput = {
  cycleIntervalsDays: number[];
  /** days since first log */
  loggingSpanDays: number;
  cycleCount: number;
  recentSymptomIds: string[];
  pregnancyWeek?: number | null;
  kicksLast7Days?: number | null;
  pcosModule: boolean;
  /** MIR-F-02 reused by HealthLens — already computed, never invented here. */
  mirrorInsight?: {
    title: string;
    body: string;
    confidence: "Low" | "Medium" | "High";
    enoughScans: boolean;
    patternFound: boolean;
  } | null;
  /** FR-123: only attached when HAIR_HL_MONTHLY_SIGNED_OFF is true. */
  hairInsight?: {
    title: string;
    body: string;
    confidence: "Low" | "Medium" | "High";
    enoughScans: boolean;
    patternFound: boolean;
  } | null;
  symptomCountRecent30?: number;
  symptomCountPrev30?: number;
  movementReducedLast7?: boolean | null;
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
    | "steady"
    | "skin_cycle"
    | "hair_pmos";
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
        title: "Several clustered wellness signs in your diary",
        body: "Several signs that people sometimes bring to a clinician appear together in your recent diary. Only a clinician can assess what this means for you. This is not a diagnosis.",
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
    (input.symptomCountRecent30 ?? 0) >= 8 &&
    (input.symptomCountPrev30 ?? 0) > 0 &&
    (input.symptomCountRecent30 ?? 0) >= (input.symptomCountPrev30 ?? 0) * 1.5
  ) {
    findings.push({
      id: "symptom-rising",
      kind: "co_occurrence",
      title: "Symptoms logged more often lately",
      body: "You logged more symptom entries in the last 30 days than in the 30 days before that. That is a possible pattern in your diary — not proof that anything has worsened medically. A clinician can help you interpret it.",
      confidence: "Medium",
      discussWithProvider: true,
    });
  }

  if (input.mirrorInsight?.enoughScans) {
    findings.push({
      id: "skin-cycle",
      kind: "skin_cycle",
      title: input.mirrorInsight.title,
      body: input.mirrorInsight.body,
      confidence: input.mirrorInsight.confidence,
      discussWithProvider: input.mirrorInsight.patternFound,
    });
  }

  if (input.hairInsight?.enoughScans) {
    findings.push({
      id: "hair-pmos",
      kind: "hair_pmos",
      title: input.hairInsight.title,
      body: input.hairInsight.body,
      confidence: input.hairInsight.confidence,
      discussWithProvider: input.hairInsight.patternFound,
    });
  }

  if (
    input.pregnancyWeek != null &&
    input.pregnancyWeek >= 20 &&
    (input.movementReducedLast7 === true ||
      (input.pregnancyWeek >= 24 &&
        input.kicksLast7Days != null &&
        input.kicksLast7Days === 0))
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
  symptomSummary: string;
  medicationSummary: string;
  walletSummary: string;
  questions: string[];
}): string {
  const lines = [
    "GirlCode360 — Doctor Appointment Prep Card",
    `(Wellness summary — not a medical assessment) · Market: ${opts.market}`,
    "",
    "Cycle summary",
    opts.cycleSummary,
    "",
    "Symptom log (recent)",
    opts.symptomSummary,
    "",
    "Medication reminders (as logged)",
    opts.medicationSummary,
    "",
    "Health Wallet documents (titles only)",
    opts.walletSummary,
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
    "Generated by GirlCode360 HealthLens. AI-assisted wellness tool. Not a diagnosis.",
  ];
  return lines.join("\n");
}

/** Encode FR-031 daily pregnancy fields into the existing symptoms array (no schema change). */
export function encodePregnancyDaily(opts: {
  nausea?: 0 | 1 | 2 | 3 | null;
  fatigue?: 0 | 1 | 2 | 3 | null;
  sleepHours?: number | null;
  movementFelt?: boolean | null;
  extra?: string[];
}): string[] {
  const out = [...(opts.extra ?? [])].filter(
    (s) =>
      !s.startsWith("nausea_") &&
      !s.startsWith("fatigue_") &&
      !s.startsWith("sleep_") &&
      s !== "movement_felt" &&
      s !== "movement_reduced",
  );
  if (opts.nausea != null) out.push(`nausea_${opts.nausea}`);
  if (opts.fatigue != null) out.push(`fatigue_${opts.fatigue}`);
  if (opts.sleepHours != null && Number.isFinite(opts.sleepHours)) {
    out.push(`sleep_${Math.max(0, Math.min(24, Math.round(opts.sleepHours)))}`);
  }
  if (opts.movementFelt === true) out.push("movement_felt");
  if (opts.movementFelt === false) out.push("movement_reduced");
  return out;
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export function cyclePhaseFromDay(dayInCycle: number | null): CyclePhase | null {
  if (dayInCycle == null || dayInCycle < 1) return null;
  if (dayInCycle <= 5) return "menstrual";
  if (dayInCycle <= 13) return "follicular";
  if (dayInCycle <= 16) return "ovulation";
  return "luteal";
}

export function dayInCycle(
  scanDate: string,
  cycleStarts: string[],
): number | null {
  const starts = [...cycleStarts].filter(Boolean).sort();
  let start: string | null = null;
  for (const s of starts) {
    if (s <= scanDate) start = s;
  }
  if (!start) return null;
  return daysBetween(start, scanDate) + 1;
}

const SKIN_SYMPTOM_IDS = new Set([
  "acne",
  "oily_skin",
  "dry_skin",
  "breakout",
  "skin_flare",
]);

export type MirrorScanPoint = {
  id: string;
  createdAt: string;
  cyclePhase: CyclePhase | null;
  scores: Record<string, number>;
  symptomIds: string[];
  seeded?: boolean;
};

export type MirrorInsight = {
  title: string;
  body: string;
  confidence: "Low" | "Medium" | "High";
  enoughScans: boolean;
  patternFound: boolean;
};

/** MIR-F-04: SheMatch-style banner only when a concern is clearly elevated. */
export const ELEVATED_SKIN_SCORE = 60;

const SNAPSHOT_SCORE_LABEL: Record<string, string> = {
  acne: "acne",
  oiliness: "oiliness",
  redness: "redness",
  texture: "texture",
  pore: "pores",
  wrinkle: "wrinkles",
  radiance: "radiance",
  dark_circle: "dark circles",
  dark_circle_v2: "dark circles",
  moisture: "moisture",
  firmness: "firmness",
  age_spot: "dark spots",
  eye_bag: "under-eye bags",
  tear_trough: "tear trough",
  droopy_eyelid: "eyelid droop",
  droopy_lower_eyelid: "lower eyelid",
  droopy_upper_eyelid: "upper eyelid",
};

const SNAPSHOT_SKIP = new Set(["all", "skin_age", "skin_type"]);

function joinPlainList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Today's YouCam scores as a report. Not a cycle claim. */
export function snapshotSkinReport(scan: MirrorScanPoint | undefined): MirrorInsight {
  if (!scan) {
    return {
      title: "Skin report",
      body: "Take a face photo in even light. You get a score snapshot from that first still. Cycle patterns wait until we have another scan in a different phase.",
      confidence: "Low",
      enoughScans: false,
      patternFound: false,
    };
  }
  const elevated = Object.entries(scan.scores)
    .filter(
      ([key, n]) =>
        !SNAPSHOT_SKIP.has(key) &&
        typeof n === "number" &&
        n > ELEVATED_SKIN_SCORE,
    )
    .sort((a, b) => b[1] - a[1]);
  const labels = elevated
    .slice(0, 3)
    .map(([key]) => SNAPSHOT_SCORE_LABEL[key] ?? key.replaceAll("_", " "));
  let body: string;
  if (labels.length) {
    const verb = labels.length === 1 ? "reads" : "read";
    body = `On this still, ${joinPlainList(labels)} ${verb} high (over ${ELEVATED_SKIN_SCORE} on YouCam's 0-100 scale). That is today's reading, not a diagnosis. Another scan in a different cycle phase is how we look for a pattern later.`;
  } else if (Object.keys(scan.scores).length) {
    body = `On this still, no concern sits clearly above ${ELEVATED_SKIN_SCORE} on YouCam's 0-100 scale. That is today's reading, not a diagnosis. Another scan in a different cycle phase is how we look for a pattern later.`;
  } else {
    body = "This scan is saved. Scores appear when YouCam finishes. Another scan in a different cycle phase is how we look for a pattern later.";
  }
  return {
    title: "Skin report ready",
    body,
    confidence: labels.length ? "Medium" : "Low",
    enoughScans: false,
    patternFound: false,
  };
}

/**
 * MIR-F-02: no cycle claims until 2+ scans in genuinely different phases.
 * The first live scan still gets a score snapshot. Never fabricates a trend.
 */
export function correlateSkinAndCycle(scans: MirrorScanPoint[]): MirrorInsight {
  const real = scans.filter((s) => !s.seeded);
  const latest = [...real].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  const phases = new Set(
    real.map((s) => s.cyclePhase).filter((p): p is CyclePhase => Boolean(p)),
  );
  if (real.length < 2 || phases.size < 2) {
    return snapshotSkinReport(latest);
  }

  const luteal = real.filter((s) => s.cyclePhase === "luteal");
  const follicular = real.filter(
    (s) => s.cyclePhase === "follicular" || s.cyclePhase === "menstrual",
  );
  const mean = (rows: MirrorScanPoint[], key: string) => {
    const vals = rows
      .map((r) => r.scores[key])
      .filter((n): n is number => typeof n === "number");
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const lutealAcne = mean(luteal, "acne");
  const follAcne = mean(follicular, "acne");
  const lutealOil = mean(luteal, "oiliness");
  const follOil = mean(follicular, "oiliness");

  const acneDelta =
    lutealAcne != null && follAcne != null ? lutealAcne - follAcne : 0;
  const oilDelta =
    lutealOil != null && follOil != null ? lutealOil - follOil : 0;

  const skinSymptoms = real.some((s) =>
    s.symptomIds.some((id) => SKIN_SYMPTOM_IDS.has(id) || id.includes("acne")),
  );

  if (acneDelta < 8 && oilDelta < 8) {
    return {
      title: "No clear cycle pattern yet",
      body: "Your acne and oiliness scores look similar across the phases we have. We have not detected a clear pattern — that is still useful information to take to a clinician if you want to discuss skin changes.",
      confidence: "Low",
      enoughScans: true,
      patternFound: false,
    };
  }

  const bits: string[] = [];
  if (acneDelta >= 8) {
    bits.push(
      `acne scores have been higher around the luteal phase than earlier in the cycle (about ${Math.round(acneDelta)} points on YouCam’s 0–100 scale)`,
    );
  }
  if (oilDelta >= 8) {
    bits.push(
      `oiliness scores have also been higher later in the cycle (about ${Math.round(oilDelta)} points)`,
    );
  }
  if (skinSymptoms) {
    bits.push(
      "that lines up with skin-related symptoms you logged on some of those days",
    );
  }

  return {
    title: "Possible cycle-linked skin pattern",
    body: `Looking at your scans together, ${bits.join(", ")}. This is a correlation in your own logs — not a diagnosis or proof of a hormonal cause. A clinician can help you interpret it.`,
    confidence: acneDelta >= 15 || oilDelta >= 15 ? "High" : "Medium",
    enoughScans: true,
    patternFound: true,
  };
}

export function elevatedSkinConcerns(
  scores: Record<string, number>,
): string[] {
  return Object.entries(scores)
    .filter(([, n]) => typeof n === "number" && n > ELEVATED_SKIN_SCORE)
    .map(([k]) => k);
}

export function matchSkincareByScores<
  T extends { kind: string; tags: string[] },
>(items: T[], scores: Record<string, number>): T[] {
  const keys = new Set(elevatedSkinConcerns(scores));
  if (!keys.size) return [];
  return items.filter(
    (item) =>
      item.kind === "skincare" && item.tags.some((tag) => keys.has(tag)),
  );
}


