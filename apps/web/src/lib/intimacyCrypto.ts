/** Device-bound AES-GCM for TTC intimacy (FR-042). Server stores ciphertext only. */

const DB = "gc360-intimacy";
const STORE = "keys";
const KEY_ID = "aes-gcm";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return key;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function encryptIntimacyFlag(): Promise<{
  intimacyCiphertext: string;
  intimacyIv: string;
}> {
  const key = await loadOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBuffer(iv) },
      key,
      asBuffer(new TextEncoder().encode("1")),
    ),
  );
  return { intimacyCiphertext: b64(ct), intimacyIv: b64(iv) };
}

export async function decryptIntimacyFlag(
  ciphertext: string,
  iv: string,
): Promise<boolean> {
  try {
    const key = await loadOrCreateKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBuffer(fromB64(iv)) },
      key,
      asBuffer(fromB64(ciphertext)),
    );
    return new TextDecoder().decode(plain) === "1";
  } catch {
    return false;
  }
}
