/** Phase 2.1 tracking depth — pure helpers. Do not import ./index (circular). */

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stddev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = average(nums);
  if (mean == null) return null;
  const variance =
    nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

export type CycleSpanLite = {
  startDate: string;
  endDate?: string | null;
};

function cycleAverages(cycles: CycleSpanLite[]): {
  cycleLengthDays: number | null;
  periodLengthDays: number | null;
  highVariance: boolean;
} {
  const sorted = [...cycles]
    .filter((c) => c.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const starts = sorted.map((c) => c.startDate);
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1]!, starts[i]!);
    if (gap > 0 && gap < 90) intervals.push(gap);
  }
  const window = intervals.slice(-Math.min(6, intervals.length));
  const periodLengths = sorted
    .filter((c) => c.endDate)
    .map((c) => daysBetween(c.startDate, c.endDate!) + 1)
    .filter((n) => n > 0 && n <= 14);
  return {
    cycleLengthDays: window.length ? Math.round(average(window) ?? 0) : null,
    periodLengthDays: periodLengths.length
      ? Math.round(average(periodLengths) ?? 0)
      : null,
    highVariance: (stddev(window) ?? 0) >= 4,
  };
}

export type CycleSummaryDay = {
  date: string;
  flow: string;
  mood: number | null;
  symptomIds: string[];
};

export type CycleMonthSummary = {
  monthKey: string;
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  mostCommonSymptoms: Array<{ id: string; label: string; count: number }>;
  moodPattern: string;
  daysLogged: number;
  text: string;
};

/** FR-017 monthly cycle summary — wellness language only. */
export function buildCycleMonthSummary(opts: {
  year: number;
  monthIndex: number;
  cycles: CycleSpanLite[];
  days: CycleSummaryDay[];
  symptomLabels?: Record<string, string>;
}): CycleMonthSummary {
  const mm = String(opts.monthIndex + 1).padStart(2, "0");
  const monthKey = `${opts.year}-${mm}`;
  const monthDays = opts.days.filter((d) => d.date.startsWith(monthKey));
  const av = cycleAverages(opts.cycles);
  const counts = new Map<string, number>();
  for (const d of monthDays) {
    for (const id of d.symptomIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const mostCommonSymptoms = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      label: opts.symptomLabels?.[id] ?? id.replace(/_/g, " "),
      count,
    }));
  const moods = monthDays
    .map((d) => d.mood)
    .filter((m): m is number => m != null && m >= 1 && m <= 5);
  const moodAvg = average(moods);
  let moodPattern = "Not enough mood logs this month to describe a pattern.";
  if (moodAvg != null) {
    if (moodAvg <= 2.2) {
      moodPattern =
        "Mood logs this month sit on the lower side of your 1–5 scale. This is a description of your entries, not a diagnosis.";
    } else if (moodAvg >= 3.8) {
      moodPattern =
        "Mood logs this month sit on the higher side of your 1–5 scale. This is a description of your entries, not a diagnosis.";
    } else {
      moodPattern =
        "Mood logs this month sit around the middle of your 1–5 scale. This is a description of your entries, not a diagnosis.";
    }
  }
  const lines = [
    "GirlCode360 — Monthly cycle summary",
    `(Wellness log — not a medical assessment) · ${monthKey}`,
    "",
    `Average cycle length: ${av.cycleLengthDays != null ? `${av.cycleLengthDays} days` : "Need two logged periods"}`,
    `Average period length: ${av.periodLengthDays != null ? `${av.periodLengthDays} days` : "Need two logged periods"}`,
    `Days logged this month: ${monthDays.length}`,
    `Most common symptoms: ${
      mostCommonSymptoms.length
        ? mostCommonSymptoms.map((s) => `${s.label} × ${s.count}`).join("; ")
        : "None logged"
    }`,
    `Mood pattern: ${moodPattern}`,
    "",
    "Predictions and averages use your logged dates. They are wellness estimates, not medical advice. Consult a healthcare provider for diagnosis.",
  ];
  return {
    monthKey,
    averageCycleLength: av.cycleLengthDays,
    averagePeriodLength: av.periodLengthDays,
    mostCommonSymptoms,
    moodPattern,
    daysLogged: monthDays.length,
    text: lines.join("\n"),
  };
}

export type PeriodLeadDays = 1 | 2 | 3;

export function clampPeriodLeadDays(n: unknown): PeriodLeadDays {
  if (n === 2 || n === "2") return 2;
  if (n === 3 || n === "3") return 3;
  return 1;
}

/** FR-019: remind N days before predicted start, and on the predicted day. */
export function periodReminderDue(
  predictedStart: string,
  today: string,
  leadDays: PeriodLeadDays,
): { lead: boolean; dayOf: boolean } {
  return {
    lead: addDays(predictedStart, -leadDays) === today,
    dayOf: predictedStart === today,
  };
}

export type WhoGainBandId =
  | "underweight"
  | "healthy"
  | "overweight"
  | "obesity";

