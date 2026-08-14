import { openDb } from "./idb";

export type MirrorPhotoKind = "face" | "body" | "hand" | "garment";

export type MirrorPhoto = {
  id: string;
  kind: MirrorPhotoKind;
  blob: Blob;
  createdAt: string;
};

const STORE = "mirror_photos";
const MAX_PHOTOS = 16;

export const MIRROR_PHOTO_LABELS: Record<MirrorPhotoKind, string> = {
  face: "Face",
  body: "Full body",
  hand: "Hand",
  garment: "Clothing",
};

export function fileFromMirrorPhoto(photo: MirrorPhoto): File {
  const type = photo.blob.type || "image/jpeg";
  return new File([photo.blob], `mirror-${photo.kind}-${photo.id}.jpg`, { type });
}

async function withPhotos<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE)) {
      resolve(undefined);
      return;
    }
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    if (req) req.onerror = () => reject(req.error);
  });
}

export async function listMirrorPhotos(): Promise<MirrorPhoto[]> {
  const db = await openDb();
  if (!db.objectStoreNames.contains(STORE)) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as MirrorPhoto[]).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveMirrorPhoto(
  file: File,
  kind: MirrorPhotoKind,
): Promise<MirrorPhoto> {
  const row: MirrorPhoto = {
    id: crypto.randomUUID(),
    kind,
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await withPhotos("readwrite", (s) => s.put(row));
  const all = await listMirrorPhotos();
  if (all.length > MAX_PHOTOS) {
    const extra = all.slice(MAX_PHOTOS);
    await Promise.all(extra.map((p) => deleteMirrorPhoto(p.id)));
  }
  return row;
}

export async function deleteMirrorPhoto(id: string): Promise<void> {
  await withPhotos("readwrite", (s) => s.delete(id));
}
