import { Baby, FolderLock, HeartPulse, Sparkles } from "lucide-react";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { cn } from "@/lib/utils";

export type HealthTab = "pcos" | "pregnancy" | "ttc" | "wallet";

const MODULES: {
  id: HealthTab;
  label: string;
  hint: string;
  icon: typeof HeartPulse;
}[] = [
  { id: "pcos", label: "PMOS", hint: "Diary and reminders", icon: HeartPulse },
  { id: "pregnancy", label: "Pregnancy", hint: "Weeks and appointments", icon: Baby },
  { id: "ttc", label: "TTC", hint: "Fertile window and signs", icon: Sparkles },
  { id: "wallet", label: "Wallet", hint: "Encrypted files", icon: FolderLock },
];

export function HealthModuleNav({
  value,
  onChange,
  enabled,
}: {
  value: HealthTab;
  onChange: (id: HealthTab) => void;
  enabled: Record<HealthTab, boolean>;
}) {
  return (
    <>
      <div className="lg:hidden">
        <SegmentedTabs
          ariaLabel="Health modules"
          value={value}
          onChange={(id) => onChange(id as HealthTab)}
          items={MODULES.map((m) => ({ id: m.id, label: m.label }))}
        />
      </div>
      <nav
        className="hidden lg:sticky lg:top-8 lg:grid lg:gap-2"
        aria-label="Health modules"
      >
        {MODULES.map((m) => {
          const Icon = m.icon;
          const active = value === m.id;
          const on = enabled[m.id];
          return (
            <button
              key={m.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(m.id)}
              className={cn(
                "grid grid-cols-[24px_1fr] items-start gap-x-3 gap-y-1 rounded-[var(--radius-sheet)] px-4 py-3 text-left",
                "min-h-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card text-foreground shadow-[var(--shadow-2)]"
                  : "text-muted-foreground [@media(hover:hover)]:hover:bg-card/70 [@media(hover:hover)]:hover:text-foreground",
              )}
            >
              <Icon className="mt-0.5 size-6" aria-hidden />
              <span className="text-[length:var(--text-label)] font-semibold text-foreground">
                {m.label}
              </span>
              <span className="col-start-2 text-[length:var(--text-caption)] text-muted-foreground">
                {m.hint}
                {on ? " · On" : " · Off"}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
