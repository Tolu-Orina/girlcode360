/**
 * P3.3 Hair Studio — texture equity gate + PMOS correlation (MIR-F-02 rules).
 * Wellness copy only. Not a diagnosis of PMOS, thinning, or hirsutism.
 */

export const HAIR_TEXTURES = ["straight", "wavy", "curly", "coily"] as const;
export type HairTexture = (typeof HAIR_TEXTURES)[number];

export const HAIR_EQUITY_OVERALL_MIN = 0.8;
export const HAIR_EQUITY_PER_TEXTURE_MIN = 0.5;

/** Monthly HealthLens hair category stays off until a clinical advisor signs this copy. */
export const HAIR_HL_MONTHLY_SIGNED_OFF = false;

export const HAIR_CORRELATION_WELLNESS_NOTE =
  "Hair scores are a wellness snapshot. They are not a diagnosis of thinning, hirsutism, or PMOS.";

export const HAIR_COLOR_PRESETS = [
  { id: "soft-black", hex: "#2b1b17", label: "Soft black" },
  { id: "dark-brown", hex: "#4a2c1a", label: "Dark brown" },
  { id: "warm-brown", hex: "#6b3a1f", label: "Warm brown" },
  { id: "auburn", hex: "#7a3e22", label: "Auburn" },
  { id: "copper", hex: "#b85c38", label: "Copper" },
  { id: "blonde", hex: "#c9a66b", label: "Blonde" },
] as const;

export const HAIR_STYLE_PRESETS = [
  { id: "natural", label: "Natural length" },
  { id: "shoulder", label: "Shoulder" },
  { id: "bob", label: "Bob" },
  { id: "braids", label: "Braids" },
] as const;

export type HairScores = {
  hair_type?: HairTexture | null;
  hair_length?: number | null;
  hair_frizziness?: number | null;
  hair_density?: number | null;
};

export type HairScanPoint = {
  id: string;
  createdAt: string;
  cyclePhase: "menstrual" | "follicular" | "ovulation" | "luteal" | null;
  scores: HairScores;
  symptomIds: string[];
  kind: "analysis" | "tryon";
};

export type HairInsight = {
  title: string;
  body: string;
  confidence: "Low" | "Medium" | "High";
  enoughScans: boolean;
  patternFound: boolean;
};

export type HairTextureCase = {
  id: string;
  expected: HairTexture;
  predicted: HairTexture | null;
};

