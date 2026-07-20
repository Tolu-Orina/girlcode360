/** Premium entitlement — env allowlist + DSQL/in-memory subscriptions (Phase 7). */

import { isDsqlEnabled } from "../db/client";
import * as dsqlBilling from "./dsql/billing";

export type BillingProvider = "stripe" | "paystack" | "dev";

type SubRow = {
  premium: boolean;
  provider: BillingProvider | null;
  renewsAt: string | null;
  updatedAt: string;
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

export async function activatePremium(
  sub: string,
  provider: BillingProvider,
  renewsAt?: string | null,
) {
  if (isDsqlEnabled()) {
    await dsqlBilling.upsertSubscription(sub, {
      premium: true,
      provider,
      renewsAt: renewsAt ?? null,
    });
  } else {
    const now = new Date().toISOString();
    subscriptions.set(sub, {
      premium: true,
      provider,
      renewsAt: renewsAt ?? null,
      updatedAt: now,
    });
  }
  return getBillingStatus(sub);
}

export async function deactivatePremium(sub: string) {
  if (isDsqlEnabled()) {
    await dsqlBilling.deleteSubscription(sub);
  } else {
    subscriptions.delete(sub);
  }
  return getBillingStatus(sub);
}

export async function createCheckoutSession(
  sub: string,
  provider: "stripe" | "paystack",
  successUrl?: string,
) {
  const sessionId = crypto.randomUUID();
  const base =
    successUrl ??
    process.env.WEB_APP_URL ??
    "https://app.girlcode360.local/app/account";
  const checkoutUrl = `${base}${base.includes("?") ? "&" : "?"}billing=pending&session=${sessionId}&provider=${provider}`;
  return {
    provider,
    checkoutUrl,
    sessionId,
    message:
      "Checkout stub: call POST /v1/billing/webhooks/" +
      provider +
      " or POST /v1/billing/dev-activate to grant Premium in this environment.",
  };
}

export async function handleBillingWebhook(
  provider: "stripe" | "paystack",
  body: { sub?: string; customerId?: string; event?: string },
): Promise<{
  ok: boolean;
  error?: string;
  status?: Awaited<ReturnType<typeof getBillingStatus>>;
}> {
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

export async function createPortalSession(sub: string) {
  const status = await getBillingStatus(sub);
  return {
    portalUrl:
      (process.env.WEB_APP_URL ?? "https://app.girlcode360.local") +
      "/app/account?billing=portal",
    premium: status.premium,
    message: "Customer portal stub — opens Account Premium section.",
  };
}
