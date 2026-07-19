/**
 * Health Wallet client crypto — zero-knowledge-ish vault.
 * Passphrase → Argon2id → KEK; per-file DEK; AES-GCM for file + note.
 * Server never receives plaintext or the raw KEK.
 */
import { argon2id } from "@noble/hashes/argon2";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

const te = new TextEncoder();
const td = new TextDecoder();

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

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export async function deriveKek(
  passphrase: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = fromB64(saltB64);
  const hash = argon2id(te.encode(passphrase), salt, {
    t: 3,
    m: 32_768,
    p: 1,
    dkLen: 32,
  });
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(hash),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export function createVaultSalt(): string {
  return b64(randomBytes(16));
}

async function aesGcmEncrypt(
  key: CryptoKey,
  plain: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBufferSource(iv) },
      key,
      asBufferSource(plain),
    ),
  );
  return { ciphertext: ct, iv };
}

async function aesGcmDecrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(iv) },
      key,
      asBufferSource(ciphertext),
    ),
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    "AES-GCM",
    true,
    ["encrypt", "decrypt"],
  );
}

export async function wrapDek(
  kek: CryptoKey,
  dek: CryptoKey,
): Promise<{ wrappedDek: string; wrappedDekIv: string }> {
  const raw = await exportRawKey(dek);
  const { ciphertext, iv } = await aesGcmEncrypt(kek, raw);
  return { wrappedDek: b64(ciphertext), wrappedDekIv: b64(iv) };
}

export async function unwrapDek(
  kek: CryptoKey,
  wrappedDek: string,
  wrappedDekIv: string,
): Promise<CryptoKey> {
  const raw = await aesGcmDecrypt(
    kek,
    fromB64(wrappedDek),
    fromB64(wrappedDekIv),
  );
  return importDek(raw);
}

export async function encryptBytes(
  dek: CryptoKey,
  plain: Uint8Array,
): Promise<{ ciphertext: Uint8Array; fileIv: string }> {
  const { ciphertext, iv } = await aesGcmEncrypt(dek, plain);
  return { ciphertext, fileIv: b64(iv) };
}

export async function decryptBytes(
  dek: CryptoKey,
  ciphertext: Uint8Array,
  fileIv: string,
): Promise<Uint8Array> {
  return aesGcmDecrypt(dek, ciphertext, fromB64(fileIv));
}

export async function encryptNote(
  dek: CryptoKey,
  note: string,
): Promise<{ noteCiphertext: string; noteIv: string } | null> {
  if (!note.trim()) return null;
  const { ciphertext, iv } = await aesGcmEncrypt(dek, te.encode(note));
  return { noteCiphertext: b64(ciphertext), noteIv: b64(iv) };
}

export async function decryptNote(
  dek: CryptoKey,
  noteCiphertext: string,
  noteIv: string,
): Promise<string> {
  const plain = await aesGcmDecrypt(
    dek,
    fromB64(noteCiphertext),
    fromB64(noteIv),
  );
  return td.decode(plain);
}

/** Pack DEK for URL fragment `#k=` (never sent to server). */
export async function dekToFragment(dek: CryptoKey): Promise<string> {
  return bytesToHex(await exportRawKey(dek));
}

export async function dekFromFragment(hex: string): Promise<CryptoKey> {
  return importDek(hexToBytes(hex));
}

export { b64, fromB64 };
