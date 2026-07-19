import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicWalletObject, getPublicWalletShare } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import { decryptBytes, dekFromFragment, fromB64 } from "../lib/walletCrypto";
import "./health.css";

/**
 * Public share viewer — DEK arrives only in `#k=` fragment (never sent to server).
 */
export function SharePage() {
  const { token = "" } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) {
        setError("API is not configured.");
        return;
      }
      const hash = window.location.hash;
      const m = hash.match(/[#&]k=([0-9a-fA-F]+)/);
      if (!m?.[1]) {
        setError(
          "Missing decryption key in the link fragment (#k=…). Ask the sender to reshare.",
        );
        return;
      }
      try {
        const meta = await getPublicWalletShare(token);
        if (cancelled) return;
        setFilename(meta.filename);
        setExpiresAt(meta.expiresAt);
        const obj = await getPublicWalletObject(token);
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
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open share");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  return (
    <main className="health-page" style={{ padding: "1.5rem" }}>
      <h1>Shared document</h1>
      <p className="health-lead">
        Decrypted in your browser. GirlCode360 servers only held ciphertext.
        {expiresAt ? ` Expires ${new Date(expiresAt).toLocaleString()}.` : ""}
      </p>
      {error ? <p className="auth-error">{error}</p> : null}
      {url ? (
        filename.toLowerCase().endsWith(".pdf") ? (
          <iframe
            title={filename}
            src={url}
            style={{ width: "100%", minHeight: "70vh", border: 0 }}
          />
        ) : (
          <img src={url} alt={filename} style={{ maxWidth: "100%" }} />
        )
      ) : !error ? (
        <p className="health-lead">Decrypting…</p>
      ) : null}
    </main>
  );
}
