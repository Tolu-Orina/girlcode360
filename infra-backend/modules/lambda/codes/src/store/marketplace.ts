import { isDsqlEnabled } from "../db/client";
import {
  fuzzyListingHay,
  haversineKm,
  isOpenNow,
  matchSheMatch,
  sheMatchTrigger,
  type GeoPoint,
  type SheMatchTriggerId,
} from "../../../../../../packages/domain/src/index";
import { MARKETPLACE_SEED, seededAsListing } from "../lib/marketplaceSeed";
import { latestConsentsByPurpose } from "./memory";
import * as dsql from "./dsql/marketplace";
import type {
  CreateBusinessListingRequest,
  HealthModule,
  MarketplaceCategory,
  MarketplaceListing,
} from "../types";

const memListings = new Map<string, MarketplaceListing>();
const modulePrefs = new Map<string, Record<HealthModule, boolean>>();
const sendLog = new Set<string>();

function seedMemory() {
  if (memListings.size) return;
  for (const seed of MARKETPLACE_SEED) {
    memListings.set(seed.id, seededAsListing(seed));
  }
}

function decorate(
  listing: MarketplaceListing,
  origin: GeoPoint | null,
  weekday: number,
  hhmm: string,
): MarketplaceListing {
  return {
    ...listing,
    distanceKm: origin ? haversineKm(origin, listing) : null,
    openNow: isOpenNow(listing.hours, weekday, hhmm),
  };
}

export async function listMarketplace(opts: {
  origin: GeoPoint | null;
  category?: MarketplaceCategory;
  radiusKm?: number;
  minRating?: number;
  openNow?: boolean;
  q?: string;
  weekday: number;
  hhmm: string;
  market?: MarketplaceListing["market"];
}): Promise<MarketplaceListing[]> {
  const all = isDsqlEnabled()
    ? await dsql.listLive()
    : (seedMemory(), [...memListings.values()].filter((l) => l.status === "live"));
  let rows = all.map((l) => decorate(l, opts.origin, opts.weekday, opts.hhmm));
  if (opts.market) rows = rows.filter((l) => l.market === opts.market);
  if (opts.category) rows = rows.filter((l) => l.category === opts.category);
  if (opts.minRating != null) {
    rows = rows.filter((l) => l.rating >= opts.minRating!);
  }
  if (opts.openNow) rows = rows.filter((l) => l.openNow);
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    rows = rows.filter((l) =>
      fuzzyListingHay(
        q,
        `${l.name} ${l.category} ${l.tags.join(" ")} ${l.services.join(" ")} ${l.address}`,
      ),
    );
  }
  if (opts.origin && opts.radiusKm != null && Number.isFinite(opts.radiusKm)) {
    rows = rows.filter(
      (l) => l.distanceKm != null && l.distanceKm <= opts.radiusKm!,
    );
  }
  rows.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) {
      return a.distanceKm - b.distanceKm;
    }
    return a.name.localeCompare(b.name);
  });
  return rows;
}

export async function getMarketplaceListing(
  id: string,
  origin: GeoPoint | null,
  weekday: number,
  hhmm: string,
): Promise<MarketplaceListing | undefined> {
  const row = isDsqlEnabled()
    ? await dsql.getListing(id)
    : (seedMemory(), memListings.get(id));
  if (!row || (row.status !== "live" && !row.ownerSub)) return undefined;
  return decorate(row, origin, weekday, hhmm);
}

export async function listMyListings(sub: string): Promise<MarketplaceListing[]> {
  if (isDsqlEnabled()) return dsql.listMine(sub);
  seedMemory();
  return [...memListings.values()].filter((l) => l.ownerSub === sub);
}

