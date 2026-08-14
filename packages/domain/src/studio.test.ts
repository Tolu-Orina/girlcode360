import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  familyForFitzpatrick,
  parseShadeFinderPayload,
} from "./fitzpatrick.ts";
import {
  matchShadeTwins,
  parseMakeupCategories,
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
