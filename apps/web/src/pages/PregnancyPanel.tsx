import { useEffect, useState, type FormEvent } from "react";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import type {
  Appointment,
  HealthModule,
  PregnancyProfile,
  UserProfile,
  WeekContent,
} from "../../../../packages/api-types/src/index";
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  getPregnancy,
  getPregnancyWeek,
  initPregnancy,
  patchModules,
  upsertPregnancyDay,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import weeksLocal from "../data/pregnancy-weeks.json";
import {
  calculateEdd,
  gestationalWeek,
} from "../../../../packages/domain/src/index";

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
  const [weight, setWeight] = useState("");
  const [kicks, setKicks] = useState("");

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
    } catch {
      /* not started */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, profile?.sub]);

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
        kicks: kicks ? Number(kicks) : null,
      });
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
      <div className="health-section">
        <h2>Pregnancy</h2>
        <p className="health-lead">
          Track weeks, appointments, and wellbeing. Content is wellness guidance —
          not medical advice.
        </p>
        <button type="button" className="primary" onClick={enable} disabled={busy}>
          Enable Pregnancy
        </button>
      </div>
    );
  }

  return (
    <div className="health-section">
      <h2>Pregnancy</h2>
      {!preg ? (
        <form className="health-form" onSubmit={start}>
          <label>
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "lmp" | "conception")}
            >
              <option value="lmp">Last menstrual period (LMP)</option>
              <option value="conception">Conception date</option>
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              required
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            Calculate EDD
          </button>
        </form>
      ) : (
        <>
          <p className="health-lead">
            Week {week} · EDD {preg.edd} (range {preg.eddEarly} – {preg.eddLate})
          </p>
          <PredictionDisclaimer message="EDD is an estimate (Naegele ±1 week). Your clinician confirms dating." />
          {weekContent ? (
            <ul className="insight-list">
              <li>
                <strong>{weekContent.title}</strong>
                <p>Baby: {weekContent.baby}</p>
                <p>You: {weekContent.maternal}</p>
                <p>Nutrition: {weekContent.nutrition}</p>
              </li>
            </ul>
          ) : null}

          <h2>Today’s log</h2>
          <form className="health-form" onSubmit={saveDay}>
            <div className="stress-row">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={wellbeing === n ? "on" : ""}
                  onClick={() => setWellbeing(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <label>
              Weight (kg)
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
            {week >= 24 ? (
              <label>
                Kick count
                <input
                  type="number"
                  min={0}
                  value={kicks}
                  onChange={(e) => setKicks(e.target.value)}
                />
              </label>
            ) : null}
            <button type="submit" className="primary" disabled={busy}>
              Save day
            </button>
          </form>

          <h2>Appointments</h2>
          <form className="health-form" onSubmit={addAppt}>
            <label>
              Date
              <input
                type="date"
                required
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
              />
            </label>
            <label>
              Type
              <input
                value={apptType}
                onChange={(e) => setApptType(e.target.value)}
              />
            </label>
            <button type="submit" className="primary" disabled={busy}>
              Add appointment
            </button>
          </form>
          <ul className="med-list">
            {appts.map((a) => (
              <li key={a.id}>
                <div className="row">
                  <div>
                    <strong>
                      {a.type} · {a.date}
                    </strong>
                    <p>
                      Reminders:{" "}
                      {[a.remindDayBefore && "1 day", a.remindHourBefore && "1 hour"]
                        .filter(Boolean)
                        .join(", ") || "off"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteAppointment(a.id).then(() =>
                        setAppts((p) => p.filter((x) => x.id !== a.id)),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
