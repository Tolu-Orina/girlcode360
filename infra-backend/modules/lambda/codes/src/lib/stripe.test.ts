import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import {
  interpretStripeEvent,
  verifyStripeSignature,
} from "./stripe.ts";

function sign(raw: string, secret: string, t: number): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("stripe webhook signature", () => {
  const secret = "whsec_test_secret";
  const raw = '{"id":"evt_1"}';
  const now = 1_700_000_000;

  it("accepts a valid v1 signature", () => {
    assert.equal(
      verifyStripeSignature(raw, sign(raw, secret, now), secret, now),
      true,
    );
  });

  it("rejects a wrong secret", () => {
    assert.equal(
      verifyStripeSignature(raw, sign(raw, secret, now), "other", now),
      false,
    );
  });

  it("rejects a stale timestamp", () => {
    assert.equal(
      verifyStripeSignature(raw, sign(raw, secret, now - 400), secret, now),
      false,
    );
  });
});

describe("interpretStripeEvent", () => {
  it("activates on checkout.session.completed with cognito_sub", () => {
    const out = interpretStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          customer: "cus_1",
          metadata: { cognito_sub: "user-1" },
          client_reference_id: "user-1",
        },
      },
    });
    assert.equal(out.action, "activate");
    assert.equal(out.sub, "user-1");
    assert.equal(out.customerId, "cus_1");
  });

  it("deactivates on subscription deleted", () => {
    const out = interpretStripeEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_1",
          metadata: { cognito_sub: "user-1" },
        },
      },
    });
    assert.equal(out.action, "deactivate");
  });

  it("does not treat checkout complete as paid", () => {
    const out = interpretStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          status: "complete",
          payment_status: "unpaid",
          customer: "cus_1",
          metadata: { cognito_sub: "user-1" },
        },
      },
    });
    assert.equal(out.action, "ignore");
  });

  it("reads cognito_sub from invoice subscription_details", () => {
    const out = interpretStripeEvent({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_1",
          period_end: 1_700_000_000,
          parent: {
            subscription_details: { metadata: { cognito_sub: "user-1" } },
          },
        },
      },
    });
    assert.equal(out.action, "activate");
    assert.equal(out.sub, "user-1");
  });

  it("does not revoke on a failed invoice (Smart Retries)", () => {
    const out = interpretStripeEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          customer: "cus_1",
          metadata: { cognito_sub: "user-1" },
        },
      },
    });
    assert.equal(out.action, "ignore");
  });
});
