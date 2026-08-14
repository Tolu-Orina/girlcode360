import { Chip } from "@/components/primitives/chip";

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

export function SymptomChipGroups({
  symptoms,
  selected,
  onToggle,
}: {
  symptoms: Array<{ id: string; label: string; category?: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: symptoms.filter((s) => (s.category ?? "other") === cat),
  })).filter((g) => g.items.length > 0);

  const leftover = symptoms.filter(
    (s) =>
      !CATEGORY_ORDER.includes((s.category ?? "other") as (typeof CATEGORY_ORDER)[number]),
  );

  return (
    <div className="grid gap-4">
      {grouped.map(({ cat, items }) => (
        <div key={cat} className="grid gap-2">
          <p className="m-0 text-[length:var(--text-caption)] font-semibold text-muted-foreground">
            {CATEGORY_LABEL[cat]}
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((s) => (
              <Chip
                key={s.id}
                pressed={selected.includes(s.id)}
                onClick={() => onToggle(s.id)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      {leftover.length ? (
        <div className="flex flex-wrap gap-2">
          {leftover.map((s) => (
            <Chip
              key={s.id}
              pressed={selected.includes(s.id)}
              onClick={() => onToggle(s.id)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
