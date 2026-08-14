import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AmbientLayer } from "@/components/blocks/ambient-layer";
import { AppPage, leadClass } from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { EmptyState, ErrorBanner, SkeletonBlock } from "@/components/blocks/states";
import { getPublicWalletObject, getPublicWalletShare } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import { decryptBytes, dekFromFragment, fromB64 } from "../lib/walletCrypto";

function mapShareError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (/expir|410|gone/i.test(msg)) {
    return "This share has expired. Ask the sender for a new link.";
  }
  if (/not found|404/i.test(msg)) {
    return "This share link is not valid.";
  }
  return err instanceof Error ? err.message : "Could not open this share.";
}

export function SharePage() {
  const { token = "" } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) {
        setError("API is not configured.");
        setLoading(false);
        return;
      }
      const hash = window.location.hash;
      const m = hash.match(/[#&]k=([0-9a-fA-F]+)/);
      if (!m?.[1]) {
        setMissingKey(true);
        setLoading(false);
        return;
      }
      try {
        const meta = await getPublicWalletShare(token);
        if (cancelled) return;
        setFilename(meta.filename);
        setExpiresAt(meta.expiresAt);
        const obj = await getPublicWalletObject(token);
        try {
          const dek = await dekFromFragment(m[1]);
          const plain = await decryptBytes(
            dek,
            fromB64(obj.ciphertextB64),
            obj.fileIv,
          );
          const blob = new Blob([plain.buffer as ArrayBuffer], {
            type: obj.contentType,
          });
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setUrl(objectUrl);
        } catch {
          if (!cancelled) {
            setError(
              "This link’s key does not match the file. Ask the sender to share again.",
            );
          }
        }
      } catch (err) {
        if (!cancelled) setError(mapShareError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <AmbientLayer />
      <header className="relative z-10 flex h-[var(--header-height)] items-center border-b border-border px-6">
        <Link
          to="/"
          className="font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-bold text-primary no-underline"
        >
          GirlCode360
        </Link>
      </header>
      <AppPage as="main" className="relative z-10 px-4 py-8 lg:px-8">
        <PageHeader
          eyebrow="Shared document"
          title={filename || "Wallet file"}
          lead="Decrypted in your browser. GirlCode360 servers only held ciphertext."
        />
        {expiresAt ? (
          <p className={leadClass}>
            Expires {new Date(expiresAt).toLocaleString()}.
          </p>
        ) : null}

        {missingKey ? (
          <EmptyState
            title="This link is missing its key"
            body="The sender’s link should end with #k=…. Ask them to copy the full address and share again."
          />
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        {loading ? (
          <SkeletonBlock className="min-h-[40vh]" />
        ) : url ? (
          filename.toLowerCase().endsWith(".pdf") ? (
            <iframe
              title={filename}
              src={url}
              className="min-h-[70vh] w-full rounded-[var(--radius)] border border-border bg-card"
            />
          ) : (
            <img
              src={url}
              alt={filename}
              className="max-w-full rounded-[var(--radius)] border border-border"
            />
          )
        ) : null}
      </AppPage>
    </div>
  );
}
