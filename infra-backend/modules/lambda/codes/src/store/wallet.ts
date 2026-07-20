import { createHash } from "node:crypto";
import {
  deleteObject,
  getObject,
  isDataBucketEnabled,
  putObject,
  walletObjectKey,
} from "../db/s3";
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
/** docId → ciphertext bytes (base64) — used when DATA_BUCKET is unset */
const objects = new Map<string, string>();
/** Tracks which docs have ciphertext (memory path or after S3 put in this instance). */
const objectPresent = new Set<string>();
/** docId → owning userSub (needed for S3 key on purge / public get) */
const docOwner = new Map<string, string>();
const sharesByTokenHash = new Map<
  string,
  {
    tokenHash: string;
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

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function storeCiphertext(
  userSub: string,
  docId: string,
  ciphertextB64: string,
): Promise<void> {
  if (isDataBucketEnabled()) {
    await putObject(
      walletObjectKey(userSub, docId),
      Buffer.from(ciphertextB64, "base64"),
      "application/octet-stream",
    );
  } else {
    objects.set(docId, ciphertextB64);
  }
  objectPresent.add(docId);
  docOwner.set(docId, userSub);
}

async function loadCiphertext(
  userSub: string,
  docId: string,
): Promise<string | undefined> {
  if (isDataBucketEnabled()) {
    const buf = await getObject(walletObjectKey(userSub, docId));
    if (!buf) return undefined;
    return buf.toString("base64");
  }
  return objects.get(docId);
}

async function removeCiphertext(userSub: string, docId: string): Promise<void> {
  if (isDataBucketEnabled()) {
    await deleteObject(walletObjectKey(userSub, docId));
  } else {
    objects.delete(docId);
  }
  objectPresent.delete(docId);
  docOwner.delete(docId);
}

async function hasCiphertext(userSub: string, docId: string): Promise<boolean> {
  if (objectPresent.has(docId)) return true;
  if (isDataBucketEnabled()) {
    const buf = await getObject(walletObjectKey(userSub, docId));
    if (buf) {
      objectPresent.add(docId);
      docOwner.set(docId, userSub);
      return true;
    }
    return false;
  }
  return objects.has(docId);
}

export async function listWalletDocs(sub: string): Promise<WalletDocMeta[]> {
  return (docsByUser.get(sub) ?? [])
    .filter((d) => !d.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWalletDoc(
  sub: string,
  id: string,
): Promise<WalletDocMeta | undefined> {
  return (docsByUser.get(sub) ?? []).find((d) => d.id === id);
}

export async function createWalletUpload(
  sub: string,
  body: CreateWalletUploadRequest,
  apiBase: string,
): Promise<{
  doc: WalletDocMeta;
  uploadUrl: string;
  uploadPath: string;
  uploadHeaders: Record<string, string>;
}> {
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
  docOwner.set(id, sub);
  const base = apiBase.replace(/\/$/, "");
  return {
    doc,
    uploadUrl: `${base}/v1/wallet/objects/${id}`,
    uploadPath: `/v1/wallet/objects/${id}`,
    uploadHeaders: { "Content-Type": "application/json" },
  };
}

export async function putWalletObject(
  sub: string,
  id: string,
  ciphertextB64: string,
): Promise<boolean> {
  const doc = await getWalletDoc(sub, id);
  if (!doc || doc.deletedAt) return false;
  await storeCiphertext(sub, id, ciphertextB64);
  return true;
}

export async function getWalletObject(
  sub: string,
  id: string,
): Promise<string | undefined> {
  const doc = await getWalletDoc(sub, id);
  if (!doc || doc.deletedAt) return undefined;
  return loadCiphertext(sub, id);
}

export async function getWalletObjectPublic(
  docId: string,
): Promise<string | undefined> {
  const owner = docOwner.get(docId);
  if (owner) return loadCiphertext(owner, docId);
  if (!isDataBucketEnabled()) return objects.get(docId);
  return undefined;
}

export async function patchWalletMeta(
  sub: string,
  id: string,
  patch: {
    category?: WalletCategory;
    noteCiphertext?: string | null;
    noteIv?: string | null;
  },
): Promise<WalletDocMeta | undefined> {
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
export async function softDeleteWalletDoc(
  sub: string,
  id: string,
): Promise<WalletDocMeta | undefined> {
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
  for (const [tokenHash, share] of sharesByTokenHash) {
    if (share.docId === id) {
      sharesByTokenHash.set(tokenHash, { ...share, revoked: true });
    }
  }
  return next;
}

/** Apply due purges (ciphertext + metadata). */
export async function runWalletPurge(): Promise<number> {
  const now = Date.now();
  let n = 0;
  for (const [sub, list] of docsByUser) {
    const kept: WalletDocMeta[] = [];
    for (const d of list) {
      if (d.purgeAfter && Date.parse(d.purgeAfter) <= now) {
        await removeCiphertext(sub, d.id);
        n++;
      } else {
        kept.push(d);
      }
    }
    docsByUser.set(sub, kept);
  }
  return n;
}

export async function createWalletShare(
  sub: string,
  docId: string,
  body: CreateWalletShareRequest,
): Promise<WalletShare | { error: string }> {
  const doc = await getWalletDoc(sub, docId);
  if (!doc || doc.deletedAt) return { error: "doc_not_found" };
  if (!(await hasCiphertext(sub, docId))) return { error: "object_missing" };
  const days = body.expiresIn === "24h" ? 1 : body.expiresIn === "48h" ? 2 : 7;
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const share = {
    tokenHash,
    docId,
    userSub: sub,
    expiresAt: addDaysIso(days),
    revoked: false,
    createdAt: now,
  };
  sharesByTokenHash.set(tokenHash, share);
  return {
    token,
    docId: share.docId,
    expiresAt: share.expiresAt,
    revoked: false,
    createdAt: share.createdAt,
  };
}

export async function revokeWalletShare(
  sub: string,
  token: string,
): Promise<boolean> {
  const tokenHash = hashToken(token);
  const share = sharesByTokenHash.get(tokenHash);
  if (!share || share.userSub !== sub) return false;
  sharesByTokenHash.set(tokenHash, { ...share, revoked: true });
  return true;
}

export async function getPublicShare(
  token: string,
  apiBase: string,
): Promise<WalletSharePublic | { error: string }> {
  const tokenHash = hashToken(token);
  const share = sharesByTokenHash.get(tokenHash);
  if (!share || share.revoked) return { error: "share_invalid" };
  if (Date.parse(share.expiresAt) < Date.now()) return { error: "share_expired" };
  let doc: WalletDocMeta | undefined;
  for (const list of docsByUser.values()) {
    doc = list.find((d) => d.id === share.docId);
    if (doc) break;
  }
  if (!doc || doc.deletedAt) return { error: "doc_not_found" };
  if (!(await hasCiphertext(share.userSub, doc.id))) {
    return { error: "object_missing" };
  }
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

export async function listSharesForDoc(sub: string, docId: string) {
  // Plaintext token is returned only once at create; list keeps the same keys.
  return [...sharesByTokenHash.values()]
    .filter((s) => s.userSub === sub && s.docId === docId && !s.revoked)
    .map((s) => ({
      token: "",
      docId: s.docId,
      expiresAt: s.expiresAt,
      revoked: s.revoked,
      createdAt: s.createdAt,
    }));
}

export async function lookupShareCiphertext(
  token: string,
): Promise<string | undefined> {
  const tokenHash = hashToken(token);
  const share = sharesByTokenHash.get(tokenHash);
  if (!share || share.revoked) return undefined;
  if (Date.parse(share.expiresAt) < Date.now()) return undefined;
  return loadCiphertext(share.userSub, share.docId);
}

export async function purgeUserWallet(sub: string): Promise<void> {
  const docs = docsByUser.get(sub) ?? [];
  for (const d of docs) await removeCiphertext(sub, d.id);
  docsByUser.delete(sub);
  for (const [tokenHash, share] of [...sharesByTokenHash.entries()]) {
    if (share.userSub === sub) sharesByTokenHash.delete(tokenHash);
  }
}

/** Include soft-deleted for My Data counts */
export async function countWalletDocsAll(sub: string): Promise<number> {
  return (docsByUser.get(sub) ?? []).length;
}
