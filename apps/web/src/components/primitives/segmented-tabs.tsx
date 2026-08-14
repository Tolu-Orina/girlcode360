import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabList = cva(
  "flex flex-wrap gap-2 rounded-[var(--radius)] border border-border bg-card p-1",
);

const tabBtn = cva(
  "inline-flex min-h-[var(--tap)] items-center justify-center rounded-[var(--radius)] px-4 text-[length:var(--text-label)] font-semibold transition-colors",
  {
    variants: {
      active: {
        true: "bg-muted text-foreground",
        false: "bg-transparent text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground",
      },
    },
    defaultVariants: { active: false },
  },
);

export type SegmentedTabItem = {
  id: string;
  label: string;
};

export function SegmentedTabs({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className={tabList()} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(tabBtn({ active }))}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