export type HairTextureScore = {
  coverage: Record<HairTexture, number>;
  overall: number;
  perTexture: Record<HairTexture, { n: number; correct: number }>;
  pass: boolean;
  failReasons: string[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function parseHairTexture(raw: unknown): HairTexture | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (t === "kinky" || t === "coily_kinky" || t === "type_4" || t === "4c" || t === "4b" || t === "4a") {
    return "coily";
  }
  if (t === "type_3" || t === "3c" || t === "3b" || t === "3a") return "curly";
  if (t === "type_2" || t === "2c" || t === "2b" || t === "2a") return "wavy";
  if (t === "type_1" || t === "1c" || t === "1b" || t === "1a") return "straight";
  if ((HAIR_TEXTURES as readonly string[]).includes(t)) return t as HairTexture;
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  const rec = asRecord(v);
  if (rec && typeof rec.score === "number") return rec.score;
  return null;
}

export function parseHairAnalysisPayload(payload: unknown): HairScores {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const typeRaw =
    data?.hair_type ??
    data?.hairType ??
    asRecord(data?.hair_type)?.type ??
    asRecord(data?.hair_type)?.value;
  const results = asRecord(data?.results) ?? data;
  const lengthObj =
    asRecord(results?.hair_length) ?? asRecord(data?.hair_length);
  const lengthTerm =
    (typeof lengthObj?.term === "string" && lengthObj.term) ||
    (typeof results?.term === "string" && results.term) ||
    (typeof data?.term === "string" && data.term) ||
    null;
  return {
    hair_type: parseHairTexture(typeRaw),
    hair_length:
      num(data?.hair_length ?? data?.hairLength ?? lengthObj?.mapping) ??
      scoreFromHairLengthTerm(lengthTerm),
    hair_frizziness: num(data?.hair_frizziness ?? data?.hairFrizziness ?? data?.frizz),
    hair_density: num(
      data?.hair_density ??
        data?.hairDensity ??
        data?.density ??
        asRecord(results?.hair_density)?.mapping,
    ),
  };
}

const HAIR_LENGTH_TERM_SCORE: Record<string, number> = {
  "above the ears": 18,
  "ear length": 32,
  "ear length or longer": 42,
  "short hair": 52,
  "short hair or longer": 62,
  "above chest": 78,
  "above chest or longer": 86,
  "long hair": 96,
};

export function scoreFromHairLengthTerm(term: string | null): number | null {
  if (!term) return null;
  return HAIR_LENGTH_TERM_SCORE[term.trim().toLowerCase()] ?? null;
}

export function scoreHairTextureHarness(cases: HairTextureCase[]): HairTextureScore {
  const perTexture = Object.fromEntries(
    HAIR_TEXTURES.map((t) => [t, { n: 0, correct: 0 }]),
  ) as HairTextureScore["perTexture"];
  for (const c of cases) {
    const row = perTexture[c.expected];
    row.n += 1;
    if (c.predicted === c.expected) row.correct += 1;
  }
  const coverage = Object.fromEntries(
    HAIR_TEXTURES.map((t) => [t, perTexture[t].n]),
  ) as Record<HairTexture, number>;
  const total = cases.length;
  const hits = HAIR_TEXTURES.reduce((s, t) => s + perTexture[t].correct, 0);
  const overall = total ? hits / total : 0;
  const failReasons: string[] = [];
  for (const t of HAIR_TEXTURES) {
    if (perTexture[t].n < 1) failReasons.push(`missing_coverage_${t}`);
    else if (perTexture[t].correct / perTexture[t].n < HAIR_EQUITY_PER_TEXTURE_MIN) {
      failReasons.push(`texture_accuracy_below_floor_${t}`);
    }
  }
  if (overall < HAIR_EQUITY_OVERALL_MIN) failReasons.push("texture_overall_below_floor");
  return {
    coverage,
    overall,
    perTexture,
    pass: failReasons.length === 0,
    failReasons,
  };
}

const HAIR_SYMPTOMS = new Set(["hair_thinning", "hirsutism"]);

/**
 * FR-121: same guardrails as MIR-F-02 — min two analysis scans on different days;
 * never invent a pattern; never diagnose.
 */
export function correlateHairAndPmos(scans: HairScanPoint[]): HairInsight {
  const real = scans.filter((s) => s.kind === "analysis");
  const days = new Set(real.map((s) => s.createdAt.slice(0, 10)));
  if (real.length < 2 || days.size < 2) {
    return {
      title: "Hair report ready",
      body: "We need at least two hair diagnostics on different days before we can look for a pattern. This is a snapshot of today — not a PMOS claim.",
      confidence: "Low",
      enoughScans: false,
      patternFound: false,
    };
  }

  const sorted = [...real].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mid = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, mid);
  const later = sorted.slice(mid);
  const mean = (rows: HairScanPoint[], key: "hair_density" | "hair_frizziness") => {
    const vals = rows
      .map((r) => r.scores[key])
      .filter((n): n is number => typeof n === "number");
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const densEarly = mean(earlier, "hair_density");
  const densLate = mean(later, "hair_density");
  const frizzEarly = mean(earlier, "hair_frizziness");
  const frizzLate = mean(later, "hair_frizziness");
  const densDelta =
    densEarly != null && densLate != null ? densLate - densEarly : 0;
  const frizzDelta =
    frizzEarly != null && frizzLate != null ? frizzLate - frizzEarly : 0;

  const thinning = real.some((s) => s.symptomIds.includes("hair_thinning"));
  const hirsutism = real.some((s) => s.symptomIds.includes("hirsutism"));
  const loggedHair = real.some((s) =>
    s.symptomIds.some((id) => HAIR_SYMPTOMS.has(id)),
  );

  if (Math.abs(densDelta) < 8 && Math.abs(frizzDelta) < 8) {
    return {
      title: "No clear hair pattern yet",
      body: `${HAIR_CORRELATION_WELLNESS_NOTE} Density and frizz scores look similar across the days we have. We have not detected a clear pattern.`,
      confidence: "Low",
      enoughScans: true,
      patternFound: false,
    };
  }

  const bits: string[] = [];
  if (densDelta <= -8) {
    bits.push(
      `scalp density scores are lower on later scans than earlier ones (about ${Math.round(Math.abs(densDelta))} points on YouCam’s 0–100 scale)`,
    );
    if (thinning) {
      bits.push("that lines up with hair-thinning notes you logged on some of those days");
    }
  }
  if (frizzDelta >= 8) {
    bits.push(
      `frizz scores are higher on later scans (about ${Math.round(frizzDelta)} points)`,
    );
  }
  if (hirsutism) {
    bits.push(
      "you also logged unwanted facial or body hair on some days — that is a separate diary note from scalp density, and we are not treating them as the same thing",
    );
  }
  if (!bits.length && loggedHair) {
    return {
      title: "No clear hair pattern yet",
      body: `${HAIR_CORRELATION_WELLNESS_NOTE} Symptom notes are present, but score changes are too small to describe a trend.`,
      confidence: "Low",
      enoughScans: true,
      patternFound: false,
    };
  }

  return {
    title: "Possible hair-score pattern in your logs",
    body: `Looking at your hair diagnostics together, ${bits.join("; ")}. This is a correlation in your own logs — not a diagnosis or proof of a hormonal cause. A clinician can help you interpret it.`,
    confidence: Math.abs(densDelta) >= 15 || Math.abs(frizzDelta) >= 15 ? "High" : "Medium",
    enoughScans: true,
    patternFound: true,
  };
}
