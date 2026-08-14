import {
  parseJsonArray,
  query,
  toIso,
} from "../../db/client";
import type {
  ConsentPurpose,
  ConsentRecord,
  HealthModule,
  Market,
  UserProfile,
} from "../../types";

type UserRow = {
  sub: string;
  email: string | null;
  market: string;
  locale: string;
  age_confirmed_18: boolean;
  onboarding_complete: boolean;
  modules: string;
  created_at: unknown;
  updated_at: unknown;
};

type ConsentRow = {
  id: string;
  user_sub: string;
  purpose: string;
  granted: boolean;
  policy_version: string;
  jurisdiction: string;
  recorded_at: unknown;
};

function mapUser(row: UserRow): UserProfile {
  return {
    sub: row.sub,
    email: row.email ?? undefined,
    market: row.market as Market,
    locale: row.locale,
    ageConfirmed18: row.age_confirmed_18,
    onboardingComplete: row.onboarding_complete,
    modules: parseJsonArray<HealthModule>(row.modules),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    purpose: row.purpose as ConsentPurpose,
    granted: row.granted,
    policyVersion: row.policy_version,
    jurisdiction: row.jurisdiction as Market,
    recordedAt: toIso(row.recorded_at),
  };
}

export async function getUser(sub: string): Promise<UserProfile | undefined> {
  const res = await query<UserRow>("SELECT * FROM users WHERE sub = $1", [sub]);
  const row = res.rows[0];
  return row ? mapUser(row) : undefined;
}

export async function getUserByEmail(
  email: string,
): Promise<UserProfile | undefined> {
  const res = await query<UserRow>(
    `SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  const row = res.rows[0];
  return row ? mapUser(row) : undefined;
}

export async function upsertUser(
  sub: string,
  patch: Partial<UserProfile> & { email?: string },
): Promise<UserProfile> {
  const existing = await getUser(sub);
  const now = new Date().toISOString();
  const next: UserProfile = {
    sub,
    email: patch.email ?? existing?.email,
    market: patch.market ?? existing?.market ?? "UK",
    locale: patch.locale ?? existing?.locale ?? "en-GB",
    ageConfirmed18: patch.ageConfirmed18 ?? existing?.ageConfirmed18 ?? false,
    onboardingComplete:
      patch.onboardingComplete ?? existing?.onboardingComplete ?? false,
    modules: patch.modules ?? existing?.modules ?? ["period_tracker"],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const res = await query<UserRow>(
    `INSERT INTO users (
       sub, email, market, locale, age_confirmed_18, onboarding_complete,
       modules, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
     ON CONFLICT (sub) DO UPDATE SET
       email = EXCLUDED.email,
       market = EXCLUDED.market,
       locale = EXCLUDED.locale,
       age_confirmed_18 = EXCLUDED.age_confirmed_18,
       onboarding_complete = EXCLUDED.onboarding_complete,
       modules = EXCLUDED.modules,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      next.sub,
      next.email ?? null,
      next.market,
      next.locale,
      next.ageConfirmed18,
      next.onboardingComplete,
      JSON.stringify(next.modules),
      next.createdAt,
      next.updatedAt,
    ],
  );
  return mapUser(res.rows[0]!);
}

export async function setModules(
  sub: string,
  modules: HealthModule[],
): Promise<UserProfile> {
  const existing = await getUser(sub);
  if (!existing) throw new Error("USER_NOT_FOUND");
  return upsertUser(sub, { modules });
}

export async function addConsents(
  sub: string,
  jurisdiction: Market,
  policyVersion: string,
  items: Array<{ purpose: ConsentPurpose; granted: boolean }>,
): Promise<ConsentRecord[]> {
  const now = new Date().toISOString();
  const rows: ConsentRecord[] = items.map((item) => ({
    id: crypto.randomUUID(),
    purpose: item.purpose,
    granted: item.granted,
    policyVersion,
    jurisdiction,
    recordedAt: now,
  }));

  for (const row of rows) {
    await query(
      `INSERT INTO consents (
         id, user_sub, purpose, granted, policy_version, jurisdiction, recorded_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)`,
      [
        row.id,
        sub,
        row.purpose,
        row.granted,
        row.policyVersion,
        row.jurisdiction,
        row.recordedAt,
      ],
    );
  }
  return rows;
}

export async function listConsents(sub: string): Promise<ConsentRecord[]> {
  const res = await query<ConsentRow>(
    `SELECT * FROM consents WHERE user_sub = $1 ORDER BY recorded_at ASC`,
    [sub],
  );
  return res.rows.map(mapConsent);
}

export async function latestConsentsByPurpose(
  sub: string,
): Promise<ConsentRecord[]> {
  const all = await listConsents(sub);
  const map = new Map<ConsentPurpose, ConsentRecord>();
  for (const row of all) map.set(row.purpose, row);
  return [...map.values()];
}

export async function listHealthLensEligibleSubs(): Promise<string[]> {
  const res = await query<{ user_sub: string }>(
    `SELECT DISTINCT user_sub FROM consents WHERE purpose = 'ai_healthlens' AND granted = TRUE`,
    [],
  );
  const out: string[] = [];
  for (const row of res.rows) {
    const latest = await latestConsentsByPurpose(row.user_sub);
    if (latest.find((c) => c.purpose === "ai_healthlens")?.granted) {
      out.push(row.user_sub);
    }
  }
  return out;
}

export async function listMarketingSubsForMarket(
  market: Market,
): Promise<string[]> {
  const res = await query<{ user_sub: string }>(
    `SELECT DISTINCT user_sub FROM consents WHERE purpose = 'marketing' AND granted = TRUE`,
    [],
  );
  const out: string[] = [];
  for (const row of res.rows) {
    const user = await getUser(row.user_sub);
    if (!user || user.market !== market) continue;
    const latest = await latestConsentsByPurpose(row.user_sub);
    if (latest.find((c) => c.purpose === "marketing")?.granted) {
      out.push(row.user_sub);
    }
  }
  return out;
}

export async function purgeUser(sub: string): Promise<void> {
  await query(`DELETE FROM sync_idempotency WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM cycle_days WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM cycles WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM consents WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM users WHERE sub = $1`, [sub]);
}
