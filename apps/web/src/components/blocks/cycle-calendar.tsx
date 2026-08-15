import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/period-span";
import { cn } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function LegendItem({
  swatch,
  label,
}: {
  swatch: ReactNode;
  label: string;
}) {
  return (
    <li className="flex h-5 items-center gap-2">
      <span
        className="grid size-3 shrink-0 place-items-center"
        aria-hidden
      >
        {swatch}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function CycleCalendar({
  monthTitle,
  cells,
  viewMonth,
  todayKey,
  selected,
  logged,
  predicted,
  fertileDates,
  ovulationDay,
  dayLogs,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onToday,
  onSelect,
  paintMode,
  onTogglePaint,
}: {
  monthTitle: string;
  cells: Date[];
  viewMonth: number;
  todayKey: string;
  selected: string | null;
  logged: Set<string>;
  predicted: Set<string>;
  fertileDates: Set<string>;
  ovulationDay: string | null;
  dayLogs: Set<string>;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (date: string) => void;
  paintMode: boolean;
  onTogglePaint: () => void;
}) {
  const showEstimates = fertileDates.size > 0 || Boolean(ovulationDay);

  return (
    <article className="grid min-w-0 gap-4 overflow-x-clip rounded-[var(--radius-sheet)] bg-white/40 p-4 shadow-[var(--shadow-2)] backdrop-blur-[20px] lg:gap-6 lg:p-6">
      <div className="grid min-w-0 gap-4 lg:flex lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 lg:hidden"
            disabled={!canPrev}
            onClick={onPrev}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h2 className="m-0 min-w-0 flex-1 truncate text-center text-[length:var(--text-section)] text-foreground lg:flex-none lg:text-left">
            {monthTitle}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 lg:hidden"
            disabled={!canNext}
            onClick={onNext}
            aria-label="Next month"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button type="button" variant="ghost" onClick={onToday}>
            Today
          </Button>
          <Button
            type="button"
            variant={paintMode ? "default" : "outline"}
            onClick={onTogglePaint}
          >
            {paintMode ? "Done" : "Edit dates"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden lg:inline-flex"
            disabled={!canPrev}
            onClick={onPrev}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden lg:inline-flex"
            disabled={!canNext}
            onClick={onNext}
            aria-label="Next month"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>
      </div>

      <div
        className="grid min-w-0 grid-cols-7 gap-1 lg:gap-2"
        role="grid"
        aria-label={paintMode ? "Edit period dates" : "Cycle calendar"}
      >
        {DOW.map((d) => (
          <div
            key={d}
            className="grid min-h-8 min-w-0 place-items-center text-center text-[length:var(--text-caption)] font-semibold text-muted-foreground uppercase"
          >
            <span className="lg:hidden">{d.charAt(0)}</span>
            <span className="hidden lg:inline">{d}</span>
          </div>
        ))}
        {cells.map((d) => {
          const date = ymd(d);
          const inMonth = d.getMonth() === viewMonth;
          const isToday = date === todayKey;
          const isLogged = logged.has(date);
          const isPredicted = !isLogged && predicted.has(date);
          const isFertile =
            !isLogged && !isPredicted && fertileDates.has(date);
          const isOvulation = ovulationDay === date && !isLogged;
          const hasLog = dayLogs.has(date);
          const isSelected = selected === date;
          const prevLogged = logged.has(addDays(date, -1));
          const nextLogged = logged.has(addDays(date, 1));
          const bits = [
            isLogged ? "logged period" : null,
            isPredicted ? "predicted" : null,
            isFertile ? "fertile estimate" : null,
            isOvulation ? "ovulation estimate" : null,
            hasLog ? "has notes" : null,
            isSelected && !paintMode ? "selected" : null,
            paintMode ? "tap to mark or unmark bleeding" : null,
          ].filter(Boolean);
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${date}${bits.length ? `, ${bits.join(", ")}` : ""}`}
              className={cn(
                "relative grid min-h-12 min-w-0 place-items-center text-[length:var(--text-label)] lg:min-h-16",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                paintMode && "ring-1 ring-inset ring-primary/40",
                !isLogged && "rounded-[var(--radius)]",
                isLogged && !prevLogged && !nextLogged && "rounded-full",
                isLogged && !prevLogged && nextLogged && "rounded-l-full rounded-r-none",
                isLogged && prevLogged && !nextLogged && "rounded-r-full rounded-l-none",
                isLogged && prevLogged && nextLogged && "rounded-none",
                !inMonth && "text-muted-foreground/60",
                isToday && "font-bold",
                isLogged && "bg-primary text-primary-foreground",
                isPredicted &&
                  "border border-dashed border-primary text-primary",
                isFertile && "bg-ok/20 text-foreground",
                isOvulation && "border-2 border-ok",
                isSelected &&
                  !paintMode &&
                  "ring-2 ring-inset ring-foreground",
              )}
              onClick={() => onSelect(date)}
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

      <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0 text-[length:var(--text-caption)] text-muted-foreground">
        <LegendItem
          swatch={<i className="size-3 rounded-full bg-primary" />}
          label="Period"
        />
        <LegendItem
          swatch={
            <i className="size-3 rounded-full border border-dashed border-primary" />
          }
          label="Predicted"
        />
        {showEstimates ? (
          <>
            <LegendItem
              swatch={<i className="size-3 rounded-full bg-ok/20" />}
              label="Fertile"
            />
            <LegendItem
              swatch={
                <i className="size-3 rounded-full border-2 border-ok bg-ok/20" />
              }
              label="Ovulation"
            />
          </>
        ) : null}
        <LegendItem
          swatch={
            <i className="size-3 rounded-full border-2 border-foreground" />
          }
          label="Selected"
        />
      </ul>
      {paintMode ? (
        <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
          Tap each day you bled. Tap again to remove it. Then tap Done.
        </p>
      ) : null}
    </article>
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
