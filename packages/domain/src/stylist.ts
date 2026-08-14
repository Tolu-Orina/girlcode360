/**
 * P3.5 AI Stylist + Style Analytics — domain only.
 * Outfit suggestion is wardrobe-first (FR-135). Not a second recommender,
 * not a second Bedrock path, no calendar read, no new consent category.
 */

import {
  buildPackingList,
  type WardrobeClimate,
  type WardrobePackingItem,
} from "./wardrobe.ts";


export const STYLE_ANALYTICS_WINDOW_DAYS = 90;

export const STYLIST_WARDROBE_FIRST_NOTE =
  "This outfit is assembled from pieces you already catalogued. It is not a shopping list.";

export const STYLIST_NO_CALENDAR_NOTE =
  "We do not read device calendars. Climate is a session or market default, not a live weather feed.";

const STYLIST_QUERY =
  /what should i wear|what to wear|outfit today|wear today|style me|stylist|dress (for|today)|packing list|what do i wear/i;

export function isStylistQuery(message: string): boolean {
  return STYLIST_QUERY.test(message.trim());
}

export function climateFromMarket(market: "UK" | "NG" | "GH"): WardrobeClimate {
  return market === "UK" ? "temperate" : "hot";
}

export type DailyOutfitSuggestion = {
  itemIds: string[];
  notes: string[];
  enoughItems: boolean;
  shopFirst: false;
};

export function suggestDailyOutfit(
  items: WardrobePackingItem[],
  opts: { climate: WardrobeClimate },
): DailyOutfitSuggestion {
  const packed = buildPackingList(items, { nights: 1, climate: opts.climate });
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = packed.itemIds
    .map((id) => byId.get(id))
    .filter((r): r is WardrobePackingItem => Boolean(r));
  const one = rows.find((r) => r.category === "one_piece");
  const top = rows.find((r) => r.category === "top");
  const bottom = rows.find((r) => r.category === "bottom");
  const outer = rows.find((r) => r.category === "outerwear");
  const shoes = rows.find((r) => r.category === "shoes");
  const chosen: WardrobePackingItem[] = [];
  if (one) chosen.push(one);
  else {
    if (top) chosen.push(top);
    if (bottom) chosen.push(bottom);
  }
  if (outer && (opts.climate === "cold" || opts.climate === "mixed")) {
    chosen.push(outer);
  }
  if (shoes) chosen.push(shoes);
  const itemIds = [...new Set(chosen.map((c) => c.id))];
  return {
    itemIds,
    notes: [STYLIST_WARDROBE_FIRST_NOTE, STYLIST_NO_CALENDAR_NOTE, ...packed.notes],
    enoughItems: packed.enoughItems && itemIds.length > 0,
    shopFirst: false,
  };
}

export type StyleCostPerWear = {
  itemId: string;
  name: string | null;
  wornCount: number;
  purchasePriceMinor: number | null;
  costPerWearMinor: number | null;
};

export type StylePoint = {
  id: string;
  createdAt: string;
  label: string;
  value: number | null;
};

export type StyleAnalytics = {
  windowDays: number;
  utilisationPct: number | null;
  itemsCatalogued: number;
  itemsWornInWindow: number;
  costPerWear: StyleCostPerWear[];
  skinTrend: StylePoint[];
  hairTrend: StylePoint[];
  shadeHistory: StylePoint[];
  newConsentRequired: false;
};

export function computeStyleAnalytics(input: {
  now?: string;
  items: Array<{
    id: string;
    name?: string | null;
    archived?: boolean;
    wornCount: number;
    purchasePriceMinor: number | null;
  }>;
  outfits: Array<{ itemIds: string[]; wornOn: string | null }>;
  skin: Array<{ id: string; createdAt: string; overallScore: number | null }>;
  hair: Array<{
    id: string;
    createdAt: string;
    kind: string;
    hairDensity: number | null;
  }>;
  shades: Array<{ id: string; createdAt: string; fitzpatrickType: string | null }>;
}): StyleAnalytics {
  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  const windowMs = STYLE_ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const liveItems = input.items.filter((i) => !i.archived);
  const wornIds = new Set<string>();
  for (const o of input.outfits) {
    if (!o.wornOn) continue;
    const t = Date.parse(`${o.wornOn}T00:00:00.000Z`);
    if (!Number.isFinite(t) || nowMs - t > windowMs || nowMs - t < 0) continue;
    for (const id of o.itemIds) wornIds.add(id);
  }
  const itemsWornInWindow = liveItems.filter((i) => wornIds.has(i.id)).length;
  const utilisationPct =
    liveItems.length === 0
      ? null
      : Math.round((itemsWornInWindow / liveItems.length) * 100);
  const costPerWear: StyleCostPerWear[] = liveItems
    .map((i) => ({
      itemId: i.id,
      name: i.name ?? null,
      wornCount: i.wornCount,
      purchasePriceMinor: i.purchasePriceMinor,
      costPerWearMinor:
        i.purchasePriceMinor != null && i.wornCount > 0
          ? Math.round(i.purchasePriceMinor / i.wornCount)
          : null,
    }))
    .sort((a, b) => (b.costPerWearMinor ?? -1) - (a.costPerWearMinor ?? -1))
    .slice(0, 12);
  return {
    windowDays: STYLE_ANALYTICS_WINDOW_DAYS,
    utilisationPct,
    itemsCatalogued: liveItems.length,
    itemsWornInWindow,
    costPerWear,
    skinTrend: input.skin
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        label: "Skin overall",
        value: s.overallScore,
      })),
    hairTrend: input.hair
      .filter((h) => h.kind === "analysis")
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        label: "Hair density",
        value: h.hairDensity,
      })),
    shadeHistory: input.shades
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        label: s.fitzpatrickType ? `Shade ${s.fitzpatrickType}` : "Shade match",
        value: null,
      })),
    newConsentRequired: false,
  };
}
