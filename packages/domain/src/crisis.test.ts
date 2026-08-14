import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crisisMessage, detectCrisis, redactPii } from "./index.ts";

describe("detectCrisis (ALN-F-04)", () => {
  it("flags explicit self-harm language", () => {
    assert.equal(detectCrisis("I want to kill myself"), true);
  });

  it("flags heavy bleeding with dizziness", () => {
    assert.equal(
      detectCrisis("Heavy bleeding and I feel dizzy when I stand"),
      true,
    );
  });

  it("does not flag ordinary cycle questions", () => {
    assert.equal(detectCrisis("My period is late this month"), false);
  });

  it("flags killing myself, overdose, and end it all", () => {
    assert.equal(detectCrisis("I keep thinking about killing myself"), true);
    assert.equal(detectCrisis("I might overdose tonight"), true);
    assert.equal(detectCrisis("I just want to end it all"), true);
    assert.equal(detectCrisis("I cut myself last night"), true);
    assert.equal(detectCrisis("I do not want to live anymore"), true);
  });
});

describe("crisisMessage hospital line", () => {
  it("stays silent when no listing is in range", () => {
    assert.match(crisisMessage("UK"), /No clinic listing is within 5 km/);
    assert.doesNotMatch(crisisMessage("UK"), /invent|St Mary|demo hospital/i);
  });

  it("names only a listing that was actually matched", () => {
    const msg = crisisMessage("NG", {
      name: "Lagos University Teaching Hospital",
      distanceKm: 1.2,
    });
    assert.match(msg, /Lagos University Teaching Hospital/);
    assert.match(msg, /seeded directory/);
  });
});

describe("redactPii (ALN-F-02)", () => {
  it("strips emails before a model payload", () => {
    assert.match(
      redactPii("Reach me at ada@example.com please"),
      /\[redacted\]/,
    );
    assert.doesNotMatch(redactPii("Reach me at ada@example.com please"), /ada@/);
  });
});
