import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AppPage,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { AreaPicker } from "@/components/blocks/area-picker";
import { PageHeader } from "@/components/blocks/page-header";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { Chip } from "@/components/primitives/chip";
import { Field, FieldInput } from "@/components/primitives/field";
import { PageTip } from "@/components/blocks/page-tip";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { listMarketplace } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { marketplaceQuery } from "@/lib/session-geo";
import type {
  MarketplaceCategory,
  MarketplaceListing,
} from "../../../../packages/api-types/src/index";
import { MARKETPLACE_CATEGORY_LABEL } from "../../../../packages/domain/src/index";

const FILTER_KEY = "gc360.mktFilters";
const CATS: Array<MarketplaceCategory | "all"> = [
  "all",
  "beauty",
  "boutique",
  "pharmacy",
  "clinic",
];
const RADII = [0.5, 1, 2, 5, 0] as const;

type Filters = {
  category: MarketplaceCategory | "all";
  radiusKm: number;
  minRating: number;
  openNow: boolean;
  q: string;
  savedOnly: boolean;
};

function loadFilters(): Filters {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (raw) return { ...defaultFilters(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultFilters();
}

function defaultFilters(): Filters {
  return {
    category: "all",
    radiusKm: 5,
    minRating: 0,
    openNow: false,
    q: "",
    savedOnly: false,
  };
}

export function MarketplacePage() {
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originTick, setOriginTick] = useState(0);
  const online = useOnline();

  const persist = useCallback((next: Filters) => {
    setFilters(next);
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    if (!apiBaseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listMarketplace(
        marketplaceQuery({
          category: filters.category === "all" ? undefined : filters.category,
          radiusKm: filters.radiusKm || undefined,
          minRating: filters.minRating || undefined,
          openNow: filters.openNow ? "1" : undefined,
          q: filters.q.trim() || undefined,
        }),
      );
      setListings(
        filters.savedOnly
          ? res.listings.filter((l) => l.favourite)
          : res.listings,
      );
      setNote(res.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, originTick]);

  const catLabel = useMemo(
    () => (c: MarketplaceCategory) => MARKETPLACE_CATEGORY_LABEL[c],
    [],
  );

  return (
    <AppPage>
      <PageHeader
        eyebrow="Nearby"
        title="Marketplace"
        lead="Pharmacies, clinics, beauty, and boutiques. Seeded directory plus moderated listings. Confirm before you travel."
      />
      <PageTip id="marketplace" />
      {!online ? <OfflineBanner /> : null}
      <AreaPicker onChange={() => setOriginTick((n) => n + 1)} />

      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <Chip
            key={c}
            pressed={filters.category === c}
            onClick={() => persist({ ...filters, category: c })}
          >
            {c === "all" ? "All" : MARKETPLACE_CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {RADII.map((r) => (
          <Chip
            key={r}
            pressed={filters.radiusKm === r}
            onClick={() => persist({ ...filters, radiusKm: r })}
          >
            {r === 0 ? "Any distance" : `${r} km`}
          </Chip>
        ))}
        <Chip
          pressed={filters.openNow}
          onClick={() => persist({ ...filters, openNow: !filters.openNow })}
        >
          Open now
        </Chip>
        <Chip
          pressed={filters.savedOnly}
          onClick={() => persist({ ...filters, savedOnly: !filters.savedOnly })}
        >
          Saved
        </Chip>
        {[0, 4, 4.5].map((n) => (
          <Chip
            key={n}
            pressed={filters.minRating === n}
            onClick={() => persist({ ...filters, minRating: n })}
          >
            {n === 0 ? "Any score" : `${n}+`}
          </Chip>
        ))}
      </div>
      <Field id="mkt-q" label="Search">
        <FieldInput
          id="mkt-q"
          value={filters.q}
          onChange={(e) => persist({ ...filters, q: e.target.value })}
          placeholder="Name or service"
        />
      </Field>
      <Button type="button" variant="outline" onClick={() => persist(defaultFilters())}>
        Reset filters
      </Button>
      <p className={leadClass}>
        <Link to="/business">Register a business</Link>
      </p>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
      {note ? <p className={leadClass}>{note}</p> : null}

      {loading ? (
        <SkeletonBlock className="h-40" />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings in range"
          body="Widen the radius, change the area, or clear filters. SheMatch stays silent when nothing is within 5 km."
        />
      ) : (
        <ul className={listClass}>
          {listings.map((l) => (
            <li key={l.id} className={listItemClass}>
              <Link
                to={`/app/marketplace/${l.id}`}
                className="grid gap-1 text-foreground no-underline"
              >
                <strong className="text-[length:var(--text-body)]">{l.name}</strong>
                <span className={leadClass}>
                  {catLabel(l.category)}
                  {l.sponsored ? " · Sponsored" : ""}
                  {l.distanceKm != null ? ` · ${l.distanceKm.toFixed(1)} km` : ""}
                  {` · Directory ${l.rating.toFixed(1)}`}
                  {l.reviewCount
                    ? ` · Reviews ${l.reviewAverage?.toFixed(1)} (${l.reviewCount})`
                    : ""}
                  {l.openNow != null ? (l.openNow ? " · Open" : " · Closed") : ""}
                  {l.favourite ? " · Saved" : ""}
                </span>
                <span className={leadClass}>{l.address}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
