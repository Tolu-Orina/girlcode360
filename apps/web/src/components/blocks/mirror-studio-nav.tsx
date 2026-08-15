import { ChartLine, Gem, Palette, ScanFace, Scissors, Shirt, UserRound } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MirrorTab =
  | "scan"
  | "makeup"
  | "hair"
  | "wardrobe"
  | "accessories"
  | "tryon"
  | "timeline";

const STUDIOS: {
  id: MirrorTab;
  label: string;
  hint: string;
  icon: typeof ScanFace;
}[] = [
  { id: "scan", label: "Skin", hint: "Scores from a face still", icon: ScanFace },
  { id: "makeup", label: "Makeup", hint: "Boutique shade try-on", icon: Palette },
  { id: "hair", label: "Hair", hint: "Length scores and colour try-on", icon: Scissors },
  { id: "wardrobe", label: "Wardrobe", hint: "Pieces you already own", icon: Shirt },
  { id: "accessories", label: "Accessories", hint: "Jewellery, frames, nails", icon: Gem },
  { id: "tryon", label: "Apparel", hint: "Full-body catalogue looks", icon: UserRound },
  { id: "timeline", label: "Timeline", hint: "Progress across dates", icon: ChartLine },
];

export function MirrorStudioNav({
  value,
  onChange,
}: {
  value: MirrorTab;
  onChange: (id: MirrorTab) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <LayoutGroup>
      <nav
        className="grid w-full min-w-0 grid-cols-4 gap-1 md:w-[28rem]"
        aria-label="Mirror studios"
      >
        {STUDIOS.map((s) => {
          const Icon = s.icon;
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              aria-label={s.label}
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(s.id)}
              className={cn(
                "relative grid min-h-12 min-w-12 justify-items-center gap-1 rounded-[var(--radius)] px-1 py-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId={reduce ? undefined : "mirror-studio-pill"}
                  className="absolute inset-0 rounded-[var(--radius)] bg-card shadow-[var(--shadow-2)]"
                  transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
              <Icon className="relative z-[1] size-6" aria-hidden />
              <span className="relative z-[1] text-center text-[length:var(--text-caption)] font-semibold max-md:sr-only">
                {s.label}
              </span>
            </button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
