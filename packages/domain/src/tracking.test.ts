import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bmiKgM2,
  buildCycleMonthSummary,
  buildPmosHealthReport,
  clampPeriodLeadDays,
  periodReminderDue,
  whoBandForBmi,
} from "./tracking.ts";

describe("buildCycleMonthSummary (PT-F-06 / FR-017)", () => {
  it("uses logged intervals, not a 28-day default", () => {
    const summary = buildCycleMonthSummary({
      year: 2026,
      monthIndex: 2,
      cycles: [
        { startDate: "2026-01-01", endDate: "2026-01-05" },
        { startDate: "2026-02-05", endDate: "2026-02-10" },
        { startDate: "2026-03-12", endDate: "2026-03-16" },
      ],
      days: [
        {
          date: "2026-03-12",
          flow: "medium",
          mood: 2,
          symptomIds: ["cramps", "cramps"],
        },
        { date: "2026-03-13", flow: "light", mood: 2, symptomIds: ["cramps"] },
      ],
    });
    assert.notEqual(summary.averageCycleLength, 28);
    assert.equal(summary.daysLogged, 2);
    assert.equal(summary.mostCommonSymptoms[0]?.id, "cramps");
    assert.match(summary.text, /not a medical assessment/i);
    assert.doesNotMatch(summary.text.toLowerCase(), /you have pcos/);
  });
});

describe("periodReminderDue (PT-F-07 / FR-019)", () => {
  it("fires on the lead day and the predicted day", () => {
    const due = periodReminderDue("2026-09-10", "2026-09-07", 3);
    assert.equal(due.lead, true);
    assert.equal(due.dayOf, false);
    assert.equal(periodReminderDue("2026-09-10", "2026-09-10", 3).dayOf, true);
    assert.equal(clampPeriodLeadDays(99), 1);
  });
});

describe("WHO pregnancy gain (PG-F-05 / FR-034)", () => {
  it("maps a healthy BMI into the 11.5–16 kg band", () => {
    const bmi = bmiKgM2(60, 165);
    assert.ok(bmi && bmi > 21 && bmi < 23);
    const band = whoBandForBmi(bmi);
    assert.equal(band?.id, "healthy");
    assert.equal(band?.gainMinKg, 11.5);
  });
});

describe("buildPmosHealthReport (PMOS-F-05)", () => {
  it("stays non-diagnostic", () => {
    const text = buildPmosHealthReport({
      market: "UK",
      cycles: [
        { startDate: "2026-01-01", endDate: "2026-01-05" },
        { startDate: "2026-02-05", endDate: "2026-02-09" },
      ],
      symptomIds: ["acne", "acne", "fatigue"],
      biometrics: [
        {
          date: "2026-03-01",
          weightKg: 70,
          sleepHours: 6,
          waterGlasses: 6,
          stress: 4,
        },
      ],
      insights: [
        { title: "Keep logging", body: "Possible patterns only. Not a diagnosis." },
      ],
      asOf: "2026-03-15",
    });
    assert.match(text, /not a medical assessment/i);
    assert.doesNotMatch(text.toLowerCase(), /diagnosed with/);
  });
});