export async function submitBusinessListing(
  sub: string,
  body: CreateBusinessListingRequest,
): Promise<MarketplaceListing> {
  if (isDsqlEnabled()) return dsql.createPending(sub, body);
  seedMemory();
  const listing: MarketplaceListing = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    category: body.category,
    market: body.market,
    address: body.address.trim(),
    phone: body.phone.trim(),
    lat: body.lat,
    lng: body.lng,
    hours: body.hours ?? {
      mon: ["09:00", "18:00"],
      tue: ["09:00", "18:00"],
      wed: ["09:00", "18:00"],
      thu: ["09:00", "18:00"],
      fri: ["09:00", "18:00"],
      sat: ["10:00", "16:00"],
      sun: null,
    },
    rating: 0,
    tags: body.tags ?? [],
    services: body.services ?? [],
    registrationNumber: body.registrationNumber?.trim() || null,
    seeded: false,
    status: "pending",
    catalogueItemId: null,
    sponsored: false,
    distanceKm: null,
    openNow: null,
    ownerSub: sub,
  };
  memListings.set(listing.id, listing);
  return listing;
}

export async function moderateListing(
  id: string,
  action: "approve" | "reject",
): Promise<MarketplaceListing | undefined> {
  if (isDsqlEnabled()) return dsql.moderate(id, action);
  seedMemory();
  const row = memListings.get(id);
  if (!row) return undefined;
  row.status = action === "approve" ? "live" : "rejected";
  return row;
}

export async function sheMatchConsented(sub: string): Promise<boolean> {
  const rows = await latestConsentsByPurpose(sub);
  return rows.find((c) => c.purpose === "shematch")?.granted === true;
}

export async function getSheMatchPrefs(sub: string): Promise<{
  granted: boolean;
  modules: Record<HealthModule, boolean>;
}> {
  const granted = await sheMatchConsented(sub);
  const modules = isDsqlEnabled()
    ? await dsql.getModulePrefs(sub)
    : (modulePrefs.get(sub) ?? {
        period_tracker: false,
        pcos_manager: false,
        pregnancy: false,
        ttc: false,
        wallet: false,
      });
  return { granted, modules };
}

export async function patchSheMatchPrefs(
  sub: string,
  modules: Partial<Record<HealthModule, boolean>>,
): Promise<Record<HealthModule, boolean>> {
  if (isDsqlEnabled()) return dsql.setModulePrefs(sub, modules);
  const cur =
    modulePrefs.get(sub) ?? {
      period_tracker: false,
      pcos_manager: false,
      pregnancy: false,
      ttc: false,
      wallet: false,
    };
  const next = { ...cur, ...modules };
  modulePrefs.set(sub, next);
  return next;
}

export async function suggestSheMatch(opts: {
  sub: string;
  triggerId: SheMatchTriggerId;
  origin: GeoPoint;
  extraTags?: string[];
  weekday: number;
  hhmm: string;
}): Promise<MarketplaceListing[]> {
  const prefs = await getSheMatchPrefs(opts.sub);
  if (!prefs.granted) return [];
  const trigger = sheMatchTrigger(opts.triggerId);
  if (!trigger) return [];
  if (!prefs.modules[trigger.module]) return [];
  const live = await listMarketplace({
    origin: opts.origin,
    weekday: opts.weekday,
    hhmm: opts.hhmm,
  });
  const matches = matchSheMatch({
    triggerId: opts.triggerId,
    origin: opts.origin,
    extraTags: opts.extraTags,
    listings: live.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      tags: l.tags,
      lat: l.lat,
      lng: l.lng,
      rating: l.rating,
      sponsored: l.sponsored,
      catalogueItemId: l.catalogueItemId,
    })),
  });
  return matches
    .map((m) => live.find((l) => l.id === m.id))
    .filter((l): l is MarketplaceListing => Boolean(l));
}

export async function claimNotificationSend(
  sub: string,
  kind: string,
  slotKey: string,
): Promise<boolean> {
  if (isDsqlEnabled()) return dsql.claimSend(sub, kind, slotKey);
  const key = `${sub}:${kind}:${slotKey}`;
  if (sendLog.has(key)) return false;
  sendLog.add(key);
  return true;
}

export async function listAllPushSubscriptions() {
  if (isDsqlEnabled()) return dsql.listAllPushSubs();
  const { listAllPushMemory } = await import("./memory");
  return listAllPushMemory();
}

export async function purgeUserMarketplace(sub: string): Promise<void> {
  if (isDsqlEnabled()) await dsql.purgeUserMarketplace(sub);
  modulePrefs.delete(sub);
  for (const [id, row] of memListings) {
    if (row.ownerSub === sub && !row.seeded) memListings.delete(id);
  }
}
