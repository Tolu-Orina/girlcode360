import { useEffect, useState, type FormEvent } from "react";
import type {
  HealthModule,
  UserProfile,
  WalletCategory,
  WalletDocMeta,
} from "../../../../packages/api-types/src/index";
import { WALLET_CATEGORIES } from "../../../../packages/api-types/src/index";
import {
  createWalletShare,
  createWalletUpload,
  deleteWalletDoc,
  getWalletObject,
  listWalletDocs,
  patchModules,
  putWalletCiphertext,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import {
  b64,
  createVaultSalt,
  decryptBytes,
  decryptNote,
  dekToFragment,
  deriveKek,
  encryptBytes,
  encryptNote,
  generateDek,
  unwrapDek,
  wrapDek,
} from "../lib/walletCrypto";
import { requireSensitiveUnlock } from "../lib/walletGate";

const SALT_KEY = "gc360.wallet.salt";
const MAX_MB = 25;

const CATEGORY_LABEL: Record<WalletCategory, string> = {
  test_results: "Test Results",
  prescriptions: "Prescriptions",
  scan_images: "Scan Images",
  vaccination: "Vaccination",
  insurance: "Insurance",
  other: "Other",
};

export function WalletPanel({
  profile,
  onProfile,
  busy,
  setBusy,
  setError,
}: {
  profile: UserProfile | null;
  onProfile: (p: UserProfile) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}) {
  const on = profile?.modules.includes("wallet") ?? false;
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [kek, setKek] = useState<CryptoKey | null>(null);
  const [docs, setDocs] = useState<WalletDocMeta[]>([]);
  const [category, setCategory] = useState<WalletCategory>("other");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);

  async function loadDocs() {
    if (!apiBaseUrl || !on) return;
    const res = await listWalletDocs();
    setDocs(res.docs);
  }

  useEffect(() => {
    if (on && unlocked) void loadDocs().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, unlocked]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const base = profile?.modules ?? (["period_tracker"] as HealthModule[]);
      const modules: HealthModule[] = base.includes("wallet")
        ? base
        : [...base, "wallet"];
      onProfile(await patchModules({ modules }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable wallet");
    } finally {
      setBusy(false);
    }
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let salt = localStorage.getItem(SALT_KEY);
      if (!salt) {
        salt = createVaultSalt();
        localStorage.setItem(SALT_KEY, salt);
      }
      const key = await deriveKek(passphrase, salt);
      setKek(key);
      setUnlocked(true);
      setPassphrase("");
      if (apiBaseUrl) await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!kek || !file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Max file size is ${MAX_MB}MB`);
      return;
    }
    if (!apiBaseUrl) {
      setError("API required to upload wallet documents.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const dek = await generateDek();
      const { ciphertext, fileIv } = await encryptBytes(dek, buf);
      const wrapped = await wrapDek(kek, dek);
      const noteEnc = await encryptNote(dek, note);
      const created = await createWalletUpload({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
        noteCiphertext: noteEnc?.noteCiphertext ?? null,
        noteIv: noteEnc?.noteIv ?? null,
        wrappedDek: wrapped.wrappedDek,
        wrappedDekIv: wrapped.wrappedDekIv,
        fileIv,
      });
      await putWalletCiphertext(created.uploadPath, b64(ciphertext));
      setFile(null);
      setNote("");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function viewDoc(doc: WalletDocMeta) {
    if (!kek) return;
    setBusy(true);
    setError(null);
    try {
      const obj = await getWalletObject(doc.id);
      const dek = await unwrapDek(kek, doc.wrappedDek, doc.wrappedDekIv);
      const plain = await decryptBytes(
        dek,
        Uint8Array.from(atob(obj.ciphertextB64), (c) => c.charCodeAt(0)),
        doc.fileIv,
      );
      if (doc.noteCiphertext && doc.noteIv) {
        // Decrypt in memory for viewer only — never log plaintext
        await decryptNote(dek, doc.noteCiphertext, doc.noteIv);
      }
      const blob = new Blob([plain.buffer as ArrayBuffer], {
        type: doc.contentType,
      });
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(URL.createObjectURL(blob));
      setViewerName(doc.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decrypt failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareDoc(doc: WalletDocMeta, expiresIn: "24h" | "48h" | "7d") {
    if (!kek) return;
    const ok = await requireSensitiveUnlock(async () =>
      window.prompt("Enter a wallet PIN (min 4 digits) to share:"),
    );
    if (!ok) {
      setError("Unlock required before sharing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dek = await unwrapDek(kek, doc.wrappedDek, doc.wrappedDekIv);
      const frag = await dekToFragment(dek);
      const { share } = await createWalletShare(doc.id, { expiresIn });
      const link = `${window.location.origin}/share/${share.token}#k=${frag}`;
      setShareLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    setBusy(true);
    try {
      await deleteWalletDoc(id);
      await loadDocs();
      setViewerUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!on) {
    return (
      <div className="health-section">
        <h2>Health Wallet</h2>
        <p className="health-lead">
          Client-side encrypted documents. The server only stores ciphertext —
          never your passphrase or plaintext files.
        </p>
        <button type="button" className="primary" onClick={enable} disabled={busy}>
          Enable Health Wallet
        </button>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="health-section">
        <h2>Unlock vault</h2>
        <p className="health-lead">
          Your passphrase derives a key with Argon2id on this device. We cannot
          recover it if you forget it.
        </p>
        <form className="health-form" onSubmit={unlock}>
          <label>
            Vault passphrase
            <input
              type="password"
              required
              minLength={8}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="health-section">
      <h2>Health Wallet</h2>
      <p className="health-lead">
        Upload PDF/JPG/PNG (max {MAX_MB}MB). Files are encrypted before upload.
      </p>

      <form className="health-form" onSubmit={upload}>
        <label>
          File
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WalletCategory)}
          >
            {WALLET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note (encrypted)
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={busy || !file}>
          Encrypt & upload
        </button>
      </form>

      <ul className="med-list">
        {docs.map((d) => (
          <li key={d.id}>
            <div className="row">
              <div>
                <strong>{d.filename}</strong>
                <p>
                  {CATEGORY_LABEL[d.category]} ·{" "}
                  {Math.round(d.sizeBytes / 1024)} KB
                </p>
              </div>
              <div className="cycle-actions">
                <button type="button" onClick={() => viewDoc(d)}>
                  View
                </button>
                <button type="button" onClick={() => shareDoc(d, "24h")}>
                  Share 24h
                </button>
                <button type="button" onClick={() => removeDoc(d.id)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {shareLink ? (
        <p className="health-lead">
          Share link (key in fragment only): <code>{shareLink}</code>
        </p>
      ) : null}

      {viewerUrl ? (
        <div className="health-section">
          <h2>Viewer — {viewerName}</h2>
          <p className="health-lead">
            Decrypted in memory only — not written unencrypted to disk cache by
            this app.
          </p>
          {viewerName.toLowerCase().endsWith(".pdf") ? (
            <iframe
              title={viewerName}
              src={viewerUrl}
              style={{ width: "100%", minHeight: "420px", border: 0 }}
            />
          ) : (
            <img
              src={viewerUrl}
              alt={viewerName}
              style={{ maxWidth: "100%", borderRadius: "0.5rem" }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (viewerUrl) URL.revokeObjectURL(viewerUrl);
              setViewerUrl(null);
            }}
          >
            Close viewer
          </button>
        </div>
      ) : null}
    </div>
  );
}
