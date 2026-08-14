import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SkeletonBlock } from "@/components/blocks/states";
import { loadLocalState, type CycleState } from "@/lib/sync";
import { cn } from "@/lib/utils";
import type { Cycle, CycleDay } from "../../../../../packages/api-types/src/index";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const PRIMARY = "#b0126a";
const MUTED_SLICE = "#f0c4db";
const REST_SLICE = "#f5e0ec";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    const cur = new Date(`${c.startDate}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    while (cur <= last) {
      set.add(ymd(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return set;
}

function cycleLengths(cycles: Cycle[]): { cycle: string; days: number }[] {
  const starts = [...cycles]
    .map((c) => c.startDate)
    .sort((a, b) => a.localeCompare(b));
  const rows: { cycle: string; days: number }[] = [];
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(`${starts[i - 1]}T00:00:00`);
    const b = new Date(`${starts[i]}T00:00:00`);
    const days = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (days > 0 && days < 90) {
      rows.push({ cycle: `${rows.length + 1}`, days });
    }
  }
  return rows.slice(-6);
}

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-`;
}

function pieSlices(
  period: Set<string>,
  days: CycleDay[],
  year: number,
  month: number,
): {
  slices: { name: string; value: number; fill: string }[];
  hasLogs: boolean;
} {
  const prefix = monthPrefix(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let periodCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${prefix}${String(d).padStart(2, "0")}`;
    if (period.has(key)) periodCount += 1;
  }
  const otherLogged = days.filter(
    (day) => day.date.startsWith(prefix) && !period.has(day.date),
  ).length;
  const quiet = Math.max(0, daysInMonth - periodCount - otherLogged);
  const slices = [
    { name: "Period", value: periodCount, fill: PRIMARY },
    { name: "Other logs", value: otherLogged, fill: MUTED_SLICE },
    { name: "No log", value: quiet, fill: REST_SLICE },
  ].filter((s) => s.value > 0);
  return { slices, hasLogs: periodCount + otherLogged > 0 };
}

const cardClass =
  "grid gap-3 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)]";

export function HomeOverview() {
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const [state, setState] = useState<CycleState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadLocalState().then((s) => {
      if (!cancelled) {
        setState(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="grid grid-cols-1 gap-6"
        aria-busy="true"
        aria-label="Loading overview"
      >
        <SkeletonBlock className="h-72 rounded-[var(--radius-sheet)]" />
      </div>
    );
  }

  const cycles = state?.cycles ?? [];
  const days = state?.days ?? [];
  const period = loggedPeriodDates(cycles);
  const lengths = cycleLengths(cycles);
  const cells = buildMonthCells(year, month);
  const monthName = today.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const pie = pieSlices(period, days, year, month);
  const slices = pie.slices;
  const showBar = lengths.length > 0;
  const showPie = pie.hasLogs;
  const chartCount = 1 + (showBar ? 1 : 0) + (showPie ? 1 : 0);
  const todayKey = ymd(today);

  return (
    <section
      aria-label="This month"
      className={cn(
        "grid grid-cols-1 gap-6",
        chartCount === 2 && "lg:grid-cols-2",
        chartCount === 3 && "lg:grid-cols-3",
      )}
    >
      <article className="glass-gloss grid gap-3 rounded-[var(--radius-sheet)] p-4">
        <h2 className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
          {monthName}
        </h2>
        <div
          className="grid grid-cols-7 gap-1"
          role="grid"
          aria-label={`Logged period days in ${monthName}`}
        >
          {DOW.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center text-[length:var(--text-caption)] font-semibold text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((d) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === month;
            const isToday = key === todayKey;
            const isPeriod = inMonth && period.has(key);
            return (
              <span
                key={key}
                role="gridcell"
                aria-label={`${key}${isPeriod ? ", period logged" : ""}`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-[var(--radius)] text-[length:var(--text-caption)]",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && "text-foreground",
                  isPeriod && "bg-primary font-semibold text-primary-foreground",
                  isToday && !isPeriod && "font-bold ring-2 ring-ring",
                )}
              >
                {d.getDate()}
              </span>
            );
          })}
        </div>
      </article>

      {showBar ? (
      <article className={cardClass}>
        <h2 className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
          Cycle length
        </h2>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lengths}
                  margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="cycle"
                    tick={{ fill: "#6b4a58", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    allowDecimals={false}
                    tick={{ fill: "#6b4a58", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(176, 18, 106, 0.08)" }}
                    formatter={(value) => [`${value as number} days`, "Length"]}
                    labelFormatter={(label) => `Cycle ${label}`}
                  />
                  <Bar
                    dataKey="days"
                    fill={PRIMARY}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={32}
                    label={{ position: "top", fill: "#2a1520", fontSize: 12 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Days between logged period starts</caption>
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {lengths.map((row) => (
                  <tr key={row.cycle}>
                    <td>{row.cycle}</td>
                    <td>{row.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
      </article>
      ) : null}

      {showPie ? (
      <article className={cardClass}>
        <h2 className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
          This month
        </h2>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value as number} days`, String(name)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="m-0 flex list-none flex-wrap justify-center gap-3 p-0">
              {slices.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-[length:var(--text-caption)] text-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.fill }}
                    aria-hidden
                  />
                  {s.name} {s.value}
                </li>
              ))}
            </ul>
            <table className="sr-only">
              <caption>How this month breaks down</caption>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
      </article>
      ) : null}
    </section>
  );
}
