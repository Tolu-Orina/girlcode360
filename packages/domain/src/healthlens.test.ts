import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodePregnancyDaily,
  healthLensActivation,
  runHealthLensRules,
} from "./index.ts";

describe("healthLensActivation (HL-F-01)", () => {
  it("stays closed until 3 cycles or 90 days", () => {
    assert.equal(healthLensActivation(2, 40).activated, false);
    assert.equal(healthLensActivation(3, 10).activated, true);
    assert.equal(healthLensActivation(1, 90).activated, true);
  });
});

describe("runHealthLensRules (HL-F-05)", () => {
  const base = {
    cycleIntervalsDays: [30, 42, 50],
    loggingSpanDays: 120,
    cycleCount: 4,
    recentSymptomIds: [] as string[],
    pcosModule: false,
  };

  it("does not assume a 28-day cycle when lengths vary", () => {
    const findings = runHealthLensRules(base);
    const irregular = findings.find((f) => f.kind === "irregularity");
    assert.ok(irregular);
    assert.doesNotMatch(irregular!.body, /28/);
  });

  it("flags reduced movement from week 20 logs", () => {
    const findings = runHealthLensRules({
      ...base,
      pregnancyWeek: 22,
      movementReducedLast7: true,
    });
    assert.ok(findings.some((f) => f.id === "foetal-movement"));
  });

  it("does not invent a foetal-movement flag without pregnancy data", () => {
    const findings = runHealthLensRules(base);
    assert.equal(
      findings.some((f) => f.id === "foetal-movement"),
      false,
    );
  });
});

describe("encodePregnancyDaily (PG-F-03)", () => {
  it("stores movement_reduced without extra schema fields", () => {
    const ids = encodePregnancyDaily({
      nausea: 2,
      fatigue: 1,
      sleepHours: 6,
      movementFelt: false,
    });
    assert.ok(ids.includes("nausea_2"));
    assert.ok(ids.includes("movement_reduced"));
    assert.ok(ids.includes("sleep_6"));
  });
});
