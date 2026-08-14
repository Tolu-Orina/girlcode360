import { parseJsonArray, query, toIso } from "../../db/client";
import { MARKETPLACE_SEED, seededAsListing } from "../../lib/marketplaceSeed";
import type {
  CreateBusinessListingRequest,
  HealthModule,
  MarketplaceHours,
  MarketplaceListing,
} from "../../types";

type Row = {
  id: string;
  owner_sub: string | null;
  status: string;
  name: string;
  category: string;
  market: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  hours: string;
  rating: number;
  tags: string;
  services: string;
  registration_number: string | null;
  catalogue_item_id: string | null;
  sponsored: boolean;
  seeded: boolean;
  created_at: unknown;
  updated_at: unknown;
};

function parseHours(raw: string): MarketplaceHours {
  try {
    return JSON.parse(raw) as MarketplaceHours;
  } catch {
    return {
      mon: ["09:00", "18:00"],
      tue: ["09:00", "18:00"],
      wed: ["09:00", "18:00"],
      thu: ["09:00", "18:00"],
      fri: ["09:00", "18:00"],
      sat: ["10:00", "16:00"],
      sun: null,
    };
  }
}

function mapListing(row: Row): MarketplaceListing {
  return {
    id: row.id,
    name: row.name,
    category: row.category as MarketplaceListing["category"],
    market: row.market as MarketplaceListing["market"],
    address: row.address,
    phone: row.phone,
    lat: Number(row.lat),
    lng: Number(row.lng),
    hours: parseHours(row.hours),
    rating: Number(row.rating),
    tags: parseJsonArray(row.tags),
    services: parseJsonArray(row.services),
    registrationNumber: row.registration_number,
    seeded: row.seeded,
    status: row.status as MarketplaceListing["status"],
    catalogueItemId: row.catalogue_item_id,
    sponsored: row.sponsored,
    distanceKm: null,
    openNow: null,
    ownerSub: row.owner_sub,
  };
}

