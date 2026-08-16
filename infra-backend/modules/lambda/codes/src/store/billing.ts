/** Premium entitlement — Stripe Checkout when keys are live; Paystack remains a stub. */

import { isDsqlEnabled } from "../db/client";
import { getUserByEmail } from "./memory";
import {
  createStripeCheckout,
  createStripePortal,
  interpretStripeEvent,
  parseSignedStripeEvent,
} from "../lib/stripe";
import {
  createPaystackCheckout,
  interpretPaystackEvent,
  parseSignedPaystackEvent,
} from "../lib/paystack";
import * as dsqlBilling from "./dsql/billing";

export type BillingProvider = "stripe" | "paystack" | "dev";

type SubRow = {
  premium: boolean;
  provider: BillingProvider | null;
  renewsAt: string | null;
  updatedAt: string;
  stripeCustomerId: string | null;
};

const subscriptions = new Map<string, SubRow>();

function envPremium(sub: string): boolean {
  const list = (process.env.PREMIUM_SUBS ?? "").split(",").filter(Boolean);
  return list.includes(sub);
}

export async function isPremium(sub: string): Promise<boolean> {
  if (envPremium(sub)) return true;
  if (isDsqlEnabled()) {
    return (await dsqlBilling.getSubscription(sub))?.premium === true;
  }
  return subscriptions.get(sub)?.premium === true;
}

export async function getBillingStatus(sub: string) {
  const row = isDsqlEnabled()
    ? await dsqlBilling.getSubscription(sub)
    : subscriptions.get(sub);
  const premium = await isPremium(sub);
  return {
    premium,
    provider: premium ? (row?.provider ?? (envPremium(sub) ? "dev" : null)) : null,
    plan: premium ? ("premium" as const) : ("free" as const),
    renewsAt: row?.renewsAt ?? null,
  };
}

async function readRow(sub: string): Promise<SubRow | undefined> {
  if (isDsqlEnabled()) return dsqlBilling.getSubscription(sub);
  return subscriptions.get(sub);
}

export async function activatePremium(
  sub: string,
  provider: BillingProvider,
  renewsAt?: string | null,
  stripeCustomerId?: string | null,
) {
  if (isDsqlEnabled()) {
    await dsqlBilling.upsertSubscription(sub, {
      premium: true,
      provider,
      renewsAt: renewsAt ?? null,
      stripeCustomerId,
    });
  } else {
    const prev = subscriptions.get(sub);
    const now = new Date().toISOString();
    subscriptions.set(sub, {
      premium: true,
      provider,
      renewsAt: renewsAt ?? null,
      updatedAt: now,
      stripeCustomerId:
        stripeCustomerId ?? prev?.stripeCustomerId ?? null,
    });
  }
  return getBillingStatus(sub);
}

export async function deactivatePremium(sub: string) {
  const prev = await readRow(sub);
  if (isDsqlEnabled()) {
    await dsqlBilling.upsertSubscription(sub, {
      premium: false,
      provider: prev?.provider ?? null,
      renewsAt: null,
      stripeCustomerId: prev?.stripeCustomerId ?? null,
    });
  } else if (prev) {
    subscriptions.set(sub, {
      ...prev,
      premium: false,
      renewsAt: null,
      updatedAt: new Date().toISOString(),
    });
  }
  return getBillingStatus(sub);
}

export async function createCheckoutSession(
  sub: string,
  provider: "stripe" | "paystack",
  opts?: {
    successUrl?: string;
    cancelUrl?: string;
    email?: string;
    market?: "UK" | "NG" | "GH";
  },
) {
  const origin = (process.env.WEB_APP_URL ?? "https://app.girlcode360.local").replace(
    /\/$/,
    "",
  );
  const base = opts?.successUrl ?? `${origin}/app/account`;
  const cancelUrl =
    opts?.cancelUrl ??
    base.replace("billing=success", "billing=cancel");
  const successUrl = base.includes("billing=")
    ? base
    : `${base}${base.includes("?") ? "&" : "?"}billing=success`;
  const cancelResolved = cancelUrl.includes("billing=")
    ? cancelUrl
    : `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}billing=cancel`;

  if (provider === "stripe") {
    const existing = await readRow(sub);
    const live = await createStripeCheckout({
      sub,
      email: opts?.email,
      customerId: existing?.stripeCustomerId,
      successUrl,
      cancelUrl: cancelResolved,
    });
    if (live.ok) {
      if (live.customerId) {
        if (isDsqlEnabled()) {
          try {
            await dsqlBilling.rememberStripeCustomer(sub, live.customerId);
          } catch (err) {
            console.error("rememberStripeCustomer failed", err);
          }
        } else {
          const prev = subscriptions.get(sub);
          subscriptions.set(sub, {
            premium: prev?.premium ?? false,
            provider: prev?.provider ?? null,
            renewsAt: prev?.renewsAt ?? null,
            updatedAt: new Date().toISOString(),
            stripeCustomerId: live.customerId,
          });
        }
      }
      return {
        provider,
        checkoutUrl: live.url,
        sessionId: live.sessionId,
        message: "Opening Stripe Checkout.",
        live: true as const,
      };
    }
    if (live.error !== "stripe_not_configured" && live.error !== "stripe_price_missing") {
      return {
        provider,
        checkoutUrl: "",
        sessionId: "",
        message: "Stripe Checkout could not start. Try again in a moment.",
        live: false as const,
        error: live.error,
      };
    }
  }

  if (provider === "paystack") {
    if (!opts?.email) {
      return {
        provider,
        checkoutUrl: "",
        sessionId: "",
        live: false as const,
        message: "Paystack needs the email on your account.",
        error: "paystack_email_required",
      };
    }
    const live = await createPaystackCheckout({
      sub,
      email: opts.email,
      market: opts.market,
      successUrl,
    });
    if (live.ok) {
      return {
        provider,
        checkoutUrl: live.url,
        sessionId: live.sessionId,
        message: "Opening Paystack Checkout.",
        live: true as const,
      };
    }
    if (live.error !== "paystack_not_configured" && live.error !== "paystack_plan_missing") {
      return {
        provider,
        checkoutUrl: "",
        sessionId: "",
        message: "Paystack Checkout could not start. Try again in a moment.",
        live: false as const,
        error: live.error,
      };
    }
  }

  const sessionId = crypto.randomUUID();
  const checkoutUrl = `${base}${base.includes("?") ? "&" : "?"}billing=pending&session=${sessionId}&provider=${provider}`;
  return {
    provider,
    checkoutUrl,
    sessionId,
    live: false as const,
    message:
      provider === "paystack"
        ? "Paystack is not configured yet. Add paystack_secret_key and paystack_plan_code to the app secret."
        : "Checkout stub: add stripe_secret_key, stripe_webhook_secret, and stripe_price_id to the app secret.",
  };
}

