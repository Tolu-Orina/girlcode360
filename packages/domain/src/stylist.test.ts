import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  climateFromMarket,
  computeStyleAnalytics,
  isStylistQuery,
  suggestDailyOutfit,
  STYLIST_NO_CALENDAR_NOTE,
  STYLIST_WARDROBE_FIRST_NOTE,
} from "./stylist.ts";
import type { WardrobePackingItem } from "./wardrobe.ts";

function item(
  id: string,
  category: WardrobePackingItem["category"],
): WardrobePackingItem {
  return {
    id,
    category,
    name: id,
    colourTags: ["navy"],
    wornCount: 0,
  };
}

describe("P3.5 stylist query + wardrobe-first outfit (FR-135)", () => {
  it("detects wear-today phrasing and ignores unrelated chat", () => {
    assert.equal(isStylistQuery("What should I wear today?"), true);
    assert.equal(isStylistQuery("outfit today please"), true);
    assert.equal(isStylistQuery("why is my cycle late"), false);
  });

  it("returns owned item ids and never a shop-first flag", () => {
    const closet = [
      item("t1", "top"),
      item("b1", "bottom"),
      item("o1", "outerwear"),
      item("s1", "shoes"),
    ];
    const out = suggestDailyOutfit(closet, { climate: "temperate" });
    assert.equal(out.shopFirst, false);
    assert.equal(out.enoughItems, true);
    assert.ok(out.itemIds.includes("t1"));
    assert.ok(out.itemIds.includes("b1"));
    assert.equal(out.itemIds.some((id) => id.startsWith("shop-")), false);
    assert.match(out.notes.join(" "), /not a shopping list/i);
    assert.match(STYLIST_NO_CALENDAR_NOTE, /do not read device calendars/i);
    assert.match(STYLIST_WARDROBE_FIRST_NOTE, /catalogued/i);
  });

  it("does not invent a shop outfit from an empty closet", () => {
    const out = suggestDailyOutfit([], { climate: "hot" });
    assert.equal(out.shopFirst, false);
    assert.equal(out.enoughItems, false);
    assert.equal(out.itemIds.length, 0);
  });

  it("uses a market default climate, not a live weather API", () => {
    assert.equal(climateFromMarket("UK"), "temperate");
    assert.equal(climateFromMarket("NG"), "hot");
    assert.equal(climateFromMarket("GH"), "hot");
  });
});

describe("computeStyleAnalytics (FR-138–140, NFR-STU-11)", () => {
  it("computes utilisation and null-safe cost-per-wear over 90 days", () => {
    const stats = computeStyleAnalytics({
      now: "2026-08-14T00:00:00.000Z",
      items: [
        { id: "a", wornCount: 2, purchasePriceMinor: 4000 },
        { id: "b", wornCount: 0, purchasePriceMinor: 2000 },
        { id: "c", wornCount: 1, purchasePriceMinor: null },
      ],
      outfits: [
        { itemIds: ["a"], wornOn: "2026-07-20" },
        { itemIds: ["c"], wornOn: "2025-01-01" },
      ],
      skin: [{ id: "s1", createdAt: "2026-08-01T00:00:00.000Z", overallScore: 70 }],
      hair: [
        {
          id: "h1",
          createdAt: "2026-08-02T00:00:00.000Z",
          kind: "analysis",
          hairDensity: 62,
        },
        {
          id: "h2",
          createdAt: "2026-08-03T00:00:00.000Z",
          kind: "tryon",
          hairDensity: 10,
        },
      ],
      shades: [
        {
          id: "sh1",
          createdAt: "2026-08-04T00:00:00.000Z",
          fitzpatrickType: "IV",
        },
      ],
    });
    assert.equal(stats.newConsentRequired, false);
    assert.equal(stats.itemsCatalogued, 3);
    assert.equal(stats.itemsWornInWindow, 1);
    assert.equal(stats.utilisationPct, 33);
    const priced = stats.costPerWear.find((r) => r.itemId === "a");
    assert.equal(priced?.costPerWearMinor, 2000);
    const unpriced = stats.costPerWear.find((r) => r.itemId === "c");
    assert.equal(unpriced?.costPerWearMinor, null);
    assert.equal(stats.hairTrend.length, 1);
    assert.equal(stats.shadeHistory[0]?.label, "Shade IV");
    assert.equal(stats.skinTrend[0]?.value, 70);
  });

  it("does not invent utilisation on an empty closet", () => {
    const stats = computeStyleAnalytics({
      items: [],
      outfits: [],
      skin: [],
      hair: [],
      shades: [],
    });
    assert.equal(stats.utilisationPct, null);
    assert.equal(stats.itemsCatalogued, 0);
  });
});