export type WhoGainBand = {
  id: WhoGainBandId;
  label: string;
  minBmi: number;
  maxBmi: number;
  gainMinKg: number;
  gainMaxKg: number;
};

/** IOM singleton ranges commonly cited with WHO BMI classes — a guide, not a prescription. */
export const WHO_PREGNANCY_WEIGHT_GAIN: WhoGainBand[] = [
  {
    id: "underweight",
    label: "BMI below 18.5",
    minBmi: 0,
    maxBmi: 18.5,
    gainMinKg: 12.5,
    gainMaxKg: 18,
  },
  {
    id: "healthy",
    label: "BMI 18.5–24.9",
    minBmi: 18.5,
    maxBmi: 25,
    gainMinKg: 11.5,
    gainMaxKg: 16,
  },
  {
    id: "overweight",
    label: "BMI 25–29.9",
    minBmi: 25,
    maxBmi: 30,
    gainMinKg: 7,
    gainMaxKg: 11.5,
  },
  {
    id: "obesity",
    label: "BMI 30 or above",
    minBmi: 30,
    maxBmi: 99,
    gainMinKg: 5,
    gainMaxKg: 9,
  },
];

export const PREGNANCY_WEIGHT_DISCLAIMER =
  "Consult your midwife or doctor for personalised guidance on pregnancy weight.";

export function bmiKgM2(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 80) || heightCm > 250) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function whoBandForBmi(bmi: number | null): WhoGainBand | null {
  if (bmi == null || !Number.isFinite(bmi)) return null;
  return (
    WHO_PREGNANCY_WEIGHT_GAIN.find((b) => bmi >= b.minBmi && bmi < b.maxBmi) ??
    WHO_PREGNANCY_WEIGHT_GAIN[WHO_PREGNANCY_WEIGHT_GAIN.length - 1]!
  );
}

export const MUCUS_TOOLTIPS: Record<string, string> = {
  dry: "Little or no discharge. Common just after a period.",
  sticky: "Thick or tacky. Often seen in the early part of a cycle.",
  creamy: "Lotion-like. Some people notice this before more stretchy mucus.",
  watery: "Thin and wet. Can appear as the fertile window approaches.",
  egg_white:
    "Clear and stretchy. Often discussed as a fertile-window sign — an estimate, not proof of ovulation.",
  not_sure: "Skip or pick this if you are not sure. Logging is optional.",
};

export function buildPmosHealthReport(opts: {
  market: string;
  cycles: CycleSpanLite[];
  symptomIds: string[];
  biometrics: Array<{
    date: string;
    weightKg: number | null;
    sleepHours: number | null;
    waterGlasses: number | null;
    stress: number | null;
  }>;
  insights: Array<{ title: string; body: string }>;
  asOf?: string;
}): string {
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const from = addDays(asOf, -90);
  const windowCycles = opts.cycles.filter(
    (c) => c.startDate >= from && c.startDate <= asOf,
  );
  const av = cycleAverages(windowCycles);
  const window = opts.biometrics.filter(
    (b) => b.date >= from && b.date <= asOf,
  );
  const weights = window
    .map((b) => b.weightKg)
    .filter((n): n is number => n != null);
  const sleep = window
    .map((b) => b.sleepHours)
    .filter((n): n is number => n != null);
  const stress = window
    .map((b) => b.stress)
    .filter((n): n is number => n != null);
  const counts = new Map<string, number>();
  for (const id of opts.symptomIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n]) => `${id.replace(/_/g, " ")} × ${n}`)
    .join("; ");
  const insightLines = opts.insights.map((i) => `• ${i.title}: ${i.body}`);
  return [
    "GirlCode360 — PMOS health report (about 3 months of logs)",
    `(Wellness summary — not a medical assessment) · Market: ${opts.market}`,
    "",
    "Cycle",
    av.cycleLengthDays != null
      ? `About ${av.cycleLengthDays} days between starts; period length about ${av.periodLengthDays ?? "—"} days; ${windowCycles.length} cycles logged.`
      : "Need two logged periods before cycle averages appear.",
    av.highVariance
      ? "Cycle lengths vary in this window — share the dates with a clinician if that concerns you."
      : "",
    "",
    "Symptom frequency",
    top || "No symptoms logged in this window.",
    "",
    "Biometrics (optional logs)",
    `Weight logs: ${weights.length}. Sleep logs: ${sleep.length} (average ${sleep.length ? Math.round((average(sleep) ?? 0) * 10) / 10 : "—"} h). Stress logs: ${stress.length} (average ${stress.length ? Math.round((average(stress) ?? 0) * 10) / 10 : "—"} / 5).`,
    "",
    "Possible patterns (rules, not a diagnosis)",
    ...(insightLines.length ? insightLines : ["• Keep logging for a clearer wellness picture."]),
    "",
    "For a clinic visit, also generate a Doctor Appointment Prep Card from Alena / HealthLens. Wallet files are listed by title only there.",
    "",
    "GirlCode360 does not diagnose conditions. Consult a qualified clinician.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
