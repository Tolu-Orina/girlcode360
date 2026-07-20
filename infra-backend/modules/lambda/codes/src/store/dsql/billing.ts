import { query, toIso } from "../../db/client";

export type BillingProvider = "stripe" | "paystack" | "dev";

export type SubRow = {
  premium: boolean;
  provider: BillingProvider | null;
  renewsAt: string | null;
  updatedAt: string;
};

type DbRow = {
  user_sub: string;
  premium: boolean;
  provider: string | null;
  renews_at: unknown | null;
  updated_at: unknown;
};

function mapRow(row: DbRow): SubRow {
  return {
    premium: row.premium,
    provider: (row.provider as BillingProvider | null) ?? null,
    renewsAt: row.renews_at ? toIso(row.renews_at) : null,
    updatedAt: toIso(row.updated_at),
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

export async function upsertSubscription(
  sub: string,
  row: {
    premium: boolean;
    provider: BillingProvider | null;
    renewsAt: string | null;
  },
): Promise<SubRow> {
  const now = new Date().toISOString();
  const res = await query<DbRow>(
    `INSERT INTO subscriptions (user_sub, premium, provider, renews_at, updated_at)
     VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz)
     ON CONFLICT (user_sub) DO UPDATE SET
       premium = EXCLUDED.premium,
       provider = EXCLUDED.provider,
       renews_at = EXCLUDED.renews_at,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [sub, row.premium, row.provider, row.renewsAt, now],
  );
  return mapRow(res.rows[0]!);
}

export async function deleteSubscription(sub: string): Promise<void> {
  await query(`DELETE FROM subscriptions WHERE user_sub = $1`, [sub]);
}
