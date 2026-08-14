import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AppPage, formStackClass, leadClass, listClass, listItemClass } from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import {
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
  SuccessBanner,
} from "@/components/blocks/states";
import { Field, FieldInput, FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import {
  createListingReview,
  deleteListingFavourite,
  getMarketplaceListing,
  getResaleListingMedia,
  listListingReviews,
  putListingFavourite,
  submitContentReport,
} from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { marketplaceQuery } from "@/lib/session-geo";
import type {
  ListingReview,
  MarketplaceListing,
  ResaleListing,
} from "../../../../packages/api-types/src/index";
import { MARKETPLACE_CATEGORY_LABEL } from "../../../../packages/domain/src/index";

export function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [resale, setResale] = useState<ResaleListing | null>(null);
  const [resaleSrc, setResaleSrc] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  async function load() {
    if (!id || !apiBaseUrl) return;
    setLoading(true);
    try {
      const [res, rev] = await Promise.all([
        getMarketplaceListing(id, marketplaceQuery()),
        listListingReviews(id),
      ]);
      setListing(res.listing);
      setResale(res.resale ?? null);
      setReviews(rev.reviews);
      if (res.resale?.hasImage) {
        try {
          const media = await getResaleListingMedia(res.resale.id);
          setResaleSrc(`data:${media.contentType};base64,${media.imageB64}`);
        } catch {
          setResaleSrc(null);
        }
      } else {
        setResaleSrc(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Listing not found");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const maps =
    listing &&
    `https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`;
  const tel = listing?.phone?.replace(/\s/g, "");

  async function onReview(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await createListingReview(id, { stars, body });
      setOk(res.message);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Listing"
        title={listing?.name ?? resale?.title ?? "Listing"}
        lead={
          resale
            ? `${resale.peerLabel}. Ask via the review thread below — same Marketplace messaging as boutique listings.`
            : "Directory listing. Confirm hours and phone before you go. Not a medical recommendation."
        }
      />
      <p className={leadClass}>
        <Link to="/app/marketplace">Back to marketplace</Link>
      </p>
      {!online ? <OfflineBanner /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}
      {loading ? <SkeletonBlock className="h-48" /> : null}
      {resale ? (
        <div className="grid gap-3">
          <p className={leadClass}>
            {resale.peerLabel}
            {resale.details ? ` · ${resale.details}` : ""}
            {` · ${(resale.priceMinor / 100).toFixed(2)}`}
          </p>
          {resaleSrc ? (
            <img
              src={resaleSrc}
              alt=""
              className="w-full max-w-md rounded-[var(--radius)] border border-border bg-muted"
            />
          ) : null}
        </div>
      ) : null}
      {listing ? (
        <div className="grid gap-3">
          <p className={leadClass}>
            {MARKETPLACE_CATEGORY_LABEL[listing.category]}
            {listing.sponsored ? " · Sponsored" : ""}
            {listing.distanceKm != null ? ` · ${listing.distanceKm.toFixed(1)} km` : ""}
            {` · Directory ${listing.rating.toFixed(1)}`}
            {listing.reviewCount
              ? ` · Reviews ${listing.reviewAverage?.toFixed(1)} (${listing.reviewCount})`
              : ""}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!id) return;
                const op = listing.favourite
                  ? deleteListingFavourite(id)
                  : putListingFavourite(id);
                void op
                  .then(() =>
                    setListing((l) => (l ? { ...l, favourite: !l.favourite } : l)),
                  )
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : "Could not save"),
                  );
              }}
            >
              {listing.favourite ? "Remove from saved" : "Save listing"}
            </Button>
          </div>

          <section className="grid gap-3">
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              Reviews
            </h2>
            <p className={leadClass}>
              New reviews wait for moderation. At least 20 characters. No links.
            </p>
            <ul className={listClass}>
              {reviews.length ? (
                reviews.map((r) => (
                  <li key={r.id} className={listItemClass}>
                    <strong className="text-foreground">{r.stars} / 5</strong>
                    <p className={leadClass}>{r.body}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void submitContentReport({
                          targetType: "review",
                          targetId: r.id,
                          reason: "harmful",
                        })
                          .then(() =>
                            setOk("Report sent. We aim to review within 24 hours."),
                          )
                          .catch((err) =>
                            setError(
                              err instanceof Error ? err.message : "Report failed",
                            ),
                          )
                      }
                    >
                      Report review
                    </Button>
                  </li>
                ))
              ) : (
                <li className={listItemClass}>
                  <p className={leadClass}>No live reviews yet.</p>
                </li>
              )}
            </ul>
            <form className={formStackClass} onSubmit={(e) => void onReview(e)}>
              <Field id="rev-stars" label="Stars">
                <FieldInput
                  id="rev-stars"
                  type="number"
                  min={1}
                  max={5}
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                />
              </Field>
              <Field
                id="rev-body"
                label="Your review"
                hint="Minimum 20 characters. Moderated before display."
              >
                <FieldTextarea
                  id="rev-body"
                  required
                  minLength={20}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={busy || !online}>
                Submit review
              </Button>
            </form>
          </section>
        </div>
      ) : null}
    </AppPage>
  );
}
