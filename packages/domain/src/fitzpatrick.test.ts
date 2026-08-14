import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  EQUITY_OVERALL_MIN,
  EQUITY_PER_TYPE_MIN,
  FITZPATRICK_TYPES,
  SHADE_MATCH_WELLNESS_NOTE,
  familyForFitzpatrick,
  parseFitzpatrickType,
  parseShadeFinderPayload,
  scoreEquityHarness,
  type EquityCase,
  type FitzpatrickType,
} from "./fitzpatrick.ts";

const fixturesPath = join(dirname(fileURLToPath(import.meta.url)), "fitzpatrick.fixtures.json");

type FixtureFile = {
  cases: Array<{ id: string; payload: unknown }>;
};

function loadReferenceCases(): EquityCase[] {
  const file = JSON.parse(readFileSync(fixturesPath, "utf8")) as FixtureFile;
  return file.cases.map((row) => {
    const expectedType = row.id.split("-")[1] as FitzpatrickType;
    const parsed = parseShadeFinderPayload(row.payload);
    return {
      id: row.id,
      expectedType,
      expectedFamily: familyForFitzpatrick(expectedType),
      predictedType: parsed.fitzpatrick,
      predictedFamily: parsed.matches[0]?.family ?? null,
    };
  });
}

describe("P3.1 Fitzpatrick I–VI equity harness", () => {
  it("parses vendor type strings and integers", () => {
    assert.equal(parseFitzpatrickType("VI"), "VI");
    assert.equal(parseFitzpatrickType("Type II"), "II");
    assert.equal(parseFitzpatrickType(4), "IV");
    assert.equal(parseFitzpatrickType("not-a-type"), null);
  });

  it("covers every Fitzpatrick type in the reference set", () => {
    const cases = loadReferenceCases();
    for (const t of FITZPATRICK_TYPES) {
      const n = cases.filter((c) => c.expectedType === t).length;
      assert.ok(n >= 2, `need at least two reference cases for type ${t}`);
    }
  });

  it("passes shade and foundation-family accuracy floors on the reference set", () => {
    const score = scoreEquityHarness(loadReferenceCases());
    assert.equal(score.pass, true, score.failReasons.join(","));
    assert.ok(score.fitzpatrickOverall >= EQUITY_OVERALL_MIN);
    assert.ok(score.familyOverall >= EQUITY_OVERALL_MIN);
    for (const t of FITZPATRICK_TYPES) {
      const row = score.perType[t];
      assert.ok(row.n >= 1);
      assert.ok(row.typeCorrect / row.n >= EQUITY_PER_TYPE_MIN);
    }
  });

  it("fails the gate when darker types are predicted as fair", () => {
    const biased: EquityCase[] = FITZPATRICK_TYPES.flatMap((t) => [
      {
        id: `bias-${t}`,
        expectedType: t,
        expectedFamily: familyForFitzpatrick(t),
        predictedType: "I",
        predictedFamily: "fair",
      },
    ]);
    const score = scoreEquityHarness(biased);
    assert.equal(score.pass, false);
    assert.ok(score.failReasons.includes("type_accuracy_below_floor_VI"));
  });

  it("frames Fitzpatrick as a matching aid, not a health label", () => {
    assert.match(SHADE_MATCH_WELLNESS_NOTE, /not a diagnosis/i);
    assert.equal(SHADE_MATCH_WELLNESS_NOTE.toLowerCase().includes("you have"), false);
  });
});
