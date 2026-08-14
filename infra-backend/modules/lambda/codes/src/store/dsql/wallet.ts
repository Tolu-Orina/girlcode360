import { query, toIso } from "../../db/client";
import type { WalletCategory, WalletDocMeta } from "../../types";

type DocRow = {
  id: string;
  user_sub: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  category: string;
  custom_label: string | null;
  note_ciphertext: string | null;
  note_iv: string | null;
  wrapped_dek: string;
  wrapped_dek_iv: string;
  file_iv: string;
  s3_key: string | null;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown | null;
  purge_after: unknown | null;
};

type ShareRow = {
  token: string;
  id: string | null;
  doc_id: string;
  user_sub: string;
  expires_at: unknown;
  revoked: boolean;
  created_at: unknown;
};

export type WalletShareRecord = {
  id: string;
  tokenHash: string;
  docId: string;
  userSub: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

export type WalletShareListItem = {
  id: string;
  docId: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

function mapDoc(row: DocRow): WalletDocMeta {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    category: row.category as WalletCategory,
    customLabel: row.custom_label ?? null,
    noteCiphertext: row.note_ciphertext,
    noteIv: row.note_iv,
    wrappedDek: row.wrapped_dek,
    wrappedDekIv: row.wrapped_dek_iv,
    fileIv: row.file_iv,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : null,
    purgeAfter: row.purge_after ? toIso(row.purge_after) : null,
  };
}

function mapShare(row: ShareRow): WalletShareRecord {
  return {
    id: row.id ?? row.token,
    tokenHash: row.token,
    docId: row.doc_id,
    userSub: row.user_sub,
    expiresAt: toIso(row.expires_at),
    revoked: row.revoked,
    createdAt: toIso(row.created_at),
  };
}

export async function listWalletDocs(sub: string): Promise<WalletDocMeta[]> {
  const res = await query<DocRow>(
    `SELECT * FROM wallet_docs
     WHERE user_sub = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [sub],
  );
  return res.rows.map(mapDoc);
}

export async function listWalletDocsAll(sub: string): Promise<WalletDocMeta[]> {
  const res = await query<DocRow>(
    `SELECT * FROM wallet_docs WHERE user_sub = $1`,
    [sub],
  );
  return res.rows.map(mapDoc);
}

export async function getWalletDoc(
  sub: string,
  id: string,
): Promise<WalletDocMeta | undefined> {
  const res = await query<DocRow>(
    `SELECT * FROM wallet_docs WHERE user_sub = $1 AND id = $2`,
    [sub, id],
  );
  const row = res.rows[0];
  return row ? mapDoc(row) : undefined;
}

export async function getWalletDocById(
  id: string,
): Promise<(WalletDocMeta & { userSub: string }) | undefined> {
  const res = await query<DocRow>(`SELECT * FROM wallet_docs WHERE id = $1`, [
    id,
  ]);
  const row = res.rows[0];
  if (!row) return undefined;
  return { ...mapDoc(row), userSub: row.user_sub };
}

export async function insertWalletDoc(
  sub: string,
  doc: WalletDocMeta,
  s3Key: string | null = null,
): Promise<WalletDocMeta> {
  const res = await query<DocRow>(
    `INSERT INTO wallet_docs (
       id, user_sub, filename, content_type, size_bytes, category, custom_label,
       note_ciphertext, note_iv, wrapped_dek, wrapped_dek_iv, file_iv,
       s3_key, created_at, updated_at, deleted_at, purge_after
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
       $14::timestamptz,$15::timestamptz,$16::timestamptz,$17::timestamptz
     )
     RETURNING *`,
    [
      doc.id,
      sub,
      doc.filename,
      doc.contentType,
      doc.sizeBytes,
      doc.category,
      doc.customLabel,
      doc.noteCiphertext,
      doc.noteIv,
      doc.wrappedDek,
      doc.wrappedDekIv,
      doc.fileIv,
      s3Key,
      doc.createdAt,
      doc.updatedAt,
      doc.deletedAt,
      doc.purgeAfter,
    ],
  );
  return mapDoc(res.rows[0]!);
}

export async function updateWalletDoc(
  sub: string,
  id: string,
  patch: {
    category?: WalletCategory;
    customLabel?: string | null;
    noteCiphertext?: string | null;
    noteIv?: string | null;
    updatedAt: string;
  },
): Promise<WalletDocMeta | undefined> {
  const cur = await getWalletDoc(sub, id);
  if (!cur || cur.deletedAt) return undefined;
  const next: WalletDocMeta = {
    ...cur,
    category: patch.category ?? cur.category,
    customLabel:
      patch.customLabel !== undefined ? patch.customLabel : cur.customLabel,
    noteCiphertext:
      patch.noteCiphertext !== undefined
        ? patch.noteCiphertext
        : cur.noteCiphertext,
    noteIv: patch.noteIv !== undefined ? patch.noteIv : cur.noteIv,
    updatedAt: patch.updatedAt,
  };
  const res = await query<DocRow>(
    `UPDATE wallet_docs SET
       category = $3,
       custom_label = $4,
       note_ciphertext = $5,
       note_iv = $6,
       updated_at = $7::timestamptz
     WHERE user_sub = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [
      sub,
      id,
      next.category,
      next.customLabel,
      next.noteCiphertext,
      next.noteIv,
      next.updatedAt,
    ],
  );
  const row = res.rows[0];
  return row ? mapDoc(row) : undefined;
}

export async function softDeleteWalletDoc(
  sub: string,
  id: string,
  deletedAt: string,
  purgeAfter: string,
): Promise<WalletDocMeta | undefined> {
  const res = await query<DocRow>(
    `UPDATE wallet_docs SET
       deleted_at = $3::timestamptz,
       purge_after = $4::timestamptz,
       updated_at = $3::timestamptz
     WHERE user_sub = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [sub, id, deletedAt, purgeAfter],
  );
  const row = res.rows[0];
  return row ? mapDoc(row) : undefined;
}

export async function revokeSharesForDoc(docId: string): Promise<void> {
  await query(`UPDATE wallet_shares SET revoked = TRUE WHERE doc_id = $1`, [
    docId,
  ]);
}

export async function listDuePurgeDocs(): Promise<
  Array<{ userSub: string; id: string }>
> {
  const res = await query<{ user_sub: string; id: string }>(
    `SELECT user_sub, id FROM wallet_docs
     WHERE purge_after IS NOT NULL AND purge_after <= NOW()`,
  );
  return res.rows.map((r) => ({ userSub: r.user_sub, id: r.id }));
}

export async function hardDeleteWalletDoc(id: string): Promise<void> {
  await query(`DELETE FROM wallet_shares WHERE doc_id = $1`, [id]);
  await query(`DELETE FROM wallet_docs WHERE id = $1`, [id]);
}

export async function insertWalletShare(share: {
  id: string;
  tokenHash: string;
  docId: string;
  userSub: string;
  expiresAt: string;
  createdAt: string;
}): Promise<WalletShareRecord> {
  const res = await query<ShareRow>(
    `INSERT INTO wallet_shares (
       token, id, doc_id, user_sub, expires_at, revoked, created_at
     ) VALUES ($1,$2,$3,$4,$5::timestamptz,FALSE,$6::timestamptz)
     RETURNING *`,
    [
      share.tokenHash,
      share.id,
      share.docId,
      share.userSub,
      share.expiresAt,
      share.createdAt,
    ],
  );
  return mapShare(res.rows[0]!);
}

export async function getShareByTokenHash(
  tokenHash: string,
): Promise<WalletShareRecord | undefined> {
  const res = await query<ShareRow>(
    `SELECT * FROM wallet_shares WHERE token = $1`,
    [tokenHash],
  );
  const row = res.rows[0];
  return row ? mapShare(row) : undefined;
}

export async function getShareById(
  id: string,
): Promise<WalletShareRecord | undefined> {
  const res = await query<ShareRow>(
    `SELECT * FROM wallet_shares WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  return row ? mapShare(row) : undefined;
}

export async function revokeWalletShare(
  sub: string,
  idOrTokenHash: string,
): Promise<boolean> {
  const res = await query(
    `UPDATE wallet_shares SET revoked = TRUE
     WHERE user_sub = $1 AND (id = $2 OR token = $2)
     RETURNING token`,
    [sub, idOrTokenHash],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listSharesForDoc(
  sub: string,
  docId: string,
): Promise<WalletShareListItem[]> {
  const res = await query<ShareRow>(
    `SELECT * FROM wallet_shares
     WHERE user_sub = $1 AND doc_id = $2 AND revoked = FALSE
     ORDER BY created_at DESC`,
    [sub, docId],
  );
  return res.rows.map((row) => {
    const s = mapShare(row);
    return {
      id: s.id,
      docId: s.docId,
      expiresAt: s.expiresAt,
      revoked: s.revoked,
      createdAt: s.createdAt,
    };
  });
}

export async function countWalletDocsAll(sub: string): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM wallet_docs WHERE user_sub = $1`,
    [sub],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function purgeUserWallet(sub: string): Promise<string[]> {
  const docs = await listWalletDocsAll(sub);
  await query(`DELETE FROM wallet_shares WHERE user_sub = $1`, [sub]);
  await query(`DELETE FROM wallet_docs WHERE user_sub = $1`, [sub]);
  return docs.map((d) => d.id);
}
