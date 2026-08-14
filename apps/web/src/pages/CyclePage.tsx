import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionRow,
  AppPage,
  formStackClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { AskAlenaLink } from "@/components/blocks/ask-alena-link";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
  SuccessBanner,
} from "@/components/blocks/states";
import { Chip } from "@/components/primitives/chip";
import {
  Field,
  FieldInput,
  FieldSelect,
  FieldTextarea,
} from "@/components/primitives/field";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
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

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FLOW_OPTIONS: FlowLevel[] = [
  "none",
  "spotting",
  "light",
  "medium",
  "heavy",
];

type Symptom = {
  id: string;
  label: string;
  category: string;
  surfaces?: Array<"cycle" | "pmos">;
};

const CYCLE_SYMPTOMS = (symptoms as Symptom[]).filter(
  (s) => !s.surfaces || s.surfaces.includes("cycle"),
);

const MOODS: { level: MoodLevel; label: string; emoji: string }[] = [
  { level: 1, label: "Low", emoji: "\uD83D\uDE14" },
  { level: 2, label: "Meh", emoji: "\uD83D\uDE15" },
  { level: 3, label: "OK", emoji: "\uD83D\uDE10" },
  { level: 4, label: "Good", emoji: "\uD83D\uDE42" },
  { level: 5, label: "Great", emoji: "\uD83D\uDE0A" },
];

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
  const startOffset = (first.getDay() + 6) % 7;
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
  const [ok, setOk] = useState<string | null>(null);
  const online = useOnline();

  const [flow, setFlow] = useState<FlowLevel>("none");
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [symptomIds, setSymptomIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [overrideLen, setOverrideLen] = useState("");
  const [fertileDates, setFertileDates] = useState<Set<string>>(new Set());
  const [ovulationDay, setOvulationDay] = useState<string | null>(null);
  const [ttcOn, setTtcOn] = useState(false);
  const [periodOn, setPeriodOn] = useState(true);
  const [fertileMessage, setFertileMessage] = useState<string | null>(null);
  const [periodBanner, setPeriodBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalState();
      if (!cancelled) setState(local);
      try {
        await flushOutbox();
        if (cancelled) return;
        const remote = await getCycles();
        if (cancelled) return;
        const next = await hydrateFromServer(remote);
        setState(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.code === "api_base_url_missing")) {
          await flushOutbox();
          setState(await loadLocalState());
          setError("Could not sync. Logs on this device are still here.");
        }
      }
      try {
        if (!apiBaseUrl) return;
        const me = await getMe();
        if (cancelled) return;
        setPeriodOn(me.modules.includes("period_tracker"));
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
    setOk(null);
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
    setOk(null);
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

      if (flow !== "none" && !logged.has(selected)) {
        const withPeriod = await enqueueAndStore({
          op: "upsert_cycle",
          cycle: { startDate: selected, endDate: selected },
        });
        setState(withPeriod);
      } else if (flow !== "none") {
        const cycles = next.cycles;
        const open = [...cycles]
          .reverse()
          .find((c) => !c.endDate || c.endDate >= c.startDate);
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
      setOk("Day saved.");
      if (flow !== "none") setPeriodBanner(true);
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
      setPeriodBanner(true);
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
      setOk("Cycle length updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save override");
    } finally {
      setBusy(false);
    }
  }

  const prediction: PredictionResponse | undefined = state?.prediction;
  const monthDays = (state?.days ?? []).filter((d) =>
    d.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`),
  );
  const empty =
    state !== null &&
    (state.cycles?.length ?? 0) === 0 &&
    (state.days?.length ?? 0) === 0;

  const statusLine = state?.pendingCount
    ? `${state.pendingCount} change(s) waiting to sync`
    : online
      ? "Synced"
      : "Offline. Logging locally";

  return (
    <AppPage>
      <PageHeader
        eyebrow="Cycle"
        title="Log today"
        lead="See the month, then save the day you tap. Predictions are estimates, not a diagnosis."
      />
      <AskAlenaLink from="cycle" />
      {periodBanner || (dayLogs.get(ymd(today))?.flow && dayLogs.get(ymd(today))!.flow !== "none") ? (
        <SheMatchBanner trigger="period_start" />
      ) : null}
      {ttcOn && fertileDates.has(ymd(today)) ? (
        <SheMatchBanner trigger="fertile_window" />
      ) : null}

      {!periodOn ? (
        <EmptyState
          title="Period Tracker is off"
          body="Turn it on in Account to log flow, mood, and symptoms. This is optional — other modules stay as you left them."
          action={
            <Button asChild>
              <Link to="/app/account">Open Account</Link>
            </Button>
          }
        />
      ) : null}

      {periodOn ? (
      <>
      <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
        {statusLine}
      </p>

      {!online ? <OfflineBanner /> : null}
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() =>
            void flushOutbox().then((s) => {
              if (s) setState(s);
              setError(null);
            })
          }
        />
      ) : null}
      {ok ? <SuccessBanner message={ok} /> : null}

      {prediction ? (
        <PredictionDisclaimer message={prediction.message} />
      ) : null}
      {ttcOn && fertileMessage ? (
        <PredictionDisclaimer message={fertileMessage} />
      ) : null}

      <ActionRow>
        <Button
          type="button"
          variant="outline"
          onClick={() => void startPeriodToday()}
          disabled={busy}
        >
          Start period
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSummary((s) => !s)}
        >
          {showSummary ? "Hide summary" : "Month summary"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void flushOutbox().then((s) => s && setState(s))}
        >
          Sync now
        </Button>
      </ActionRow>

      {showSummary ? (
        <div className={cn(outlinedCardClass, "grid gap-2 text-[length:var(--text-body)] text-muted-foreground")}>
          <strong className="text-foreground">
            {monthLabel(viewYear, viewMonth)}
          </strong>
          <span>Days logged: {monthDays.length}</span>
          <span>
            Symptom entries:{" "}
            {monthDays.reduce((n, d) => n + d.symptomIds.length, 0)}
          </span>
          <span>
            Next predicted start: {prediction?.nextStarts[0] ?? "Need ≥2 cycles"}
            {prediction?.enoughData
              ? ` (±${prediction.confidenceBandDays}d)`
              : ""}
          </span>
        </div>
      ) : null}

      {state === null ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading calendar">
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-64" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              {monthLabel(viewYear, viewMonth)}
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canShift(-1)}
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canShift(1)}
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight className="size-6" />
              </Button>
            </div>
          </div>

          {empty && !selected ? (
            <EmptyState
              title="Log your first day"
              body="Tap a date, or start a period today. Logging stays on this device until you sync."
              action={
                <Button type="button" onClick={() => void startPeriodToday()}>
                  Start period
                </Button>
              }
            />
          ) : null}

          <div
            className="grid grid-cols-7 gap-1"
            role="grid"
            aria-label="Cycle calendar"
          >
            {DOW.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[length:var(--text-caption)] tracking-wide text-muted-foreground uppercase"
              >
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const date = ymd(d);
              const inMonth = d.getMonth() === viewMonth;
              const isToday = date === ymd(today);
              const isLogged = logged.has(date);
              const isPredicted = !isLogged && predicted.has(date);
              const isFertile = ttcOn && !isLogged && fertileDates.has(date);
              const isOvulation = ttcOn && ovulationDay === date;
              const hasLog = dayLogs.has(date);
              const isSelected = selected === date;
              const bits = [
                isLogged ? "logged period" : null,
                isPredicted ? "predicted" : null,
                isFertile ? "fertile estimate" : null,
                isOvulation ? "ovulation estimate" : null,
                hasLog ? "has notes" : null,
                isSelected ? "selected" : null,
              ].filter(Boolean);
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${date}${bits.length ? `, ${bits.join(", ")}` : ""}`}
                  className={cn(
                    "relative grid min-h-12 place-items-center rounded-[var(--radius)] text-[length:var(--text-label)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !inMonth && "text-muted-foreground/60",
                    isToday && "font-bold",
                    isLogged && "bg-primary text-primary-foreground",
                    isPredicted && "border border-dashed border-primary text-primary",
                    isFertile && "underline decoration-ok decoration-2 underline-offset-4",
                    isOvulation && "ring-2 ring-ok",
                    isSelected && "ring-2 ring-foreground",
                  )}
                  onClick={() => openDay(date)}
                >
                  {d.getDate()}
                  {hasLog ? (
                    <span
                      className="absolute bottom-1 size-1 rounded-full bg-current"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-[length:var(--text-caption)] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <i className="inline-block size-3 rounded-sm bg-primary" aria-hidden />
              Logged period (filled)
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="inline-block size-3 rounded-sm border border-dashed border-primary" aria-hidden />
              Predicted (dashed)
            </span>
            {ttcOn ? (
              <>
                <span className="inline-flex items-center gap-2">
                  <i className="inline-block size-3 rounded-sm border-b-2 border-ok" aria-hidden />
                  Fertile, estimate (underline)
                </span>
                <span className="inline-flex items-center gap-2">
                  <i className="inline-block size-3 rounded-sm ring-2 ring-ok" aria-hidden />
                  Ovulation, estimate (ring)
                </span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-2">
              <i className="inline-block size-3 rounded-sm ring-2 ring-foreground" aria-hidden />
              Selected (dark ring)
            </span>
          </div>
        </>
      )}

      <Field id="cycle-len" label="Correct cycle length (days)">
        <div className="flex flex-wrap items-center gap-2">
          <FieldInput
            id="cycle-len"
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
            className="w-24"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void applyOverride()}
            disabled={busy}
          >
            Apply
          </Button>
        </div>
      </Field>

      {selected ? (
        <div className={cn(outlinedCardClass, formStackClass)}>
          <h3 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-sub)] text-primary">
            {selected}
          </h3>
          <Field id="flow" label="Flow">
            <FieldSelect
              id="flow"
              value={flow}
              onChange={(e) => setFlow(e.target.value as FlowLevel)}
            >
              {FLOW_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <div className="grid gap-2">
            <p className="m-0 text-[length:var(--text-label)] font-medium">Mood</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <Chip
                  key={m.level}
                  pressed={mood === m.level}
                  onClick={() => setMood(m.level)}
                  className="flex-1"
                  aria-label={`Mood ${m.label}`}
                >
                  <span aria-hidden="true">{m.emoji}</span> {m.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="m-0 text-[length:var(--text-label)] font-medium">
              Symptoms
            </p>
            <div className="flex flex-wrap gap-2">
              {(CYCLE_SYMPTOMS as Symptom[]).map((s) => (
                <Chip
                  key={s.id}
                  pressed={symptomIds.includes(s.id)}
                  onClick={() =>
                    setSymptomIds((prev) =>
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
          </div>

          <Field id="note" label="Note" hint="Optional">
            <FieldTextarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <ActionRow>
            <Button
              type="button"
              onClick={() => void saveDay()}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save this day"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
          </ActionRow>
        </div>
      ) : null}
      </>
      ) : null}

    </AppPage>
  );
}
