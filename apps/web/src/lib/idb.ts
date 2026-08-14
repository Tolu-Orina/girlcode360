/**
 * IndexedDB schema for offline-first cycle logs + sync outbox.
 */
const DB_NAME = "girlcode360";
const DB_VERSION = 2;

export type OutboxItem = {
  id: string;
  idempotencyKey: string;
  op: unknown;
  createdAt: string;
  status: "pending" | "syncing" | "done" | "error";
  error?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cycles")) {
        db.createObjectStore("cycles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("days")) {
        db.createObjectStore("days", { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "id" });
        outbox.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains("wardrobe_drafts")) {
        const drafts = db.createObjectStore("wardrobe_drafts", { keyPath: "id" });
        drafts.createIndex("status", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    const req = fn(s);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    if (req) {
      req.onerror = () => reject(req.error);
    }
  });
}

export async function idbPutCycle(cycle: unknown): Promise<void> {
  await withStore("cycles", "readwrite", (s) => s.put(cycle));
}

export async function idbGetAllCycles<T>(): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cycles", "readonly");
    const req = tx.objectStore("cycles").getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutDay(day: unknown): Promise<void> {
  await withStore("days", "readwrite", (s) => s.put(day));
}

export async function idbGetAllDays<T>(): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("days", "readonly");
    const req = tx.objectStore("days").getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetDay<T>(date: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("days", "readonly");
    const req = tx.objectStore("days").get(date);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetMeta(key: string, value: unknown): Promise<void> {
  await withStore("meta", "readwrite", (s) => s.put({ key, value }));
}

export async function idbGetMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(key);
    req.onsuccess = () => {
      const row = req.result as { key: string; value: T } | undefined;
      resolve(row?.value);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbEnqueue(op: unknown): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    op,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await withStore("outbox", "readwrite", (s) => s.put(item));
  return item;
}

export async function idbPendingOutbox(): Promise<OutboxItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const req = tx.objectStore("outbox").getAll();
    req.onsuccess = () => {
      const all = (req.result as OutboxItem[]).filter(
        (i) => i.status === "pending" || i.status === "error",
      );
      resolve(all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbMarkOutbox(
  id: string,
  status: OutboxItem["status"],
  error?: string,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result as OutboxItem | undefined;
      if (!row) {
        resolve();
        return;
      }
      store.put({ ...row, status, error });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbPruneOutboxDone(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.getAll();
    req.onsuccess = () => {
      for (const row of req.result as OutboxItem[]) {
        if (row.status === "done") store.delete(row.id);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbReplaceCycles(cycles: unknown[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cycles", "readwrite");
    const store = tx.objectStore("cycles");
    store.clear();
    for (const c of cycles) store.put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbReplaceDays(days: unknown[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("days", "readwrite");
    const store = tx.objectStore("days");
    store.clear();
    for (const d of days) store.put(d);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type WardrobeDraft = {
  id: string;
  imageB64: string;
  name: string;
  category: string;
  colourTags: string[];
  sampleHexes: string[];
  purchasePriceMinor: number | null;
  createdAt: string;
  status: "pending" | "syncing" | "error";
  error?: string;
};

export async function idbPutWardrobeDraft(draft: WardrobeDraft): Promise<void> {
  await withStore("wardrobe_drafts", "readwrite", (s) => s.put(draft));
}

export async function idbGetWardrobeDrafts(): Promise<WardrobeDraft[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("wardrobe_drafts", "readonly");
    const req = tx.objectStore("wardrobe_drafts").getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as WardrobeDraft[]).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      );
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteWardrobeDraft(id: string): Promise<void> {
  await withStore("wardrobe_drafts", "readwrite", (s) => s.delete(id));
}
