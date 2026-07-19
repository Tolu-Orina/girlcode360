import type {
  CreateWalletShareRequest,
  CreateWalletUploadRequest,
  WalletCategory,
  WalletDocMeta,
} from "../types";

type WalletShare = {
  token: string;
  docId: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

type WalletSharePublic = {
  token: string;
  filename: string;
  contentType: string;
  fileIv: string;
  expiresAt: string;
  downloadUrl: string;
};

const docsByUser = new Map<string, WalletDocMeta[]>();
/** docId → ciphertext bytes (base64) — server-side ciphertext only */
const objects = new Map<string, string>();
const sharesByToken = new Map<
  string,
  {
    token: string;
    docId: string;
    userSub: string;
    expiresAt: string;
    revoked: boolean;
    createdAt: string;
  }
>();

const MAX_BYTES = 25 * 1024 * 1024;

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function listWalletDocs(sub: string): WalletDocMeta[] {
  return (docsByUser.get(sub) ?? [])
    .filter((d) => !d.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWalletDoc(
  sub: string,
  id: string,
): WalletDocMeta | undefined {
  return (docsByUser.get(sub) ?? []).find((d) => d.id === id);
}

export function createWalletUpload(
  sub: string,
  body: CreateWalletUploadRequest,
  apiBase: string,
): { doc: WalletDocMeta; uploadUrl: string; uploadPath: string; uploadHeaders: Record<string, string> } {
  if (!body.filename || !body.contentType || !body.wrappedDek || !body.fileIv) {
    throw new Error("INVALID_UPLOAD");
  }
  if (body.sizeBytes <= 0 || body.sizeBytes > MAX_BYTES) {
    throw new Error("SIZE_LIMIT");
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const doc: WalletDocMeta = {
    id,
    filename: body.filename,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    category: body.category,
    noteCiphertext: body.noteCiphertext ?? null,
    noteIv: body.noteIv ?? null,
    wrappedDek: body.wrappedDek,
    wrappedDekIv: body.wrappedDekIv,
    fileIv: body.fileIv,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    purgeAfter: null,
  };
  const list = docsByUser.get(sub) ?? [];
  list.push(doc);
  docsByUser.set(sub, list);
  const base = apiBase.replace(/\/$/, "");
  return {
    doc,
    uploadUrl: `${base}/v1/wallet/objects/${id}`,
    uploadPath: `/v1/wallet/objects/${id}`,
    uploadHeaders: { "Content-Type": "application/json" },
  };
}

export function putWalletObject(
  sub: string,
  id: string,
  ciphertextB64: string,
): boolean {
  const doc = getWalletDoc(sub, id);
  if (!doc || doc.deletedAt) return false;
  objects.set(id, ciphertextB64);
  return true;
}

export function getWalletObject(
  sub: string,
  id: string,
): string | undefined {
  const doc = getWalletDoc(sub, id);
  if (!doc || doc.deletedAt) return undefined;
  return objects.get(id);
}

export function getWalletObjectPublic(docId: string): string | undefined {
  return objects.get(docId);
}

export function patchWalletMeta(
  sub: string,
  id: string,
  patch: {
    category?: WalletCategory;
    noteCiphertext?: string | null;
    noteIv?: string | null;
  },
): WalletDocMeta | undefined {
  const list = docsByUser.get(sub) ?? [];
  const idx = list.findIndex((d) => d.id === id && !d.deletedAt);
  if (idx < 0) return undefined;
  const cur = list[idx]!;
  const next: WalletDocMeta = {
    ...cur,
    category: patch.category ?? cur.category,
    noteCiphertext:
      patch.noteCiphertext !== undefined
        ? patch.noteCiphertext
        : cur.noteCiphertext,
    noteIv: patch.noteIv !== undefined ? patch.noteIv : cur.noteIv,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  docsByUser.set(sub, list);
  return next;
}

/** Soft delete — purge after 30 days (FR-050). */
export function softDeleteWalletDoc(sub: string, id: string): WalletDocMeta | undefined {
  const list = docsByUser.get(sub) ?? [];
  const idx = list.findIndex((d) => d.id === id && !d.deletedAt);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const next: WalletDocMeta = {
    ...list[idx]!,
    deletedAt: now,
    purgeAfter: addDaysIso(30),
    updatedAt: now,
  };
  list[idx] = next;
  docsByUser.set(sub, list);
  // Revoke shares
  for (const [token, share] of sharesByToken) {
    if (share.docId === id) {
      sharesByToken.set(token, { ...share, revoked: true });
    }
  }
  return next;
}

/** Apply due purges (ciphertext + metadata). */
export function runWalletPurge(): number {
  const now = Date.now();
  let n = 0;
  for (const [sub, list] of docsByUser) {
    const kept: WalletDocMeta[] = [];
    for (const d of list) {
      if (d.purgeAfter && Date.parse(d.purgeAfter) <= now) {
        objects.delete(d.id);
        n++;
      } else {
        kept.push(d);
      }
    }
    docsByUser.set(sub, kept);
  }
  return n;
}

export function createWalletShare(
  sub: string,
  docId: string,
  body: CreateWalletShareRequest,
): WalletShare | { error: string } {
  const doc = getWalletDoc(sub, docId);
  if (!doc || doc.deletedAt) return { error: "doc_not_found" };
  if (!objects.has(docId)) return { error: "object_missing" };
  const days = body.expiresIn === "24h" ? 1 : body.expiresIn === "48h" ? 2 : 7;
  const token = crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const share = {
    token,
    docId,
    userSub: sub,
    expiresAt: addDaysIso(days),
    revoked: false,
    createdAt: now,
  };
  sharesByToken.set(token, share);
  return {
    token: share.token,
    docId: share.docId,
    expiresAt: share.expiresAt,
    revoked: false,
    createdAt: share.createdAt,
  };
}

export function revokeWalletShare(
  sub: string,
  token: string,
): boolean {
  const share = sharesByToken.get(token);
  if (!share || share.userSub !== sub) return false;
  sharesByToken.set(token, { ...share, revoked: true });
  return true;
}

export function getPublicShare(
  token: string,
  apiBase: string,
): WalletSharePublic | { error: string } {
  const share = sharesByToken.get(token);
  if (!share || share.revoked) return { error: "share_invalid" };
  if (Date.parse(share.expiresAt) < Date.now()) return { error: "share_expired" };
  // Find doc across users
  let doc: WalletDocMeta | undefined;
  for (const list of docsByUser.values()) {
    doc = list.find((d) => d.id === share.docId);
    if (doc) break;
  }
  if (!doc || doc.deletedAt) return { error: "doc_not_found" };
  if (!objects.has(doc.id)) return { error: "object_missing" };
  const base = apiBase.replace(/\/$/, "");
  return {
    token,
    filename: doc.filename,
    contentType: doc.contentType,
    fileIv: doc.fileIv,
    expiresAt: share.expiresAt,
    downloadUrl: `${base}/v1/wallet/share/${token}/object`,
  };
}

export function listSharesForDoc(sub: string, docId: string) {
  return [...sharesByToken.values()].filter(
    (s) => s.userSub === sub && s.docId === docId && !s.revoked,
  );
}

export function lookupShareCiphertext(token: string): string | undefined {
  const share = sharesByToken.get(token);
  if (!share || share.revoked) return undefined;
  if (Date.parse(share.expiresAt) < Date.now()) return undefined;
  return objects.get(share.docId);
}

export function purgeUserWallet(sub: string): void {
  const docs = docsByUser.get(sub) ?? [];
  for (const d of docs) objects.delete(d.id);
  docsByUser.delete(sub);
  for (const [token, share] of [...sharesByToken.entries()]) {
    if (share.userSub === sub) sharesByToken.delete(token);
  }
}

/** Include soft-deleted for My Data counts */
export function countWalletDocsAll(sub: string): number {
  return (docsByUser.get(sub) ?? []).length;
}
