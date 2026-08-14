import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  familyForFitzpatrick,
  parseShadeFinderPayload,
} from "./fitzpatrick.ts";
import {
  buildMakeupVtoEffects,
  makeupShadesForCategory,
  matchShadeTwins,
  parseMakeupCategories,
  parseMakeupPalettes,
  skinScanReusableForShade,
  STUDIO_MAKEUP_CATEGORIES,
} from "./studio.ts";

describe("skinScanReusableForShade (FR-117)", () => {
  it("accepts a scan from the last 30 days", () => {
    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(skinScanReusableForShade(created), true);
  });

  it("rejects a scan older than 30 days", () => {
    const created = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(skinScanReusableForShade(created), false);
  });
});

describe("parseMakeupCategories", () => {
  it("defaults to all seven categories", () => {
    assert.deepEqual(parseMakeupCategories(undefined), [...STUDIO_MAKEUP_CATEGORIES]);
  });

  it("drops unknown labels", () => {
    assert.deepEqual(parseMakeupCategories(["lip", "not-a-category"]), ["lip"]);
  });
});

describe("parseMakeupPalettes", () => {
  it("keeps valid hex per category", () => {
    assert.deepEqual(parseMakeupPalettes({ blush: "#c45c6a", skip: "#fff" }), {
      blush: "#c45c6a",
    });
  });
});

describe("buildMakeupVtoEffects", () => {
  it("includes brows, lashes, and the chosen blush hex", () => {
    const effects = buildMakeupVtoEffects(["blush", "eyebrow", "eyelash"], {
      blush: "#c45c6a",
    });
    const cats = effects.map((e) => e.category);
    assert.ok(cats.includes("blush"));
    assert.ok(cats.includes("eyebrows"));
    assert.ok(cats.includes("eyelashes"));
    const blush = effects.find((e) => e.category === "blush") as {
      palettes: Array<{ color: string }>;
    };
    assert.equal(blush.palettes[0]?.color, "#C45C6A");
  });
});

describe("makeupShadesForCategory", () => {
  it("stocks foundation at more than one boutique", () => {
    const shops = new Set(
      makeupShadesForCategory("foundation").map((s) => s.boutiqueName),
    );
    assert.ok(shops.size >= 2);
  });
});

describe("matchShadeTwins (FR-118)", () => {
  const catalogue = [
    {
      id: "mk-a-fair",
      brandCode: "seed-a",
      shadeCode: "10N",
      family: "fair" as const,
      boutiqueName: "South Ken Beauty",
      boutiqueArea: "London · SW7",
    },
    {
      id: "mk-a-deep",
      brandCode: "seed-a",
      shadeCode: "60N",
      family: "deep" as const,
      boutiqueName: "South Ken Beauty",
      boutiqueArea: "London · SW7",
    },
    {
      id: "mk-b-deep",
      brandCode: "seed-b",
      shadeCode: "62W",
      family: "deep" as const,
      boutiqueName: "Bloom Pharmacy",
      boutiqueArea: "Lagos · Ikeja",
    },
  ];

  it("returns one twin per retailer brand from catalogue stock", () => {
    const payload = {
      data: {
        fitzpatrick_type: "VI",
        matches: [
          { brand: "seed-a", shade: "60N", family: "deep", confidence: "high" },
        ],
      },
    };
    const parsed = parseShadeFinderPayload(payload);
    assert.equal(parsed.fitzpatrick, "VI");
    assert.equal(familyForFitzpatrick("VI"), "deep");
    const result = matchShadeTwins(payload, catalogue);
    assert.equal(result.twins.length, 2);
    assert.ok(result.twins.every((t) => t.family === "deep"));
    assert.equal(result.overallConfidence, "Low");
    assert.match(result.wellnessNote, /not a diagnosis/i);
  });
});
