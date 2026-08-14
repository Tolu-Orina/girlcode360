/**
 * P3.4 My Wardrobe — closed category/colour lists, swimwear/lingerie ban,
 * packing-list capsule (FR-127). Tagging is a local suggestion the user can
 * correct — not a diagnosis and not a second Bedrock path.
 */

export const WARDROBE_CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "shoes",
  "accessory",
] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const WARDROBE_COLOURS = [
  "black",
  "white",
  "grey",
  "navy",
  "blue",
  "green",
  "olive",
  "brown",
  "beige",
  "cream",
  "red",
  "burgundy",
  "pink",
  "orange",
  "yellow",
  "purple",
  "gold",
  "silver",
] as const;

export type WardrobeColour = (typeof WARDROBE_COLOURS)[number];

export const WARDROBE_CLIMATES = ["hot", "temperate", "cold", "mixed"] as const;
export type WardrobeClimate = (typeof WARDROBE_CLIMATES)[number];

/** Same Perfect Corp exclusion as MIR-F-05 / MIR-F-08. */
export const WARDROBE_BANNED =
  /swimwear|swimsuit|lingerie|bikini|underwear|intimate|thong|bralette/i;

export const WARDROBE_QUEUE_MAX = 50;

export const WARDROBE_TAG_NOTE =
  "Category and colour are suggestions from this photo. Correct anything that is off. Swimwear and lingerie are not catalogued for try-on.";

const COLOUR_RGB: Record<WardrobeColour, [number, number, number]> = {
  black: [32, 32, 32],
  white: [245, 245, 245],
  grey: [128, 128, 128],
  navy: [20, 35, 70],
  blue: [50, 90, 180],
  green: [40, 120, 70],
  olive: [90, 100, 50],
  brown: [90, 55, 35],
  beige: [210, 190, 160],
  cream: [245, 235, 210],
  red: [180, 40, 40],
  burgundy: [110, 25, 45],
  pink: [220, 130, 160],
  orange: [210, 110, 40],
  yellow: [220, 190, 60],
  purple: [110, 70, 150],
  gold: [200, 160, 60],
  silver: [180, 185, 190],
};

export function isWardrobeCategory(v: string): v is WardrobeCategory {
  return (WARDROBE_CATEGORIES as readonly string[]).includes(v);
}

export function isWardrobeClimate(v: string): v is WardrobeClimate {
  return (WARDROBE_CLIMATES as readonly string[]).includes(v);
}

export function parseWardrobeCategory(raw: unknown): WardrobeCategory | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (WARDROBE_BANNED.test(t)) return null;
  if (t === "dress" || t === "jumpsuit" || t === "romper") return "one_piece";
  if (t === "jacket" || t === "coat" || t === "blazer" || t === "cardigan") {
    return "outerwear";
  }
  if (t === "trousers" || t === "jeans" || t === "skirt" || t === "shorts") {
    return "bottom";
  }
  if (t === "shirt" || t === "blouse" || t === "tee" || t === "jumper") return "top";
  if (t === "trainers" || t === "boots" || t === "sandals") return "shoes";
  if (t === "bag" || t === "belt" || t === "scarf" || t === "hat") return "accessory";
  return isWardrobeCategory(t) ? t : null;
}

export function assertWardrobeAllowed(text: string): void {
  if (WARDROBE_BANNED.test(text)) throw new Error("WARDROBE_CATEGORY_BANNED");
}

