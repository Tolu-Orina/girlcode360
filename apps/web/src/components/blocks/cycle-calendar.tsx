import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  ttcOn,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onToday,
  onSelect,
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
  ttcOn: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (date: string) => void;
}) {
  return (
    <article className="grid gap-4 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)] lg:gap-6 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          {monthTitle}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onToday}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
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
            disabled={!canNext}
            onClick={onNext}
            aria-label="Next month"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-7 gap-1 lg:gap-2"
        role="grid"
        aria-label="Cycle calendar"
      >
        {DOW.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[length:var(--text-caption)] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const date = ymd(d);
          const inMonth = d.getMonth() === viewMonth;
          const isToday = date === todayKey;
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
              aria-current={isToday ? "date" : undefined}
              aria-label={`${date}${bits.length ? `, ${bits.join(", ")}` : ""}`}
              className={cn(
                "relative grid min-h-12 place-items-center rounded-[var(--radius)] text-[length:var(--text-label)] lg:min-h-16",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "text-muted-foreground/60",
                isToday && "font-bold",
                isLogged && "bg-primary text-primary-foreground",
                isPredicted &&
                  "border border-dashed border-primary text-primary",
                isFertile &&
                  "underline decoration-ok decoration-2 underline-offset-4",
                isOvulation && "ring-2 ring-ok",
                isSelected && "ring-2 ring-foreground ring-offset-2",
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

      <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-[length:var(--text-caption)] text-muted-foreground">
        <li className="inline-flex items-center gap-2">
          <i className="inline-block size-3 rounded-sm bg-primary" aria-hidden />
          Logged period
        </li>
        <li className="inline-flex items-center gap-2">
          <i
            className="inline-block size-3 rounded-sm border border-dashed border-primary"
            aria-hidden
          />
          Predicted
        </li>
        {ttcOn ? (
          <>
            <li className="inline-flex items-center gap-2">
              <i
                className="inline-block size-3 rounded-sm border-b-2 border-ok"
                aria-hidden
              />
              Fertile estimate
            </li>
            <li className="inline-flex items-center gap-2">
              <i
                className="inline-block size-3 rounded-sm ring-2 ring-ok"
                aria-hidden
              />
              Ovulation estimate
            </li>
          </>
        ) : null}
        <li className="inline-flex items-center gap-2">
          <i
            className="inline-block size-3 rounded-sm ring-2 ring-foreground"
            aria-hidden
          />
          Selected
        </li>
      </ul>
    </article>
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
