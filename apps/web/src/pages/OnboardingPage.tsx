import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ALL_MODULES,
  ApiError,
  CURRENT_POLICY_VERSION,
  bootstrap,
  detectLocale,
  detectMarket,
  getMe,
  patchMe,
  patchModules,
  postConsents,
  type ConsentPurpose,
  type HealthModule,
  type Market,
  type UserProfile,
} from "../lib/api";
import "./onboarding.css";

type Step = "age" | "jurisdiction" | "consent" | "modules";

const PURPOSE_COPY: Record<
  ConsentPurpose,
  { title: string; body: string; required?: boolean }
> = {
  health_data: {
    title: "Health data processing",
    body: "Store and process your cycle, symptoms, and wellness logs so the app can work for you.",
    required: true,
  },
  analytics: {
    title: "Product analytics",
    body: "Help us understand feature use with aggregated, non-diagnostic metrics.",
  },
  marketing: {
    title: "Marketing messages",
    body: "Occasional product updates. Never health content in notification bodies.",
  },
  location: {
    title: "Approximate location",
    body: "Used only for jurisdiction and emergency number hints — not sold.",
  },
  ai_zara: {
    title: "Zara AI companion",
    body: "Allow Zara to use your prompts (and optional context you choose) via Amazon Bedrock.",
  },
  ai_healthlens: {
    title: "HealthLens insights",
    body: "Allow pattern summaries over your logged data. Wellness only — not diagnosis.",
  },
};

const MODULE_COPY: Record<HealthModule, { title: string; body: string }> = {
  period_tracker: {
    title: "Period Tracker",
    body: "Log cycles, symptoms, and predictions.",
  },
  pcos_manager: {
    title: "PCOS Manager",
    body: "Symptoms, biometrics, and education for PCOS wellness.",
  },
  pregnancy: {
    title: "Pregnancy",
    body: "Week-by-week guidance, logs, and reminders.",
  },
  ttc: {
    title: "Trying to conceive",
    body: "Fertile window overlay and optional fertility signs.",
  },
  wallet: {
    title: "Health Wallet",
    body: "Encrypted personal health records you control.",
  },
};

const MARKET_LABEL: Record<Market, string> = {
  UK: "United Kingdom",
  NG: "Nigeria",
  GH: "Ghana",
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("age");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [market, setMarket] = useState<Market>(detectMarket());
  const [locale] = useState(detectLocale());
  const [consents, setConsents] = useState<Record<ConsentPurpose, boolean>>({
    health_data: true,
    analytics: false,
    marketing: false,
    location: false,
    ai_zara: false,
    ai_healthlens: false,
  });
  const [modules, setModules] = useState<HealthModule[]>(["period_tracker"]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        if (me.onboardingComplete) {
          navigate("/app", { replace: true });
          return;
        }
        setProfile(me);
        setMarket(me.market);
        setModules(me.modules?.length ? me.modules : ["period_tracker"]);
        if (!me.ageConfirmed18) setStep("age");
        else setStep("jurisdiction");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
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
  }, [navigate]);

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
      setError(err instanceof Error ? err.message : "Age confirmation failed");
    } finally {
      setBusy(false);
    }
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
      const items = (
        Object.keys(PURPOSE_COPY) as ConsentPurpose[]
      ).map((purpose) => ({
        purpose,
        granted: consents[purpose],
      }));
      await postConsents({
        jurisdiction: market,
        policyVersion: CURRENT_POLICY_VERSION,
        items,
      });
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
      await patchMe({ onboardingComplete: true });
      localStorage.setItem("gc_onboarding_complete", "1");
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save modules");
    } finally {
      setBusy(false);
    }
  }

  function toggleModule(m: HealthModule) {
    setModules((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  if (loading) {
    return (
      <main className="onboarding-page">
        <p className="onboarding-lead">Loading your account…</p>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <p className="onboarding-step">
        Onboarding · {stepLabel(step)}
        {profile?.email ? ` · ${profile.email}` : ""}
      </p>

      {step === "age" ? (
        <form className="onboarding-form" onSubmit={onConfirmAge}>
          <h1>Are you 18 or older?</h1>
          <p className="onboarding-lead">
            GirlCode360 is for adults only. Confirming your age is required
            before we store any health data.
          </p>
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="onboarding-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Yes, I am 18+"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate("/signin")}
            >
              I am under 18 — exit
            </button>
          </div>
        </form>
      ) : null}

      {step === "jurisdiction" ? (
        <form className="onboarding-form" onSubmit={onSaveJurisdiction}>
          <h1>Where should we apply privacy rules?</h1>
          <p className="onboarding-lead">
            We detected <strong>{MARKET_LABEL[detectMarket()]}</strong> from
            your device locale. Override if needed — this sets UK / NG / GH
            policy and emergency number hints.
          </p>
          <label>
            Market
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
            >
              {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
                <option key={m} value={m}>
                  {MARKET_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="onboarding-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "consent" ? (
        <form className="onboarding-form" onSubmit={onSaveConsents}>
          <h1>Your privacy choices</h1>
          <p className="onboarding-lead">
            Policy version <code>{CURRENT_POLICY_VERSION}</code>. Read the{" "}
            <Link to="/privacy">Privacy Policy</Link> and{" "}
            <Link to="/terms">Terms</Link>.
          </p>
          {(Object.keys(PURPOSE_COPY) as ConsentPurpose[]).map((purpose) => (
            <label key={purpose} className="consent-row">
              <input
                type="checkbox"
                checked={consents[purpose]}
                disabled={PURPOSE_COPY[purpose].required}
                onChange={(e) =>
                  setConsents((c) => ({ ...c, [purpose]: e.target.checked }))
                }
              />
              <span>
                <strong>
                  {PURPOSE_COPY[purpose].title}
                  {PURPOSE_COPY[purpose].required ? " (required)" : ""}
                </strong>
                <span>{PURPOSE_COPY[purpose].body}</span>
              </span>
            </label>
          ))}
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="onboarding-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "modules" ? (
        <form className="onboarding-form" onSubmit={onSaveModules}>
          <h1>What do you want to use?</h1>
          <p className="onboarding-lead">
            Pick the modules that matter now. You can change this later in
            Account.
          </p>
          {ALL_MODULES.map((m) => (
            <label key={m} className="module-row">
              <input
                type="checkbox"
                checked={modules.includes(m)}
                onChange={() => toggleModule(m)}
              />
              <span>
                <strong>{MODULE_COPY[m].title}</strong>
                <span>{MODULE_COPY[m].body}</span>
              </span>
            </label>
          ))}
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="onboarding-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Finishing…" : "Enter GirlCode360"}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}

function stepLabel(step: Step): string {
  switch (step) {
    case "age":
      return "1 of 4";
    case "jurisdiction":
      return "2 of 4";
    case "consent":
      return "3 of 4";
    case "modules":
      return "4 of 4";
  }
}
