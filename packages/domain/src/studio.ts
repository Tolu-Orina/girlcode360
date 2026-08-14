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

export const STUDIO_MAKEUP_LABELS: Record<StudioMakeupCategory, string> = {
  foundation: "Foundation",
  eyebrow: "Brows",
  blush: "Blush",
  eyeshadow: "Eyeshadow",
  eyelash: "Lashes",
  lip: "Lips",
  eyeliner: "Liner",
};

/** Photo/live defaults — the features people ask to try on first. */
export const PHOTO_MAKEUP_DEFAULT: StudioMakeupCategory[] = [
  "foundation",
  "eyebrow",
  "blush",
  "eyeshadow",
  "eyelash",
];

export const SHADE_MATCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export type MakeupTryOnShade = {
  id: string;
  category: StudioMakeupCategory;
  hex: string;
  brandCode: string;
  shadeCode: string;
  title: string;
  boutiqueName: string;
  boutiqueArea: string;
  shadeFamily?: string;
};

const MAKEUP_RETAILERS = [
  {
    brandCode: "seed-a",
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
  },
  {
    brandCode: "seed-b",
    boutiqueName: "Bloom Pharmacy",
    boutiqueArea: "Lagos · Ikeja",
  },
  {
    brandCode: "seed-c",
    boutiqueName: "Wellness Shelf",
    boutiqueArea: "Accra · Osu",
  },
] as const;

const FOUNDATION_SHADES: Array<{
  family: string;
  shade: string;
  title: string;
  hex: string;
}> = [
  { family: "fair", shade: "10N", title: "Fair 10N", hex: "#f1d0bc" },
  { family: "light", shade: "20N", title: "Light 20N", hex: "#e8c4a8" },
  { family: "light_medium", shade: "30N", title: "Light-medium 30N", hex: "#d9a87a" },
  { family: "medium", shade: "40N", title: "Medium 40N", hex: "#c48a58" },
  { family: "tan", shade: "50N", title: "Tan 50N", hex: "#a86b3c" },
  { family: "deep", shade: "60N", title: "Deep 60N", hex: "#6b3d28" },
];

const COLOR_SHADES: Array<{
  category: Exclude<StudioMakeupCategory, "foundation">;
  shade: string;
  title: string;
  hex: string;
}> = [
  { category: "eyebrow", shade: "Taupe", title: "Soft taupe brow", hex: "#6b5344" },
  { category: "eyebrow", shade: "Cocoa", title: "Cocoa brow", hex: "#3b2a22" },
  { category: "eyebrow", shade: "Espresso", title: "Espresso brow", hex: "#241610" },
  { category: "blush", shade: "Petal", title: "Petal blush", hex: "#e19f9f" },
  { category: "blush", shade: "Clay", title: "Clay blush", hex: "#c45c6a" },
  { category: "blush", shade: "Berry", title: "Berry blush", hex: "#a33b4a" },
  { category: "eyeshadow", shade: "Taupe", title: "Taupe lid", hex: "#8b5a6b" },
  { category: "eyeshadow", shade: "Bronze", title: "Bronze lid", hex: "#8a5a32" },
  { category: "eyeshadow", shade: "Plum", title: "Plum lid", hex: "#5c3a55" },
  { category: "eyelash", shade: "Brown", title: "Soft brown lash", hex: "#3a2418" },
  { category: "eyelash", shade: "Ink", title: "Natural black lash", hex: "#1a1a1a" },
  { category: "eyelash", shade: "Soft", title: "Soft black lash", hex: "#2c2c2c" },
  { category: "lip", shade: "Nude", title: "Nude rose lip", hex: "#c47a7a" },
  { category: "lip", shade: "Berry", title: "Berry lip", hex: "#c2185b" },
  { category: "lip", shade: "Terra", title: "Terracotta lip", hex: "#b85c38" },
  { category: "eyeliner", shade: "Brown", title: "Brown liner", hex: "#3a2418" },
  { category: "eyeliner", shade: "Black", title: "Black liner", hex: "#1a1a1a" },
  { category: "eyeliner", shade: "Espresso", title: "Espresso liner", hex: "#241610" },
];

