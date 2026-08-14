import { ChartLine, Gem, Palette, ScanFace, Scissors, Shirt, UserRound } from "lucide-react";
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
  { id: "hair", label: "Hair", hint: "Colour and density", icon: Scissors },
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
  return (
    <>
      <nav
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        aria-label="Mirror studios"
      >
        <ul className="m-0 flex w-max list-none gap-2 p-0">
          {STUDIOS.map((s) => {
            const Icon = s.icon;
            const active = value === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onChange(s.id)}
                  className={cn(
                    "grid min-h-12 min-w-[4.5rem] justify-items-center gap-1 rounded-[var(--radius-sheet)] px-3 py-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-card text-foreground shadow-[var(--shadow-2)]"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                  <span className="text-[length:var(--text-caption)] font-semibold whitespace-nowrap">
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav
        className="hidden lg:sticky lg:top-8 lg:grid lg:gap-2"
        aria-label="Mirror studios"
      >
        {STUDIOS.map((s) => {
          const Icon = s.icon;
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(s.id)}
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
                {s.label}
              </span>
              <span className="col-start-2 text-[length:var(--text-caption)] text-muted-foreground">
                {s.hint}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
