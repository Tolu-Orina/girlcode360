import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ActionRow,
  AppPage,
  formStackClass,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import {
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
  SuccessBanner,
} from "@/components/blocks/states";
import { Field, FieldInput } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useOnline } from "@/hooks/use-online";
import {
  JURISDICTION_CONSENT_LEAD,
  MARKET_LABEL,
  MODULE_COPY,
  PURPOSE_COPY,
} from "@/lib/consent-copy";
import { mapAuthError } from "@/lib/auth-errors";
import { PASSWORD_HINT, passwordPolicyError } from "@/lib/password-policy";
import {
  appLockEnabled,
  hasPin,
  hasWebAuthn,
  registerWebAuthn,
  setAppLockEnabled,
  setPin,
  webauthnAvailable,
} from "@/lib/walletGate";
import { resetTourAndTips } from "@/lib/tips";
import type {
  BillingStatus,
  ConsentPurpose,
  ConsentRecord,
  DeletionRequest,
  HealthModule,
  Market,
  MyDataSnapshot,
  NotificationPrefs,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import { ALL_MODULES, CURRENT_POLICY_VERSION } from "../../../../packages/api-types/src/index";
import {
  ApiError,
  cancelAccountDeletion,
  devActivatePremium,
  getBillingStatus,
  getConsents,
  getMe,
  getMyData,
  getNotificationPrefs,
  getSheMatchPrefs,
  patchMe,
  patchModules,
  patchNotificationPrefs,
  patchSheMatchPrefs,
  postConsents,
  requestAccountDeletion,
  requestDataExport,
  startCheckout,
  openBillingPortal,
} from "../lib/api";
import { setAnalyticsConsent, track } from "../lib/analytics";
import { changePassword, signOut } from "@/lib/cognito";
import { apiBaseUrl, cognitoConfig } from "@/lib/config";

const DEFAULT_PREFS: NotificationPrefs = {
  masterEnabled: true,
  period: true,
  ovulation: true,
  appointments: true,
  medication: true,
  weeklyInsights: true,
  periodLeadDays: 1,
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
  mirror_biometric: "Mirror photos (skin and try-on)",
  mirror_live_camera: "Live camera (Makeup Studio)",
  wardrobe: "My Wardrobe (clothing photos)",
  shematch: "SheMatch local suggestions",
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
  const [sheModules, setSheModules] = useState<Record<HealthModule, boolean>>({
    period_tracker: false,
    pcos_manager: false,
    pregnancy: false,
    ttc: false,
    wallet: false,
  });
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [myData, setMyData] = useState<MyDataSnapshot | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [lockOn, setLockOn] = useState(() => appLockEnabled());
  const [newPin, setNewPin] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const online = useOnline();

  async function refreshPrivacy() {
    if (!apiBaseUrl) return;
    const [c, data, bill, she] = await Promise.all([
      getConsents(),
      getMyData(),
      getBillingStatus(),
      getSheMatchPrefs().catch(() => null),
    ]);
    setConsents(c.current);
    setConsentHistory(c.history);
    setMyData(data);
    setBilling(bill);
    setDeletion(data.deletion);
    if (she) setSheModules(she.modules);
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
      if (!apiBaseUrl) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await getNotificationPrefs();
        if (!cancelled) {
          setPrefs({
            ...res.prefs,
            periodLeadDays: res.prefs.periodLeadDays ?? 1,
          });
        }
        await refreshPrivacy();
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError)) {
          setError("Could not load account");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (params.get("billing") === "cancel") {
      setOk("Checkout cancelled. You are still on Free.");
      return;
    }
    if (params.get("billing") !== "success") return;
    let cancelled = false;
    (async () => {
      setOk("Confirming payment…");
      for (const wait of [0, 2000, 5000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        try {
          await refreshPrivacy();
        } catch {
          /* webhook may still be in flight */
        }
      }
      if (!cancelled) {
        setOk("If payment went through, Premium is on. Refresh if this still says Free.");
      }
    })();
    return () => {
      cancelled = true;
    };
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
      setPrefs({
        ...res.prefs,
        periodLeadDays: res.prefs.periodLeadDays ?? 1,
      });
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
    setBusy(true);
    setError(null);
    try {
      const res = await requestAccountDeletion();
      setDeletion(res.deletion);
      setConfirmDelete(false);
      track({ name: "deletion_requested" });
      setOk("Deletion scheduled. Cooling-off for 24 hours.");
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
      setConfirmDelete(false);
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
      if (res.live && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setOk(res.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code.replace(/_/g, " ")
          : err instanceof Error
            ? err.message
            : "Checkout failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await openBillingPortal();
      if (res.live && res.portalUrl) {
        window.location.assign(res.portalUrl);
        return;
      }
      setOk(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal");
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

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    const policy = passwordPolicyError(newPassword);
    if (policy) {
      setError(policy);
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setOk("Password updated.");
    } catch (err) {
      setError(mapAuthError(err, "password"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMarket(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const me = await patchMe({ market: profile.market, locale: profile.locale });
      setProfile(me);
      setOk("Market saved. Privacy rules follow this choice.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save market");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveModules(e: FormEvent) {
    e.preventDefault();
    if (!profile || profile.modules.length === 0) {
      setError("Pick at least one module.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await patchModules({ modules: profile.modules });
      setProfile(me);
      setOk("Modules updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save modules");
    } finally {
      setBusy(false);
    }
  }

  function toggleModule(m: HealthModule) {
    setProfile((prev) => {
      if (!prev) return prev;
      const has = prev.modules.includes(m);
      const modules = has
        ? prev.modules.filter((x) => x !== m)
        : [...prev.modules, m];
      return { ...prev, modules };
    });
  }

  async function onEnableLock() {
    if (newPin.length < 4 && !hasPin()) {
      setError("Choose a PIN of at least 4 digits first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (newPin.length >= 4) await setPin(newPin);
      setAppLockEnabled(true);
      setLockOn(true);
      setNewPin("");
      setOk("App lock on. You will be asked when you open the app.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable lock");
    } finally {
      setBusy(false);
    }
  }

  function onDisableLock() {
    setAppLockEnabled(false);
    setLockOn(false);
    setOk("App lock off.");
  }

  async function onRegisterBiometrics() {
    setBusy(true);
    setError(null);
    try {
      const okCred = await registerWebAuthn();
      if (!okCred) {
        setError("Face ID or Touch ID was not set up. You can still use a PIN.");
        return;
      }
      setOk("Face ID / Touch ID registered on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register biometrics");
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
    <AppPage>
      <PageHeader
        eyebrow="Account"
        title={profile?.email ?? "Signed in"}
        lead="Consents, export, deletion, Premium, and notification preferences."
      />

      {!online ? (
        <OfflineBanner message="You are offline. Export and checkout need a connection." />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}

      {loading ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading account">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : null}

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Premium
        </h2>
        <p className={leadClass}>
          Plan: {billing?.plan ?? myData?.premium ? "premium" : "free"}
          {billing?.provider ? ` · ${billing.provider}` : ""}
          {billing?.renewsAt
            ? ` · renews ${new Date(billing.renewsAt).toLocaleDateString()}`
            : ""}
        </p>
        {!(billing?.premium || myData?.premium) ? (
          <>
            <p className={leadClass}>
              UK: £4.99/month via Stripe. Nigeria: ₦2,500/month via Paystack.
              Ghana: GH₵35/month via Paystack when that plan is set.
            </p>
            <ActionRow>
              <Button
                type="button"
                variant={
                  profile?.market === "NG" || profile?.market === "GH"
                    ? "outline"
                    : "default"
                }
                disabled={busy || !apiBaseUrl || !online}
                onClick={() => void onCheckout("stripe")}
              >
                Upgrade with Stripe
              </Button>
              <Button
                type="button"
                variant={
                  profile?.market === "NG" || profile?.market === "GH"
                    ? "default"
                    : "outline"
                }
                disabled={busy || !apiBaseUrl || !online}
                onClick={() => void onCheckout("paystack")}
              >
                Upgrade with Paystack
              </Button>
              {(import.meta.env.DEV ||
                (typeof window !== "undefined" &&
                  window.location.hostname.includes("girlcode-dev"))) ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || !apiBaseUrl}
                  onClick={() => void onDevPremium()}
                >
                  Dev activate
                </Button>
              ) : null}
            </ActionRow>
          </>
        ) : (
          <ActionRow>
            <p className={`${leadClass} m-0`}>
              Unlimited Alena and HealthLens on-demand. Mirror Studio is included.
            </p>
            {billing?.provider === "stripe" ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !apiBaseUrl || !online}
                onClick={() => void onPortal()}
              >
                Manage subscription
              </Button>
            ) : null}
          </ActionRow>
        )}
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Privacy Centre
        </h2>
        <p className={leadClass}>
          {profile ? JURISDICTION_CONSENT_LEAD[profile.market] : null} Review
          consents, export your data, or request deletion (Art.15–20). Policy{" "}
          {CURRENT_POLICY_VERSION}.
        </p>
        {profile ? (
          <form className="grid gap-3" onSubmit={(e) => void onSaveMarket(e)}>
            <Field id="account-market" label="Privacy market">
              <select
                id="account-market"
                className="h-12 min-h-[var(--tap)] w-full rounded-[var(--radius)] border border-input bg-card px-4 text-[length:var(--text-body)] text-foreground"
                value={profile.market}
                onChange={(e) =>
                  setProfile((p) =>
                    p ? { ...p, market: e.target.value as Market } : p,
                  )
                }
              >
                {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" variant="outline" disabled={busy || !apiBaseUrl}>
              Save market
            </Button>
          </form>
        ) : null}
        <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
          My Data
        </h3>
        <p className={leadClass}>
          Art.15 inventory. Symptom text and TTC intimacy stay in the JSON
          export, not on this screen.
        </p>
        {myData ? (
          <ul className={listClass}>
            <li className={listItemClass}>
              Email: {myData.inventory?.email ?? myData.profile.email ?? "Not on this profile"}
            </li>
            <li className={listItemClass}>
              Market: {MARKET_LABEL[myData.inventory?.market ?? myData.profile.market]}
            </li>
            <li className={listItemClass}>
              Locale: {myData.inventory?.locale ?? myData.profile.locale}
            </li>
            <li className={listItemClass}>
              Modules: {(myData.inventory?.modules ?? myData.modules).map((m) => MODULE_COPY[m].title).join(", ")}
            </li>
            <li className={listItemClass}>
              Consents on:{" "}
              {(myData.inventory?.consentsGranted ?? [])
                .map((p) => CONSENT_LABELS[p])
                .join(", ") || "None listed"}
            </li>
            <li className={listItemClass}>
              SheMatch:{" "}
              {myData.inventory?.shematchGranted ? "on" : "off"}
              {myData.inventory?.shematchModulesOn?.length
                ? ` · ${myData.inventory.shematchModulesOn.join(", ")}`
                : ""}
            </li>
            <li className={listItemClass}>
              Notifications:{" "}
              {myData.inventory?.notifications.masterEnabled ? "on" : "off"} ·
              quiet hours {myData.inventory?.notifications.quietHoursStart ?? "22:00"}–
              {myData.inventory?.notifications.quietHoursEnd ?? "07:00"}
            </li>
            <li className={listItemClass}>Cycles: {myData.counts.cycles}</li>
            <li className={listItemClass}>
              Cycle days: {myData.counts.cycleDays}
            </li>
            <li className={listItemClass}>
              Appointments: {myData.counts.appointments ?? 0}
            </li>
            <li className={listItemClass}>
              Wallet docs: {myData.counts.walletDocs}
            </li>
            <li className={listItemClass}>
              HealthLens reports: {myData.counts.healthLensReports}
            </li>
            <li className={listItemClass}>
              Mirror scans: {myData.counts.skinScans ?? 0}
            </li>
            <li className={listItemClass}>
              Apparel try-ons: {myData.counts.apparelTryons ?? 0}
            </li>
            <li className={listItemClass}>
              Marketplace listings you submitted:{" "}
              {myData.counts.marketplaceListingsOwned ?? 0}
            </li>
            <li className={listItemClass}>
              Content reports you filed: {myData.counts.reportsFiled ?? 0}
            </li>
            <li className={listItemClass}>
              Community groups joined: {myData.counts.communityGroupsJoined ?? 0}
            </li>
            <li className={listItemClass}>
              In-app notices: {myData.counts.inAppNotifications ?? 0}
            </li>
            <li className={listItemClass}>
              Deletion: {myData.inventory?.deletionStatus ?? deletion?.status ?? "none"}
            </li>
          </ul>
        ) : (
          <p className={leadClass}>
            {apiBaseUrl ? "Loading My Data…" : "Connect API for My Data."}
          </p>
        )}

        <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
          Consents
        </h3>
        {(Object.keys(CONSENT_LABELS) as ConsentPurpose[]).map((purpose) => (
          <Label
            key={purpose}
            className="flex min-h-[var(--tap)] items-center gap-3 text-[length:var(--text-body)] font-normal"
          >
            <Checkbox
              checked={granted(purpose)}
              disabled={busy || purpose === "health_data" || !apiBaseUrl}
              onCheckedChange={(v) =>
                void toggleConsent(purpose, v === true)
              }
            />
            {CONSENT_LABELS[purpose]}
          </Label>
        ))}

        <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
          SheMatch modules
        </h3>
        <p className={leadClass}>
          Only used when SheMatch consent is on. Suggestions stay off if nothing
          is within 5 km.
        </p>
        {ALL_MODULES.map((mod) => (
          <Label
            key={mod}
            className="flex min-h-[var(--tap)] items-center gap-3 text-[length:var(--text-body)] font-normal"
          >
            <Checkbox
              checked={sheModules[mod]}
              disabled={busy || !apiBaseUrl}
              onCheckedChange={(v) => {
                const granted = v === true;
                setSheModules((p) => ({ ...p, [mod]: granted }));
                void patchSheMatchPrefs({ [mod]: granted });
              }}
            />
            {MODULE_COPY[mod].title}
          </Label>
        ))}

        {consentHistory.length > 0 ? (
          <>
            <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
              Consent history
            </h3>
            <ul className={listClass}>
              {[...consentHistory]
                .slice(-12)
                .reverse()
                .map((row) => (
                  <li key={row.id} className={listItemClass}>
                    {PURPOSE_COPY[row.purpose].title}: {row.granted ? "granted" : "withdrawn"} ·{" "}
                    {row.policyVersion} · {row.jurisdiction} ·{" "}
                    {new Date(row.recordedAt).toLocaleString()}
                  </li>
                ))}
            </ul>
          </>
        ) : null}

        <ActionRow>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !apiBaseUrl || !online}
            onClick={() => void onExport()}
          >
            Export JSON
          </Button>
        </ActionRow>
        {deletion?.status === "cooling_off" ? (
          <div className="grid gap-3">
            <p className={leadClass}>
              Account deletion is scheduled. Purge after{" "}
              {new Date(deletion.purgeAfter).toLocaleString()}. You can keep
              the account until then.
            </p>
            <ActionRow>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onCancelDelete()}
              >
                Keep account
              </Button>
            </ActionRow>
          </div>
        ) : confirmDelete ? (
          <div className="grid gap-3">
            <p className={leadClass}>
              Request deletion? You have 24 hours to keep the account before
              purge. Health logs, reports you filed, and marketplace submissions
              are removed after that.
            </p>
            <ActionRow>
              <Button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Keep account
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive"
                disabled={busy || !apiBaseUrl}
                onClick={() => void onDelete()}
              >
                Request deletion
              </Button>
            </ActionRow>
          </div>
        ) : (
          <ActionRow>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive"
              disabled={busy || !apiBaseUrl}
              onClick={() => setConfirmDelete(true)}
            >
              Request deletion
            </Button>
          </ActionRow>
        )}
      </section>

      <form className="grid gap-4 border-t border-border pt-6" onSubmit={(e) => void onSaveModules(e)}>
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Modules
        </h2>
        <p className={leadClass}>
          Turn health areas on or off. At least one must stay on.
        </p>
        {ALL_MODULES.map((m) => (
          <Label
            key={m}
            className="flex min-h-[var(--tap)] items-start gap-3 text-[length:var(--text-body)] font-normal"
          >
            <Checkbox
              className="mt-1"
              checked={profile?.modules.includes(m) ?? false}
              disabled={busy || !apiBaseUrl}
              onCheckedChange={() => toggleModule(m)}
            />
            <span>
              <strong className="block">{MODULE_COPY[m].title}</strong>
              <span className="block text-[length:var(--text-label)] text-muted-foreground">
                {MODULE_COPY[m].body}
              </span>
            </span>
          </Label>
        ))}
        <Button type="submit" disabled={busy || !apiBaseUrl}>
          Save modules
        </Button>
      </form>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Security
        </h2>
        <p className={leadClass}>
          Change your password, or lock the app on this device with a PIN and
          optional Face ID / Touch ID.
        </p>
        {cognitoConfig.userPoolId ? (
          <form className={formStackClass} onSubmit={(e) => void onChangePassword(e)}>
            <Field id="current-password" label="Current password">
              <FieldInput
                id="current-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </Field>
            <Field id="new-password" label="New password" hint={PASSWORD_HINT}>
              <FieldInput
                id="new-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Label className="flex min-h-[var(--tap)] items-center gap-3 font-normal">
              <Checkbox
                checked={showPw}
                onCheckedChange={(v) => setShowPw(v === true)}
              />
              Show passwords
            </Label>
            <Button type="submit" disabled={busy || !online}>
              Update password
            </Button>
          </form>
        ) : (
          <p className={leadClass}>Password change needs Cognito on this build.</p>
        )}
        <Field id="app-pin" label="App PIN" hint="At least 4 digits. Same PIN can unlock Wallet shares.">
          <FieldInput
            id="app-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </Field>
        <ActionRow>
          {lockOn ? (
            <Button type="button" variant="outline" onClick={onDisableLock}>
              Turn app lock off
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => void onEnableLock()}>
              Turn app lock on
            </Button>
          )}
          {webauthnAvailable() ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onRegisterBiometrics()}
            >
              {hasWebAuthn() ? "Re-register Face ID" : "Add Face ID / Touch ID"}
            </Button>
          ) : null}
        </ActionRow>
        <p className={leadClass}>
          Lock is {lockOn ? "on" : "off"}
          {hasPin() ? " · PIN saved on this device" : ""}
          {hasWebAuthn() ? " · biometrics registered" : ""}.
        </p>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Library
        </h2>
        <p className={leadClass}>Educational articles.</p>
        <Button asChild>
          <Link to="/app/library">Browse library</Link>
        </Button>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Community
        </h2>
        <p className={leadClass}>
          Optional peer groups. Text only. Anonymised names. Leave any time.
        </p>
        <Button asChild>
          <Link to="/app/community">Open community</Link>
        </Button>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          App tips
        </h2>
        <p className={leadClass}>
          Replay the first-run tour and page tips on this device.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetTourAndTips();
            setOk("Tips will show again on Home and each page.");
          }}
        >
          Show tips again
        </Button>
      </section>

      <form className={formStackClass} onSubmit={(e) => void savePrefs(e)}>
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Notifications
        </h2>
        <p className={leadClass}>
          Health reminder bodies stay generic. Quiet hours default 22:00–07:00
          local. Listing and partner notices are in-app only — open{" "}
          <Link to="/app/inbox">Inbox</Link>. They need Marketing messages on
          and are not lock-screen push.
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
          <Label
            key={key}
            className="flex min-h-[var(--tap)] items-center gap-3 text-[length:var(--text-body)] font-normal"
          >
            <Checkbox
              checked={prefs[key]}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, [key]: v === true }))
              }
            />
            {label}
          </Label>
        ))}
        {prefs.period ? (
          <Field
            id="period-lead"
            label="Period reminder"
            hint="Days before the predicted start. Quiet hours still apply. Lock-screen text stays generic."
          >
            <select
              id="period-lead"
              className="h-12 min-h-[var(--tap)] w-full rounded-[var(--radius)] border border-input bg-card px-4 text-[length:var(--text-body)] text-foreground"
              value={prefs.periodLeadDays ?? 1}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  periodLeadDays: Number(e.target.value) as 1 | 2 | 3,
                }))
              }
            >
              <option value={1}>1 day before</option>
              <option value={2}>2 days before</option>
              <option value={3}>3 days before</option>
            </select>
          </Field>
        ) : null}
        <Field id="quiet-start" label="Quiet hours start">
          <FieldInput
            id="quiet-start"
            type="time"
            value={prefs.quietHoursStart}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))
            }
          />
        </Field>
        <Field id="quiet-end" label="Quiet hours end">
          <FieldInput
            id="quiet-end"
            type="time"
            value={prefs.quietHoursEnd}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))
            }
          />
        </Field>
        <Button type="submit" disabled={busy}>
          Save preferences
        </Button>
      </form>

      <Button type="button" variant="outline" onClick={logout}>
        Sign out
      </Button>
    </AppPage>
  );
}
