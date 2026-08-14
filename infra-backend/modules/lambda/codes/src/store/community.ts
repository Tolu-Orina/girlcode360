import {
  COMMUNITY_GROUPS,
  anonymisedDisplayName,
  isCommunityGroupId,
  validateCommunityPost,
  type CommunityGroupId,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import type { CommunityGroupView, CommunityPost } from "../types";
import * as dsql from "./dsql/community";

type MemMembership = {
  groupId: CommunityGroupId;
  userSub: string;
  displayName: string;
  joinedAt: string;
};

const memberships = new Map<string, MemMembership>();
const posts = new Map<string, CommunityPost & { authorSub: string }>();

function memKey(groupId: string, sub: string): string {
  return `${groupId}:${sub}`;
}

export async function postExists(id: string): Promise<boolean> {
  if (isDsqlEnabled()) return dsql.postExists(id);
  return posts.has(id);
}

export async function listGroups(sub: string): Promise<CommunityGroupView[]> {
  const mine = isDsqlEnabled()
    ? await dsql.listMembershipsForUser(sub)
    : [...memberships.values()].filter((m) => m.userSub === sub);
  const counts = isDsqlEnabled()
    ? await dsql.memberCounts()
    : (() => {
        const map = new Map<string, number>();
        for (const m of memberships.values()) {
          map.set(m.groupId, (map.get(m.groupId) ?? 0) + 1);
        }
        return map;
      })();
  const byGroup = new Map(mine.map((m) => [m.groupId, m]));
  return COMMUNITY_GROUPS.map((g) => {
    const row = byGroup.get(g.id);
    return {
      id: g.id,
      name: g.name,
      body: g.body,
      joined: Boolean(row),
      displayName: row?.displayName ?? null,
      memberCount: counts.get(g.id) ?? 0,
    };
  });
}

export async function joinGroup(
  sub: string,
  groupId: string,
): Promise<CommunityGroupView | { error: string }> {
  if (!isCommunityGroupId(groupId)) return { error: "unknown_group" };
  const displayName = anonymisedDisplayName(sub);
  const row: MemMembership = {
    groupId,
    userSub: sub,
    displayName,
    joinedAt: new Date().toISOString(),
  };
  if (isDsqlEnabled()) await dsql.upsertMembership(row);
  else memberships.set(memKey(groupId, sub), row);
  const groups = await listGroups(sub);
  return groups.find((g) => g.id === groupId)!;
}

export async function leaveGroup(
  sub: string,
  groupId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isCommunityGroupId(groupId)) return { error: "unknown_group" };
  if (isDsqlEnabled()) await dsql.deleteMembership(groupId, sub);
  else memberships.delete(memKey(groupId, sub));
  return { ok: true };
}

async function requireMember(
  sub: string,
  groupId: string,
): Promise<MemMembership | undefined> {
  if (isDsqlEnabled()) return dsql.getMembership(groupId, sub);
  return memberships.get(memKey(groupId, sub));
}

export async function listPosts(
  sub: string,
  groupId: string,
): Promise<CommunityPost[] | { error: string }> {
  if (!isCommunityGroupId(groupId)) return { error: "unknown_group" };
  const member = await requireMember(sub, groupId);
  if (!member) return { error: "not_a_member" };
  if (isDsqlEnabled()) return dsql.listVisiblePosts(groupId, sub);
  return [...posts.values()]
    .filter(
      (p) =>
        p.groupId === groupId &&
        (p.status === "live" || p.authorSub === sub) &&
        p.status !== "rejected",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      id: p.id,
      groupId: p.groupId,
      authorDisplay: p.authorDisplay,
      body: p.body,
      status: p.status,
      mine: p.authorSub === sub,
      createdAt: p.createdAt,
    }));
}

export async function createPost(
  sub: string,
  groupId: string,
  raw: string,
): Promise<CommunityPost | { error: string }> {
  if (!isCommunityGroupId(groupId)) return { error: "unknown_group" };
  const member = await requireMember(sub, groupId);
  if (!member) return { error: "not_a_member" };
  const checked = validateCommunityPost(raw);
  if (!checked.ok) return { error: checked.error };
  const now = new Date().toISOString();
  const row: CommunityPost & { authorSub: string } = {
    id: crypto.randomUUID(),
    groupId,
    authorSub: sub,
    authorDisplay: member.displayName,
    body: checked.body,
    status: "pending",
    mine: true,
    createdAt: now,
  };
  if (isDsqlEnabled()) {
    await dsql.insertPost({
      id: row.id,
      groupId,
      authorSub: sub,
      authorDisplay: member.displayName,
      body: checked.body,
      status: "pending",
      createdAt: now,
    });
  } else {
    posts.set(row.id, row);
  }
  return {
    id: row.id,
    groupId,
    authorDisplay: row.authorDisplay,
    body: row.body,
    status: row.status,
    mine: true,
    createdAt: row.createdAt,
  };
}

export async function listPendingPosts(): Promise<CommunityPost[]> {
  if (isDsqlEnabled()) return dsql.listPendingPosts();
  return [...posts.values()]
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({
      id: p.id,
      groupId: p.groupId,
      authorDisplay: p.authorDisplay,
      body: p.body,
      status: p.status,
      mine: false,
      createdAt: p.createdAt,
    }));
}

export async function moderatePost(
  id: string,
  action: "approve" | "reject",
): Promise<CommunityPost | undefined> {
  if (isDsqlEnabled()) return dsql.moderatePost(id, action);
  const row = posts.get(id);
  if (!row) return undefined;
  row.status = action === "approve" ? "live" : "rejected";
  return {
    id: row.id,
    groupId: row.groupId,
    authorDisplay: row.authorDisplay,
    body: row.body,
    status: row.status,
    mine: false,
    createdAt: row.createdAt,
  };
}

export async function purgeUserCommunity(sub: string): Promise<void> {
  if (isDsqlEnabled()) {
    await dsql.purgeUserCommunity(sub);
    return;
  }
  for (const [key, m] of [...memberships.entries()]) {
    if (m.userSub === sub) memberships.delete(key);
  }
  for (const [id, p] of [...posts.entries()]) {
    if (p.authorSub === sub) posts.delete(id);
  }
}
