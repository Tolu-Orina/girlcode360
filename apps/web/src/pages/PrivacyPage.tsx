import { Link } from "react-router-dom";
import { CURRENT_POLICY_VERSION } from "../lib/api";
import "./onboarding.css";

export function PrivacyPage() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      <p>
        Placeholder policy for GirlCode360 internal beta (version{" "}
        <code>{CURRENT_POLICY_VERSION}</code>). This is not legal advice and
        will be replaced before public launch.
      </p>
      <ul>
        <li>
          We process health and wellness data only with your explicit consent.
        </li>
        <li>
          Data is encrypted in transit (TLS) and at rest (AWS KMS) on our
          backend.
        </li>
        <li>
          You can withdraw optional consents (analytics, marketing, AI) at any
          time from Account.
        </li>
        <li>
          Notification bodies never include health content.
        </li>
        <li>
          Markets: UK (UK GDPR), Nigeria, and Ghana — jurisdiction chosen during
          onboarding.
        </li>
        <li>
          <strong>Health Wallet threat model:</strong> documents are encrypted
          on your device (Argon2id → KEK, per-file DEK, AES-GCM) before upload.
          Servers store ciphertext and wrapped keys only — never your
          passphrase or plaintext. Time-limited share links carry the file
          decryption key in the URL fragment (`#k=…`) so it is not sent to our
          servers or written to access logs. Soft-deleted files are purged
          within 30 days.
        </li>
      </ul>
      <p>
        <Link to="/onboarding">Back to onboarding</Link>
        {" · "}
        <Link to="/terms">Terms of Service</Link>
      </p>
    </main>
  );
}