export function colourFromHex(hex: string): WardrobeColour | null {
  const m = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const r = Number.parseInt(m.slice(0, 2), 16);
  const g = Number.parseInt(m.slice(2, 4), 16);
  const b = Number.parseInt(m.slice(4, 6), 16);
  let best: WardrobeColour = "grey";
  let bestD = Infinity;
  for (const [name, rgb] of Object.entries(COLOUR_RGB) as Array<
    [WardrobeColour, [number, number, number]]
  >) {
    const d =
      (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export function parseWardrobeColours(raw: unknown): WardrobeColour[] {
  if (!Array.isArray(raw)) return [];
  const out: WardrobeColour[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.trim().toLowerCase();
    if ((WARDROBE_COLOURS as readonly string[]).includes(t)) {
      const c = t as WardrobeColour;
      if (!out.includes(c)) out.push(c);
    }
  }
  return out.slice(0, 4);
}

export function suggestWardrobeTags(opts: {
  sampleHexes?: string[];
  label?: string;
}): {
  category: WardrobeCategory | null;
  colourTags: WardrobeColour[];
  banned: boolean;
} {
  const label = opts.label?.trim() ?? "";
  if (WARDROBE_BANNED.test(label)) {
    return { category: null, colourTags: [], banned: true };
  }
  const colours: WardrobeColour[] = [];
  for (const hex of opts.sampleHexes ?? []) {
    const c = colourFromHex(hex);
    if (c && !colours.includes(c)) colours.push(c);
  }
  return {
    category: parseWardrobeCategory(label),
    colourTags: colours.slice(0, 3),
    banned: false,
  };
}

export function garmentCategoryForVto(
  category: WardrobeCategory | null,
): "upper_body" | "lower_body" | "full_body" {
  if (!category) throw new Error("WARDROBE_VTO_UNSUPPORTED");
  if (category === "top") return "upper_body";
  if (category === "bottom") return "lower_body";
  if (category === "one_piece" || category === "outerwear") return "full_body";
  throw new Error("WARDROBE_VTO_UNSUPPORTED");
}

export type WardrobePackingItem = {
  id: string;
  category: WardrobeCategory | null;
  name?: string | null;
  colourTags: string[];
  wornCount: number;
  archived?: boolean;
};

export type PackingListResult = {
  itemIds: string[];
  notes: string[];
  enoughItems: boolean;
};

function pick(
  items: WardrobePackingItem[],
  category: WardrobeCategory,
  n: number,
): WardrobePackingItem[] {
  return items
    .filter((i) => i.category === category && !i.archived)
    .sort((a, b) => a.wornCount - b.wornCount || a.id.localeCompare(b.id))
    .slice(0, n);
}

export function buildPackingList(
  items: WardrobePackingItem[],
  opts: { nights: number; climate: WardrobeClimate },
): PackingListResult {
  const nights = Math.min(21, Math.max(1, Math.round(opts.nights)));
  const usable = items.filter((i) => {
    if (i.archived) return false;
    const blob = `${i.category ?? ""} ${i.name ?? ""} ${i.colourTags.join(" ")}`;
    return !WARDROBE_BANNED.test(blob);
  });
  const notes: string[] = [];
  const chosen: WardrobePackingItem[] = [];
  const take = (rows: WardrobePackingItem[]) => {
    for (const row of rows) {
      if (!chosen.some((c) => c.id === row.id)) chosen.push(row);
    }
  };

  const dresses = pick(usable, "one_piece", Math.max(1, Math.ceil(nights / 4)));
  take(dresses);

  const topsWanted =
    opts.climate === "hot" ? Math.min(nights, 6) : Math.max(2, Math.ceil(nights / 2));
  take(pick(usable, "top", topsWanted));

  const bottomsWanted = Math.max(2, Math.ceil(nights / 3));
  take(pick(usable, "bottom", bottomsWanted));

  if (opts.climate === "cold" || opts.climate === "mixed") {
    take(pick(usable, "outerwear", opts.climate === "cold" ? 2 : 1));
  }
  take(pick(usable, "shoes", 1));
  take(pick(usable, "accessory", 1));

  const hasCover =
    chosen.some((i) => i.category === "one_piece") ||
    (chosen.some((i) => i.category === "top") &&
      chosen.some((i) => i.category === "bottom"));
  if (!hasCover) {
    notes.push(
      "Add a top and a bottom, or a one-piece, before a packing list can fill a capsule.",
    );
  }
  notes.push(
    "Pulled from your catalogued pieces only. This is a packing aid, not a shopping list.",
  );
  return {
    itemIds: chosen.map((i) => i.id),
    notes,
    enoughItems: hasCover,
  };
}
