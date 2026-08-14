import {
  RESALE_PEER_LABEL,
  resaleListingCopy,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import { getObject } from "../db/s3";
import { getUser } from "./memory";
import {
  getWardrobeItemMedia,
  getWardrobeItemRecord,
} from "./wardrobe";
import type { Market, ResaleListing, ResaleListingStatus } from "../types";
import * as dsql from "./dsql/resale";

export type ResaleListingRecord = dsql.ResaleListingRow;

const mem = new Map<string, ResaleListingRecord[]>();

function publicListing(
  row: ResaleListingRecord,
  opts?: { mine?: boolean; hasImage?: boolean },
): ResaleListing {
  return {
    id: row.id,
    wardrobeItemId: row.wardrobeItemId,
    title: row.title,
    details: row.details,
    priceMinor: row.priceMinor,
    status: row.status,
    peerLabel: RESALE_PEER_LABEL,
    market: row.market as Market,
    hasImage: opts?.hasImage ?? true,
    createdAt: row.createdAt,
    mine: opts?.mine,
  };
}

async function listUserRows(sub: string): Promise<ResaleListingRecord[]> {
  if (isDsqlEnabled()) return dsql.listResaleForUser(sub);
  return mem.get(sub) ?? [];
}

async function getRow(id: string): Promise<ResaleListingRecord | undefined> {
  if (isDsqlEnabled()) return dsql.getResale(id);
  for (const rows of mem.values()) {
    const hit = rows.find((r) => r.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export async function listMyResale(sub: string): Promise<ResaleListing[]> {
  return (await listUserRows(sub)).map((r) => publicListing(r, { mine: true }));
}

export async function listLiveResalePublic(market?: Market): Promise<ResaleListing[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listLiveResale(market)
    : [...mem.values()]
        .flat()
        .filter((r) => r.status === "live" && (!market || r.market === market));
  return rows.map((r) => publicListing(r));
}

export async function listPendingResale(): Promise<ResaleListing[]> {
  const rows = isDsqlEnabled()
    ? await dsql.listPendingResale()
    : [...mem.values()].flat().filter((r) => r.status === "pending_moderation");
  return rows.map((r) => publicListing(r));
}

export async function getLiveResale(id: string): Promise<ResaleListing | undefined> {
  const row = await getRow(id);
  if (!row || row.status !== "live") return undefined;
  return publicListing(row);
}

export async function getResaleForOwner(
  sub: string,
  id: string,
): Promise<ResaleListing | undefined> {
  const row = await getRow(id);
  if (!row || row.userSub !== sub) return undefined;
  return publicListing(row, { mine: true });
}

export async function isLiveResaleId(id: string): Promise<boolean> {
  const row = await getRow(id);
  return Boolean(row && row.status === "live");
}

export async function createResaleListing(
  sub: string,
  opts: { wardrobeItemId: string; priceMinor: number },
): Promise<ResaleListing> {
  const price = Math.round(Number(opts.priceMinor));
  if (!Number.isFinite(price) || price < 1) throw new Error("RESALE_PRICE_INVALID");
  const item = await getWardrobeItemRecord(sub, opts.wardrobeItemId);
  if (!item || item.archived) throw new Error("WARDROBE_ITEM_NOT_FOUND");
  const existing = await listUserRows(sub);
  if (
    existing.some(
      (r) =>
        r.wardrobeItemId === item.id &&
        (r.status === "pending_moderation" || r.status === "live"),
    )
  ) {
    throw new Error("RESALE_ALREADY_LISTED");
  }
  const profile = await getUser(sub);
  const copy = resaleListingCopy({
    name: item.name,
    category: item.category,
    colourTags: item.colourTags,
  });
  const row: ResaleListingRecord = {
    id: crypto.randomUUID(),
    userSub: sub,
    wardrobeItemId: item.id,
    priceMinor: price,
    status: "pending_moderation",
    title: copy.title,
    details: copy.details,
    market: profile?.market ?? "UK",
    moderationRef: "content_moderation_queue",
    createdAt: new Date().toISOString(),
  };
  if (isDsqlEnabled()) await dsql.insertResale(row);
  else mem.set(sub, [row, ...(mem.get(sub) ?? [])]);
  return publicListing(row, { mine: true });
}

export async function moderateResale(
  id: string,
  action: "approve" | "reject",
): Promise<ResaleListing | undefined> {
  const next: ResaleListingStatus = action === "approve" ? "live" : "rejected";
  if (isDsqlEnabled()) {
    const row = await dsql.updateResaleStatus(id, next);
    return row ? publicListing(row) : undefined;
  }
  for (const [sub, rows] of mem) {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) continue;
    const row = { ...rows[idx]!, status: next };
    mem.set(
      sub,
      rows.map((r) => (r.id === id ? row : r)),
    );
    return publicListing(row);
  }
  return undefined;
}

export async function getResaleMedia(
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | undefined> {
  const row = await getRow(id);
  if (!row) return undefined;
  if (row.status !== "live" && row.status !== "pending_moderation") return undefined;
  return getWardrobeItemMedia(row.userSub, row.wardrobeItemId);
}

export async function listResaleForExport(sub: string): Promise<ResaleListingRecord[]> {
  return listUserRows(sub);
}

export async function purgeUserResale(sub: string): Promise<void> {
  if (isDsqlEnabled()) await dsql.purgeUserResale(sub);
  mem.delete(sub);
}