export async function handleStripeSignedWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<{ ok: boolean; error?: string; ignored?: boolean }> {
  const parsed = await parseSignedStripeEvent(rawBody, signature);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const outcome = interpretStripeEvent(parsed.event);
  let sub = outcome.sub;
  if (!sub && outcome.customerId && isDsqlEnabled()) {
    const row = await dsqlBilling.getSubscriptionByStripeCustomer(
      outcome.customerId,
    );
    sub = row?.userSub ?? null;
  }
  if (!sub && outcome.customerId && !isDsqlEnabled()) {
    for (const [userSub, row] of subscriptions) {
      if (row.stripeCustomerId === outcome.customerId) {
        sub = userSub;
        break;
      }
    }
  }
  if (outcome.action === "ignore") return { ok: true, ignored: true };
  if (!sub) return { ok: true, ignored: true };
  if (outcome.action === "deactivate") {
    await deactivatePremium(sub);
    return { ok: true };
  }
  await activatePremium(sub, "stripe", outcome.renewsAt, outcome.customerId);
  return { ok: true };
}

export async function handlePaystackSignedWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<{ ok: boolean; error?: string; ignored?: boolean }> {
  const parsed = await parseSignedPaystackEvent(rawBody, signature);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const outcome = interpretPaystackEvent(parsed.event);
  if (outcome.action === "ignore") return { ok: true, ignored: true };
  let sub = outcome.sub;
  if (!sub && outcome.email) {
    sub = (await getUserByEmail(outcome.email))?.sub ?? null;
  }
  if (!sub) return { ok: true, ignored: true };
  if (outcome.action === "deactivate") {
    await deactivatePremium(sub);
    return { ok: true };
  }
  await activatePremium(sub, "paystack", outcome.renewsAt);
  return { ok: true };
}

export async function handleBillingWebhook(
  provider: "stripe" | "paystack",
  body: {
    sub?: string;
    customerId?: string;
    event?: string;
    listingId?: string;
  },
): Promise<{
  ok: boolean;
  error?: string;
  status?: Awaited<ReturnType<typeof getBillingStatus>>;
  listingId?: string;
  sponsored?: boolean;
}> {
  if (body.listingId) {
    const { setListingSponsored } = await import("./marketplace");
    const listing = await setListingSponsored(
      body.listingId,
      body.event !== "subscription.deleted" && body.event !== "charge.failed",
    );
    if (!listing) return { ok: false, error: "listing_not_found" };
    return { ok: true, listingId: listing.id, sponsored: listing.sponsored };
  }
  const sub = body.sub ?? body.customerId;
  if (!sub) return { ok: false, error: "sub_required" };
  if (body.event === "subscription.deleted" || body.event === "charge.failed") {
    return { ok: true, status: await deactivatePremium(sub) };
  }
  return { ok: true, status: await activatePremium(sub, provider) };
}

export async function purgeUserBilling(sub: string): Promise<void> {
  if (isDsqlEnabled()) {
    await dsqlBilling.deleteSubscription(sub);
  } else {
    subscriptions.delete(sub);
  }
}

export async function createPortalSession(sub: string, returnUrl?: string) {
  const row = await readRow(sub);
  const status = await getBillingStatus(sub);
  const home =
    returnUrl ??
    `${(process.env.WEB_APP_URL ?? "https://app.girlcode360.local").replace(/\/$/, "")}/app/account`;
  if (row?.stripeCustomerId) {
    const portal = await createStripePortal({
      customerId: row.stripeCustomerId,
      returnUrl: home,
    });
    if (portal.ok) {
      return {
        portalUrl: portal.url,
        premium: status.premium,
        message: "Opening Stripe customer portal.",
        live: true as const,
      };
    }
  }
  return {
    portalUrl: `${home}${home.includes("?") ? "&" : "?"}billing=portal`,
    premium: status.premium,
    live: false as const,
    message: "Customer portal stub — opens Account Premium section.",
  };
}
