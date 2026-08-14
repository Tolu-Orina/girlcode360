import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  correlateSkinAndCycle,
  matchSkincareByScores,
  type MirrorScanPoint,
} from "./index.ts";

function point(
  partial: Partial<MirrorScanPoint> & Pick<MirrorScanPoint, "id" | "cyclePhase">,
): MirrorScanPoint {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    scores: {},
    symptomIds: [],
    ...partial,
  };
}

describe("correlateSkinAndCycle (MIR-F-02)", () => {
  it("does not claim a pattern from one live scan", () => {
    const insight = correlateSkinAndCycle([
      point({
        id: "a",
        cyclePhase: "luteal",
        scores: { acne: 80, oiliness: 70 },
      }),
    ]);
    assert.equal(insight.patternFound, false);
    assert.equal(insight.enoughScans, false);
  });

  it("ignores seeded rows when counting live scans", () => {
    const insight = correlateSkinAndCycle([
      point({
        id: "seed",
        cyclePhase: "follicular",
        scores: { acne: 20, oiliness: 20 },
        seeded: true,
      }),
      point({
        id: "live",
        cyclePhase: "luteal",
        scores: { acne: 80, oiliness: 70 },
      }),
    ]);
    assert.equal(insight.enoughScans, false);
    assert.equal(insight.patternFound, false);
  });

  it("reports no pattern when scores are similar across phases", () => {
    const insight = correlateSkinAndCycle([
      point({
        id: "a",
        cyclePhase: "follicular",
        scores: { acne: 40, oiliness: 42 },
      }),
      point({
        id: "b",
        cyclePhase: "luteal",
        scores: { acne: 43, oiliness: 44 },
      }),
    ]);
    assert.equal(insight.enoughScans, true);
    assert.equal(insight.patternFound, false);
    assert.match(insight.body, /clear pattern/i);
  });

  it("flags a luteal acne rise without diagnosing", () => {
    const insight = correlateSkinAndCycle([
      point({
        id: "a",
        cyclePhase: "follicular",
        scores: { acne: 30, oiliness: 28 },
      }),
      point({
        id: "b",
        cyclePhase: "luteal",
        scores: { acne: 55, oiliness: 50 },
        symptomIds: ["acne"],
      }),
    ]);
    assert.equal(insight.patternFound, true);
    assert.match(insight.body, /correlation/i);
    assert.match(insight.body, /not a diagnosis/i);
  });
});

describe("matchSkincareByScores (MIR-F-04)", () => {
  const items = [
    { kind: "skincare", tags: ["acne", "oiliness"], id: "a" },
    { kind: "skincare", tags: ["radiance"], id: "b" },
    { kind: "apparel", tags: ["acne"], id: "c" },
  ];

  it("returns nothing until a concern is above 60", () => {
    assert.deepEqual(matchSkincareByScores(items, { acne: 40 }), []);
  });

  it("matches tagged skincare only", () => {
    const hit = matchSkincareByScores(items, { acne: 72 });
    assert.deepEqual(
      hit.map((i) => i.id),
      ["a"],
    );
  });
});
