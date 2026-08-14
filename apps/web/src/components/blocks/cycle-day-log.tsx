import { Chip } from "@/components/primitives/chip";
import { Field, FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowLevel, MoodLevel } from "../../../../../packages/api-types/src/index";

const FLOW_OPTIONS: { value: FlowLevel; label: string }[] = [
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

const MOODS: { level: MoodLevel; label: string }[] = [
  { level: 1, label: "Low" },
  { level: 2, label: "Meh" },
  { level: 3, label: "OK" },
  { level: 4, label: "Good" },
  { level: 5, label: "Great" },
];

const CATEGORY_ORDER = [
  "pain",
  "digestive",
  "mood",
  "skin",
  "energy",
  "other",
] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  pain: "Pain",
  digestive: "Digestive",
  mood: "Mood",
  skin: "Skin",
  energy: "Energy",
  other: "Other",
};

export type CycleSymptom = {
  id: string;
  label: string;
  category: string;
};

export function CycleDayLog({
  dateLabel,
  flow,
  mood,
  symptomIds,
  note,
  symptoms,
  busy,
  showCancel,
  onFlow,
  onMood,
  onToggleSymptom,
  onNote,
  onSave,
  onCancel,
  onAskAlena,
  isPeriodDay,
  isOvulationDay,
  isFertileDay,
  onTogglePeriod,
}: {
  dateLabel: string;
  flow: FlowLevel;
  mood: MoodLevel | null;
  symptomIds: string[];
  note: string;
  symptoms: CycleSymptom[];
  busy: boolean;
  showCancel: boolean;
  onFlow: (value: FlowLevel) => void;
  onMood: (value: MoodLevel) => void;
  onToggleSymptom: (id: string) => void;
  onNote: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onAskAlena: () => void;
  isPeriodDay: boolean;
  isOvulationDay: boolean;
  isFertileDay: boolean;
  onTogglePeriod: () => void;
}) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: symptoms.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  const estimate = isPeriodDay
    ? null
    : isOvulationDay
      ? "Estimated ovulation"
      : isFertileDay
        ? "Estimated fertile window"
        : null;

  return (
    <aside
      className={cn(
        "grid min-w-0 gap-6 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)]",
        "lg:sticky lg:top-8 lg:max-h-[calc(100dvh-var(--header-height)-4rem)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden lg:p-6",
      )}
    >
      <header className="grid gap-3">
        <div className="grid gap-1">
          <p className="m-0 text-[length:var(--text-caption)] font-semibold tracking-wide text-muted-foreground uppercase">
            This day
          </p>
          <h3 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-sub)] text-foreground">
            {dateLabel}
          </h3>
          {estimate ? (
            <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
              {estimate}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            pressed={isPeriodDay}
            disabled={busy}
            onClick={onTogglePeriod}
            aria-label={isPeriodDay ? "Period on. Tap to turn off" : "Period off. Tap to turn on"}
          >
            Period
          </Chip>
          {isPeriodDay
            ? FLOW_OPTIONS.map((f) => (
                <Chip
                  key={f.value}
                  pressed={flow === f.value}
                  onClick={() => onFlow(flow === f.value ? "none" : f.value)}
                >
                  {f.label}
                </Chip>
              ))
            : null}
        </div>
      </header>

      <div className="grid gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="p-0 text-[length:var(--text-label)] font-medium text-foreground">
            Mood
          </legend>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Chip
                key={m.level}
                pressed={mood === m.level}
                onClick={() => onMood(m.level)}
                className="flex-1"
                aria-label={`Mood ${m.label}`}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4">
          <p className="m-0 text-[length:var(--text-label)] font-medium text-foreground">
            Symptoms
          </p>
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="grid gap-2">
              <p className="m-0 text-[length:var(--text-caption)] font-semibold text-muted-foreground">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map((s) => (
                  <Chip
                    key={s.id}
                    pressed={symptomIds.includes(s.id)}
                    onClick={() => onToggleSymptom(s.id)}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Field id="note" label="Note" hint="Optional">
          <FieldTextarea
            id="note"
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Anything you want to remember"
          />
        </Field>
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : "Save this day"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {showCancel ? "Cancel" : "Reset"}
          </Button>
        </div>
        <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
          <button
            type="button"
            className="font-semibold text-primary underline underline-offset-2"
            onClick={onAskAlena}
          >
            Ask Alena
          </button>{" "}
          about this day.
        </p>
      </div>
    </aside>
  );
}
