/**
 * P3.1 equity gate — Fitzpatrick I–VI for shade match and foundation families.
 * Wellness / matching accuracy only. Not a medical classification.
 */

export const FITZPATRICK_TYPES = ["I", "II", "III", "IV", "V", "VI"] as const;
export type FitzpatrickType = (typeof FITZPATRICK_TYPES)[number];

/** Foundation families aligned to Fitzpatrick I–VI for scoring, not diagnosis. */
export const FOUNDATION_FAMILIES = [
  "fair",
  "light",
  "light_medium",
  "medium",
  "tan",
  "deep",
] as const;
export type FoundationFamily = (typeof FOUNDATION_FAMILIES)[number];

export const EQUITY_OVERALL_MIN = 0.8;
export const EQUITY_PER_TYPE_MIN = 0.5;

export const SHADE_MATCH_WELLNESS_NOTE =
  "Fitzpatrick type here is a shade-matching aid. It is not a diagnosis or a health label.";

export type ShadeMatchRow = {
  brand: string;
  shade: string;
  family: FoundationFamily;
  confidence: "low" | "medium" | "high";
};

export type EquityCase = {
  id: string;
  expectedType: FitzpatrickType;
  expectedFamily: FoundationFamily;
  predictedType: FitzpatrickType | null;
  predictedFamily: FoundationFamily | null;
};

export type EquityScore = {
  coverage: Record<FitzpatrickType, number>;
  fitzpatrickOverall: number;
  familyOverall: number;
  perType: Record<FitzpatrickType, { n: number; typeCorrect: number; familyCorrect: number }>;
  pass: boolean;
  failReasons: string[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function parseFitzpatrickType(raw: unknown): FitzpatrickType | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 6) {
    return FITZPATRICK_TYPES[raw - 1]!;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase().replace(/^TYPE\s+/, "");
  if ((FITZPATRICK_TYPES as readonly string[]).includes(t)) {
    return t as FitzpatrickType;
  }
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= 6) return FITZPATRICK_TYPES[n - 1]!;
  return null;
}

export function parseFoundationFamily(raw: unknown): FoundationFamily | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((FOUNDATION_FAMILIES as readonly string[]).includes(t)) {
    return t as FoundationFamily;
  }
  return null;
}

export function familyForFitzpatrick(type: FitzpatrickType): FoundationFamily {
  const i = FITZPATRICK_TYPES.indexOf(type);
  return FOUNDATION_FAMILIES[i]!;
}

/** Read a YouCam shade-finder-shaped payload without treating type as clinical. */
export function parseShadeFinderPayload(payload: unknown): {
  fitzpatrick: FitzpatrickType | null;
  matches: ShadeMatchRow[];
} {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const fitzRaw =
    data?.fitzpatrick_type ??
    data?.fitzpatrickType ??
    data?.fitzpatrick ??
    asRecord(data?.shade_match)?.fitzpatrick_type;
  const matchesRaw = data?.matches ?? data?.shade_matches ?? data?.shade_match;
  const list = Array.isArray(matchesRaw)
    ? matchesRaw
    : asRecord(matchesRaw)?.items && Array.isArray(asRecord(matchesRaw)!.items)
      ? (asRecord(matchesRaw)!.items as unknown[])
      : [];
  const matches: ShadeMatchRow[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const family = parseFoundationFamily(rec.family ?? rec.shade_family ?? rec.depth);
    if (!family) continue;
    const confidenceRaw = String(rec.confidence ?? rec.level ?? "medium").toLowerCase();
    const confidence: ShadeMatchRow["confidence"] =
      confidenceRaw === "low" || confidenceRaw === "high" ? confidenceRaw : "medium";
    matches.push({
      brand: String(rec.brand ?? rec.brand_code ?? ""),
      shade: String(rec.shade ?? rec.shade_name ?? rec.name ?? ""),
      family,
      confidence,
    });
  }
  return { fitzpatrick: parseFitzpatrickType(fitzRaw), matches };
}

export function scoreEquityHarness(cases: EquityCase[]): EquityScore {
  const perType = Object.fromEntries(
    FITZPATRICK_TYPES.map((t) => [t, { n: 0, typeCorrect: 0, familyCorrect: 0 }]),
  ) as EquityScore["perType"];

  for (const c of cases) {
    const row = perType[c.expectedType];
    row.n += 1;
    if (c.predictedType === c.expectedType) row.typeCorrect += 1;
    if (c.predictedFamily === c.expectedFamily) row.familyCorrect += 1;
  }

  const coverage = Object.fromEntries(
    FITZPATRICK_TYPES.map((t) => [t, perType[t].n]),
  ) as Record<FitzpatrickType, number>;

  const total = cases.length;
  const typeHits = FITZPATRICK_TYPES.reduce((s, t) => s + perType[t].typeCorrect, 0);
  const familyHits = FITZPATRICK_TYPES.reduce((s, t) => s + perType[t].familyCorrect, 0);
  const fitzpatrickOverall = total ? typeHits / total : 0;
  const familyOverall = total ? familyHits / total : 0;

  const failReasons: string[] = [];
  for (const t of FITZPATRICK_TYPES) {
    if (perType[t].n < 1) {
      failReasons.push(`missing_coverage_${t}`);
    } else if (perType[t].typeCorrect / perType[t].n < EQUITY_PER_TYPE_MIN) {
      failReasons.push(`type_accuracy_below_floor_${t}`);
    }
  }
  if (fitzpatrickOverall < EQUITY_OVERALL_MIN) {
    failReasons.push("fitzpatrick_overall_below_floor");
  }
  if (familyOverall < EQUITY_OVERALL_MIN) {
    failReasons.push("foundation_family_overall_below_floor");
  }

  return {
    coverage,
    fitzpatrickOverall,
    familyOverall,
    perType,
    pass: failReasons.length === 0,
    failReasons,
  };
}
