import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AppPage,
  formStackClass,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { AskAlenaLink } from "@/components/blocks/ask-alena-link";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { Chip } from "@/components/primitives/chip";
import { Field, FieldInput, FieldSelect } from "@/components/primitives/field";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import type {
  BiometricLog,
  HealthModule,
  MedicationReminder,
  PcosArticle,
  PcosInsight,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import { libraryArticles } from "../../../../packages/domain/src/index";
import {
  ApiError,
  createPcosMedication,
  deletePcosMedication,
  getMe,
  getPcosArticles,
  getPcosBiometrics,
  getPcosInsights,
  getPcosMedications,
  getVapidPublicKey,
  patchModules,
  registerPushSubscription,
  upsertPcosBiometric,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import symptoms from "../data/symptoms.json";
import { enqueueAndStore, loadLocalState } from "../lib/sync";
import { PregnancyPanel } from "./PregnancyPanel";
import { TtcPanel } from "./TtcPanel";
import { WalletPanel } from "./WalletPanel";

type Symptom = {
  id: string;
  label: string;
  surfaces?: Array<"cycle" | "pmos">;
};

const PMOS_SYMPTOMS = (symptoms as Symptom[]).filter(
  (s) => !s.surfaces || s.surfaces.includes("pmos"),
);

const MED_HINT: Record<"UK" | "NG" | "GH", string> = {
  UK: "Name, dose, time, and how often. People in the UK often add metformin, inositol, or letrozole if a clinician already advised them — this is a reminder list, not a prescription.",
  NG: "Name, dose, time, and how often. Add clinic-prescribed meds or supplements you already use. This is a reminder list, not a prescription.",
  GH: "Name, dose, time, and how often. Add clinic-prescribed meds or supplements you already use. This is a reminder list, not a prescription.",
};

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
  const online = useOnline();

  const [insights, setInsights] = useState<PcosInsight[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    "Possible patterns only. Not a diagnosis or medical advice.",
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
  const [medFreq, setMedFreq] = useState<"daily" | "weekdays" | "custom">(
    "daily",
  );
  const [diaryDate, setDiaryDate] = useState(todayYmd);
  const [diaryIds, setDiaryIds] = useState<string[]>([]);
  const [diaryPending, setDiaryPending] = useState(0);
  const [acneBanner, setAcneBanner] = useState(false);

  const pmosOn =
    !apiBaseUrl || (profile?.modules.includes("pcos_manager") ?? false);

  async function refreshPcos(market: string) {
    const m = market as "UK" | "NG" | "GH";
    if (!apiBaseUrl) {
      setArticles(libraryArticles(m, "pcos"));
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
          setArticles(libraryArticles(me.market, "pcos"));
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.code === "api_base_url_missing") {
            setArticles(libraryArticles("UK", "pcos"));
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

  useEffect(() => {
    let cancelled = false;
    void loadLocalState().then((s) => {
      if (cancelled) return;
      setDiaryPending(s.pendingCount);
      const day = s.days.find((d) => d.date === diaryDate);
      setDiaryIds(day?.symptomIds ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [diaryDate, pmosOn]);

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
        err instanceof Error ? err.message : "Could not enable PMOS module",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDiary(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await enqueueAndStore({
        op: "upsert_day",
        day: { date: diaryDate, symptomIds: diaryIds },
      });
      setDiaryPending(next.pendingCount);
      if (diaryIds.includes("acne")) setAcneBanner(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save diary",
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
        frequency: medFreq,
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
      const vapid = apiBaseUrl ? await getVapidPublicKey() : { publicKey: null };
      const reg = await navigator.serviceWorker.ready;
      if (vapid.publicKey && "PushManager" in window) {
        const bytes = Uint8Array.from(
          atob(vapid.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
        const json = sub.toJSON();
        await registerPushSubscription({
          endpoint: json.endpoint ?? sub.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
        });
      } else {
        await registerPushSubscription({
          endpoint: `local://${crypto.randomUUID()}`,
          keys: { p256dh: "pending-vapid", auth: "pending-vapid" },
        });
        setError(
          "Push delivery needs a VAPID key on the server. Permission is saved; bodies stay generic.",
        );
      }
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

  return (
    <AppPage>
      <PageHeader
        eyebrow="Health"
        title="Modules you opt into"
        lead="Wellness tracking and education. Clinicians diagnose; we help you prepare."
      />
      <AskAlenaLink from="health" />

      {!online ? (
        <OfflineBanner message="You are offline. The PMOS diary still saves on this device. Medication reminders need a connection." />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading health">
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : (
        <>
          <SegmentedTabs
            ariaLabel="Health modules"
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            items={[
              { id: "pcos", label: "PMOS" },
              { id: "pregnancy", label: "Pregnancy" },
              { id: "ttc", label: "TTC" },
              { id: "wallet", label: "Wallet" },
            ]}
          />

          {tab === "pcos" ? (
            !pmosOn ? (
              <EmptyState
                title="PMOS Manager is off"
                body="Turn on the symptom diary, medication reminders, and education. Cycle-only accounts never see this until you opt in."
                action={
                  <Button
                    type="button"
                    onClick={() => void enablePcos()}
                    disabled={busy}
                  >
                    {busy ? "Enabling…" : "Enable PMOS Manager"}
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-6">
                {acneBanner || diaryIds.includes("acne") ? (
                  <SheMatchBanner trigger="pcos_acne" />
                ) : null}
                {meds.length ? <SheMatchBanner trigger="medication_due" /> : null}
                <form className={formStackClass} onSubmit={(e) => void saveDiary(e)}>
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Symptom diary
                  </h2>
                  <p className={leadClass}>
                    {PMOS_SYMPTOMS.length} wellness symptoms. Saves on this
                    device first, then syncs with Cycle. Not a diagnosis.
                    {diaryPending
                      ? ` ${diaryPending} change(s) waiting to sync.`
                      : ""}
                  </p>
                  <Field id="diary-date" label="Date">
                    <FieldInput
                      id="diary-date"
                      type="date"
                      value={diaryDate}
                      onChange={(e) => setDiaryDate(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {PMOS_SYMPTOMS.map((s) => (
                      <Chip
                        key={s.id}
                        pressed={diaryIds.includes(s.id)}
                        onClick={() =>
                          setDiaryIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((x) => x !== s.id)
                              : [...prev, s.id],
                          )
                        }
                      >
                        {s.label}
                      </Chip>
                    ))}
                  </div>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save diary"}
                  </Button>
                </form>

                <section className="grid gap-4">
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Insights
                  </h2>
                  <PredictionDisclaimer message={disclaimer} />
                  <ul className={listClass}>
                    {insights.map((i) => (
                      <li key={i.id} className={listItemClass}>
                        <strong className="block text-foreground">{i.title}</strong>
                        <p className={leadClass}>{i.body}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <form className={formStackClass} onSubmit={saveBiometrics}>
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Biometrics (optional)
                  </h2>
                  <Field id="weight" label="Weight (kg)">
                    <FieldInput
                      id="weight"
                      type="number"
                      step="0.1"
                      min={20}
                      max={300}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </Field>
                  <Field id="sleep" label="Sleep (hours)">
                    <FieldInput
                      id="sleep"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={sleep}
                      onChange={(e) => setSleep(e.target.value)}
                    />
                  </Field>
                  <Field id="water" label="Water (glasses)">
                    <FieldInput
                      id="water"
                      type="number"
                      min={0}
                      max={20}
                      value={water}
                      onChange={(e) => setWater(e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-2">
                    <p className="m-0 text-[length:var(--text-label)] font-medium">
                      Stress (1–5)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <Chip
                          key={n}
                          pressed={stress === n}
                          onClick={() => setStress(n)}
                          className="w-12"
                        >
                          {n}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={busy}>
                    Save today
                  </Button>
                  {bios.length > 0 ? (
                    <p className={leadClass}>
                      Last saved: {bios[bios.length - 1]!.date}
                    </p>
                  ) : null}
                </form>

                <form className={formStackClass} onSubmit={addMedication}>
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Medication reminders
                  </h2>
                  <p className={leadClass}>
                    {MED_HINT[profile?.market ?? "UK"]}
                  </p>
                  <Field id="med-name" label="Name">
                    <FieldInput
                      id="med-name"
                      required
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                    />
                  </Field>
                  <Field id="med-dose" label="Dosage">
                    <FieldInput
                      id="med-dose"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                    />
                  </Field>
                  <Field id="med-time" label="Time">
                    <FieldInput
                      id="med-time"
                      type="time"
                      required
                      value={medTime}
                      onChange={(e) => setMedTime(e.target.value)}
                    />
                  </Field>
                  <Field id="med-freq" label="How often">
                    <FieldSelect
                      id="med-freq"
                      value={medFreq}
                      onChange={(e) =>
                        setMedFreq(
                          e.target.value as "daily" | "weekdays" | "custom",
                        )
                      }
                    >
                      <option value="daily">Every day</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="custom">Custom</option>
                    </FieldSelect>
                  </Field>
                  <Button type="submit" disabled={busy}>
                    Add reminder
                  </Button>
                </form>
                <ul className={listClass}>
                  {meds.map((m) => (
                    <li key={m.id} className={listItemClass}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <strong className="block text-foreground">
                            {m.name}
                            {m.dosage ? ` · ${m.dosage}` : ""}
                          </strong>
                          <p className={leadClass}>
                            {m.timeLocal} · {m.frequency}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void removeMed(m.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void enablePush()}
                  disabled={busy}
                >
                  Enable generic push reminders
                </Button>

                <section className="grid gap-4">
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Education
                  </h2>
                  <p className={leadClass}>
                    Full articles, review dates, and reporting live in Library.
                  </p>
                  <ul className={listClass}>
                    {articles.map((a) => (
                      <li key={a.id} className={listItemClass}>
                        <strong className="block text-foreground">{a.title}</strong>
                        <p className={leadClass}>{a.summary}</p>
                        <Link
                          className="mt-2 inline-flex min-h-[var(--tap)] items-center text-[length:var(--text-label)] font-semibold text-primary"
                          to={`/app/library?id=${encodeURIComponent(a.id)}`}
                        >
                          Open in Library
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )
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
        </>
      )}
    </AppPage>
  );
}
