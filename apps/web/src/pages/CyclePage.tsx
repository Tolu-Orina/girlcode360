import { useEffect, useMemo, useState } from "react";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import type {
  Cycle,
  CycleDay,
  FlowLevel,
  MoodLevel,
  PredictionResponse,
} from "../../../../packages/api-types/src/index";
import { ApiError, getCycles, getFertileWindow, getMe } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import {
  enqueueAndStore,
  flushOutbox,
  hydrateFromServer,
  loadLocalState,
  type CycleState,
} from "../lib/sync";
import symptoms from "../data/symptoms.json";
import "./cycle.css";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FLOW_OPTIONS: FlowLevel[] = [
  "none",
  "spotting",
  "light",
  "medium",
  "heavy",
];
const MOOD_LABELS = ["", "Low", "Meh", "OK", "Good", "Great"];

type Symptom = { id: string; label: string; category: string };

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function buildMonthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function loggedPeriodDates(cycles: Cycle[]): Set<string> {
  const set = new Set<string>();
  for (const c of cycles) {
    const end = c.endDate ?? c.startDate;
    const cur = new Date(c.startDate + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (cur <= last) {
      set.add(ymd(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return set;
}

export function CyclePage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [state, setState] = useState<CycleState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [flow, setFlow] = useState<FlowLevel>("none");
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [symptomIds, setSymptomIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [overrideLen, setOverrideLen] = useState("");
  const [fertileDates, setFertileDates] = useState<Set<string>>(new Set());
  const [ovulationDay, setOvulationDay] = useState<string | null>(null);
  const [ttcOn, setTtcOn] = useState(false);
  const [fertileMessage, setFertileMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalState();
      if (!cancelled) setState(local);
      try {
        const remote = await getCycles();
        if (cancelled) return;
        const next = await hydrateFromServer(remote);
        setState(next);
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.code === "api_base_url_missing")) {
          await flushOutbox();
          setState(await loadLocalState());
        }
      }
      try {
        if (!apiBaseUrl) return;
        const me = await getMe();
        if (cancelled) return;
        if (me.modules.includes("ttc")) {
          setTtcOn(true);
          const fw = await getFertileWindow();
          if (cancelled) return;
          setFertileDates(new Set(fw.fertileDates));
          setOvulationDay(fw.ovulationDay || null);
          setFertileMessage(fw.message);
        }
      } catch {
        /* TTC optional */
      }
    })();

    const onOnline = () => {
      void flushOutbox().then((s) => s && setState(s));
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const minMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [today]);
  const maxMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 6, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [today]);

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const logged = useMemo(
    () => loggedPeriodDates(state?.cycles ?? []),
    [state?.cycles],
  );
  const predicted = useMemo(
    () => new Set(state?.prediction.predictedDates ?? []),
    [state?.prediction],
  );
  const dayLogs = useMemo(() => {
    const map = new Map<string, CycleDay>();
    for (const d of state?.days ?? []) map.set(d.date, d);
    return map;
  }, [state?.days]);

  function canShift(delta: number): boolean {
    const d = new Date(viewYear, viewMonth + delta, 1);
    const key = d.getFullYear() * 12 + d.getMonth();
    const min = minMonth.y * 12 + minMonth.m;
    const max = maxMonth.y * 12 + maxMonth.m;
    return key >= min && key <= max;
  }

  function shiftMonth(delta: number) {
    if (!canShift(delta)) return;
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function openDay(date: string) {
    setSelected(date);
    const existing = dayLogs.get(date);
    setFlow(existing?.flow ?? (logged.has(date) ? "medium" : "none"));
    setMood(existing?.mood ?? null);
    setSymptomIds(existing?.symptomIds ?? []);
    setNote(existing?.note ?? "");
  }

  async function saveDay() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const next = await enqueueAndStore({
        op: "upsert_day",
        day: {
          date: selected,
          flow,
          mood,
          symptomIds,
          note: note.trim() || null,
        },
      });

      // Auto-open/close cycles from flow
      if (flow !== "none" && !logged.has(selected)) {
        const withPeriod = await enqueueAndStore({
          op: "upsert_cycle",
          cycle: { startDate: selected, endDate: selected },
        });
        setState(withPeriod);
      } else if (flow !== "none") {
        // Extend latest open cycle end date if this day is after start
        const cycles = next.cycles;
        const open = [...cycles].reverse().find((c) => !c.endDate || c.endDate >= c.startDate);
        if (open && selected >= open.startDate) {
          const patched = await enqueueAndStore({
            op: "patch_cycle",
            id: open.id,
            patch: { endDate: selected },
          });
          setState(patched);
        } else {
          setState(next);
        }
      } else {
        setState(next);
      }
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save day");
    } finally {
      setBusy(false);
    }
  }

  async function startPeriodToday() {
    const date = ymd(today);
    setBusy(true);
    setError(null);
    try {
      const next = await enqueueAndStore({
        op: "upsert_cycle",
        cycle: { startDate: date, endDate: date },
      });
      const withDay = await enqueueAndStore({
        op: "upsert_day",
        day: { date, flow: "medium" },
      });
      setState({ ...withDay, prediction: next.prediction });
      openDay(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start period");
    } finally {
      setBusy(false);
    }
  }

  async function applyOverride() {
    const n = Number(overrideLen);
    if (!Number.isFinite(n) || n < 15 || n > 60) {
      setError("Cycle length override must be between 15 and 60 days.");
      return;
    }
    const latest = state?.cycles[state.cycles.length - 1];
    if (!latest) {
      setError("Log a period first, then correct the cycle length.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await enqueueAndStore({
        op: "patch_cycle",
        id: latest.id,
        patch: { cycleLengthOverride: n },
      });
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save override");
    } finally {
      setBusy(false);
    }
  }

  const prediction: PredictionResponse | undefined = state?.prediction;
  const monthDays = (state?.days ?? []).filter((d) =>
    d.date.startsWith(
      `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`,
    ),
  );

  return (
    <section className="cycle-page">
      <h1>Cycle</h1>
      <p className="cycle-status">
        {state?.pendingCount
          ? `${state.pendingCount} change(s) waiting to sync`
          : navigator.onLine
            ? "Synced"
            : "Offline — logging locally"}
      </p>

      {prediction ? (
        <PredictionDisclaimer message={prediction.message} />
      ) : null}
      {ttcOn && fertileMessage ? (
        <PredictionDisclaimer message={fertileMessage} />
      ) : null}

      <div className="cycle-actions">
        <button type="button" className="primary" onClick={startPeriodToday} disabled={busy}>
          Log period start
        </button>
        <button type="button" onClick={() => setShowSummary((s) => !s)}>
          {showSummary ? "Hide summary" : "Month summary"}
        </button>
        <button
          type="button"
          onClick={() => void flushOutbox().then((s) => s && setState(s))}
        >
          Sync now
        </button>
      </div>

      {showSummary ? (
        <div className="summary-panel">
          <strong>{monthLabel(viewYear, viewMonth)}</strong>
          <span>Days logged: {monthDays.length}</span>
          <span>
            Symptom entries:{" "}
            {monthDays.reduce((n, d) => n + d.symptomIds.length, 0)}
          </span>
          <span>
            Next predicted start:{" "}
            {prediction?.nextStarts[0] ?? "Need ≥2 cycles"}
            {prediction?.enoughData
              ? ` (±${prediction.confidenceBandDays}d)`
              : ""}
          </span>
        </div>
      ) : null}

      <div className="cycle-toolbar">
        <h2>{monthLabel(viewYear, viewMonth)}</h2>
        <div className="cycle-nav">
          <button type="button" disabled={!canShift(-1)} onClick={() => shiftMonth(-1)}>
            Prev
          </button>
          <button type="button" disabled={!canShift(1)} onClick={() => shiftMonth(1)}>
            Next
          </button>
        </div>
      </div>

      <div className="calendar-grid" role="grid" aria-label="Cycle calendar">
        {DOW.map((d) => (
          <div key={d} className="calendar-dow">
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const date = ymd(d);
          const inMonth = d.getMonth() === viewMonth;
          const isToday = date === ymd(today);
          const isLogged = logged.has(date);
          const isPredicted = !isLogged && predicted.has(date);
          const isFertile =
            ttcOn && !isLogged && fertileDates.has(date);
          const isOvulation = ttcOn && ovulationDay === date;
          const hasLog = dayLogs.has(date);
          const cls = [
            "calendar-cell",
            inMonth ? "" : "muted",
            isToday ? "today" : "",
            isLogged ? "logged" : "",
            isPredicted ? "predicted" : "",
            isFertile ? "fertile" : "",
            isOvulation ? "ovulation" : "",
            hasLog ? "has-log" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={date}
              type="button"
              className={cls}
              onClick={() => openDay(date)}
              aria-label={date}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <i className="legend-swatch logged" /> Logged period
        </span>
        <span>
          <i className="legend-swatch predicted" /> Predicted
        </span>
        {ttcOn ? (
          <>
            <span>
              <i className="legend-swatch fertile" /> Fertile (est.)
            </span>
            <span>
              <i className="legend-swatch ovulation" /> Ovulation (est.)
            </span>
          </>
        ) : null}
      </div>

      <label>
        Correct cycle length (days)
        <div className="cycle-actions">
          <input
            type="number"
            min={15}
            max={60}
            value={overrideLen}
            onChange={(e) => setOverrideLen(e.target.value)}
            placeholder={
              prediction?.cycleLengthDays
                ? String(prediction.cycleLengthDays)
                : "28"
            }
            style={{
              padding: "0.55rem 0.65rem",
              border: "1px solid #d9ccd4",
              borderRadius: "0.4rem",
              width: "5rem",
            }}
          />
          <button type="button" onClick={applyOverride} disabled={busy}>
            Apply
          </button>
        </div>
      </label>

      {error ? <p className="auth-error">{error}</p> : null}

      {selected ? (
        <div className="day-sheet">
          <h3>{selected}</h3>
          <label>
            Flow
            <select
              value={flow}
              onChange={(e) => setFlow(e.target.value as FlowLevel)}
            >
              {FLOW_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>Mood</p>
            <div className="mood-row">
              {([1, 2, 3, 4, 5] as MoodLevel[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mood === m ? "on" : ""}
                  onClick={() => setMood(m)}
                >
                  {MOOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>
              Symptoms
            </p>
            <div className="symptom-chips">
              {(symptoms as Symptom[]).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={symptomIds.includes(s.id) ? "on" : ""}
                  onClick={() =>
                    setSymptomIds((prev) =>
                      prev.includes(s.id)
                        ? prev.filter((x) => x !== s.id)
                        : [...prev, s.id],
                    )
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            Note
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <div className="cycle-actions">
            <button type="button" className="primary" onClick={saveDay} disabled={busy}>
              {busy ? "Saving…" : "Save day"}
            </button>
            <button type="button" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
