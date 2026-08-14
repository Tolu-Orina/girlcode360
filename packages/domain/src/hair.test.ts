import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  HAIR_CORRELATION_WELLNESS_NOTE,
  HAIR_HL_MONTHLY_SIGNED_OFF,
  HAIR_TEXTURES,
  correlateHairAndPmos,
  parseHairAnalysisPayload,
  parseHairTexture,
  scoreHairTextureHarness,
  type HairScanPoint,
  type HairTexture,
} from "./hair.ts";

const fixturesPath = join(dirname(fileURLToPath(import.meta.url)), "hair.fixtures.json");

function loadTextureCases() {
  const file = JSON.parse(readFileSync(fixturesPath, "utf8")) as {
    cases: Array<{ id: string; payload: unknown }>;
  };
  return file.cases.map((row) => {
    const expected = row.id.split("-")[1] as HairTexture;
    return {
      id: row.id,
      expected,
      predicted: parseHairAnalysisPayload(row.payload).hair_type,
    };
  });
}

function scan(
  partial: Partial<HairScanPoint> & Pick<HairScanPoint, "id" | "createdAt">,
): HairScanPoint {
  return {
    cyclePhase: null,
    scores: {},
    symptomIds: [],
    kind: "analysis",
    ...partial,
  };
}

describe("P3.3 hair texture equity harness", () => {
  it("maps YouCam hair-length term to a 0–100 score", () => {
    const parsed = parseHairAnalysisPayload({
      results: { hair_length: { term: "long hair" } },
    });
    assert.equal(parsed.hair_length, 96);
  });

  it("covers straight, wavy, curly, and coily", () => {
    const cases = loadTextureCases();
    for (const t of HAIR_TEXTURES) {
      assert.ok(
        cases.filter((c) => c.expected === t).length >= 2,
        `need two reference cases for ${t}`,
      );
    }
  });

  it("passes accuracy floors on the reference set", () => {
    const score = scoreHairTextureHarness(loadTextureCases());
    assert.equal(score.pass, true, score.failReasons.join(","));
  });

  it("fails the gate when coily hair is predicted as straight", () => {
    const biased = HAIR_TEXTURES.map((t) => ({
      id: `bias-${t}`,
      expected: t,
      predicted: "straight" as const,
    }));
    const score = scoreHairTextureHarness(biased);
    assert.equal(score.pass, false);
    assert.ok(score.failReasons.includes("texture_accuracy_below_floor_coily"));
  });
});

describe("correlateHairAndPmos (FR-121)", () => {
  it("does not claim a pattern from one diagnostic", () => {
    const insight = correlateHairAndPmos([
      scan({
        id: "a",
        createdAt: "2026-08-01T00:00:00.000Z",
        scores: { hair_density: 80 },
        symptomIds: ["hair_thinning"],
      }),
    ]);
    assert.equal(insight.enoughScans, false);
    assert.equal(insight.patternFound, false);
  });

  it("ignores try-on rows when counting diagnostics", () => {
    const insight = correlateHairAndPmos([
      scan({
        id: "try",
        createdAt: "2026-08-01T00:00:00.000Z",
        kind: "tryon",
        scores: { hair_density: 20 },
      }),
      scan({
        id: "live",
        createdAt: "2026-08-10T00:00:00.000Z",
        scores: { hair_density: 80 },
      }),
    ]);
    assert.equal(insight.enoughScans, false);
  });

  it("reports no pattern when density is stable", () => {
    const insight = correlateHairAndPmos([
      scan({
        id: "a",
        createdAt: "2026-07-01T00:00:00.000Z",
        scores: { hair_density: 62, hair_frizziness: 40 },
      }),
      scan({
        id: "b",
        createdAt: "2026-08-01T00:00:00.000Z",
        scores: { hair_density: 64, hair_frizziness: 41 },
      }),
    ]);
    assert.equal(insight.patternFound, false);
    assert.match(insight.body, /clear hair pattern|similar/i);
  });

  it("flags a density drop with thinning notes without diagnosing", () => {
    const insight = correlateHairAndPmos([
      scan({
        id: "a",
        createdAt: "2026-07-01T00:00:00.000Z",
        scores: { hair_density: 70, hair_frizziness: 30 },
      }),
      scan({
        id: "b",
        createdAt: "2026-08-01T00:00:00.000Z",
        scores: { hair_density: 50, hair_frizziness: 32 },
        symptomIds: ["hair_thinning"],
      }),
    ]);
    assert.equal(insight.patternFound, true);
    assert.match(insight.body, /not a diagnosis/i);
    assert.equal(insight.body.toLowerCase().includes("you have pcos"), false);
  });

  it("keeps monthly HealthLens hair category off until clinical sign-off", () => {
    assert.equal(HAIR_HL_MONTHLY_SIGNED_OFF, false);
    assert.match(HAIR_CORRELATION_WELLNESS_NOTE, /not a diagnosis/i);
  });
});
