import { query, toIso } from "../../db/client";
import type { CommunityGroupId, CommunityPost } from "../../types";

type MembershipRow = {
  group_id: string;
  user_sub: string;
  display_name: string;
  joined_at: unknown;
};

type PostRow = {
  id: string;
  group_id: string;
  author_sub: string;
  author_display: string;
  body: string;
  status: string;
  created_at: unknown;
};

export type Membership = {
  groupId: CommunityGroupId;
  userSub: string;
  displayName: string;
  joinedAt: string;
};

export function mapPost(row: PostRow, viewerSub: string): CommunityPost {
  return {
    id: row.id,
    groupId: row.group_id as CommunityGroupId,
    authorSub: row.author_sub,
    authorDisplay: row.author_display,
    body: row.body,
    status: row.status as CommunityPost["status"],
    mine: row.author_sub === viewerSub,
    createdAt: toIso(row.created_at),
  };
}

export async function getMembership(
  groupId: string,
  sub: string,
): Promise<Membership | undefined> {
  const res = await query<MembershipRow>(
    `SELECT * FROM community_memberships WHERE group_id = $1 AND user_sub = $2`,
    [groupId, sub],
  );
  const row = res.rows[0];
  if (!row) return undefined;
  return {
    groupId: row.group_id as CommunityGroupId,
    userSub: row.user_sub,
    displayName: row.display_name,
    joinedAt: toIso(row.joined_at),
  };
}

export async function upsertMembership(row: Membership): Promise<void> {
  await query(
    `INSERT INTO community_memberships (group_id, user_sub, display_name, joined_at)
     VALUES ($1,$2,$3,$4::timestamptz)
     ON CONFLICT (group_id, user_sub) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [row.groupId, row.userSub, row.displayName, row.joinedAt],
  );
}

export async function deleteMembership(
  groupId: string,
  sub: string,
): Promise<void> {
  await query(
    `DELETE FROM community_memberships WHERE group_id = $1 AND user_sub = $2`,
    [groupId, sub],
  );
}

export async function listMembershipsForUser(sub: string): Promise<Membership[]> {
  const res = await query<MembershipRow>(
    `SELECT * FROM community_memberships WHERE user_sub = $1`,
    [sub],
  );
  return res.rows.map((row) => ({
    groupId: row.group_id as CommunityGroupId,
    userSub: row.user_sub,
    displayName: row.display_name,
    joinedAt: toIso(row.joined_at),
  }));
}

export async function memberCounts(): Promise<Map<string, number>> {
  const res = await query<{ group_id: string; n: string }>(
    `SELECT group_id, COUNT(*)::text AS n FROM community_memberships GROUP BY group_id`,
    [],
  );
  return new Map(res.rows.map((r) => [r.group_id, Number(r.n)]));
}

export async function insertPost(post: {
  id: string;
  groupId: string;
  authorSub: string;
  authorDisplay: string;
  body: string;
  status: string;
  createdAt: string;
}): Promise<void> {
  await query(
    `INSERT INTO community_posts (
       id, group_id, author_sub, author_display, body, status, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$7::timestamptz)`,
    [
      post.id,
      post.groupId,
      post.authorSub,
      post.authorDisplay,
      post.body,
      post.status,
      post.createdAt,
    ],
  );
}

export async function getPost(id: string): Promise<PostRow | undefined> {
  const res = await query<PostRow>(
    `SELECT id, group_id, author_sub, author_display, body, status, created_at
     FROM community_posts WHERE id = $1`,
    [id],
  );
  return res.rows[0];
}

export async function listVisiblePosts(
  groupId: string,
  viewerSub: string,
): Promise<CommunityPost[]> {
  const res = await query<PostRow>(
    `SELECT id, group_id, author_sub, author_display, body, status, created_at
     FROM community_posts
     WHERE group_id = $1
       AND (status = 'live' OR author_sub = $2)
       AND status <> 'rejected'
     ORDER BY created_at DESC`,
    [groupId, viewerSub],
  );
  return res.rows
    .filter((r) => r.status === "live" || r.author_sub === viewerSub)
    .map((r) => mapPost(r, viewerSub));
}

export async function listPendingPosts(): Promise<CommunityPost[]> {
  const res = await query<PostRow>(
    `SELECT id, group_id, author_sub, author_display, body, status, created_at
     FROM community_posts WHERE status = 'pending' ORDER BY created_at ASC`,
    [],
  );
  return res.rows.map((r) => mapPost(r, ""));
}

export async function moderatePost(
  id: string,
  action: "approve" | "reject",
): Promise<CommunityPost | undefined> {
  const status = action === "approve" ? "live" : "rejected";
  const res = await query<PostRow>(
    `UPDATE community_posts SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, group_id, author_sub, author_display, body, status, created_at`,
    [id, status],
  );
  const row = res.rows[0];
  return row ? mapPost(row, "") : undefined;
}

export async function postExists(id: string): Promise<boolean> {
  const res = await query<{ id: string }>(
    `SELECT id FROM community_posts WHERE id = $1`,
    [id],
  );
  return Boolean(res.rows[0]);
}

export async function purgeUserCommunity(sub: string): Promise<void> {
  await query(`DELETE FROM community_posts WHERE author_sub = $1`, [sub]);
  await query(`DELETE FROM community_memberships WHERE user_sub = $1`, [sub]);
}
