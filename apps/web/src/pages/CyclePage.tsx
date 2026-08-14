import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppPage } from "@/components/blocks/app-page";
import { CycleCalendar } from "@/components/blocks/cycle-calendar";
import { CycleDayLog } from "@/components/blocks/cycle-day-log";
import { PageHeader } from "@/components/blocks/page-header";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
  SuccessBanner,
} from "@/components/blocks/states";
import { Field, FieldInput } from "@/components/primitives/field";
import { PageTip } from "@/components/blocks/page-tip";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { useAlena } from "@/hooks/use-alena";
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
import { downloadText } from "../lib/download";
import { apiBaseUrl } from "../lib/config";
import {
  enqueueAndStore,
  flushOutbox,
  hydrateFromServer,
  loadLocalState,
  type CycleState,
} from "../lib/sync";
import symptoms from "../data/symptoms.json";
import { buildCycleMonthSummary } from "../../../../packages/domain/src/index";

type Symptom = {
  id: string;
  label: string;
  category: string;
  surfaces?: Array<"cycle" | "pmos">;
};

const CYCLE_SYMPTOMS = (symptoms as Symptom[]).filter(
  (s) => !s.surfaces || s.surfaces.includes("cycle"),
);

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

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
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

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function CyclePage() {
  const today = useMemo(() => new Date(), []);
  const { openAlena } = useAlena();
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [state, setState] = useState<CycleState | null>(null);
  const [selected, setSelected] = useState<string | null>(() =>
    isDesktop() ? ymd(new Date()) : null,
  );
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
  const [dirty, setDirty] = useState(false);

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

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    openDay(ymd(today));
  }

  function fillForm(date: string) {
    const existing = dayLogs.get(date);
    setFlow(existing?.flow ?? (logged.has(date) ? "medium" : "none"));
    setMood(existing?.mood ?? null);
    setSymptomIds(existing?.symptomIds ?? []);
    setNote(existing?.note ?? "");
    setDirty(false);
  }

  function openDay(date: string) {
    setSelected(date);
    setOk(null);
    fillForm(date);
  }

  useEffect(() => {
    if (!state || !selected || dirty || busy) return;
    fillForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selected]);

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
      if (!isDesktop()) setSelected(null);
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
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
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
  const monthSummary = buildCycleMonthSummary({
    year: viewYear,
    monthIndex: viewMonth,
    cycles: (state?.cycles ?? []).map((c) => ({
      startDate: c.startDate,
      endDate: c.endDate,
    })),
    days: (state?.days ?? []).map((d) => ({
      date: d.date,
      flow: d.flow,
      mood: d.mood,
      symptomIds: d.symptomIds,
    })),
    symptomLabels: Object.fromEntries(CYCLE_SYMPTOMS.map((s) => [s.id, s.label])),
  });
  const empty =
    state !== null &&
    (state.cycles?.length ?? 0) === 0 &&
    (state.days?.length ?? 0) === 0;

  const statusLine = state?.pendingCount
    ? `${state.pendingCount} change(s) waiting to sync`
    : online
      ? "Synced"
      : "Offline. Logging locally";

  const stats = [
    {
      label: "Average cycle",
      value:
        monthSummary.averageCycleLength != null
          ? `${monthSummary.averageCycleLength} days`
          : "Need two periods",
    },
    {
      label: "Average period",
      value:
        monthSummary.averagePeriodLength != null
          ? `${monthSummary.averagePeriodLength} days`
          : "Need two periods",
    },
    {
      label: "Days logged",
      value: String(monthDays.length),
    },
  ];

  const calendar = state === null ? null : (
    <CycleCalendar
      monthTitle={monthLabel(viewYear, viewMonth)}
      cells={cells}
      viewMonth={viewMonth}
      todayKey={ymd(today)}
      selected={selected}
      logged={logged}
      predicted={predicted}
      fertileDates={fertileDates}
      ovulationDay={ovulationDay}
      dayLogs={new Set(dayLogs.keys())}
      ttcOn={ttcOn}
      canPrev={canShift(-1)}
      canNext={canShift(1)}
      onPrev={() => shiftMonth(-1)}
      onNext={() => shiftMonth(1)}
      onToday={goToday}
      onSelect={openDay}
    />
  );

  const dayLog = selected ? (
    <CycleDayLog
      dateLabel={formatDayLabel(selected)}
      flow={flow}
      mood={mood}
      symptomIds={symptomIds}
      note={note}
      symptoms={CYCLE_SYMPTOMS}
      busy={busy}
      showCancel={!isDesktop()}
      onFlow={(value) => {
        setDirty(true);
        setFlow(value);
      }}
      onMood={(value) => {
        setDirty(true);
        setMood(value);
      }}
      onToggleSymptom={(id) => {
        setDirty(true);
        setSymptomIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
      }}
      onNote={(value) => {
        setDirty(true);
        setNote(value);
      }}
      onSave={() => void saveDay()}
      onCancel={() => {
        if (isDesktop() && selected) {
          fillForm(selected);
          return;
        }
        setSelected(null);
      }}
      onAskAlena={() => openAlena({ from: "cycle" })}
    />
  ) : null;

  const summaryBody = (
    <div className="grid gap-2 text-[length:var(--text-body)] text-muted-foreground">
      <span>
        Most common symptoms:{" "}
        {monthSummary.mostCommonSymptoms.length
          ? monthSummary.mostCommonSymptoms
              .map((s) => `${s.label} (${s.count})`)
              .join(", ")
          : "None this month"}
      </span>
      <span>{monthSummary.moodPattern}</span>
      <PredictionDisclaimer message="This is a wellness estimate, not medical advice. Consult a healthcare provider for diagnosis." />
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          downloadText(
            `girlcode360-cycle-${monthSummary.monthKey}.txt`,
            monthSummary.text,
          )
        }
      >
        <Download className="size-4" aria-hidden />
        Download summary
      </Button>
    </div>
  );

  return (
    <AppPage className="lg:max-w-[var(--shell-max)] lg:gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Cycle"
          lead="Select a day to log flow, mood, and symptoms. Predictions are estimates, not a diagnosis."
        />
        {periodOn ? (
          <div className="flex flex-wrap items-center gap-2">
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
              variant="ghost"
              onClick={() => void flushOutbox().then((s) => s && setState(s))}
            >
              <RefreshCw className="size-4" aria-hidden />
              Sync now
            </Button>
          </div>
        ) : null}
      </div>

      <PageTip id="cycle" />

      {periodBanner ||
      (dayLogs.get(ymd(today))?.flow &&
        dayLogs.get(ymd(today))!.flow !== "none") ? (
        <SheMatchBanner trigger="period_start" />
      ) : null}
      {ttcOn && fertileDates.has(ymd(today)) ? (
        <SheMatchBanner trigger="fertile_window" />
      ) : null}

      {!periodOn ? (
        <EmptyState
          title="Period Tracker is off"
          body="Turn it on in Account to log flow, mood, and symptoms. This is optional. Other modules stay as you left them."
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

          {state === null ? (
            <div
              className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]"
              aria-busy="true"
              aria-label="Loading calendar"
            >
              <SkeletonBlock className="h-96 rounded-[var(--radius-sheet)]" />
              <SkeletonBlock className="hidden h-96 rounded-[var(--radius-sheet)] lg:block" />
            </div>
          ) : (
            <>
              {empty && !selected ? (
                <EmptyState
                  title="Log your first day"
                  body="Select a date, or start a period today. Logging stays on this device until you sync."
                  action={
                    <Button
                      type="button"
                      onClick={() => void startPeriodToday()}
                    >
                      Start period
                    </Button>
                  }
                />
              ) : null}

              <div className="hidden grid-cols-3 gap-4 lg:grid">
                {stats.map((s) => (
                  <article
                    key={s.label}
                    className="grid gap-1 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)]"
                  >
                    <p className="m-0 text-[length:var(--text-caption)] font-semibold text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="m-0 text-[length:var(--text-sub)] font-semibold text-foreground">
                      {s.value}
                    </p>
                  </article>
                ))}
              </div>

              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)] lg:gap-8">
                <div className="grid gap-6">
                  {calendar}
                  <details className="rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)] lg:p-6">
                    <summary className="cursor-pointer text-[length:var(--text-label)] font-semibold text-foreground">
                      Correct cycle length
                    </summary>
                    <div className="mt-4">
                      <Field
                        id="cycle-len"
                        label="Length in days"
                        hint="Use this if a logged cycle was not typical for you. 15 to 60."
                      >
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
                    </div>
                  </details>
                </div>

                <div className={cn(!selected && "max-lg:hidden")}>
                  {dayLog ?? (
                    <p className="m-0 hidden rounded-[var(--radius-sheet)] bg-card p-6 text-[length:var(--text-body)] text-muted-foreground shadow-[var(--shadow-2)] lg:block">
                      Select a day to log flow, mood, and symptoms.
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSummary((s) => !s)}
                >
                  {showSummary ? "Hide summary" : "Month summary"}
                </Button>
                {showSummary ? (
                  <div className="mt-4 grid gap-4 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)]">
                    <strong className="text-foreground">
                      {monthLabel(viewYear, viewMonth)}
                    </strong>
                    {stats.map((s) => (
                      <span key={s.label} className="text-muted-foreground">
                        {s.label}: {s.value}
                      </span>
                    ))}
                    {summaryBody}
                  </div>
                ) : null}
              </div>

              <details className="hidden rounded-[var(--radius-sheet)] bg-card p-6 shadow-[var(--shadow-2)] lg:block">
                <summary className="cursor-pointer text-[length:var(--text-label)] font-semibold text-foreground">
                  Month notes
                </summary>
                <div className="mt-4">{summaryBody}</div>
              </details>
            </>
          )}
        </>
      ) : null}
    </AppPage>
  );
}
