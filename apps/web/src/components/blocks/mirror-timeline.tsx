import { useEffect, useMemo, useState } from "react";
import {
  Gem,
  Palette,
  ScanFace,
  Scissors,
  Search,
  Shirt,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import {
  elevatedCardClass,
  leadClass,
} from "@/components/blocks/app-page";
import { EmptyState, SkeletonBlock } from "@/components/blocks/states";
import { MirrorStill } from "@/components/blocks/mirror-still";
import { ScoreBar } from "@/components/blocks/score-bar";
import { FieldSelect } from "@/components/primitives/field";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAccessoryLookMedia,
  getHairScanMedia,
  getMakeupLookMedia,
  getMirrorScanMedia,
  getMirrorTryOnMedia,
  getStyleAnalytics,
  getWardrobeOutfitMedia,
  listAccessoryLooks,
  listHairScans,
  listMakeupLooks,
  listMirrorTryOns,
  listWardrobeOutfits,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { elevatedSkinConcerns } from "../../../../../packages/domain/src/index";
import type {
  Market,
  SkinScan,
  StyleAnalytics,
} from "../../../../../packages/api-types/src/index";

type StudioKind =
  | "skin"
  | "makeup"
  | "hair"
  | "wardrobe"
  | "apparel"
  | "accessories";

type TimelineEvent = {
  id: string;
  kind: StudioKind;
  at: string;
  title: string;
  tags: string[];
  seeded?: boolean;
  hasImage: boolean;
  loadImage: () => Promise<string | null>;
};

const KIND_META: Record<
  StudioKind,
  { label: string; Icon: typeof ScanFace }
> = {
  skin: { label: "Skin", Icon: ScanFace },
  makeup: { label: "Makeup", Icon: Palette },
  hair: { label: "Hair", Icon: Scissors },
  wardrobe: { label: "Wardrobe", Icon: Shirt },
  apparel: { label: "Apparel", Icon: UserRound },
  accessories: { label: "Accessories", Icon: Gem },
};

const SCORE_LABELS: Record<string, string> = {
  acne: "Acne",
  oiliness: "Oiliness",
  redness: "Redness",
  texture: "Texture",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatWhenTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} · ${d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function phaseLabel(phase: SkinScan["cyclePhaseAtScan"]): string {
  if (!phase) return "No cycle day";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function money(minor: number, market: Market): string {
  const n = minor / 100;
  if (market === "UK") return `£${n.toFixed(2)}`;
  if (market === "NG") return `₦${Math.round(n)}`;
  return `GH₵${n.toFixed(2)}`;
}

function mediaUrl(
  load: () => Promise<{ contentType: string; imageB64: string }>,
): Promise<string | null> {
  return load()
    .then((m) => `data:${m.contentType};base64,${m.imageB64}`)
    .catch(() => null);
}

function EventThumb({
  event,
}: {
  event: TimelineEvent;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!event.hasImage) return;
    let cancelled = false;
    void event.loadImage().then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [event]);
  if (!src) {
    return <div className="aspect-[4/5] w-full bg-muted" aria-hidden />;
  }
  return (
    <img
      src={src}
      alt=""
      className="aspect-[4/5] w-full object-cover object-[center_18%]"
    />
  );
}

function TrendRow({
  label,
  points,
}: {
  label: string;
  points: { id: string; when: string; value: number }[];
}) {
  if (points.length < 2) return null;
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[length:var(--text-label)] text-foreground">
        {label} over time
      </p>
      <ol className="m-0 grid min-w-0 list-none grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] items-end gap-1 p-0">
        {points.map((p) => (
          <li key={p.id} className="grid justify-items-center gap-1">
            <span
              className="flex h-12 w-full items-end overflow-hidden rounded-sm bg-muted"
              title={`${Math.round(p.value)} of 100`}
            >
              <span
                className="block w-full bg-primary"
                style={{ height: `${Math.min(100, Math.max(0, p.value))}%` }}
              />
            </span>
            <span className="text-center text-[length:var(--text-caption)] text-muted-foreground">
              {formatWhen(p.when)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MirrorTimelinePanel({
  scans,
  selected,
  onSelectScan,
  onDeleteScan,
  busy,
  market,
  compareSrc,
  compareA,
  compareB,
  onCompareA,
  onCompareB,
}: {
  scans: SkinScan[];
  selected: SkinScan | null;
  onSelectScan: (scan: SkinScan) => void;
  onDeleteScan: (id: string) => void;
  busy: boolean;
  market: Market;
  compareSrc: { a: string | null; b: string | null };
  compareA: string | null;
  compareB: string | null;
  onCompareA: (id: string | null) => void;
  onCompareB: (id: string | null) => void;
}) {
  const [style, setStyle] = useState<StyleAnalytics | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [kind, setKind] = useState<"all" | StudioKind>("all");
  const liveScans = scans.filter((s) => !s.seeded);

  useEffect(() => {
    let cancelled = false;
    setStyleReady(false);
    void getStyleAnalytics()
      .then(({ analytics }) => {
        if (!cancelled) setStyle(analytics);
      })
      .catch(() => {
        if (!cancelled) setStyle(null);
      })
      .finally(() => {
        if (!cancelled) setStyleReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settled = await Promise.allSettled([
        listMakeupLooks(),
        listHairScans(),
        listMirrorTryOns(),
        listAccessoryLooks(),
        listWardrobeOutfits(),
      ]);
      if (cancelled) return;
      const makeup =
        settled[0].status === "fulfilled" ? settled[0].value.looks : [];
      const hair =
        settled[1].status === "fulfilled" ? settled[1].value.scans : [];
      const tryons =
        settled[2].status === "fulfilled" ? settled[2].value.tryons : [];
      const accessories =
        settled[3].status === "fulfilled" ? settled[3].value.looks : [];
      const outfits =
        settled[4].status === "fulfilled" ? settled[4].value.outfits : [];

      const next: TimelineEvent[] = [
        ...scans.map((scan) => {
          const concerns = elevatedSkinConcerns(scan.scores);
          return {
            id: `skin-${scan.id}`,
            kind: "skin" as const,
            at: scan.createdAt,
            title: scan.insight?.title || "Skin scores",
            tags: [
              scan.seeded ? "Sample" : "Your scan",
              ...(scan.overallScore != null
                ? [`Overall ${scan.overallScore}`]
                : []),
              ...concerns.slice(0, 2).map((c) => c.replaceAll("_", " ")),
            ],
            seeded: scan.seeded,
            hasImage: scan.hasResultImage,
            loadImage: () =>
              mediaUrl(() => getMirrorScanMedia(scan.id, "result")),
          };
        }),
        ...makeup.map((look) => ({
          id: `makeup-${look.id}`,
          kind: "makeup" as const,
          at: look.createdAt,
          title: look.saved ? "Saved makeup look" : "Makeup try-on",
          tags: look.categories.length ? look.categories : [look.sourceKind],
          hasImage: look.hasResultImage,
          loadImage: () => mediaUrl(() => getMakeupLookMedia(look.id)),
        })),
        ...hair.map((row) => ({
          id: `hair-${row.id}`,
          kind: "hair" as const,
          at: row.createdAt,
          title: row.kind === "tryon" ? "Colour try-on" : "Length scores",
          tags: [
            ...(typeof row.scores.hair_length === "number"
              ? [`Length ${row.scores.hair_length}`]
              : []),
            ...(row.scores.hair_type ? [row.scores.hair_type] : []),
          ],
          hasImage: row.hasResultImage,
          loadImage: () => mediaUrl(() => getHairScanMedia(row.id)),
        })),
        ...tryons.map((row) => ({
          id: `apparel-${row.id}`,
          kind: "apparel" as const,
          at: row.createdAt,
          title: "Boutique try-on",
          tags: ["Apparel"],
          hasImage: row.hasResultImage,
          loadImage: () => mediaUrl(() => getMirrorTryOnMedia(row.id)),
        })),
        ...accessories.map((row) => ({
          id: `acc-${row.id}`,
          kind: "accessories" as const,
          at: row.createdAt,
          title:
            row.kind === "nail"
              ? "Nail try-on"
              : row.kind === "eyewear"
                ? "Frame look"
                : "Jewellery try-on",
          tags: [row.accessoryCategory ?? row.kind],
          hasImage: row.hasResultImage,
          loadImage: () => mediaUrl(() => getAccessoryLookMedia(row.id)),
        })),
        ...outfits.map((row) => ({
          id: `outfit-${row.id}`,
          kind: "wardrobe" as const,
          at: row.createdAt,
          title: row.occasion || "Outfit",
          tags: [`${row.itemIds.length} pieces`],
          hasImage: row.hasResultImage,
          loadImage: () => mediaUrl(() => getWardrobeOutfitMedia(row.id)),
        })),
      ];
      next.sort((a, b) => (a.at < b.at ? 1 : -1));
      setEvents(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [scans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (!q) return true;
      const hay = [e.title, KIND_META[e.kind].label, ...e.tags]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, kind, query]);

  const months = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const key = monthKey(e.at);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const avgCpw = style?.costPerWear.filter((r) => r.costPerWearMinor != null) ?? [];
  const avgCpwMinor =
    avgCpw.length > 0
      ? Math.round(
          avgCpw.reduce((sum, r) => sum + (r.costPerWearMinor ?? 0), 0) /
            avgCpw.length,
        )
      : null;
  const makeupCount = events.filter((e) => e.kind === "makeup").length;
  const wardrobeCount = events.filter((e) => e.kind === "wardrobe").length;

  return (
    <div className="grid min-w-0 gap-8">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
        <header className="grid min-w-0 gap-2">
          <h2 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground lg:text-[length:var(--text-page)]">
            Timeline
          </h2>
          <p className={leadClass}>
            Your studio history. Sample points are labelled. Live scans are
            yours. Closet numbers use pieces you already catalogued.
          </p>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="relative grid min-w-0">
            <span className="sr-only">Search looks</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search looks…"
              className="h-12 min-h-[var(--tap)] rounded-[var(--radius)] border-border bg-card pl-10 shadow-[var(--shadow-2)]"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={filterOpen}
            aria-label="Filter by studio"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <SlidersHorizontal className="size-6" />
          </Button>
        </div>
      </div>

      {filterOpen ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Studio filter">
          {(
            [
              "all",
              "skin",
              "makeup",
              "hair",
              "wardrobe",
              "apparel",
              "accessories",
            ] as const
          ).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={kind === id ? "default" : "outline"}
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
            >
              {id === "all" ? "All studios" : KIND_META[id].label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
        <article className={cn(elevatedCardClass, "min-w-[16rem] snap-start border-0 lg:min-w-0")}>
          <h3 className="m-0 text-[length:var(--text-label)] font-semibold text-muted-foreground">
            Style analytics
          </h3>
          {!styleReady ? (
            <SkeletonBlock className="h-12" />
          ) : style?.utilisationPct != null ? (
            <>
              <p className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground">
                {Math.round(style.utilisationPct)}% wardrobe use
              </p>
              <p className={leadClass}>
                {style.itemsWornInWindow} of {style.itemsCatalogued} pieces in{" "}
                {style.windowDays} days.
              </p>
            </>
          ) : (
            <p className={leadClass}>
              Catalogue clothing in Wardrobe to see how much of the closet you
              wore.
            </p>
          )}
        </article>
        <article className={cn(elevatedCardClass, "min-w-[16rem] snap-start border-0 lg:min-w-0")}>
          <h3 className="m-0 text-[length:var(--text-label)] font-semibold text-muted-foreground">
            Cost per wear
          </h3>
          {avgCpwMinor != null ? (
            <>
              <p className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground">
                {money(avgCpwMinor, market)} average
              </p>
              <p className={leadClass}>
                Price ÷ times worn. Pieces without a price show wear count only.
              </p>
            </>
          ) : (
            <p className={leadClass}>
              Add a purchase price on a closet piece to see cost per wear.
            </p>
          )}
        </article>
        <article className={cn(elevatedCardClass, "min-w-[16rem] snap-start border-0 lg:min-w-0")}>
          <h3 className="m-0 text-[length:var(--text-label)] font-semibold text-muted-foreground">
            Studio sessions
          </h3>
          <p className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground">
            {liveScans.length} live skin scans
          </p>
          <p className="m-0 flex flex-wrap gap-2" aria-label="Session mix">
            <span className="grid size-8 place-items-center rounded-full bg-muted text-[length:var(--text-caption)] font-semibold text-foreground">
              S
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-accent text-[length:var(--text-caption)] font-semibold text-foreground">
              W
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-primary text-[length:var(--text-caption)] font-semibold text-primary-foreground">
              M
            </span>
          </p>
          <p className={leadClass}>
            {wardrobeCount} outfits · {makeupCount} makeup looks. Sample skin
            scans stay out of this count.
          </p>
        </article>
      </div>

      {!events.length ? (
        <EmptyState
          title="No timeline yet"
          body="Take a skin scan, or run makeup, hair, or try-on to add the first look."
        />
      ) : !filtered.length ? (
        <EmptyState
          title="No looks match"
          body="Clear search or choose All studios."
        />
      ) : (
        months.map(([month, rows]) => (
          <section key={month} className="grid gap-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
              <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                {month}
              </h3>
              <span className="h-px bg-border" aria-hidden />
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((event) => {
                const meta = KIND_META[event.kind];
                const Icon = meta.Icon;
                const scanId = event.kind === "skin" ? event.id.slice(5) : null;
                const on = scanId != null && selected?.id === scanId;
                return (
                  <li key={event.id}>
                    <article
                      className={cn(
                        elevatedCardClass,
                        "gap-3 border-0 p-0 lg:p-0",
                        on && "ring-2 ring-ring",
                      )}
                    >
                      <button
                        type="button"
                        className="grid w-full gap-3 p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          if (!scanId) return;
                          const scan = scans.find((s) => s.id === scanId);
                          if (scan) onSelectScan(scan);
                        }}
                      >
                        <div className="relative overflow-hidden rounded-t-[var(--radius-sheet)]">
                          <EventThumb event={event} />
                          <span className="absolute top-2 left-2 inline-flex min-h-8 items-center gap-2 rounded-[var(--radius)] bg-card px-2 text-[length:var(--text-caption)] font-semibold text-foreground shadow-[var(--shadow-2)]">
                            <Icon className="size-4" aria-hidden />
                            {meta.label}
                            {event.seeded ? " · Sample" : ""}
                          </span>
                        </div>
                        <div className="grid gap-2 px-4 pb-4">
                          <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                            {formatWhenTime(event.at)}
                          </p>
                          <h4 className="m-0 text-[length:var(--text-sub)] text-foreground">
                            {event.title}
                          </h4>
                          {event.tags.length ? (
                            <p className="m-0 flex flex-wrap gap-2">
                              {event.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-[var(--radius)] bg-muted px-2 py-1 text-[length:var(--text-caption)] text-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      {scanId && !event.seeded ? (
                        <div className="px-4 pb-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => onDeleteScan(scanId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {scans.length >= 2 ? (
        <section className={cn(elevatedCardClass, "border-0")}>
          <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
            Compare two skin dates
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[length:var(--text-label)] text-muted-foreground">
                Earlier
              </span>
              <FieldSelect
                value={compareA ?? ""}
                onChange={(e) => onCompareA(e.target.value || null)}
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {formatWhen(scan.createdAt)} · {phaseLabel(scan.cyclePhaseAtScan)}
                  </option>
                ))}
              </FieldSelect>
            </label>
            <label className="grid gap-1">
              <span className="text-[length:var(--text-label)] text-muted-foreground">
                Later
              </span>
              <FieldSelect
                value={compareB ?? ""}
                onChange={(e) => onCompareB(e.target.value || null)}
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {formatWhen(scan.createdAt)} · {phaseLabel(scan.cyclePhaseAtScan)}
                  </option>
                ))}
              </FieldSelect>
            </label>
          </div>
          {(() => {
            const a = scans.find((s) => s.id === compareA);
            const b = scans.find((s) => s.id === compareB);
            if (!a || !b || a.id === b.id) {
              return <p className={leadClass}>Pick two different dates to compare.</p>;
            }
            const keys = ["acne", "oiliness", "redness", "texture"] as const;
            return (
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <p className="m-0 text-[length:var(--text-label)]">
                      {formatWhen(a.createdAt)} · {phaseLabel(a.cyclePhaseAtScan)}
                    </p>
                    {compareSrc.a ? (
                      <MirrorStill
                        src={compareSrc.a}
                        alt={`Scan from ${formatWhen(a.createdAt)}`}
                        crop="face"
                      />
                    ) : (
                      <p className={leadClass}>
                        {a.seeded
                          ? "Sample point — scores only."
                          : "No result photo for this date."}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <p className="m-0 text-[length:var(--text-label)]">
                      {formatWhen(b.createdAt)} · {phaseLabel(b.cyclePhaseAtScan)}
                    </p>
                    {compareSrc.b ? (
                      <MirrorStill
                        src={compareSrc.b}
                        alt={`Scan from ${formatWhen(b.createdAt)}`}
                        crop="face"
                      />
                    ) : (
                      <p className={leadClass}>
                        {b.seeded
                          ? "Sample point — scores only."
                          : "No result photo for this date."}
                      </p>
                    )}
                  </div>
                </div>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {keys.map((key) => {
                    const av = a.scores[key];
                    const bv = b.scores[key];
                    if (av == null && bv == null) return null;
                    return (
                      <li key={key} className="text-[length:var(--text-label)]">
                        {SCORE_LABELS[key] ?? key}: {av ?? "—"} → {bv ?? "—"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
          {style?.utilisationPct != null ? (
            <ScoreBar label="Closet utilisation" value={style.utilisationPct} />
          ) : null}
          <TrendRow
            label="Skin overall"
            points={
              style?.skinTrend
                .filter((p) => typeof p.value === "number")
                .map((p) => ({
                  id: p.id,
                  when: p.createdAt,
                  value: p.value as number,
                })) ?? []
            }
          />
          <TrendRow
            label="Hair length"
            points={
              style?.hairTrend
                .filter((p) => typeof p.value === "number")
                .map((p) => ({
                  id: p.id,
                  when: p.createdAt,
                  value: p.value as number,
                })) ?? []
            }
          />
          <TrendRow
            label="Acne"
            points={scans
              .filter((s) => typeof s.scores.acne === "number")
              .map((s) => ({
                id: s.id,
                when: s.createdAt,
                value: s.scores.acne,
              }))}
          />
          {liveScans.length < 2 ? (
            <p className={leadClass}>
              {liveScans.length === 0
                ? "Take two scans in different cycle phases to look for a pattern."
                : "One live scan so far. Scan again in another phase before we look for a cycle pattern."}
            </p>
          ) : null}
        </section>
      ) : (
        <p className={leadClass}>
          {liveScans.length === 0
            ? "Take two scans in different cycle phases to look for a pattern."
            : "One live scan so far. Scan again in another phase before we look for a cycle pattern."}
        </p>
      )}

      <PredictionDisclaimer message="Mirror scores and cycle overlays are wellness tools, not a diagnosis or medical advice." />
    </div>
  );
}
