import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  formStackClass,
  elevatedCardClass,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { EmptyState } from "@/components/blocks/states";
import { Chip } from "@/components/primitives/chip";
import { Field, FieldInput, FieldSelect } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import type {
  HealthModule,
  UserProfile,
  WalletCategory,
  WalletDocMeta,
  WalletMedication,
  WalletShareListItem,
} from "../../../../packages/api-types/src/index";
import {
  WALLET_CATEGORIES,
  isAllowedWalletUpload,
} from "../../../../packages/api-types/src/index";
import {
  createWalletShare,
  createWalletUpload,
  createWalletMedication,
  deleteWalletDoc,
  deleteWalletMedication,
  getWalletObject,
  listWalletDocs,
  listWalletMedications,
  listWalletShares,
  patchModules,
  putWalletCiphertext,
  revokeWalletShare,
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
import { zipStore } from "../lib/zipStore";

const SALT_KEY = "gc360.wallet.salt";
const MAX_MB = 25;

const CATEGORY_LABEL: Record<WalletCategory, string> = {
  test_results: "Test Results",
  prescriptions: "Prescriptions",
  scan_images: "Scan Images",
  vaccination: "Vaccination Records",
  insurance: "Insurance Documents",
  other: "Other",
};

function categoryLine(d: WalletDocMeta): string {
  if (d.category === "other" && d.customLabel) return d.customLabel;
  return CATEGORY_LABEL[d.category];
}

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
  const online = useOnline();
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [kek, setKek] = useState<CryptoKey | null>(null);
  const [docs, setDocs] = useState<WalletDocMeta[]>([]);
  const [filter, setFilter] = useState<WalletCategory | "all">("all");
  const [category, setCategory] = useState<WalletCategory>("other");
  const [customLabel, setCustomLabel] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [viewerNote, setViewerNote] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<"24h" | "48h" | "7d">("24h");
  const [shares, setShares] = useState<Record<string, WalletShareListItem[]>>(
    {},
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [walletMeds, setWalletMeds] = useState<
    Array<WalletMedication & { name?: string; dosage?: string }>
  >([]);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medTime, setMedTime] = useState("08:00");
  const [medFreq, setMedFreq] = useState<"daily" | "weekdays">("daily");

  const visible = useMemo(
    () => (filter === "all" ? docs : docs.filter((d) => d.category === filter)),
    [docs, filter],
  );

  async function loadDocs() {
    if (!apiBaseUrl || !on) return;
    const res = await listWalletDocs();
    setDocs(res.docs);
  }

  async function loadMeds(key: CryptoKey) {
    if (!apiBaseUrl) return;
    const { medications } = await listWalletMedications();
    const decoded = await Promise.all(
      medications.map(async (m) => ({
        ...m,
        name: await decryptNote(key, m.nameCiphertext, m.nameIv).catch(
          () => "Encrypted on another device",
        ),
        dosage:
          m.doseCiphertext && m.doseIv
            ? await decryptNote(key, m.doseCiphertext, m.doseIv).catch(() => "")
            : "",
      })),
    );
    setWalletMeds(decoded);
  }

  useEffect(() => {
    if (on && unlocked) void loadDocs().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, unlocked]);

  useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    };
  }, [viewerUrl]);

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
      if (apiBaseUrl) {
        await loadDocs();
        await loadMeds(key);
      }
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
    if (!isAllowedWalletUpload(file.name, file.type)) {
      setError("Use a PDF, JPG, or PNG file.");
      return;
    }
    if (!apiBaseUrl) {
      setError("API required to upload wallet documents.");
      return;
    }
    setBusy(true);
    setError(null);
    setUploadPct(10);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      setUploadPct(35);
      const dek = await generateDek();
      const { ciphertext, fileIv } = await encryptBytes(dek, buf);
      const wrapped = await wrapDek(kek, dek);
      const noteEnc = await encryptNote(dek, note);
      setUploadPct(55);
      const created = await createWalletUpload({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
        customLabel:
          category === "other" ? customLabel.trim() || null : null,
        noteCiphertext: noteEnc?.noteCiphertext ?? null,
        noteIv: noteEnc?.noteIv ?? null,
        wrappedDek: wrapped.wrappedDek,
        wrappedDekIv: wrapped.wrappedDekIv,
        fileIv,
      });
      setUploadPct(75);
      await putWalletCiphertext(created.uploadPath, b64(ciphertext));
      setUploadPct(100);
      setFile(null);
      setNote("");
      setCustomLabel("");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setUploadPct(null);
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
      let noteText: string | null = null;
      if (doc.noteCiphertext && doc.noteIv) {
        noteText = await decryptNote(dek, doc.noteCiphertext, doc.noteIv);
      }
      const blob = new Blob([plain.buffer as ArrayBuffer], {
        type: doc.contentType,
      });
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(URL.createObjectURL(blob));
      setViewerName(doc.filename);
      setViewerNote(noteText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decrypt failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareDoc(doc: WalletDocMeta) {
    if (!kek) return;
    const ok = await requireSensitiveUnlock(async () =>
      window.prompt("Enter your device PIN (min 4 digits) to share:"),
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
      const { share } = await createWalletShare(doc.id, {
        expiresIn: shareExpiry,
      });
      const link = `${window.location.origin}/share/${share.token}#k=${frag}`;
      setShareLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      const listed = await listWalletShares(doc.id);
      setShares((prev) => ({ ...prev, [doc.id]: listed.shares }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadShares(docId: string) {
    try {
      const listed = await listWalletShares(docId);
      setShares((prev) => ({ ...prev, [docId]: listed.shares }));
    } catch {
      /* ignore */
    }
  }

  async function revoke(docId: string, shareId: string) {
    setBusy(true);
    try {
      await revokeWalletShare(shareId);
      await loadShares(docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke share");
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setBusy(true);
    try {
      await deleteWalletDoc(id);
      await loadDocs();
      setViewerUrl(null);
      setViewerNote(null);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportVault() {
    if (!kek) return;
    const ok = await requireSensitiveUnlock(async () =>
      window.prompt("Enter your device PIN to export the vault:"),
    );
    if (!ok) {
      setError("Unlock required before export.");
      return;
    }
    if (!docs.length) {
      setError("No documents to export.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const files: Array<{ name: string; data: Uint8Array }> = [];
      const te = new TextEncoder();
      for (const doc of docs) {
        const obj = await getWalletObject(doc.id);
        const dek = await unwrapDek(kek, doc.wrappedDek, doc.wrappedDekIv);
        const plain = await decryptBytes(
          dek,
          Uint8Array.from(atob(obj.ciphertextB64), (c) => c.charCodeAt(0)),
          doc.fileIv,
        );
        const folder = `docs/${doc.id}/`;
        files.push({ name: `${folder}${doc.filename}`, data: plain });
        if (doc.noteCiphertext && doc.noteIv) {
          const n = await decryptNote(dek, doc.noteCiphertext, doc.noteIv);
          files.push({ name: `${folder}note.txt`, data: te.encode(n) });
        }
      }
      files.push({
        name: "manifest.json",
        data: te.encode(
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              docs: docs.map((d) => ({
                id: d.id,
                filename: d.filename,
                category: d.category,
                customLabel: d.customLabel,
                sizeBytes: d.sizeBytes,
              })),
            },
            null,
            2,
          ),
        ),
      });
      const zip = zipStore(files);
      const { ciphertext, fileIv } = await encryptBytes(kek, zip);
      const salt = localStorage.getItem(SALT_KEY) ?? "";
      const envelope = JSON.stringify({
        v: 1,
        kdf: "argon2id",
        saltB64: salt,
        fileIv,
        ciphertextB64: b64(ciphertext),
        hint: "Decrypt with your Health Wallet passphrase. Inner payload is a zip of your files.",
      });
      const blob = new Blob([envelope], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `girlcode360-wallet-${new Date().toISOString().slice(0, 10)}.gc36.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  if (!on) {
    return (
      <EmptyState
        title="Health Wallet is off"
        body="Documents are encrypted on this device. The server stores ciphertext only, never your passphrase or plaintext files."
        action={
          <Button type="button" onClick={() => void enable()} disabled={busy}>
            Enable Health Wallet
          </Button>
        }
      />
    );
  }

  if (!unlocked) {
    return (
      <form className={elevatedCardClass} onSubmit={unlock}>
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Unlock vault
        </h2>
        <p className={leadClass}>
          Your passphrase derives a key on this device. We cannot recover it if
          you forget it.
        </p>
        <Field id="vault-pass" label="Vault passphrase">
          <FieldInput
            id="vault-pass"
            type="password"
            required
            minLength={8}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" disabled={busy}>
          Unlock
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="grid gap-6">
      <form className={elevatedCardClass} onSubmit={(e) => void upload(e)}>
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Add a file
        </h2>
        <p className={leadClass}>
          Upload PDF, JPG, or PNG (max {MAX_MB}MB). Files are encrypted before
          upload. Deleted files are purged from backups within 30 days.
        </p>
        <Field id="wallet-file" label="File">
          <FieldInput
            id="wallet-file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/jpeg,image/png"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field id="wallet-cat" label="Category">
          <FieldSelect
            id="wallet-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as WalletCategory)}
          >
            {WALLET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </FieldSelect>
        </Field>
        {category === "other" ? (
          <Field id="wallet-custom" label="Custom category (optional)">
            <FieldInput
              id="wallet-custom"
              maxLength={40}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Fertility clinic"
            />
          </Field>
        ) : null}
        <Field id="wallet-note" label="Note (encrypted)">
          <FieldInput
            id="wallet-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {uploadPct != null ? (
          <div className="grid gap-2">
            <p className={leadClass}>
              {uploadPct < 55 ? "Encrypting on this device…" : "Uploading ciphertext…"}
            </p>
            <span className="block h-2 overflow-hidden rounded-sm bg-muted" aria-hidden>
              <span
                className="block h-full bg-primary"
                style={{ width: `${uploadPct}%` }}
              />
            </span>
          </div>
        ) : null}
        <Button type="submit" disabled={busy || !file || !online}>
          Encrypt and upload
        </Button>
        {!online ? (
          <p className={leadClass}>Upload needs a connection.</p>
        ) : null}
      </form>
      </div>

      <div className="grid gap-6">
      <section className={elevatedCardClass}>
        <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
          Files
        </h2>
      <div className="flex flex-wrap gap-2">
        <Chip pressed={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {WALLET_CATEGORIES.map((c) => (
          <Chip
            key={c}
            pressed={filter === c}
            onClick={() => setFilter(c)}
          >
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      <ActionExport
        busy={busy}
        disabled={!docs.length || !online}
        onExport={() => void exportVault()}
      />

      {docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          body="Encrypt a file to list it here."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing in this category"
          body="Try another filter, or upload a file into this category."
        />
      ) : (
        <ul className={cn(listClass)}>
          {visible.map((d) => (
            <li key={d.id} className={listItemClass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <strong className="block text-foreground">{d.filename}</strong>
                  <p className={leadClass}>
                    {categoryLine(d)} · {Math.round(d.sizeBytes / 1024)} KB
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void viewDoc(d)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void shareDoc(d)}
                  >
                    Share {shareExpiry}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive"
                    onClick={() => void removeDoc(d.id)}
                  >
                    {confirmDeleteId === d.id
                      ? "Confirm delete"
                      : "Delete"}
                  </Button>
                  {confirmDeleteId === d.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
              {(shares[d.id] ?? []).length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {shares[d.id]!.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-caption)] text-muted-foreground"
                    >
                      <span>
                        Expires {new Date(s.expiresAt).toLocaleString()}
                        {s.revoked ? " · revoked" : ""}
                      </span>
                      {!s.revoked ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void revoke(d.id, s.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Field id="share-expiry" label="Share link length">
        <FieldSelect
          id="share-expiry"
          value={shareExpiry}
          onChange={(e) =>
            setShareExpiry(e.target.value as "24h" | "48h" | "7d")
          }
        >
          <option value="24h">24 hours</option>
          <option value="48h">48 hours</option>
          <option value="7d">7 days</option>
        </FieldSelect>
      </Field>

      {shareLink ? (
        <p className={leadClass}>
          Share link (key in fragment only — copied if the browser allowed it):{" "}
          <code className="break-all text-foreground">{shareLink}</code>
        </p>
      ) : null}
      </section>
      </div>
      </div>

      <section className={elevatedCardClass}>
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Medication reminders
        </h2>
        <p className={leadClass}>
          Separate from PMOS Manager. Names and doses stay encrypted with your
          vault key. The server only sees the clock time so it can send a
          generic lock-screen note.
        </p>
        <form
          className={formStackClass}
          onSubmit={(e) => {
            e.preventDefault();
            if (!kek || !medName.trim()) return;
            setBusy(true);
            void (async () => {
              try {
                const nameEnc = await encryptNote(kek, medName.trim());
                if (!nameEnc) return;
                const doseEnc = medDose.trim()
                  ? await encryptNote(kek, medDose.trim())
                  : null;
                await createWalletMedication({
                  nameCiphertext: nameEnc.noteCiphertext,
                  nameIv: nameEnc.noteIv,
                  doseCiphertext: doseEnc?.noteCiphertext ?? null,
                  doseIv: doseEnc?.noteIv ?? null,
                  timeLocal: medTime,
                  frequency: medFreq,
                });
                setMedName("");
                setMedDose("");
                const { medications } = await listWalletMedications();
                const decoded = await Promise.all(
                  medications.map(async (m) => ({
                    ...m,
                    name: await decryptNote(kek, m.nameCiphertext, m.nameIv),
                    dosage:
                      m.doseCiphertext && m.doseIv
                        ? await decryptNote(kek, m.doseCiphertext, m.doseIv)
                        : "",
                  })),
                );
                setWalletMeds(decoded);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not save reminder",
                );
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Field id="wmed-name" label="Medicine name">
            <FieldInput
              id="wmed-name"
              required
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
            />
          </Field>
          <Field id="wmed-dose" label="Dose (optional)">
            <FieldInput
              id="wmed-dose"
              value={medDose}
              onChange={(e) => setMedDose(e.target.value)}
            />
          </Field>
          <Field id="wmed-time" label="Time">
            <FieldInput
              id="wmed-time"
              type="time"
              value={medTime}
              onChange={(e) => setMedTime(e.target.value)}
            />
          </Field>
          <Field id="wmed-freq" label="Frequency">
            <FieldSelect
              id="wmed-freq"
              value={medFreq}
              onChange={(e) =>
                setMedFreq(e.target.value as "daily" | "weekdays")
              }
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
            </FieldSelect>
          </Field>
          <Button type="submit" disabled={busy}>
            Save encrypted reminder
          </Button>
        </form>
        <ul className={listClass}>
          {walletMeds.map((m) => (
            <li key={m.id} className={listItemClass}>
              <strong className="text-foreground">
                {m.name ?? "Reminder"} {m.dosage ? `· ${m.dosage}` : ""}
              </strong>
              <p className={leadClass}>
                {m.timeLocal} · {m.frequency}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void deleteWalletMedication(m.id).then(() =>
                    setWalletMeds((prev) => prev.filter((x) => x.id !== m.id)),
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {viewerUrl ? (
        <div className={elevatedCardClass}>
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            Viewer: {viewerName}
          </h2>
          <p className={leadClass}>
            Decrypted in memory only. This app does not write plaintext to disk.
          </p>
          {viewerNote ? (
            <p className="m-0 text-[length:var(--text-body)] text-foreground">
              Note: {viewerNote}
            </p>
          ) : null}
          {viewerName.toLowerCase().endsWith(".pdf") ? (
            <iframe
              title={viewerName}
              src={viewerUrl}
              className="min-h-[420px] w-full border-0"
            />
          ) : (
            <img
              src={viewerUrl}
              alt={viewerName}
              className="max-w-full rounded-[var(--radius)]"
            />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (viewerUrl) URL.revokeObjectURL(viewerUrl);
              setViewerUrl(null);
              setViewerNote(null);
            }}
          >
            Close viewer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ActionExport({
  busy,
  disabled,
  onExport,
}: {
  busy: boolean;
  disabled: boolean;
  onExport: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy || disabled}
      onClick={onExport}
    >
      Export encrypted backup
    </Button>
  );
}
