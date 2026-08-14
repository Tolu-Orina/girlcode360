import { useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/blocks/states";
import { Chip } from "@/components/primitives/chip";
import { Field, FieldInput, FieldSelect } from "@/components/primitives/field";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import {
  elevatedCardClass,
  formStackClass,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import type {
  Appointment,
  HealthModule,
  PregnancyDayLog,
  PregnancyProfile,
  UserProfile,
  WeekContent,
} from "../../../../packages/api-types/src/index";
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  getPregnancy,
  getPregnancyDays,
  getPregnancyWeek,
  initPregnancy,
  patchModules,
  patchPregnancy,
  upsertPregnancyDay,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import weeksLocal from "../data/pregnancy-weeks.json";
import {
  calculateEdd,
  encodePregnancyDaily,
  EMERGENCY_BY_MARKET,
  gestationalWeek,
  bmiKgM2,
  PREGNANCY_WEIGHT_DISCLAIMER,
  WHO_PREGNANCY_WEIGHT_GAIN,
  whoBandForBmi,
} from "../../../../packages/domain/src/index";

const HOSPITAL_KEY = "gc360.pregHospitalPhone";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PregnancyPanel({
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
  const on = profile?.modules.includes("pregnancy") ?? false;
  const [preg, setPreg] = useState<PregnancyProfile | null>(null);
  const [week, setWeek] = useState(1);
  const [weekContent, setWeekContent] = useState<WeekContent | null>(null);
  const [method, setMethod] = useState<"lmp" | "conception">("lmp");
  const [anchor, setAnchor] = useState("");
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptDate, setApptDate] = useState("");
  const [apptType, setApptType] = useState("Antenatal");
  const [wellbeing, setWellbeing] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [nausea, setNausea] = useState<0 | 1 | 2 | 3 | null>(null);
  const [fatigue, setFatigue] = useState<0 | 1 | 2 | 3 | null>(null);
  const [sleepHours, setSleepHours] = useState("");
  const [movementFelt, setMovementFelt] = useState<boolean | null>(null);
  const [weight, setWeight] = useState("");
  const [kicks, setKicks] = useState("");
  const [pregDays, setPregDays] = useState<PregnancyDayLog[]>([]);
  const [baseWeight, setBaseWeight] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [sessionOn, setSessionOn] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionKicks, setSessionKicks] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [apptTime, setApptTime] = useState("");
  const [apptLocation, setApptLocation] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [hospitalPhone, setHospitalPhone] = useState("");

  async function load() {
    if (!on) return;
    if (!apiBaseUrl) {
      if (anchor) {
        const edd = calculateEdd(anchor, method);
        setPreg({
          method,
          anchorDate: anchor,
          edd: edd.edd,
          eddEarly: edd.eddEarly,
          eddLate: edd.eddLate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const w = gestationalWeek(anchor, method, todayYmd());
        setWeek(w);
        const local = (weeksLocal as WeekContent[]).find((x) => x.week === w);
        setWeekContent(local ?? null);
      }
      return;
    }
    try {
      const status = await getPregnancy();
      setPreg(status.profile);
      setWeek(status.week);
      const wc = await getPregnancyWeek(status.week);
      setWeekContent(wc.week);
      const a = await getAppointments();
      setAppts(a.appointments);
      try {
        const days = await getPregnancyDays();
        setPregDays(days.days);
      } catch {
        setPregDays([]);
      }
      if (status.profile.prePregnancyWeightKg != null) {
        setBaseWeight(String(status.profile.prePregnancyWeightKg));
      }
      if (status.profile.heightCm != null) {
        setHeightCm(String(status.profile.heightCm));
      }
    } catch {
      /* not started */
    }
  }

  useEffect(() => {
    try {
      setHospitalPhone(localStorage.getItem(HOSPITAL_KEY) ?? "");
    } catch {
      /* ignore */
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, profile?.sub]);

  useEffect(() => {
    if (!sessionOn || sessionStartedAt == null) return;
    const id = window.setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionOn, sessionStartedAt]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const base = profile?.modules ?? (["period_tracker"] as HealthModule[]);
      const modules: HealthModule[] = base.includes("pregnancy")
        ? base
        : [...base, "pregnancy"];
      onProfile(await patchModules({ modules }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable pregnancy");
    } finally {
      setBusy(false);
    }
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!apiBaseUrl) {
        const edd = calculateEdd(anchor, method);
        setPreg({
          method,
          anchorDate: anchor,
          edd: edd.edd,
          eddEarly: edd.eddEarly,
          eddLate: edd.eddLate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const w = gestationalWeek(anchor, method, todayYmd());
        setWeek(w);
        setWeekContent(
          (weeksLocal as WeekContent[]).find((x) => x.week === w) ?? null,
        );
      } else {
        const res = await initPregnancy({ method, anchorDate: anchor });
        setPreg(res.profile);
        setWeek(res.week);
        const wc = await getPregnancyWeek(res.week);
        setWeekContent(wc.week);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start pregnancy");
    } finally {
      setBusy(false);
    }
  }

  async function saveDay(e: FormEvent) {
    e.preventDefault();
    if (!apiBaseUrl) {
      setError("API required to sync pregnancy day logs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertPregnancyDay({
        date: todayYmd(),
        wellbeing,
        weightKg: weight ? Number(weight) : null,
        kicks: kicks ? Number(kicks) : sessionKicks || null,
        kickSessionMinutes: sessionOn
          ? Math.max(1, Math.round(sessionElapsed / 60))
          : undefined,
        symptoms: encodePregnancyDaily({
          nausea,
          fatigue,
          sleepHours: sleepHours ? Number(sleepHours) : null,
          movementFelt: week >= 20 ? movementFelt : null,
        }),
      });
      setSessionOn(false);
      setSessionStartedAt(null);
      const days = await getPregnancyDays();
      setPregDays(days.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save log");
    } finally {
      setBusy(false);
    }
  }

  async function addAppt(e: FormEvent) {
    e.preventDefault();
    if (!apiBaseUrl) return;
    setBusy(true);
    try {
      const res = await createAppointment({
        date: apptDate,
        type: apptType,
        timeLocal: apptTime || null,
        location: apptLocation || null,
        notes: apptNotes || null,
        remindDayBefore: true,
        remindHourBefore: true,
      });
      setAppts((prev) => [
        ...prev,
        (res as { appointment: Appointment }).appointment,
      ]);
      setApptDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add appointment");
    } finally {
      setBusy(false);
    }
  }

  if (!on) {
    return (
      <EmptyState
        title="Pregnancy is off"
        body="Track weeks, appointments, and wellbeing. Wellness guidance, not medical advice."
        action={
          <Button type="button" onClick={() => void enable()} disabled={busy}>
            Enable Pregnancy
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      {!preg ? (
        <form className={elevatedCardClass} onSubmit={start}>
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            Start pregnancy tracking
          </h2>
          <p className={leadClass}>
            Wellness guidance, not medical advice. Your clinician confirms dating.
          </p>
          <Field id="preg-method" label="Method">
            <FieldSelect
              id="preg-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as "lmp" | "conception")}
            >
              <option value="lmp">Last menstrual period (LMP)</option>
              <option value="conception">Conception date</option>
            </FieldSelect>
          </Field>
          <Field id="preg-date" label="Date">
            <FieldInput
              id="preg-date"
              type="date"
              required
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            Calculate EDD
          </Button>
        </form>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="grid gap-6">
              <section className={elevatedCardClass}>
          <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
            This week
          </h2>
          <p className={leadClass}>
            Week {week} · EDD {preg.edd} (range {preg.eddEarly} – {preg.eddLate})
          </p>
          <PredictionDisclaimer message="EDD is an estimate (Naegele ±1 week). Your clinician confirms dating." />
          {week >= 18 && week <= 22 ? (
            <SheMatchBanner trigger="pregnancy_scan" />
          ) : null}
          {weekContent ? (
            <ul className={listClass}>
              <li className={listItemClass}>
                <strong className="block text-foreground">{weekContent.title}</strong>
                <p className={leadClass}>Baby: {weekContent.baby}</p>
                <p className={leadClass}>You: {weekContent.maternal}</p>
                <p className={leadClass}>Nutrition: {weekContent.nutrition}</p>
                {weekContent.clinicalNote ? (
                  <p className={leadClass}>{weekContent.clinicalNote}</p>
                ) : null}
              </li>
            </ul>
          ) : null}
              </section>

          <div className={elevatedCardClass}>
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              Emergency
            </h2>
            <p className={leadClass}>
              One tap to call. Nearby hospital from the marketplace only if a
              clinic listing is within 5 km of the area you set this session.
            </p>
            <SheMatchBanner trigger="pregnancy_emergency" />
            <div className="flex flex-wrap gap-2">
              {(EMERGENCY_BY_MARKET[profile?.market ?? "UK"] ?? []).map((n) => (
                <Button key={n.number} asChild>
                  <a href={`tel:${n.number.replace(/\s/g, "")}`}>
                    Call {n.label} {n.number}
                  </a>
                </Button>
              ))}
              {hospitalPhone.trim() ? (
                <Button asChild variant="outline">
                  <a href={`tel:${hospitalPhone.replace(/\s/g, "")}`}>
                    Call my hospital
                  </a>
                </Button>
              ) : null}
            </div>
            <Field id="preg-hospital" label="Your hospital or midwife number (optional)">
              <FieldInput
                id="preg-hospital"
                inputMode="tel"
                value={hospitalPhone}
                onChange={(e) => {
                  setHospitalPhone(e.target.value);
                  try {
                    localStorage.setItem(HOSPITAL_KEY, e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </Field>
          </div>
            </div>

          <form className={`${elevatedCardClass} lg:sticky lg:top-8 lg:max-h-[calc(100dvh-var(--header-height)-4rem)] lg:overflow-y-auto`} onSubmit={saveDay}>
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              Today’s log
            </h2>
            <p className={leadClass}>Mood (1–5)</p>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <Chip
                  key={n}
                  pressed={wellbeing === n}
                  onClick={() => setWellbeing(n)}
                  className="w-12"
                >
                  {n}
                </Chip>
              ))}
            </div>
            <p className={leadClass}>Nausea</p>
            <div className="flex flex-wrap gap-2">
              {([
                [0, "None"],
                [1, "Mild"],
                [2, "Moderate"],
                [3, "Strong"],
              ] as const).map(([n, label]) => (
                <Chip
                  key={n}
                  pressed={nausea === n}
                  onClick={() => setNausea(n)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <p className={leadClass}>Fatigue</p>
            <div className="flex flex-wrap gap-2">
              {([
                [0, "None"],
                [1, "Mild"],
                [2, "Moderate"],
                [3, "Strong"],
              ] as const).map(([n, label]) => (
                <Chip
                  key={n}
                  pressed={fatigue === n}
                  onClick={() => setFatigue(n)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <Field id="preg-sleep" label="Sleep (hours)">
              <FieldInput
                id="preg-sleep"
                type="number"
                step="0.5"
                min={0}
                max={24}
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
              />
            </Field>
            {week >= 20 ? (
              <div className="grid gap-2">
                <p className={leadClass}>Movement felt</p>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    pressed={movementFelt === true}
                    onClick={() => setMovementFelt(true)}
                  >
                    Felt as usual
                  </Chip>
                  <Chip
                    pressed={movementFelt === false}
                    onClick={() => setMovementFelt(false)}
                  >
                    Reduced
                  </Chip>
                </div>
                <p className={leadClass}>
                  If movement feels reduced, contact maternity triage or
                  emergency services. This log is not a clinical reading.
                </p>
              </div>
            ) : null}
            <Field id="preg-weight" label="Weight (kg)">
              <FieldInput
                id="preg-weight"
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
            <div className={formStackClass}>
              <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                Weight gain guide
              </h3>
              <p className={leadClass}>{PREGNANCY_WEIGHT_DISCLAIMER}</p>
              <Field id="preg-base-weight" label="Weight before pregnancy (kg)">
                <FieldInput
                  id="preg-base-weight"
                  type="number"
                  step="0.1"
                  value={baseWeight}
                  onChange={(e) => setBaseWeight(e.target.value)}
                />
              </Field>
              <Field
                id="preg-height"
                label="Height (cm)"
                hint="Optional. Used only to highlight one WHO BMI band."
              >
                <FieldInput
                  id="preg-height"
                  type="number"
                  step="1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !apiBaseUrl}
                onClick={() => {
                  void patchPregnancy({
                    prePregnancyWeightKg: baseWeight
                      ? Number(baseWeight)
                      : null,
                    heightCm: heightCm ? Number(heightCm) : null,
                  })
                    .then((res) => {
                      setPreg((p) => res.profile ?? p);
                    })
                    .catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not save baseline",
                      ),
                    );
                }}
              >
                Save baseline
              </Button>
            </div>
            {(() => {
              const bmi = bmiKgM2(Number(baseWeight), Number(heightCm));
              const band = whoBandForBmi(bmi);
              const latestW =
                weight ||
                [...pregDays].reverse().find((d) => d.weightKg != null)
                  ?.weightKg;
              const gain =
                baseWeight && latestW
                  ? Number(latestW) - Number(baseWeight)
                  : null;
              return (
                <ul className={listClass}>
                  {WHO_PREGNANCY_WEIGHT_GAIN.map((b) => (
                    <li
                      key={b.id}
                      className={listItemClass}
                    >
                      <strong className="text-foreground">
                        {b.label}
                        {band?.id === b.id ? " · your BMI band" : ""}
                      </strong>
                      <p className={leadClass}>
                        Guide: {b.gainMinKg}–{b.gainMaxKg} kg total across
                        pregnancy
                      </p>
                    </li>
                  ))}
                  <li className={listItemClass}>
                    Logged gain:{" "}
                    {gain != null && Number.isFinite(gain)
                      ? `${gain.toFixed(1)} kg from your baseline`
                      : "Add a baseline and today’s weight to see gain"}
                  </li>
                </ul>
              );
            })()}
            {week >= 24 ? (
              <div className="grid gap-3">
                <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                  Kick session
                </h3>
                <p className={leadClass}>
                  From week 24 you can time a movement session. If movements
                  feel reduced or stop, contact maternity triage or emergency
                  services. This timer is informational, not a clinical reading.
                </p>
                <p className={leadClass}>
                  {sessionOn
                    ? `Session ${Math.floor(sessionElapsed / 60)}:${String(sessionElapsed % 60).padStart(2, "0")} · kicks ${sessionKicks}`
                    : "No session running"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSessionOn(true);
                      setSessionStartedAt(Date.now());
                      setSessionKicks(0);
                      setSessionElapsed(0);
                    }}
                    disabled={sessionOn}
                  >
                    Start session
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSessionKicks((n) => n + 1)}
                    disabled={!sessionOn}
                  >
                    Count a kick
                  </Button>
                </div>
                <Field id="kicks" label="Kick count (day total)">
                  <FieldInput
                    id="kicks"
                    type="number"
                    min={0}
                    value={kicks}
                    onChange={(e) => setKicks(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <Button type="submit" disabled={busy}>
              Save day
            </Button>
          </form>
          </div>

          <form className={elevatedCardClass} onSubmit={addAppt}>
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              Appointments
            </h2>
            <Field id="appt-date" label="Date">
              <FieldInput
                id="appt-date"
                type="date"
                required
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
              />
            </Field>
            <Field id="appt-type" label="Type">
              <FieldSelect
                id="appt-type"
                value={apptType}
                onChange={(e) => setApptType(e.target.value)}
              >
                <option value="Antenatal">Antenatal</option>
                <option value="Scan">Scan</option>
                <option value="Blood test">Blood test</option>
                <option value="GP visit">GP visit</option>
                <option value="Midwife">Midwife</option>
                <option value="Clinic visit">Clinic visit</option>
                <option value="Government hospital">Government hospital</option>
              </FieldSelect>
            </Field>
            <Field id="appt-time" label="Time">
              <FieldInput
                id="appt-time"
                type="time"
                value={apptTime}
                onChange={(e) => setApptTime(e.target.value)}
              />
            </Field>
            <Field id="appt-location" label="Location">
              <FieldInput
                id="appt-location"
                value={apptLocation}
                onChange={(e) => setApptLocation(e.target.value)}
              />
            </Field>
            <Field id="appt-notes" label="Notes">
              <FieldInput
                id="appt-notes"
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Add appointment
            </Button>
          </form>
          <ul className={listClass}>
            {appts.map((a) => (
              <li key={a.id} className={listItemClass}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <strong className="block text-foreground">
                      {a.type} · {a.date}
                      {a.timeLocal ? ` · ${a.timeLocal}` : ""}
                    </strong>
                    <p className={leadClass}>
                      {a.location ? `${a.location} · ` : ""}
                      {a.notes ? `${a.notes} · ` : ""}
                      Reminders:{" "}
                      {[a.remindDayBefore && "1 day", a.remindHourBefore && "1 hour"]
                        .filter(Boolean)
                        .join(", ") || "off"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void deleteAppointment(a.id).then(() =>
                        setAppts((p) => p.filter((x) => x.id !== a.id)),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
