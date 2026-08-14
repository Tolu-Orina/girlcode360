import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { predictNextPeriods } from "./index.ts";

describe("predictNextPeriods (PT-F-02)", () => {
  it("needs two cycle starts before predicting", () => {
    assert.equal(
      predictNextPeriods([{ startDate: "2026-01-01", endDate: "2026-01-05" }]),
      null,
    );
  });

  it("uses logged intervals instead of a 28-day default", () => {
    const result = predictNextPeriods([
      { startDate: "2026-01-01", endDate: "2026-01-05" },
      { startDate: "2026-02-05", endDate: "2026-02-10" },
      { startDate: "2026-03-12", endDate: "2026-03-16" },
    ]);
    assert.ok(result);
    assert.notEqual(result.cycleLengthDays, 28);
    assert.equal(result.nextStarts.length, 3);
    assert.equal(result.nextStarts[0], "2026-04-16");
  });

  it("honours an irregular-cycle length override", () => {
    const result = predictNextPeriods(
      [
        { startDate: "2026-01-01", endDate: "2026-01-05" },
        { startDate: "2026-02-10", endDate: "2026-02-14" },
      ],
      { cycleLengthOverride: 40 },
    );
    assert.ok(result);
    assert.equal(result.cycleLengthDays, 40);
    assert.equal(result.nextStarts[0], "2026-03-22");
  });
});
