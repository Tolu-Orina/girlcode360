import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/primitives/chip";
import { Button } from "@/components/ui/button";
import { useMirrorPhotos } from "@/hooks/use-mirror-photos";
import { ctaLabel } from "@/lib/cta";
import {
  MIRROR_PHOTO_LABELS,
  type MirrorPhotoKind,
  type MirrorPhoto,
} from "@/lib/mirror-photos";
import { elevatedCardClass, leadClass } from "@/components/blocks/app-page";
import { cn } from "@/lib/utils";

const KINDS: MirrorPhotoKind[] = ["face", "body", "hand", "garment"];
type Filter = "all" | MirrorPhotoKind;

function PhotoTile({
  photo,
  src,
  on,
  onPick,
}: {
  photo: MirrorPhoto;
  src: string | undefined;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "ring-2 ring-ring" : "",
      )}
      onClick={onPick}
    >
      <img
        src={src}
        alt={`${MIRROR_PHOTO_LABELS[photo.kind]} from ${new Date(photo.createdAt).toLocaleDateString()}`}
        className={cn(
          "aspect-[4/5] w-full object-cover",
          photo.kind === "body" ? "object-[center_12%]" : "object-[center_18%]",
        )}
      />
      <span className="absolute bottom-1 left-1 rounded-[var(--radius)] bg-background/90 px-1.5 py-0.5 text-[length:var(--text-caption)] text-foreground">
        {MIRROR_PHOTO_LABELS[photo.kind]}
      </span>
    </button>
  );
}

export function MirrorPhotoTray({
  preferredKind,
  acceptedKinds,
  useLabel,
  disabled,
  busy,
}: {
  preferredKind: MirrorPhotoKind;
  acceptedKinds?: MirrorPhotoKind[];
  useLabel: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { photos, queuePhoto, removePhoto } = useMirrorPhotos();
  const [kind, setKind] = useState<Filter>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const usable = acceptedKinds?.length ? acceptedKinds : [preferredKind];

  const visible = photos.filter((p) => kind === "all" || p.kind === kind);
  const overflow = visible.length > 4;
  const preview = overflow ? visible.slice(0, 3) : visible.slice(0, 4);
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of photos) map.set(p.id, URL.createObjectURL(p.blob));
    return map;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [urls]);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const selected = picked
    ? (visible.find((p) => p.id === picked) ?? null)
    : null;
  const canUse = Boolean(selected && usable.includes(selected.kind));

  function pick(id: string) {
    setPicked(id);
  }

  return (
    <>
      <aside
        className={cn(elevatedCardClass, "min-w-0 overflow-hidden border-0 p-4 lg:p-4")}
        aria-label="Saved Mirror photos"
      >
        <header className="grid gap-1">
          <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
            Saved photos
          </h2>
        </header>
        {photos.length === 0 ? (
          <p className={leadClass}>
            Capture a still and it appears here.
          </p>
        ) : visible.length === 0 ? (
          <p className={leadClass}>
            No {MIRROR_PHOTO_LABELS[kind as MirrorPhotoKind].toLowerCase()} photos
            yet.
          </p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {preview.map((photo) => (
              <li key={photo.id}>
                <PhotoTile
                  photo={photo}
                  src={urls.get(photo.id)}
                  on={selected?.id === photo.id}
                  onPick={() => pick(photo.id)}
                />
              </li>
            ))}
            {overflow ? (
              <li>
                <button
                  type="button"
                  className="grid aspect-[4/5] w-full place-items-center rounded-[var(--radius)] bg-muted text-[length:var(--text-label)] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setMoreOpen(true)}
                >
                  View more
                </button>
              </li>
            ) : null}
          </ul>
        )}
        {selected ? (
          <div className="grid min-w-0 gap-2">
            {!canUse ? (
              <p className={leadClass}>
                This studio cannot use a {MIRROR_PHOTO_LABELS[selected.kind].toLowerCase()}{" "}
                photo. Pick a {usable.map((k) => MIRROR_PHOTO_LABELS[k].toLowerCase()).join(" or ")}{" "}
                still, or take one.
              </p>
            ) : null}
            <Button
              type="button"
              className="h-auto min-h-[var(--tap)] w-full min-w-0 whitespace-normal"
              disabled={disabled || busy || !canUse}
              onClick={() => queuePhoto(selected)}
            >
              {ctaLabel(Boolean(busy), useLabel)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-[var(--tap)] w-full min-w-0 whitespace-normal"
              disabled={disabled || busy}
              onClick={() => void removePhoto(selected.id)}
            >
              Remove from this device
            </Button>
          </div>
        ) : null}
      </aside>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mirror-photos-more-title"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className={cn(
              elevatedCardClass,
              "w-full max-w-[var(--auth-max)] border-0 shadow-[var(--shadow-modal)]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="grid gap-1">
              <h2
                id="mirror-photos-more-title"
                className="m-0 text-[length:var(--text-sub)] text-foreground"
              >
                Saved photos
              </h2>
              <p className={leadClass}>Tap a still, then Use.</p>
            </header>
            <div className="flex flex-wrap gap-2">
              <Chip
                pressed={kind === "all"}
                className="min-h-8 px-3 text-[length:var(--text-caption)]"
                onClick={() => {
                  setKind("all");
                  setPicked(null);
                }}
              >
                All
              </Chip>
              {KINDS.map((k) => (
                <Chip
                  key={k}
                  pressed={kind === k}
                  className="min-h-8 px-3 text-[length:var(--text-caption)]"
                  onClick={() => {
                    setKind(k);
                    setPicked(null);
                  }}
                >
                  {MIRROR_PHOTO_LABELS[k]}
                </Chip>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className={leadClass}>No photos in this filter.</p>
            ) : (
              <ul className="m-0 grid max-h-[60dvh] list-none grid-cols-2 gap-2 overflow-y-auto p-0">
                {visible.map((photo) => (
                  <li key={photo.id}>
                    <PhotoTile
                      photo={photo}
                      src={urls.get(photo.id)}
                      on={selected?.id === photo.id}
                      onPick={() => pick(photo.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-auto min-h-[var(--tap)] min-w-0 whitespace-normal"
                disabled={disabled || busy || !canUse}
                onClick={() => {
                  if (!selected || !canUse) return;
                  queuePhoto(selected);
                  setMoreOpen(false);
                }}
              >
                {ctaLabel(Boolean(busy), useLabel)}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMoreOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
