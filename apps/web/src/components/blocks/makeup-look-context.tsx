import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MAKEUP_TRYON_SHADES,
  makeupShadesForCategory,
  PHOTO_MAKEUP_DEFAULT,
  STUDIO_MAKEUP_CATEGORIES,
  STUDIO_MAKEUP_LABELS,
  type StudioMakeupCategory,
} from "../../../../../packages/domain/src/index";
import { elevatedCardClass, leadClass } from "@/components/blocks/app-page";
import { cn } from "@/lib/utils";

export type MakeupStudioMode = "live" | "photo" | "transfer" | "shade";

function defaultShadeIds(): Record<StudioMakeupCategory, string> {
  const out = {} as Record<StudioMakeupCategory, string>;
  for (const cat of STUDIO_MAKEUP_CATEGORIES) {
    const preferred =
      cat === "foundation"
        ? MAKEUP_TRYON_SHADES.find((s) => s.id === "mk-seed-a-light_medium")
        : undefined;
    out[cat] = (preferred ?? makeupShadesForCategory(cat)[0])!.id;
  }
  return out;
}

type Ctx = {
  mode: MakeupStudioMode;
  setMode: (mode: MakeupStudioMode) => void;
  features: StudioMakeupCategory[];
  shadeIds: Record<StudioMakeupCategory, string>;
  featureFocus: StudioMakeupCategory;
  setFeatureFocus: (cat: StudioMakeupCategory) => void;
  toggleFeature: (cat: StudioMakeupCategory) => void;
  pickShade: (id: string) => void;
  lookSelection: () => { categories: string[]; palettes: Record<string, string> };
};

const MakeupLookContext = createContext<Ctx | null>(null);

export function MakeupLookProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MakeupStudioMode>("photo");
  const [features, setFeatures] = useState<StudioMakeupCategory[]>([
    ...PHOTO_MAKEUP_DEFAULT,
  ]);
  const [shadeIds, setShadeIds] = useState(defaultShadeIds);
  const [featureFocus, setFeatureFocus] = useState<StudioMakeupCategory>(
    "foundation",
  );

  const toggleFeature = useCallback((cat: StudioMakeupCategory) => {
    setFeatures((prev) => {
      if (!prev.includes(cat)) {
        setFeatureFocus(cat);
        return [...prev, cat];
      }
      if (featureFocus !== cat) {
        setFeatureFocus(cat);
        return prev;
      }
      const next = prev.filter((c) => c !== cat);
      if (next[0]) setFeatureFocus(next[0]);
      return next;
    });
  }, [featureFocus]);

  const pickShade = useCallback((id: string) => {
    setShadeIds((prev) => ({ ...prev, [featureFocus]: id }));
  }, [featureFocus]);

  const lookSelection = useCallback(() => {
    const palettes: Record<string, string> = {};
    for (const cat of features) {
      const shade = MAKEUP_TRYON_SHADES.find((s) => s.id === shadeIds[cat]);
      if (shade) palettes[cat] = shade.hex;
    }
    return { categories: features, palettes };
  }, [features, shadeIds]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      features,
      shadeIds,
      featureFocus,
      setFeatureFocus,
      toggleFeature,
      pickShade,
      lookSelection,
    }),
    [
      mode,
      features,
      shadeIds,
      featureFocus,
      toggleFeature,
      pickShade,
      lookSelection,
    ],
  );

  return (
    <MakeupLookContext.Provider value={value}>
      {children}
    </MakeupLookContext.Provider>
  );
}

export function useMakeupLook(): Ctx {
  const ctx = useContext(MakeupLookContext);
  if (!ctx) throw new Error("useMakeupLook needs MakeupLookProvider");
  return ctx;
}

export function MakeupFeatureRail() {
  const {
    mode,
    features,
    shadeIds,
    featureFocus,
    toggleFeature,
    pickShade,
  } = useMakeupLook();

  if (mode !== "photo" && mode !== "live") return null;

  const shades = makeupShadesForCategory(featureFocus);
  const current = shades.find((s) => s.id === shadeIds[featureFocus]);

  return (
    <div className={cn(elevatedCardClass, "min-w-0 border-0")}>
      <header className="grid gap-1">
        <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
          Look
        </h2>
        <p className={leadClass}>
          Tap a feature, then a colour. Stocked at SheMatch boutiques.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {STUDIO_MAKEUP_CATEGORIES.map((cat) => {
          const on = features.includes(cat);
          const focus = featureFocus === cat && on;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={on}
              className={cn(
                "min-h-12 rounded-[var(--radius-sheet)] border px-4 text-[length:var(--text-label)] font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
                focus && "ring-2 ring-ring",
              )}
              onClick={() => toggleFeature(cat)}
            >
              {STUDIO_MAKEUP_LABELS[cat]}
            </button>
          );
        })}
      </div>
      {features.includes(featureFocus) ? (
        <div className="grid gap-2">
          <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
            {STUDIO_MAKEUP_LABELS[featureFocus]}
            {current
              ? ` · ${current.title} · ${current.boutiqueName}`
              : ""}
          </p>
          <ul className="m-0 grid list-none grid-cols-5 gap-2 p-0">
            {shades.map((shade) => {
              const selected = shadeIds[featureFocus] === shade.id;
              return (
                <li key={shade.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${shade.title} at ${shade.boutiqueName}`}
                    title={`${shade.title} · ${shade.boutiqueName}`}
                    className={cn(
                      "aspect-square w-full rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-primary ring-2 ring-ring" : "border-border",
                    )}
                    style={{ backgroundColor: shade.hex }}
                    onClick={() => pickShade(shade.id)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className={leadClass}>Turn on at least one makeup feature.</p>
      )}
    </div>
  );
}
