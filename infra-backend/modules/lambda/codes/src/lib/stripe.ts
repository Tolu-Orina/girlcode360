/** Stripe REST helpers — secret stays in Secrets Manager; hosted Checkout only. */

import { createHmac, timingSafeEqual } from "node:crypto";
import { stripeConfig } from "./secrets.ts";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2024-11-20.acacia";
const SIG_TOLERANCE_SEC = 300;

export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i >= 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : [p, ""];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > SIG_TOLERANCE_SEC) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function stripeForm(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  fields?: Record<string, string | undefined>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const body = new URLSearchParams();
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v != null && v !== "") body.set(k, v);
    }
  }
  const url =
    method === "GET" && body.toString()
      ? `${STRIPE_API}${path}?${body.toString()}`
      : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function createStripeCheckout(opts: {
  sub: string;
  email?: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<
  | { ok: true; url: string; sessionId: string; customerId: string | null }
  | { ok: false; error: string }
> {
  const cfg = await stripeConfig();
  if (!cfg.secretKey || !cfg.secretKey.startsWith("sk_")) {
    return { ok: false, error: "stripe_not_configured" };
  }
  if (!cfg.priceId || !cfg.priceId.startsWith("price_")) {
    return { ok: false, error: "stripe_price_missing" };
  }
  let customerId = opts.customerId ?? null;
  if (!customerId) {
    const created = await stripeForm(cfg.secretKey, "POST", "/customers", {
      email: opts.email,
      "metadata[cognito_sub]": opts.sub,
    });
    if (!created.ok || typeof created.json.id !== "string") {
      return { ok: false, error: "stripe_customer_failed" };
    }
    customerId = created.json.id;
  }
  const session = await stripeForm(cfg.secretKey, "POST", "/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    client_reference_id: opts.sub,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][price]": cfg.priceId,
    "line_items[0][quantity]": "1",
    "metadata[cognito_sub]": opts.sub,
    "subscription_data[metadata][cognito_sub]": opts.sub,
    allow_promotion_codes: "true",
    billing_address_collection: "auto",
  });
  const url = session.json.url;
  const id = session.json.id;
  if (!session.ok || typeof url !== "string" || typeof id !== "string") {
    return { ok: false, error: "stripe_checkout_failed" };
  }
  return { ok: true, url, sessionId: id, customerId };
}

export async function createStripePortal(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cfg = await stripeConfig();
  if (!cfg.secretKey || !cfg.secretKey.startsWith("sk_")) {
    return { ok: false, error: "stripe_not_configured" };
  }
  const session = await stripeForm(
    cfg.secretKey,
    "POST",
    "/billing_portal/sessions",
    {
      customer: opts.customerId,
      return_url: opts.returnUrl,
    },
  );
  const url = session.json.url;
  if (!session.ok || typeof url !== "string") {
    return { ok: false, error: "stripe_portal_failed" };
  }
  return { ok: true, url };
}

export type StripeWebhookOutcome = {
  action: "activate" | "deactivate" | "ignore";
  sub: string | null;
  customerId: string | null;
  renewsAt: string | null;
};

export function interpretStripeEvent(
  event: Record<string, unknown>,
): StripeWebhookOutcome {
  const type = typeof event.type === "string" ? event.type : "";
  const obj = (event.data as { object?: Record<string, unknown> } | undefined)
    ?.object;
  if (!obj) return { action: "ignore", sub: null, customerId: null, renewsAt: null };

  const meta = (obj.metadata as Record<string, string> | undefined) ?? {};
  const subFromMeta =
    meta.cognito_sub?.trim() ||
    (typeof obj.client_reference_id === "string"
      ? obj.client_reference_id.trim()
      : "") ||
    nestedCognitoSub(obj) ||
    null;
  const customerId =
    typeof obj.customer === "string"
      ? obj.customer
      : typeof obj.customer === "object" &&
          obj.customer &&
          "id" in obj.customer &&
          typeof (obj.customer as { id: string }).id === "string"
        ? (obj.customer as { id: string }).id
        : null;

  if (type === "customer.subscription.deleted") {
    return { action: "deactivate", sub: subFromMeta, customerId, renewsAt: null };
  }
  if (type === "customer.subscription.updated") {
    const status = typeof obj.status === "string" ? obj.status : "";
    if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
      return { action: "deactivate", sub: subFromMeta, customerId, renewsAt: null };
    }
    if (status === "active" || status === "trialing") {
      return {
        action: "activate",
        sub: subFromMeta,
        customerId,
        renewsAt: unixToIso(obj.current_period_end),
      };
    }
    return { action: "ignore", sub: subFromMeta, customerId, renewsAt: null };
  }
  if (type === "checkout.session.completed") {
    const paid =
      obj.payment_status === "paid" ||
      obj.payment_status === "no_payment_required";
    if (!paid) {
      return { action: "ignore", sub: subFromMeta, customerId, renewsAt: null };
    }
    return {
      action: "activate",
      sub: subFromMeta,
      customerId,
      renewsAt: null,
    };
  }
  if (type === "invoice.paid") {
    return {
      action: "activate",
      sub: subFromMeta,
      customerId,
      renewsAt: unixToIso(obj.period_end),
    };
  }
  if (type === "invoice.payment_failed") {
    return { action: "ignore", sub: subFromMeta, customerId, renewsAt: null };
  }
  return { action: "ignore", sub: subFromMeta, customerId, renewsAt: null };
}

function nestedCognitoSub(obj: Record<string, unknown>): string | null {
  const parent = obj.parent as
    | { subscription_details?: { metadata?: Record<string, string> } }
    | undefined;
  const fromParent = parent?.subscription_details?.metadata?.cognito_sub?.trim();
  if (fromParent) return fromParent;
  const details = obj.subscription_details as
    | { metadata?: Record<string, string> }
    | undefined;
  const fromDetails = details?.metadata?.cognito_sub?.trim();
  if (fromDetails) return fromDetails;
  const lines = obj.lines as
    | { data?: Array<{ metadata?: Record<string, string> }> }
    | undefined;
  for (const line of lines?.data ?? []) {
    const v = line.metadata?.cognito_sub?.trim();
    if (v) return v;
  }
  return null;
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export async function parseSignedStripeEvent(
  rawBody: string,
  signature: string | undefined,
): Promise<
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const cfg = await stripeConfig();
  if (!cfg.webhookSecret) return { ok: false, error: "stripe_webhook_secret_missing" };
  if (!verifyStripeSignature(rawBody, signature, cfg.webhookSecret)) {
    return { ok: false, error: "invalid_signature" };
  }
  try {
    return { ok: true, event: JSON.parse(rawBody) as Record<string, unknown> };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}
