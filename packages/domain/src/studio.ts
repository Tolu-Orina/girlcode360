import {
  familyForFitzpatrick,
  parseShadeFinderPayload,
  SHADE_MATCH_WELLNESS_NOTE,
  type FoundationFamily,
  type FitzpatrickType,
} from "./fitzpatrick.ts";

export const STUDIO_MAKEUP_CATEGORIES = [
  "lip",
  "eyeshadow",
  "blush",
  "foundation",
  "eyebrow",
  "eyeliner",
  "eyelash",
] as const;

export type StudioMakeupCategory = (typeof STUDIO_MAKEUP_CATEGORIES)[number];

export const SHADE_MATCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isStudioMakeupCategory(
  value: string,
): value is StudioMakeupCategory {
  return (STUDIO_MAKEUP_CATEGORIES as readonly string[]).includes(value);
}

export function parseMakeupCategories(
  raw: unknown,
): StudioMakeupCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...STUDIO_MAKEUP_CATEGORIES];
  }
  const next = raw
    .filter((v): v is string => typeof v === "string")
    .filter(isStudioMakeupCategory);
  return next.length ? next : [...STUDIO_MAKEUP_CATEGORIES];
}

export function skinScanReusableForShade(
  createdAtIso: string,
  now = Date.now(),
): boolean {
  const t = Date.parse(createdAtIso);
  if (!Number.isFinite(t)) return false;
  return now - t >= 0 && now - t <= SHADE_MATCH_MAX_AGE_MS;
}

export type ShadeCatalogueEntry = {
  id: string;
  brandCode: string;
  shadeCode: string;
  family: FoundationFamily;
  boutiqueName: string;
  boutiqueArea: string;
};

export type ShadeTwin = ShadeCatalogueEntry & {
  confidence: "low" | "medium" | "high";
};

export function matchShadeTwins(
  payload: unknown,
  catalogue: ShadeCatalogueEntry[],
): {
  fitzpatrick: FitzpatrickType | null;
  twins: ShadeTwin[];
  overallConfidence: "Low" | "Medium" | "High";
  wellnessNote: string;
} {
  const parsed = parseShadeFinderPayload(payload);
  const predictedFamily: FoundationFamily | null =
    parsed.matches[0]?.family ??
    (parsed.fitzpatrick ? familyForFitzpatrick(parsed.fitzpatrick) : null);

  const byBrand = new Map<string, ShadeCatalogueEntry[]>();
  for (const item of catalogue) {
    const list = byBrand.get(item.brandCode) ?? [];
    list.push(item);
    byBrand.set(item.brandCode, list);
  }

  const twins: ShadeTwin[] = [];
  for (const [brand, items] of byBrand) {
    const vendor = parsed.matches.find(
      (m) => m.brand.toLowerCase() === brand.toLowerCase(),
    );
    const family = vendor?.family ?? predictedFamily;
    if (!family) continue;
    const exact = vendor
      ? items.find(
          (i) => i.shadeCode.toLowerCase() === vendor.shade.toLowerCase(),
        )
      : undefined;
    const familyHit = items.find((i) => i.family === family);
    const pick = exact ?? familyHit;
    if (!pick) continue;
    twins.push({
      ...pick,
      confidence: vendor?.confidence ?? "low",
    });
  }

  const overallConfidence: "Low" | "Medium" | "High" =
    twins.length === 0
      ? "Low"
      : twins.every((t) => t.confidence === "high")
        ? "High"
        : twins.some((t) => t.confidence === "low")
          ? "Low"
          : "Medium";

  return {
    fitzpatrick: parsed.fitzpatrick,
    twins,
    overallConfidence,
    wellnessNote: SHADE_MATCH_WELLNESS_NOTE,
  };
}
