import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AmbientLayer } from "@/components/blocks/ambient-layer";
import { GateScreen } from "@/components/blocks/gate-screen";
import { PageHeader } from "@/components/blocks/page-header";
import { ErrorBanner } from "@/components/blocks/states";
import { Field } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  JURISDICTION_CONSENT_LEAD,
  MARKET_LABEL,
  MODULE_COPY,
  PURPOSE_COPY,
} from "@/lib/consent-copy";
import { signOut } from "@/lib/cognito";
import {
  ALL_MODULES,
  ApiError,
  CURRENT_POLICY_VERSION,
  DEFAULT_MODULES,
  bootstrap,
  detectLocale,
  detectMarket,
  getApiHealth,
  getConsents,
  getMe,
  patchMe,
  patchModules,
  postConsents,
  type ConsentPurpose,
  type HealthModule,
  type Market,
  type UserProfile,
} from "../lib/api";
import { markTourSeen } from "@/lib/tips";
import { ONBOARDING_TOUR } from "../../../../packages/domain/src/index";

type Step = "age" | "jurisdiction" | "consent" | "modules" | "tour" | "blocked";

const REQUIRED_PURPOSES = (Object.keys(PURPOSE_COPY) as ConsentPurpose[]).filter(
  (p) => PURPOSE_COPY[p].required,
);
const OPTIONAL_PURPOSES = (Object.keys(PURPOSE_COPY) as ConsentPurpose[]).filter(
  (p) => !PURPOSE_COPY[p].required,
);

