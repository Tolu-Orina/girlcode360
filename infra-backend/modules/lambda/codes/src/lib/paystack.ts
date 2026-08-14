/** Paystack initialize + webhook HMAC (secret key). */

import { createHmac, timingSafeEqual } from "node:crypto";
import { paystackConfig } from "./secrets.ts";

const PAYSTACK_API = "https://api.paystack.co";

export function verifyPaystackSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function selectPaystackPlan(
  market: "UK" | "NG" | "GH" | undefined,
  cfg: { planCode: string | null; planCodeGhs: string | null },
): { plan: string | null; amount: string } {
  const useGhs = market === "GH" && Boolean(cfg.planCodeGhs);
  return {
    plan: (useGhs ? cfg.planCodeGhs : cfg.planCode) ?? null,
    amount: useGhs ? "3500" : "250000",
  };
}

export async function createPaystackCheckout(opts: {
  sub: string;
  email: string;
  market?: "UK" | "NG" | "GH";
  successUrl: string;
}): Promise<
  | { ok: true; url: string; sessionId: string }
  | { ok: false; error: string }
> {
  const cfg = await paystackConfig();
  if (!cfg.secretKey || !cfg.secretKey.startsWith("sk_")) {
    return { ok: false, error: "paystack_not_configured" };
  }
  const chosen = selectPaystackPlan(opts.market, cfg);
  const plan = chosen.plan;
  if (!plan || !plan.startsWith("PLN_")) {
    return { ok: false, error: "paystack_plan_missing" };
  }
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: opts.email,
      amount: chosen.amount,
      plan,
      callback_url: opts.successUrl,
      metadata: {
        cognito_sub: opts.sub,
        cancel_action: "girlcode360_premium",
      },
    }),
  });
  const json = (await res.json()) as {
    status?: boolean;
    data?: { authorization_url?: string; reference?: string };
  };
  const url = json.data?.authorization_url;
  const reference = json.data?.reference;
  if (!res.ok || !json.status || typeof url !== "string" || typeof reference !== "string") {
    return { ok: false, error: "paystack_checkout_failed" };
  }
  return { ok: true, url, sessionId: reference };
}

export type PaystackWebhookOutcome = {
  action: "activate" | "deactivate" | "ignore";
  sub: string | null;
  email: string | null;
  renewsAt: string | null;
};

function cognitoSubFromPaystack(data: Record<string, unknown>): string | null {
  const meta = (data.metadata as Record<string, unknown> | undefined) ?? {};
  if (typeof meta.cognito_sub === "string" && meta.cognito_sub.trim()) {
    return meta.cognito_sub.trim();
  }
  const fields = meta.custom_fields;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (
        field &&
        typeof field === "object" &&
        "variable_name" in field &&
        (field as { variable_name?: string }).variable_name === "cognito_sub" &&
        typeof (field as { value?: string }).value === "string"
      ) {
        return (field as { value: string }).value.trim();
      }
    }
  }
  const customer = data.customer as
    | { metadata?: { cognito_sub?: string } }
    | undefined;
  const fromCustomer = customer?.metadata?.cognito_sub?.trim();
  return fromCustomer || null;
}

function emailFromPaystack(data: Record<string, unknown>): string | null {
  const customer = data.customer as { email?: string } | undefined;
  if (typeof customer?.email === "string" && customer.email.trim()) {
    return customer.email.trim();
  }
  if (typeof data.email === "string" && data.email.trim()) return data.email.trim();
  return null;
}

export function interpretPaystackEvent(
  event: Record<string, unknown>,
): PaystackWebhookOutcome {
  const type = typeof event.event === "string" ? event.event : "";
  const data = (event.data ?? {}) as Record<string, unknown>;
  const sub = cognitoSubFromPaystack(data);
  const email = emailFromPaystack(data);

  if (type === "charge.success" || type === "subscription.create" || type === "invoice.update") {
    const status = typeof data.status === "string" ? data.status : "";
    if (type === "invoice.update" && status !== "success") {
      return { action: "ignore", sub, email, renewsAt: null };
    }
    return { action: "activate", sub, email, renewsAt: null };
  }
  if (type === "subscription.disable" || type === "subscription.not_renew") {
    return { action: "deactivate", sub, email, renewsAt: null };
  }
  return { action: "ignore", sub, email, renewsAt: null };
}

export async function parseSignedPaystackEvent(
  rawBody: string,
  signature: string | undefined,
): Promise<
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const cfg = await paystackConfig();
  if (!cfg.secretKey) return { ok: false, error: "paystack_not_configured" };
  if (!verifyPaystackSignature(rawBody, signature, cfg.secretKey)) {
    return { ok: false, error: "invalid_signature" };
  }
  try {
    return { ok: true, event: JSON.parse(rawBody) as Record<string, unknown> };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}