export async function ensureSeeded(): Promise<void> {
  for (const seed of MARKETPLACE_SEED) {
    const listing = seededAsListing(seed);
    await query(
      `INSERT INTO marketplace_listings (
         id, owner_sub, status, name, category, market, address, phone,
         lat, lng, hours, rating, tags, services, registration_number,
         catalogue_item_id, sponsored, seeded, created_at, updated_at, moderated_at
       ) VALUES (
         $1, NULL, 'live', $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13,
         $14, $15, TRUE, NOW(), NOW(), NOW()
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        listing.id,
        listing.name,
        listing.category,
        listing.market,
        listing.address,
        listing.phone,
        listing.lat,
        listing.lng,
        JSON.stringify(listing.hours),
        listing.rating,
        JSON.stringify(listing.tags),
        JSON.stringify(listing.services),
        listing.registrationNumber,
        listing.catalogueItemId,
        listing.sponsored,
      ],
    );
  }
}

export async function listLive(): Promise<MarketplaceListing[]> {
  await ensureSeeded();
  const res = await query<Row>(
    `SELECT * FROM marketplace_listings WHERE status = 'live' ORDER BY name ASC`,
  );
  return res.rows.map(mapListing);
}

export async function getListing(id: string): Promise<MarketplaceListing | undefined> {
  await ensureSeeded();
  const res = await query<Row>(
    `SELECT * FROM marketplace_listings WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  return row ? mapListing(row) : undefined;
}

export async function listMine(sub: string): Promise<MarketplaceListing[]> {
  const res = await query<Row>(
    `SELECT * FROM marketplace_listings WHERE owner_sub = $1 ORDER BY created_at DESC`,
    [sub],
  );
  return res.rows.map(mapListing);
}

export async function createPending(
  sub: string,
  body: CreateBusinessListingRequest,
): Promise<MarketplaceListing> {
  const id = crypto.randomUUID();
  const hours = body.hours ?? {
    mon: ["09:00", "18:00"],
    tue: ["09:00", "18:00"],
    wed: ["09:00", "18:00"],
    thu: ["09:00", "18:00"],
    fri: ["09:00", "18:00"],
    sat: ["10:00", "16:00"],
    sun: null,
  };
  const res = await query<Row>(
    `INSERT INTO marketplace_listings (
       id, owner_sub, status, name, category, market, address, phone,
       lat, lng, hours, rating, tags, services, registration_number,
       catalogue_item_id, sponsored, seeded, created_at, updated_at
     ) VALUES (
       $1,$2,'pending',$3,$4,$5,$6,$7,
       $8,$9,$10,0,$11,$12,$13,
       NULL, FALSE, FALSE, NOW(), NOW()
     ) RETURNING *`,
    [
      id,
      sub,
      body.name.trim(),
      body.category,
      body.market,
      body.address.trim(),
      body.phone.trim(),
      body.lat,
      body.lng,
      JSON.stringify(hours),
      JSON.stringify(body.tags ?? []),
      JSON.stringify(body.services ?? []),
      body.registrationNumber?.trim() || null,
    ],
  );
  return mapListing(res.rows[0]!);
}

export async function moderate(
  id: string,
  action: "approve" | "reject",
): Promise<MarketplaceListing | undefined> {
  const status = action === "approve" ? "live" : "rejected";
  const res = await query<Row>(
    `UPDATE marketplace_listings SET status = $2, moderated_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, status],
  );
  const row = res.rows[0];
  return row ? mapListing(row) : undefined;
}

export async function getModulePrefs(
  sub: string,
): Promise<Record<HealthModule, boolean>> {
  const res = await query<{ module: string; granted: boolean }>(
    `SELECT module, granted FROM shematch_module_prefs WHERE user_sub = $1`,
    [sub],
  );
  const out: Record<HealthModule, boolean> = {
    period_tracker: false,
    pcos_manager: false,
    pregnancy: false,
    ttc: false,
    wallet: false,
  };
  for (const row of res.rows) {
    if (row.module in out) out[row.module as HealthModule] = row.granted;
  }
  return out;
}

export async function setModulePrefs(
  sub: string,
  modules: Partial<Record<HealthModule, boolean>>,
): Promise<Record<HealthModule, boolean>> {
  const cur = await getModulePrefs(sub);
  const next = { ...cur, ...modules };
  for (const [module, granted] of Object.entries(next)) {
    await query(
      `INSERT INTO shematch_module_prefs (user_sub, module, granted, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (user_sub, module) DO UPDATE SET
         granted = EXCLUDED.granted, updated_at = EXCLUDED.updated_at`,
      [sub, module, granted],
    );
  }
  return next;
}

export async function claimSend(
  sub: string,
  kind: string,
  slotKey: string,
): Promise<boolean> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM notification_sends WHERE user_sub = $1 AND kind = $2 AND slot_key = $3`,
    [sub, kind, slotKey],
  );
  if (existing.rows[0]) return false;
  await query(
    `INSERT INTO notification_sends (id, user_sub, kind, slot_key, created_at)
     VALUES ($1,$2,$3,$4,NOW())`,
    [crypto.randomUUID(), sub, kind, slotKey],
  );
  return true;
}

export async function listAllPushSubs(): Promise<
  Array<{ userSub: string; endpoint: string; p256dh: string; auth: string }>
> {
  const res = await query<{
    user_sub: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(`SELECT user_sub, endpoint, p256dh, auth FROM push_subscriptions`);
  return res.rows.map((r) => ({
    userSub: r.user_sub,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
  }));
}

export async function purgeUserMarketplace(sub: string): Promise<void> {
  await query(`DELETE FROM shematch_module_prefs WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM notification_sends WHERE user_sub = $1`, [sub]);
  await query(
    `DELETE FROM marketplace_listings WHERE owner_sub = $1 AND seeded = FALSE`,
    [sub],
  );
}