export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reconsent = params.get("reconsent") === "1";
  const [step, setStep] = useState<Step>("age");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [detected, setDetected] = useState<Market>(detectMarket());
  const [market, setMarket] = useState<Market>(detectMarket());
  const [locale] = useState(detectLocale());
  const [consents, setConsents] = useState<Record<ConsentPurpose, boolean>>({
    health_data: true,
    analytics: false,
    marketing: false,
    location: false,
    ai_alena: false,
    ai_healthlens: false,
    mirror_biometric: false,
    mirror_live_camera: false,
    wardrobe: false,
    shematch: false,
  });
  const [modules, setModules] = useState<HealthModule[]>([...DEFAULT_MODULES]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await getApiHealth();
        if (cancelled) return;
        if (health.suggestedMarket) {
          setDetected(health.suggestedMarket);
          setMarket((m) => (m === detectMarket() ? health.suggestedMarket! : m));
        }
      } catch {
        /* offline — locale/timezone already set */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        if (!me.ageConfirmed18) {
          setProfile(me);
          setStep("blocked");
          return;
        }
        setProfile(me);
        setMarket(me.market);
        setModules(me.modules?.length ? me.modules : [...DEFAULT_MODULES]);
        if (reconsent) {
          try {
            const c = await getConsents();
            setConsents((prev) => {
              const next = { ...prev };
              for (const row of c.current) next[row.purpose] = row.granted;
              next.health_data = true;
              return next;
            });
          } catch {
            /* keep defaults */
          }
          setStep("consent");
          return;
        }
        if (me.onboardingComplete) {
          navigate("/app", { replace: true });
          return;
        }
        if (!me.ageConfirmed18) setStep("age");
        else setStep("jurisdiction");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "minor_blocked") {
          setStep("blocked");
        } else if (err instanceof ApiError && err.status === 404) {
          setStep("age");
        } else if (err instanceof ApiError && err.code === "api_base_url_missing") {
          setError(
            "API is not configured. Set VITE_API_BASE_URL to continue onboarding.",
          );
        } else {
          setError(err instanceof Error ? err.message : "Could not load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, reconsent]);

  async function onConfirmAge(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await bootstrap({
        ageConfirmed18: true,
        market,
        locale,
      });
      setProfile(me);
      setStep("jurisdiction");
    } catch (err) {
      if (err instanceof ApiError && err.code === "minor_blocked") {
        setStep("blocked");
      } else {
        setError(err instanceof Error ? err.message : "Age confirmation failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDeclineAge() {
    setBusy(true);
    setError(null);
    try {
      await bootstrap({ ageConfirmed18: false, market, locale });
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "minor_blocked")) {
        setError(err instanceof Error ? err.message : "Could not save");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setStep("blocked");
  }

  async function onSaveJurisdiction(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await patchMe({ market, locale });
      setProfile(me);
      setStep("consent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save market");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveConsents(e: FormEvent) {
    e.preventDefault();
    if (!consents.health_data) {
      setError("Health data consent is required to use GirlCode360.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const items = (Object.keys(PURPOSE_COPY) as ConsentPurpose[]).map(
        (purpose) => ({
          purpose,
          granted: consents[purpose],
        }),
      );
      await postConsents({
        jurisdiction: market,
        policyVersion: CURRENT_POLICY_VERSION,
        items,
      });
      if (reconsent) {
        navigate("/app", { replace: true });
        return;
      }
      setStep("modules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save consents");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveModules(e: FormEvent) {
    e.preventDefault();
    if (modules.length === 0) {
      setError("Pick at least one module to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchModules({ modules });
      setStep("tour");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save modules");
    } finally {
      setBusy(false);
    }
  }

  async function finishOnboarding() {
    setBusy(true);
    setError(null);
    try {
      await patchMe({ onboardingComplete: true });
      localStorage.setItem("gc_onboarding_complete", "1");
      markTourSeen();
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish");
    } finally {
      setBusy(false);
    }
  }

  function toggleModule(m: HealthModule) {
    setModules((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  function logout() {
    try {
      signOut();
    } catch {
      /* cognito may be unset */
    }
    navigate("/signin");
  }

  if (loading) {
    return <GateScreen message="Loading your account…" />;
  }

  return (
    <main className="relative min-h-dvh bg-background px-4 pt-[calc(var(--space-6)+env(safe-area-inset-top))] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]">
      <AmbientLayer />
      <div className="relative z-10 mx-auto grid w-full max-w-[var(--auth-max)] gap-6">
        {step !== "blocked" ? (
          <p className="m-0 text-[length:var(--text-caption)] font-semibold text-primary">
            Step {stepLabel(step, reconsent)}
            {profile?.email ? ` · ${profile.email}` : ""}
          </p>
        ) : null}

        {step === "blocked" ? (
          <div className="grid gap-6">
            <PageHeader
              title="GirlCode360 is for adults"
              lead="You must be 18 or older to create a health account. We have not stored health data for this sign-in."
            />
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="button" variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        ) : null}

        {step === "age" ? (
          <form className="grid gap-6" onSubmit={onConfirmAge}>
            <PageHeader
              title="Are you 18 or older?"
              lead="GirlCode360 is for adults only. Confirming your age is required before we store any health data."
            />
            {error ? <ErrorBanner message={error} /> : null}
            <div className="grid gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Yes, I am 18+"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void onDeclineAge()}
              >
                I am under 18. Exit
              </Button>
            </div>
          </form>
        ) : null}

        {step === "jurisdiction" ? (
          <form className="grid gap-6" onSubmit={onSaveJurisdiction}>
            <PageHeader
              title="Where should we apply privacy rules?"
              lead={
                <>
                  We detected <strong>{MARKET_LABEL[detected]}</strong> from your
                  device (timezone, language
                  {detected !== detectMarket() ? ", or connection" : ""}). Change
                  it if that is wrong. This sets privacy rules and emergency
                  number hints.
                </>
              }
            />
            <Field id="onboarding-market" label="Market">
              <select
                id="onboarding-market"
                className="h-12 min-h-[var(--tap)] w-full rounded-[var(--radius)] border border-input bg-card px-4 text-[length:var(--text-body)] text-foreground"
                value={market}
                onChange={(e) => setMarket(e.target.value as Market)}
              >
                {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save market"}
            </Button>
          </form>
        ) : null}

        {step === "consent" ? (
          <form className="grid gap-6" onSubmit={onSaveConsents}>
            <PageHeader
              title={reconsent ? "Review your privacy choices" : "Your privacy choices"}
              lead={
                <>
                  {JURISDICTION_CONSENT_LEAD[market]} Policy version{" "}
                  {CURRENT_POLICY_VERSION}. Read the{" "}
                  <Link to="/privacy">Privacy Policy</Link> and{" "}
                  <Link to="/terms">Terms</Link>.
                </>
              }
            />
            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="mb-2 text-[length:var(--text-label)] font-semibold text-foreground">
                Required
              </legend>
              {REQUIRED_PURPOSES.map((purpose) => (
                <ConsentRow
                  key={purpose}
                  purpose={purpose}
                  checked={consents[purpose]}
                  disabled
                />
              ))}
            </fieldset>
            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="mb-2 text-[length:var(--text-label)] font-semibold text-foreground">
                Optional
              </legend>
              <p className="m-0 mb-2 text-[length:var(--text-caption)] text-muted-foreground">
                None of these are required to finish. You can change them later in
                Account. Optional boxes start unchecked.
              </p>
              {OPTIONAL_PURPOSES.map((purpose) => (
                <ConsentRow
                  key={purpose}
                  purpose={purpose}
                  checked={consents[purpose]}
                  onCheckedChange={(granted) =>
                    setConsents((c) => ({ ...c, [purpose]: granted }))
                  }
                />
              ))}
            </fieldset>
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save preferences"}
            </Button>
          </form>
        ) : null}

        {step === "modules" ? (
          <form className="grid gap-6" onSubmit={onSaveModules}>
            <PageHeader
              title="What do you want to use?"
              lead="Pick the modules that matter now. You can change this later in Account."
            />
            <div className="grid gap-3">
              {ALL_MODULES.map((m) => (
                <label
                  key={m}
                  className="grid min-h-[var(--tap)] cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-4"
                >
                  <Checkbox
                    checked={modules.includes(m)}
                    onCheckedChange={() => toggleModule(m)}
                    className="mt-1 size-5"
                    aria-label={MODULE_COPY[m].title}
                  />
                  <span>
                    <strong className="block text-[length:var(--text-body)] text-foreground">
                      {MODULE_COPY[m].title}
                    </strong>
                    <span className="block text-[length:var(--text-label)] text-muted-foreground">
                      {MODULE_COPY[m].body}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </Button>
          </form>
        ) : null}

        {step === "tour" ? (
          <div className="grid gap-6">
            <PageHeader
              title="How GirlCode360 works"
              lead="Five notes. You can skip and replay later in Account."
            />
            <ol className="m-0 grid list-none gap-4 p-0">
              {ONBOARDING_TOUR.map((s, i) => (
                <li
                  key={s.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-4"
                >
                  <p className="m-0 text-[length:var(--text-caption)] font-semibold text-primary">
                    {i + 1}
                  </p>
                  <p className="m-0 mt-1 text-[length:var(--text-body)] font-semibold text-foreground">
                    {s.title}
                  </p>
                  <p className="m-0 mt-1 text-[length:var(--text-label)] text-muted-foreground">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="button" disabled={busy} onClick={() => void finishOnboarding()}>
              {busy ? "Finishing…" : "Enter GirlCode360"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void finishOnboarding()}
            >
              Skip
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ConsentRow({
  purpose,
  checked,
  disabled,
  onCheckedChange,
}: {
  purpose: ConsentPurpose;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (granted: boolean) => void;
}) {
  const copy = PURPOSE_COPY[purpose];
  return (
    <label className="grid min-h-[var(--tap)] cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        className="mt-1 size-5"
        aria-label={copy.title}
      />
      <span>
        <strong className="block text-[length:var(--text-body)] text-foreground">
          {copy.title}
          {copy.required ? " (required)" : null}
        </strong>
        {purpose === "mirror_biometric" ? (
          <span className="mb-1 block text-[length:var(--text-caption)] font-semibold text-muted-foreground">
            Optional. You can skip this.
          </span>
        ) : null}
        <span className="block text-[length:var(--text-label)] text-muted-foreground">
          {copy.body}
        </span>
      </span>
    </label>
  );
}

function stepLabel(step: Step, reconsent: boolean): string {
  if (reconsent) return "Policy update";
  switch (step) {
    case "age":
      return "1 of 5";
    case "jurisdiction":
      return "2 of 5";
    case "consent":
      return "3 of 5";
    case "modules":
      return "4 of 5";
    case "tour":
      return "5 of 5";
    case "blocked":
      return "";
  }
}
