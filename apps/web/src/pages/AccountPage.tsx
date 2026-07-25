import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type {
  BillingStatus,
  ConsentPurpose,
  ConsentRecord,
  DeletionRequest,
  MyDataSnapshot,
  NotificationPrefs,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import { CURRENT_POLICY_VERSION } from "../../../../packages/api-types/src/index";
import {
  ApiError,
  cancelAccountDeletion,
  devActivatePremium,
  getBillingStatus,
  getConsents,
  getMe,
  getMyData,
  getNotificationPrefs,
  patchNotificationPrefs,
  postConsents,
  requestAccountDeletion,
  requestDataExport,
  startCheckout,
} from "../lib/api";
import { setAnalyticsConsent, track } from "../lib/analytics";
import { signOut } from "../lib/cognito";
import { apiBaseUrl } from "../lib/config";
import "./health.css";

const DEFAULT_PREFS: NotificationPrefs = {
  masterEnabled: true,
  period: true,
  ovulation: true,
  appointments: true,
  medication: true,
  weeklyInsights: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  updatedAt: new Date().toISOString(),
};

const CONSENT_LABELS: Record<ConsentPurpose, string> = {
  health_data: "Health data (required)",
  analytics: "Product analytics",
  marketing: "Marketing messages",
  location: "Approximate location",
  ai_alena: "Alena AI",
  ai_healthlens: "HealthLens",
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [myData, setMyData] = useState<MyDataSnapshot | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function refreshPrivacy() {
    if (!apiBaseUrl) return;
    const [c, data, bill] = await Promise.all([
      getConsents(),
      getMyData(),
      getBillingStatus(),
    ]);
    setConsents(c.current);
    setMyData(data);
    setBilling(bill);
    setDeletion(data.deletion);
    const analytics = c.current.find((x) => x.purpose === "analytics");
    setAnalyticsConsent(Boolean(analytics?.granted));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setProfile(me);
      } catch {
        /* offline */
      }
      if (!apiBaseUrl) return;
      try {
        const res = await getNotificationPrefs();
        if (!cancelled) setPrefs(res.prefs);
        await refreshPrivacy();
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError)) {
          setError("Could not load account");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (params.get("billing") === "success") {
      setOk("Billing return received — activate Premium if checkout was a stub.");
    }
  }, [params]);

  async function savePrefs(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (!apiBaseUrl) {
        setOk("Saved locally (API offline).");
        return;
      }
      const res = await patchNotificationPrefs(prefs);
      setPrefs(res.prefs);
      setOk("Preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleConsent(purpose: ConsentPurpose, granted: boolean) {
    if (!profile || purpose === "health_data") return;
    setBusy(true);
    setError(null);
    try {
      await postConsents({
        jurisdiction: profile.market,
        policyVersion: CURRENT_POLICY_VERSION,
        items: [
          { purpose: "health_data", granted: true },
          { purpose, granted },
        ],
      });
      await refreshPrivacy();
      track({ name: "consents_updated", props: { purpose } });
      setOk("Consent updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consent update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestDataExport();
      downloadJson(
        `girlcode360-export-${new Date().toISOString().slice(0, 10)}.json`,
        res.job.payload ?? res.job,
      );
      track({ name: "export_requested" });
      setOk("Export downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        "Request account deletion? You have 24 hours to cancel before purge.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestAccountDeletion();
      setDeletion(res.deletion);
      track({ name: "deletion_requested" });
      setOk("Deletion scheduled — cooling-off for 24 hours.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCancelDelete() {
    setBusy(true);
    try {
      const res = await cancelAccountDeletion();
      setDeletion(res.deletion);
      setOk("Deletion cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckout(provider: "stripe" | "paystack") {
    setBusy(true);
    setError(null);
    try {
      const res = await startCheckout(provider);
      track({ name: "checkout_started", props: { provider } });
      setOk(res.message);
      // Stub: stay in-app; live keys would window.location = res.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDevPremium() {
    setBusy(true);
    try {
      const res = await devActivatePremium();
      setBilling(res.status);
      setOk("Premium activated (dev).");
      await refreshPrivacy();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    try {
      signOut();
    } catch {
      /* cognito may be unset */
    }
    navigate("/signin");
  }

  const granted = (p: ConsentPurpose) =>
    consents.find((c) => c.purpose === p)?.granted ?? false;

  return (
    <section className="health-page">
      <h1>Account</h1>
      <p className="health-lead">{profile?.email ?? "Signed in"}</p>

      <div className="health-section">
        <h2>Premium</h2>
        <p className="health-lead">
          Plan: {billing?.plan ?? myData?.premium ? "premium" : "free"}
          {billing?.provider ? ` · ${billing.provider}` : ""}
        </p>
        {!(billing?.premium || myData?.premium) ? (
          <div className="cycle-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !apiBaseUrl}
              onClick={() => void onCheckout("stripe")}
            >
              Upgrade (Stripe stub)
            </button>
            <button
              type="button"
              disabled={busy || !apiBaseUrl}
              onClick={() => void onCheckout("paystack")}
            >
              Upgrade (Paystack stub)
            </button>
            <button
              type="button"
              disabled={busy || !apiBaseUrl}
              onClick={() => void onDevPremium()}
            >
              Dev activate
            </button>
          </div>
        ) : (
          <p className="health-lead">Unlimited Alena + HealthLens on-demand.</p>
        )}
      </div>

      <div className="health-section">
        <h2>Privacy Centre</h2>
        <p className="health-lead">
          Review consents, export your data, or request deletion (Art.15–20).
        </p>
        {myData ? (
          <ul className="med-list">
            <li>Cycles: {myData.counts.cycles}</li>
            <li>Cycle days: {myData.counts.cycleDays}</li>
            <li>Wallet docs: {myData.counts.walletDocs}</li>
            <li>HealthLens reports: {myData.counts.healthLensReports}</li>
          </ul>
        ) : (
          <p className="health-lead">
            {apiBaseUrl ? "Loading My Data…" : "Connect API for My Data."}
          </p>
        )}

        <h3>Consents</h3>
        {(
          Object.keys(CONSENT_LABELS) as ConsentPurpose[]
        ).map((purpose) => (
          <label
            key={purpose}
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={granted(purpose)}
              disabled={busy || purpose === "health_data" || !apiBaseUrl}
              onChange={(e) => void toggleConsent(purpose, e.target.checked)}
            />
            {CONSENT_LABELS[purpose]}
          </label>
        ))}

        <div className="cycle-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy || !apiBaseUrl}
            onClick={() => void onExport()}
          >
            Export JSON
          </button>
          {deletion?.status === "cooling_off" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCancelDelete()}
            >
              Cancel deletion
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !apiBaseUrl}
              onClick={() => void onDelete()}
            >
              Request deletion
            </button>
          )}
        </div>
        {deletion?.status === "cooling_off" ? (
          <p className="health-lead">
            Cooling off until {new Date(deletion.purgeAfter).toLocaleString()}.
          </p>
        ) : null}
      </div>

      <div className="health-section">
        <h2>Library</h2>
        <p className="health-lead">Educational articles for your market.</p>
        <Link className="btn primary" to="/app/library">
          Browse library
        </Link>
      </div>

      <form className="health-form" onSubmit={(e) => void savePrefs(e)}>
        <h2>Notifications</h2>
        <p className="health-lead">
          Bodies stay generic. Quiet hours default 22:00–07:00 local.
        </p>
        {(
          [
            ["masterEnabled", "Master notifications"],
            ["period", "Period reminders"],
            ["ovulation", "Ovulation / fertile window"],
            ["appointments", "Appointments"],
            ["medication", "Medication"],
            ["weeklyInsights", "Weekly insights"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
        <label>
          Quiet hours start
          <input
            type="time"
            value={prefs.quietHoursStart}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))
            }
          />
        </label>
        <label>
          Quiet hours end
          <input
            type="time"
            value={prefs.quietHoursEnd}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))
            }
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          Save preferences
        </button>
      </form>

      {ok ? <p className="auth-ok">{ok}</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <button type="button" onClick={logout}>
        Sign out
      </button>
    </section>
  );
}
