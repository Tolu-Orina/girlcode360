import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabList = cva(
  "flex min-w-0 gap-2 overflow-x-auto rounded-[var(--radius)] border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

const tabBtn = cva(
  "inline-flex min-h-[var(--tap)] shrink-0 items-center justify-center rounded-[var(--radius)] px-3 text-[length:var(--text-label)] font-semibold whitespace-nowrap transition-colors sm:px-4",
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
  className,
}: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn(tabList(), className)} role="tablist" aria-label={ariaLabel}>
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
