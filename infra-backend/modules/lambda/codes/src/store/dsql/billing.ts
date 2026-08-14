import { query, toIso } from "../../db/client";

export type BillingProvider = "stripe" | "paystack" | "dev";

export type SubRow = {
  premium: boolean;
  provider: BillingProvider | null;
  renewsAt: string | null;
  updatedAt: string;
  stripeCustomerId: string | null;
};

type DbRow = {
  user_sub: string;
  premium: boolean;
  provider: string | null;
  renews_at: unknown | null;
  updated_at: unknown;
  stripe_customer_id?: string | null;
};

function mapRow(row: DbRow): SubRow {
  return {
    premium: row.premium,
    provider: (row.provider as BillingProvider | null) ?? null,
    renewsAt: row.renews_at ? toIso(row.renews_at) : null,
    updatedAt: toIso(row.updated_at),
    stripeCustomerId: row.stripe_customer_id ?? null,
  };
}

export async function getSubscription(
  sub: string,
): Promise<SubRow | undefined> {
  const res = await query<DbRow>(
    `SELECT * FROM subscriptions WHERE user_sub = $1`,
    [sub],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : undefined;
}

export async function getSubscriptionByStripeCustomer(
  customerId: string,
): Promise<SubRow & { userSub: string } | undefined> {
  const res = await query<DbRow>(
    `SELECT * FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  );
  const row = res.rows[0];
  return row ? { ...mapRow(row), userSub: row.user_sub } : undefined;
}

export async function rememberStripeCustomer(
  sub: string,
  stripeCustomerId: string,
): Promise<void> {
  const existing = await getSubscription(sub);
  await upsertSubscription(sub, {
    premium: existing?.premium ?? false,
    provider: existing?.provider ?? null,
    renewsAt: existing?.renewsAt ?? null,
    stripeCustomerId,
  });
}

export async function upsertSubscription(
  sub: string,
  row: {
    premium: boolean;
    provider: BillingProvider | null;
    renewsAt: string | null;
    stripeCustomerId?: string | null;
  },
): Promise<SubRow> {
  const now = new Date().toISOString();
  const existing = await getSubscription(sub);
  const customer =
    row.stripeCustomerId !== undefined
      ? row.stripeCustomerId
      : existing?.stripeCustomerId ?? null;
  const res = await query<DbRow>(
    `INSERT INTO subscriptions (user_sub, premium, provider, renews_at, updated_at, stripe_customer_id)
     VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6)
     ON CONFLICT (user_sub) DO UPDATE SET
       premium = EXCLUDED.premium,
       provider = EXCLUDED.provider,
       renews_at = EXCLUDED.renews_at,
       updated_at = EXCLUDED.updated_at,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id)
     RETURNING *`,
    [sub, row.premium, row.provider, row.renewsAt, now, customer],
  );
  return mapRow(res.rows[0]!);
}

export async function deleteSubscription(sub: string): Promise<void> {
  await query(`DELETE FROM subscriptions WHERE user_sub = $1`, [sub]);
}
