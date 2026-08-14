import { createHash } from "node:crypto";
import { isDsqlEnabled } from "../db/client";
import {
  deleteObject,
  getObject,
  isDataBucketEnabled,
  putObject,
  walletObjectKey,
} from "../db/s3";
import * as dsqlWallet from "./dsql/wallet";
import type {
  CreateWalletMedicationRequest,
  CreateWalletShareRequest,
  CreateWalletUploadRequest,
  WalletCategory,
  WalletDocMeta,
  WalletMedication,
} from "../types";

const WALLET_CATEGORIES: WalletCategory[] = [
  "test_results",
  "prescriptions",
  "scan_images",
  "vaccination",
  "insurance",
  "other",
];

function isAllowedWalletUpload(filename: string, contentType: string): boolean {
  const name = filename.toLowerCase();
  const extOk =
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png");
  const type = contentType.toLowerCase();
  const typeOk =
    !type ||
    type === "application/octet-stream" ||
    type === "application/pdf" ||
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png";
  return extOk && typeOk;
}

export type WalletShareCreated = {
  id: string;
  token: string;
  docId: string;
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
    id: string;
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
  if (isDsqlEnabled()) return dsqlWallet.listWalletDocs(sub);
  return (docsByUser.get(sub) ?? [])
    .filter((d) => !d.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWalletDoc(
  sub: string,
  id: string,
): Promise<WalletDocMeta | undefined> {
  if (isDsqlEnabled()) return dsqlWallet.getWalletDoc(sub, id);
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
  if (!isAllowedWalletUpload(body.filename, body.contentType)) {
    throw new Error("TYPE_LIMIT");
  }
  if (!WALLET_CATEGORIES.includes(body.category)) {
    throw new Error("INVALID_UPLOAD");
  }
  const customLabel =
    body.category === "other" && body.customLabel?.trim()
      ? body.customLabel.trim().slice(0, 40)
      : null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const doc: WalletDocMeta = {
    id,
    filename: body.filename,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    category: body.category,
    customLabel,
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
  const s3Key = isDataBucketEnabled() ? walletObjectKey(sub, id) : null;
  if (isDsqlEnabled()) {
    await dsqlWallet.insertWalletDoc(sub, doc, s3Key);
  } else {
    const list = docsByUser.get(sub) ?? [];
    list.push(doc);
    docsByUser.set(sub, list);
  }
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
  if (isDsqlEnabled()) {
    const doc = await dsqlWallet.getWalletDocById(docId);
    if (!doc || doc.deletedAt) return undefined;
    return loadCiphertext(doc.userSub, docId);
  }
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
    customLabel?: string | null;
    noteCiphertext?: string | null;
    noteIv?: string | null;
  },
): Promise<WalletDocMeta | undefined> {
  if (isDsqlEnabled()) {
    return dsqlWallet.updateWalletDoc(sub, id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }
  const list = docsByUser.get(sub) ?? [];
  const idx = list.findIndex((d) => d.id === id && !d.deletedAt);
  if (idx < 0) return undefined;
  const cur = list[idx]!;
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
  const now = new Date().toISOString();
  const purgeAfter = addDaysIso(30);
  if (isDsqlEnabled()) {
    const doc = await dsqlWallet.softDeleteWalletDoc(sub, id, now, purgeAfter);
    if (doc) await dsqlWallet.revokeSharesForDoc(id);
    return doc;
  }
  const list = docsByUser.get(sub) ?? [];
  const idx = list.findIndex((d) => d.id === id && !d.deletedAt);
  if (idx < 0) return undefined;
  const next: WalletDocMeta = {
    ...list[idx]!,
    deletedAt: now,
    purgeAfter,
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
  if (isDsqlEnabled()) {
    const due = await dsqlWallet.listDuePurgeDocs();
    let n = 0;
    for (const d of due) {
      await removeCiphertext(d.userSub, d.id);
      await dsqlWallet.hardDeleteWalletDoc(d.id);
      n++;
    }
    return n;
  }
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
): Promise<WalletShareCreated | { error: string }> {
  const doc = await getWalletDoc(sub, docId);
  if (!doc || doc.deletedAt) return { error: "doc_not_found" };
  if (!(await hasCiphertext(sub, docId))) return { error: "object_missing" };
  const days = body.expiresIn === "24h" ? 1 : body.expiresIn === "48h" ? 2 : 7;
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = hashToken(token);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = addDaysIso(days);
  if (isDsqlEnabled()) {
    await dsqlWallet.insertWalletShare({
      id,
      tokenHash,
      docId,
      userSub: sub,
      expiresAt,
      createdAt: now,
    });
  } else {
    sharesByTokenHash.set(tokenHash, {
      id,
      tokenHash,
      docId,
      userSub: sub,
      expiresAt,
      revoked: false,
      createdAt: now,
    });
  }
  return {
    id,
    token,
    docId,
    expiresAt,
    revoked: false,
    createdAt: now,
  };
}

export async function revokeWalletShare(
  sub: string,
  idOrToken: string,
): Promise<boolean> {
  const tokenHash = hashToken(idOrToken);
  if (isDsqlEnabled()) {
    const byId = await dsqlWallet.revokeWalletShare(sub, idOrToken);
    if (byId) return true;
    return dsqlWallet.revokeWalletShare(sub, tokenHash);
  }
  // Match by id first, then by hash of plaintext token.
  for (const [hash, share] of sharesByTokenHash) {
    if (share.userSub !== sub) continue;
    if (share.id === idOrToken || hash === tokenHash) {
      sharesByTokenHash.set(hash, { ...share, revoked: true });
      return true;
    }
  }
  return false;
}

export async function getPublicShare(
  token: string,
  apiBase: string,
): Promise<WalletSharePublic | { error: string }> {
  const tokenHash = hashToken(token);
  let share:
    | {
        docId: string;
        userSub: string;
        expiresAt: string;
        revoked: boolean;
      }
    | undefined;
  if (isDsqlEnabled()) {
    share = await dsqlWallet.getShareByTokenHash(tokenHash);
  } else {
    share = sharesByTokenHash.get(tokenHash);
  }
  if (!share || share.revoked) return { error: "share_invalid" };
  if (Date.parse(share.expiresAt) < Date.now()) return { error: "share_expired" };

  let doc: WalletDocMeta | undefined;
  if (isDsqlEnabled()) {
    doc = await dsqlWallet.getWalletDoc(share.userSub, share.docId);
  } else {
    for (const list of docsByUser.values()) {
      doc = list.find((d) => d.id === share!.docId);
      if (doc) break;
    }
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

export async function listSharesForDoc(
  sub: string,
  docId: string,
): Promise<WalletShareListItem[]> {
  if (isDsqlEnabled()) return dsqlWallet.listSharesForDoc(sub, docId);
  return [...sharesByTokenHash.values()]
    .filter((s) => s.userSub === sub && s.docId === docId && !s.revoked)
    .map((s) => ({
      id: s.id,
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
  let share:
    | { userSub: string; docId: string; revoked: boolean; expiresAt: string }
    | undefined;
  if (isDsqlEnabled()) {
    share = await dsqlWallet.getShareByTokenHash(tokenHash);
  } else {
    share = sharesByTokenHash.get(tokenHash);
  }
  if (!share || share.revoked) return undefined;
  if (Date.parse(share.expiresAt) < Date.now()) return undefined;
  return loadCiphertext(share.userSub, share.docId);
}

export async function purgeUserWallet(sub: string): Promise<void> {
  if (isDsqlEnabled()) {
    const ids = await dsqlWallet.purgeUserWallet(sub);
    for (const id of ids) await removeCiphertext(sub, id);
    return;
  }
  const docs = docsByUser.get(sub) ?? [];
  for (const d of docs) await removeCiphertext(sub, d.id);
  docsByUser.delete(sub);
  memWalletMeds.delete(sub);
  for (const [tokenHash, share] of [...sharesByTokenHash.entries()]) {
    if (share.userSub === sub) sharesByTokenHash.delete(tokenHash);
  }
}

/** Include soft-deleted for My Data counts */
export async function countWalletDocsAll(sub: string): Promise<number> {
  if (isDsqlEnabled()) return dsqlWallet.countWalletDocsAll(sub);
  return (docsByUser.get(sub) ?? []).length;
}

const memWalletMeds = new Map<string, WalletMedication[]>();

export async function listWalletMedications(
  sub: string,
): Promise<WalletMedication[]> {
  if (isDsqlEnabled()) return dsqlWallet.listWalletMedications(sub);
  return memWalletMeds.get(sub) ?? [];
}

export async function createWalletMedication(
  sub: string,
  body: CreateWalletMedicationRequest,
): Promise<WalletMedication | { error: string }> {
  if (!body.nameCiphertext?.trim() || !body.nameIv?.trim()) {
    return { error: "ciphertext_required" };
  }
  if (!/^\d{2}:\d{2}$/.test(body.timeLocal ?? "")) {
    return { error: "time_local_required" };
  }
  if (isDsqlEnabled()) return dsqlWallet.insertWalletMedication(sub, body);
  const now = new Date().toISOString();
  const row: WalletMedication = {
    id: crypto.randomUUID(),
    nameCiphertext: body.nameCiphertext,
    nameIv: body.nameIv,
    doseCiphertext: body.doseCiphertext ?? null,
    doseIv: body.doseIv ?? null,
    timeLocal: body.timeLocal,
    frequency: body.frequency === "weekdays" ? "weekdays" : "daily",
    enabled: body.enabled !== false,
    createdAt: now,
    updatedAt: now,
  };
  memWalletMeds.set(sub, [...(memWalletMeds.get(sub) ?? []), row]);
  return row;
}

export async function deleteWalletMedication(
  sub: string,
  id: string,
): Promise<boolean> {
  if (isDsqlEnabled()) return dsqlWallet.deleteWalletMedication(sub, id);
  const list = memWalletMeds.get(sub) ?? [];
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  memWalletMeds.set(sub, next);
  return true;
}

/** Times only — never decrypt names for the tick. */
export async function dueWalletMedicationIds(
  sub: string,
  nowLocalHhMm: string,
  weekday: number,
): Promise<string[]> {
  const meds = await listWalletMedications(sub);
  return meds
    .filter((m) => {
      if (!m.enabled) return false;
      if (m.frequency === "weekdays" && (weekday === 0 || weekday === 6)) {
        return false;
      }
      return m.timeLocal.slice(0, 2) === nowLocalHhMm.slice(0, 2);
    })
    .map((m) => m.id);
}