function buildMakeupTryOnShades(): MakeupTryOnShade[] {
  const rows: MakeupTryOnShade[] = [];
  for (const shop of MAKEUP_RETAILERS) {
    for (const f of FOUNDATION_SHADES) {
      rows.push({
        id: `mk-${shop.brandCode}-${f.family}`,
        category: "foundation",
        hex: f.hex,
        brandCode: shop.brandCode,
        shadeCode: f.shade,
        title: f.title,
        boutiqueName: shop.boutiqueName,
        boutiqueArea: shop.boutiqueArea,
        shadeFamily: f.family,
      });
    }
  }
  for (let i = 0; i < COLOR_SHADES.length; i++) {
    const shade = COLOR_SHADES[i]!;
    const shop = MAKEUP_RETAILERS[i % MAKEUP_RETAILERS.length]!;
    rows.push({
      id: `mk-${shop.brandCode}-${shade.category}-${shade.shade.toLowerCase()}`,
      category: shade.category,
      hex: shade.hex,
      brandCode: shop.brandCode,
      shadeCode: shade.shade,
      title: shade.title,
      boutiqueName: shop.boutiqueName,
      boutiqueArea: shop.boutiqueArea,
    });
  }
  return rows;
}

export const MAKEUP_TRYON_SHADES = buildMakeupTryOnShades();

export function makeupShadesForCategory(
  category: StudioMakeupCategory,
): MakeupTryOnShade[] {
  return MAKEUP_TRYON_SHADES.filter((s) => s.category === category);
}

export function parseMakeupPalettes(
  raw: unknown,
): Partial<Record<StudioMakeupCategory, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<StudioMakeupCategory, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isStudioMakeupCategory(key) || typeof value !== "string") continue;
    const hex = value.trim();
    if (!HEX6.test(hex)) continue;
    out[key] = hex;
  }
  return out;
}

export function makeupPaletteColor(
  palettes: Partial<Record<StudioMakeupCategory, string>> | undefined,
  category: StudioMakeupCategory,
  fallback: string,
): string {
  const hex = palettes?.[category] ?? fallback;
  return hex.startsWith("#") ? hex.toUpperCase() : hex;
}

/** YouCam makeup-vto effects from selected categories and boutique hexes. */
export function buildMakeupVtoEffects(
  categories?: StudioMakeupCategory[],
  palettes?: Partial<Record<StudioMakeupCategory, string>>,
): Record<string, unknown>[] {
  const set = new Set(
    categories?.length ? categories : [...STUDIO_MAKEUP_CATEGORIES],
  );
  const color = (cat: StudioMakeupCategory, fallback: string) =>
    makeupPaletteColor(palettes, cat, fallback);
  const effects: Record<string, unknown>[] = [
    {
      category: "skin_smooth",
      skinSmoothStrength: 40,
      skinSmoothColorIntensity: 35,
    },
  ];
  if (set.has("foundation")) {
    effects.push({
      category: "foundation",
      palettes: [
        {
          color: color("foundation", "#e8c4a8"),
          colorIntensity: 35,
          glowIntensity: 20,
          coverageIntensity: 40,
        },
      ],
    });
  }
  if (set.has("blush")) {
    effects.push({
      category: "blush",
      pattern: { name: "1color1" },
      palettes: [
        {
          color: color("blush", "#e19f9f"),
          texture: "matte",
          colorIntensity: 45,
        },
      ],
    });
  }
  if (set.has("lip")) {
    effects.push({
      category: "lip_color",
      shape: { name: "original" },
      style: { type: "full" },
      palettes: [
        {
          color: color("lip", "#c2185b"),
          texture: "matte",
          colorIntensity: 55,
        },
      ],
    });
  }
  if (set.has("eyeshadow")) {
    effects.push({
      category: "eye_shadow",
      pattern: { name: "1color1" },
      palettes: [
        {
          color: color("eyeshadow", "#8b5a6b"),
          texture: "matte",
          colorIntensity: 45,
        },
      ],
    });
  }
  if (set.has("eyeliner")) {
    effects.push({
      category: "eye_liner",
      pattern: { name: "Arabic3" },
      palettes: [
        {
          color: color("eyeliner", "#1a1a1a"),
          texture: "matte",
          colorIntensity: 50,
        },
      ],
    });
  }
  if (set.has("eyebrow")) {
    effects.push({
      category: "eyebrows",
      pattern: { type: "color" },
      palettes: [
        {
          color: color("eyebrow", "#3B2A22"),
          texture: "matte",
          colorIntensity: 40,
        },
      ],
    });
  }
  if (set.has("eyelash")) {
    effects.push({
      category: "eyelashes",
      pattern: { name: "Natural1" },
      palettes: [
        {
          color: color("eyelash", "#1a1a1a"),
          colorIntensity: 50,
        },
      ],
    });
  }
  return effects;
}

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
