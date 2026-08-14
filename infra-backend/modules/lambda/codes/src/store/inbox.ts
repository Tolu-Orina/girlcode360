import {
  marketingInboxCopy,
  type InAppKind,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import type { InAppNotification, MarketplaceListing } from "../types";
import { listMarketingSubsForMarket } from "./memory";
import * as dsql from "./dsql/inbox";

const mem = new Map<string, InAppNotification & { userSub: string }>();

export async function insertInAppIfNew(input: {
  userSub: string;
  kind: InAppKind;
  title: string;
  body: string;
  listingId: string | null;
}): Promise<boolean> {
  if (input.listingId) {
    if (isDsqlEnabled()) {
      if (
        await dsql.hasListingNotice(input.userSub, input.kind, input.listingId)
      ) {
        return false;
      }
    } else {
      for (const row of mem.values()) {
        if (
          row.userSub === input.userSub &&
          row.kind === input.kind &&
          row.listingId === input.listingId
        ) {
          return false;
        }
      }
    }
  }
  const row: InAppNotification & { userSub: string } = {
    id: crypto.randomUUID(),
    userSub: input.userSub,
    kind: input.kind,
    title: input.title,
    body: input.body,
    listingId: input.listingId,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  if (isDsqlEnabled()) {
    await dsql.insertNotice({
      id: row.id,
      userSub: row.userSub,
      kind: row.kind,
      title: row.title,
      body: row.body,
      listingId: row.listingId,
      createdAt: row.createdAt,
    });
  } else {
    mem.set(row.id, row);
  }
  return true;
}

/** FR-067: in-app only, marketing consent, same market. Never web-push. No GPS. */
export async function fanOutListingLive(
  listing: MarketplaceListing,
): Promise<number> {
  if (listing.status !== "live" || listing.seeded) return 0;
  const kind: InAppKind = listing.sponsored ? "promo" : "new_listing";
  const copy = marketingInboxCopy(kind, listing.market);
  const subs = await listMarketingSubsForMarket(listing.market);
  let n = 0;
  for (const sub of subs) {
    if (listing.ownerSub && listing.ownerSub === sub) continue;
    const ok = await insertInAppIfNew({
      userSub: sub,
      kind,
      title: copy.title,
      body: copy.body,
      listingId: listing.id,
    });
    if (ok) n += 1;
  }
  return n;
}

export async function fanOutPromo(opts: {
  market: MarketplaceListing["market"];
  listingId?: string | null;
}): Promise<number> {
  const copy = marketingInboxCopy("promo", opts.market);
  const subs = await listMarketingSubsForMarket(opts.market);
  let n = 0;
  for (const sub of subs) {
    const ok = await insertInAppIfNew({
      userSub: sub,
      kind: "promo",
      title: copy.title,
      body: copy.body,
      listingId: opts.listingId ?? null,
    });
    if (ok) n += 1;
  }
  return n;
}

export async function listInbox(sub: string): Promise<InAppNotification[]> {
  if (isDsqlEnabled()) return dsql.listForUser(sub);
  return [...mem.values()]
    .filter((r) => r.userSub === sub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
    .map(({ userSub: _u, ...rest }) => rest);
}

export async function markInboxRead(
  sub: string,
  id: string,
): Promise<InAppNotification | undefined> {
  if (isDsqlEnabled()) return dsql.markRead(sub, id);
  const row = mem.get(id);
  if (!row || row.userSub !== sub) return undefined;
  row.readAt = new Date().toISOString();
  const { userSub: _u, ...rest } = row;
  return rest;
}

export async function markInboxAllRead(sub: string): Promise<number> {
  if (isDsqlEnabled()) return dsql.markAllRead(sub);
  let n = 0;
  const now = new Date().toISOString();
  for (const row of mem.values()) {
    if (row.userSub === sub && !row.readAt) {
      row.readAt = now;
      n += 1;
    }
  }
  return n;
}

export async function inboxUnreadCount(sub: string): Promise<number> {
  if (isDsqlEnabled()) return dsql.unreadCount(sub);
  let n = 0;
  for (const row of mem.values()) {
    if (row.userSub === sub && !row.readAt) n += 1;
  }
  return n;
}

export async function purgeUserInbox(sub: string): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.purgeUserInbox(sub);
    return;
  }
  for (const [id, row] of [...mem.entries()]) {
    if (row.userSub === sub) mem.delete(id);
  }
}
