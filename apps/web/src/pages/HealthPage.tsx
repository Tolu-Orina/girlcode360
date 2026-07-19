import { useEffect, useState, type FormEvent } from "react";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import type {
  BiometricLog,
  HealthModule,
  MedicationReminder,
  PcosArticle,
  PcosInsight,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import {
  ApiError,
  createPcosMedication,
  deletePcosMedication,
  getMe,
  getPcosArticles,
  getPcosBiometrics,
  getPcosInsights,
  getPcosMedications,
  patchModules,
  registerPushSubscription,
  upsertPcosBiometric,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import articlesLocal from "../data/pcos-articles.json";
import { PregnancyPanel } from "./PregnancyPanel";
import { TtcPanel } from "./TtcPanel";
import { WalletPanel } from "./WalletPanel";
import "./health.css";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Tab = "pcos" | "pregnancy" | "ttc" | "wallet";

export function HealthPage() {
  const [tab, setTab] = useState<Tab>("pcos");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [insights, setInsights] = useState<PcosInsight[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    "Possible patterns only — not a diagnosis or medical advice.",
  );
  const [articles, setArticles] = useState<PcosArticle[]>([]);
  const [meds, setMeds] = useState<MedicationReminder[]>([]);
  const [bios, setBios] = useState<BiometricLog[]>([]);

  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [water, setWater] = useState("");
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medTime, setMedTime] = useState("08:00");

  const pcosOn = profile?.modules.includes("pcos_manager") ?? false;

  async function refreshPcos(market: string) {
    if (!apiBaseUrl) {
      setArticles(
        (articlesLocal as PcosArticle[]).filter((a) =>
          a.markets.includes(market as "UK" | "NG" | "GH"),
        ),
      );
      setInsights([
        {
          id: "offline",
          kind: "data",
          title: "Offline mode",
          body: "Connect the API to sync biometrics, reminders, and live insights. Education articles below still work locally.",
        },
      ]);
      return;
    }
    const [ins, arts, medications, biometrics] = await Promise.all([
      getPcosInsights(),
      getPcosArticles(market as "UK" | "NG" | "GH"),
      getPcosMedications(),
      getPcosBiometrics(),
    ]);
    setInsights(ins.insights);
    setDisclaimer(ins.disclaimer);
    setArticles(arts.articles);
    setMeds(medications.medications);
    setBios(biometrics.biometrics);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        setProfile(me);
        if (me.modules.includes("pcos_manager")) {
          await refreshPcos(me.market);
        } else {
          setArticles(
            (articlesLocal as PcosArticle[]).filter((a) =>
              a.markets.includes(me.market),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.code === "api_base_url_missing") {
            setArticles(articlesLocal as PcosArticle[]);
            setError(null);
          } else {
            setError(
              err instanceof Error ? err.message : "Could not load health",
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePcos() {
    setBusy(true);
    setError(null);
    try {
      const base = profile?.modules ?? (["period_tracker"] as HealthModule[]);
      const modules: HealthModule[] = base.includes("pcos_manager")
        ? base
        : [...base, "pcos_manager"];
      const me = await patchModules({ modules });
      setProfile(me);
      await refreshPcos(me.market);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable PCOS module",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveBiometrics(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { biometric } = await upsertPcosBiometric({
        date: todayYmd(),
        weightKg: weight ? Number(weight) : null,
        sleepHours: sleep ? Number(sleep) : null,
        waterGlasses: water ? Number(water) : null,
        stress,
      });
      setBios((prev) => {
        const rest = prev.filter((b) => b.date !== biometric.date);
        return [...rest, biometric].sort((a, b) => a.date.localeCompare(b.date));
      });
      if (profile) await refreshPcos(profile.market);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save biometrics",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addMedication(e: FormEvent) {
    e.preventDefault();
    if (!medName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { medication } = await createPcosMedication({
        name: medName.trim(),
        dosage: medDose.trim() || null,
        timeLocal: medTime,
        frequency: "daily",
      });
      setMeds((prev) => [...prev, medication]);
      setMedName("");
      setMedDose("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save reminder");
    } finally {
      setBusy(false);
    }
  }

  async function removeMed(id: string) {
    setBusy(true);
    try {
      await deletePcosMedication(id);
      setMeds((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete reminder",
      );
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setError(null);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setError("Push notifications are not supported in this browser.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }
      await registerPushSubscription({
        endpoint: `local://${crypto.randomUUID()}`,
        keys: { p256dh: "pending-vapid", auth: "pending-vapid" },
      });
      if (Notification.permission === "granted") {
        new Notification("GirlCode360", {
          body: "You have a note in GirlCode360",
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable reminders",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="health-page">
        <p className="health-lead">Loading health…</p>
      </section>
    );
  }

  return (
    <section className="health-page">
      <h1>Health</h1>
      <p className="health-lead">
        Opt-in modules only. Wellness tracking and education — clinicians
        diagnose; we help you prepare.
      </p>

      <div className="health-tabs" role="tablist" aria-label="Health modules">
        {(
          [
            ["pcos", "PCOS"],
            ["pregnancy", "Pregnancy"],
            ["ttc", "TTC"],
            ["wallet", "Wallet"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "on" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pcos" ? (
        <>
          {!pcosOn ? (
            <div className="health-section">
              <h2>Enable PCOS Manager</h2>
              <p className="health-lead">
                Turn on insights, biometrics, medication reminders, and
                education. Period-only users never see this until you opt in.
              </p>
              <button
                type="button"
                className="primary"
                onClick={enablePcos}
                disabled={busy}
              >
                {busy ? "Enabling…" : "Enable PCOS Manager"}
              </button>
            </div>
          ) : (
            <>
              <div className="health-section">
                <h2>Insights</h2>
                <PredictionDisclaimer message={disclaimer} />
                <ul className="insight-list">
                  {insights.map((i) => (
                    <li key={i.id}>
                      <strong>{i.title}</strong>
                      <p>{i.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="health-section">
                <h2>Biometrics (optional)</h2>
                <form className="health-form" onSubmit={saveBiometrics}>
                  <label>
                    Weight (kg)
                    <input
                      type="number"
                      step="0.1"
                      min={20}
                      max={300}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </label>
                  <label>
                    Sleep (hours)
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={sleep}
                      onChange={(e) => setSleep(e.target.value)}
                    />
                  </label>
                  <label>
                    Water (glasses)
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={water}
                      onChange={(e) => setWater(e.target.value)}
                    />
                  </label>
                  <div>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>
                      Stress (1–5)
                    </p>
                    <div className="stress-row">
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={stress === n ? "on" : ""}
                          onClick={() => setStress(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="primary" disabled={busy}>
                    Save today
                  </button>
                </form>
                {bios.length > 0 ? (
                  <p className="health-lead">
                    Last saved: {bios[bios.length - 1]!.date}
                  </p>
                ) : null}
              </div>

              <div className="health-section">
                <h2>Medication reminders</h2>
                <form className="health-form" onSubmit={addMedication}>
                  <label>
                    Name
                    <input
                      required
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                    />
                  </label>
                  <label>
                    Dosage
                    <input
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                    />
                  </label>
                  <label>
                    Time
                    <input
                      type="time"
                      required
                      value={medTime}
                      onChange={(e) => setMedTime(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="primary" disabled={busy}>
                    Add reminder
                  </button>
                </form>
                <ul className="med-list">
                  {meds.map((m) => (
                    <li key={m.id}>
                      <div className="row">
                        <div>
                          <strong>
                            {m.name}
                            {m.dosage ? ` · ${m.dosage}` : ""}
                          </strong>
                          <p>
                            {m.timeLocal} · {m.frequency}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeMed(m.id)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={enablePush} disabled={busy}>
                  Enable generic push reminders
                </button>
              </div>
            </>
          )}

          <div className="health-section">
            <h2>Education</h2>
            <ul className="article-list">
              {articles.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <p>{a.summary}</p>
                  <p>{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {tab === "pregnancy" ? (
        <PregnancyPanel
          profile={profile}
          onProfile={setProfile}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      ) : null}

      {tab === "ttc" ? (
        <TtcPanel
          profile={profile}
          onProfile={setProfile}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      ) : null}

      {tab === "wallet" ? (
        <WalletPanel
          profile={profile}
          onProfile={setProfile}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}
    </section>
  );
}
