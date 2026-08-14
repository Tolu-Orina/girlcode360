import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import {
  interpretPaystackEvent,
  selectPaystackPlan,
  verifyPaystackSignature,
} from "./paystack.ts";

describe("paystack webhook signature", () => {
  const secret = "sk_test_paystack";
  const raw = '{"event":"charge.success"}';

  it("accepts HMAC SHA512 of the raw body", () => {
    const sig = createHmac("sha512", secret).update(raw, "utf8").digest("hex");
    assert.equal(verifyPaystackSignature(raw, sig, secret), true);
  });

  it("rejects a wrong secret", () => {
    const sig = createHmac("sha512", secret).update(raw, "utf8").digest("hex");
    assert.equal(verifyPaystackSignature(raw, sig, "other"), false);
  });
});

describe("interpretPaystackEvent", () => {
  it("activates on charge.success with cognito_sub", () => {
    const out = interpretPaystackEvent({
      event: "charge.success",
      data: { metadata: { cognito_sub: "user-1" }, status: "success" },
    });
    assert.equal(out.action, "activate");
    assert.equal(out.sub, "user-1");
  });

  it("deactivates when the subscription is disabled", () => {
    const out = interpretPaystackEvent({
      event: "subscription.disable",
      data: { customer: { email: "a@b.co" } },
    });
    assert.equal(out.action, "deactivate");
    assert.equal(out.email, "a@b.co");
  });
});

describe("selectPaystackPlan", () => {
  it("uses NGN amount when Ghana has no GHS plan", () => {
    const chosen = selectPaystackPlan("GH", {
      planCode: "PLN_ng",
      planCodeGhs: null,
    });
    assert.equal(chosen.plan, "PLN_ng");
    assert.equal(chosen.amount, "250000");
  });
});
