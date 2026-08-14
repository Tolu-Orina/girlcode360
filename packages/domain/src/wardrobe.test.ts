import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WARDROBE_QUEUE_MAX,
  WARDROBE_TAG_NOTE,
  assertWardrobeAllowed,
  buildPackingList,
  colourFromHex,
  garmentCategoryForVto,
  parseWardrobeCategory,
  suggestWardrobeTags,
  type WardrobeCategory,
  type WardrobePackingItem,
} from "./wardrobe.ts";

function item(
  id: string,
  category: WardrobeCategory,
  wornCount = 0,
): WardrobePackingItem {
  return {
    id,
    category,
    name: `${category} ${id}`,
    colourTags: ["navy"],
    wornCount,
  };
}

describe("P3.4 wardrobe tagging and bans", () => {
  it("maps dress/jumpsuit to one_piece and rejects lingerie", () => {
    assert.equal(parseWardrobeCategory("Dress"), "one_piece");
    assert.equal(parseWardrobeCategory("lingerie"), null);
    assert.throws(() => assertWardrobeAllowed("silk lingerie set"), /BANNED/);
    assert.throws(() => assertWardrobeAllowed("one-piece swimsuit"), /BANNED/);
  });

  it("maps sample hexes to closed colour names", () => {
    assert.equal(colourFromHex("#1e1e1e"), "black");
    assert.equal(colourFromHex("#c8a050"), "gold");
    const tags = suggestWardrobeTags({
      sampleHexes: ["#1e3264", "#f5f5f5"],
      label: "blouse",
    });
    assert.equal(tags.category, "top");
    assert.ok(tags.colourTags.includes("navy") || tags.colourTags.includes("blue"));
    assert.equal(tags.banned, false);
  });

  it("flags banned labels instead of inventing a category", () => {
    const tags = suggestWardrobeTags({ label: "bikini bottom" });
    assert.equal(tags.banned, true);
    assert.equal(tags.category, null);
  });

  it("refuses shoes and accessories on Apparel VTO", () => {
    assert.equal(garmentCategoryForVto("top"), "upper_body");
    assert.equal(garmentCategoryForVto("bottom"), "lower_body");
    assert.equal(garmentCategoryForVto("one_piece"), "full_body");
    assert.throws(() => garmentCategoryForVto("shoes"), /VTO_UNSUPPORTED/);
    assert.throws(() => garmentCategoryForVto("accessory"), /VTO_UNSUPPORTED/);
  });

  it("keeps suggestion copy non-diagnostic", () => {
    assert.match(WARDROBE_TAG_NOTE, /suggestions/i);
    assert.equal(WARDROBE_QUEUE_MAX, 50);
  });
});

describe("buildPackingList (FR-127)", () => {
  const closet: WardrobePackingItem[] = [];
  for (let i = 0; i < 8; i++) closet.push(item(`t${i}`, "top", i));
  for (let i = 0; i < 6; i++) closet.push(item(`b${i}`, "bottom", i));
  for (let i = 0; i < 3; i++) closet.push(item(`d${i}`, "one_piece", i));
  for (let i = 0; i < 2; i++) closet.push(item(`o${i}`, "outerwear", i));
  closet.push(item("s0", "shoes"));
  closet.push(item("a0", "accessory"));
  closet.push({
    id: "banned",
    category: "bottom",
    name: "swimwear brief",
    colourTags: ["black"],
    wornCount: 0,
  });

  it("catalogues 20+ items and builds a capsule from owned pieces only", () => {
    assert.ok(closet.length >= 20);
    const list = buildPackingList(closet, { nights: 5, climate: "temperate" });
    assert.equal(list.enoughItems, true);
    assert.ok(list.itemIds.length >= 4);
    for (const id of list.itemIds) {
      assert.ok(closet.some((c) => c.id === id));
      assert.notEqual(id, "banned");
    }
    assert.match(list.notes.join(" "), /not a shopping list/i);
  });

  it("adds outerwear for cold trips and prefers less-worn pieces", () => {
    const cold = buildPackingList(closet, { nights: 4, climate: "cold" });
    assert.ok(cold.itemIds.includes("o0"));
    assert.ok(cold.itemIds.includes("t0"));
  });

  it("does not invent a capsule from an empty closet", () => {
    const empty = buildPackingList([], { nights: 7, climate: "hot" });
    assert.equal(empty.enoughItems, false);
    assert.equal(empty.itemIds.length, 0);
  });
});
