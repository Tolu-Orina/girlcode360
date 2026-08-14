import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppPage, leadClass } from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import {
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { getMarketplaceListing } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { marketplaceQuery } from "@/lib/session-geo";
import type { MarketplaceListing } from "../../../../packages/api-types/src/index";
import { MARKETPLACE_CATEGORY_LABEL } from "../../../../packages/domain/src/index";

export function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const online = useOnline();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || !apiBaseUrl) return;
      setLoading(true);
      try {
        const res = await getMarketplaceListing(id, marketplaceQuery());
        if (!cancelled) setListing(res.listing);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Listing not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const maps =
    listing &&
    `https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`;
  const tel = listing?.phone?.replace(/\s/g, "");

  return (
    <AppPage>
      <PageHeader
        eyebrow="Listing"
        title={listing?.name ?? "Listing"}
        lead="Directory listing. Confirm hours and phone before you go. Not a medical recommendation."
      />
      <p className={leadClass}>
        <Link to="/app/marketplace">Back to marketplace</Link>
      </p>
      {!online ? <OfflineBanner /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <SkeletonBlock className="h-48" /> : null}
      {listing ? (
        <div className="grid gap-3">
          <p className={leadClass}>
            {MARKETPLACE_CATEGORY_LABEL[listing.category]}
            {listing.distanceKm != null ? ` · ${listing.distanceKm.toFixed(1)} km` : ""}
            {` · Directory ${listing.rating.toFixed(1)}`}
            {listing.openNow != null ? (listing.openNow ? " · Open" : " · Closed") : ""}
          </p>
          <p className="m-0 text-[length:var(--text-body)]">{listing.address}</p>
          {listing.phone ? (
            <p className={leadClass}>{listing.phone}</p>
          ) : (
            <p className={leadClass}>No phone on file — use emergency numbers if this is urgent.</p>
          )}
          {listing.registrationNumber ? (
            <p className={leadClass}>Registration on file: {listing.registrationNumber}</p>
          ) : null}
          {listing.seeded ? (
            <p className={leadClass}>
              Founder-seeded public directory row. Catalogue id{" "}
              {listing.catalogueItemId ?? "none"} stays stable for Mirror try-on.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {maps ? (
              <Button asChild>
                <a href={maps} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </Button>
            ) : null}
            {tel ? (
              <Button asChild variant="outline">
                <a href={`tel:${tel}`}>Call</a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}
