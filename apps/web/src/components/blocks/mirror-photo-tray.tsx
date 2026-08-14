import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/primitives/chip";
import { Button } from "@/components/ui/button";
import { useMirrorPhotos } from "@/hooks/use-mirror-photos";
import {
  MIRROR_PHOTO_LABELS,
  type MirrorPhotoKind,
} from "@/lib/mirror-photos";
import { leadClass, outlinedCardClass } from "@/components/blocks/app-page";
import { cn } from "@/lib/utils";

const KINDS: MirrorPhotoKind[] = ["face", "body", "hand", "garment"];
type Filter = "all" | MirrorPhotoKind;

export function MirrorPhotoTray({
  preferredKind,
  acceptedKinds,
  useLabel,
  disabled,
}: {
  preferredKind: MirrorPhotoKind;
  acceptedKinds?: MirrorPhotoKind[];
  useLabel: string;
  disabled?: boolean;
}) {
  const { photos, queuePhoto, removePhoto } = useMirrorPhotos();
  const [kind, setKind] = useState<Filter>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const usable = acceptedKinds?.length ? acceptedKinds : [preferredKind];

  const visible = photos.filter((p) => kind === "all" || p.kind === kind);
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

  const selected = picked
    ? (visible.find((p) => p.id === picked) ?? null)
    : null;
  const canUse = Boolean(selected && usable.includes(selected.kind));

  return (
    <aside
      className={cn(
        outlinedCardClass,
        "grid gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-var(--header-height)-4rem)] lg:overflow-y-auto",
      )}
      aria-label="Saved Mirror photos"
    >
      <header className="grid gap-1">
        <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
          Saved photos
        </h2>
        <p className={leadClass}>
          Skin, Makeup, Hair, and Apparel share this tray. Tap a photo, then
          Use — apparel try-on needs a full-body still.
        </p>
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
      {photos.length === 0 ? (
        <p className={leadClass}>
          No saved photos yet. Capture once in Skin or Makeup and it appears
          here.
        </p>
      ) : visible.length === 0 ? (
        <p className={leadClass}>
          No {MIRROR_PHOTO_LABELS[kind as MirrorPhotoKind].toLowerCase()} photos
          yet. Switch to All to see Skin and Makeup stills.
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 lg:grid-cols-2">
          {visible.map((photo) => {
            const on = selected?.id === photo.id;
            return (
              <li key={photo.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    "relative overflow-hidden rounded-[var(--radius)] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary" : "border-border",
                  )}
                  onClick={() => setPicked(photo.id)}
                >
                  <img
                    src={urls.get(photo.id)}
                    alt={`${MIRROR_PHOTO_LABELS[photo.kind]} from ${new Date(photo.createdAt).toLocaleDateString()}`}
                    className={cn(
                      "aspect-[4/5] w-full object-cover",
                      photo.kind === "body"
                        ? "object-[center_12%]"
                        : "object-[center_18%]",
                    )}
                  />
                  <span className="absolute bottom-1 left-1 rounded-[var(--radius)] bg-background/90 px-1.5 py-0.5 text-[length:var(--text-caption)] text-foreground">
                    {MIRROR_PHOTO_LABELS[photo.kind]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected ? (
        <div className="grid gap-2">
          {!canUse ? (
            <p className={leadClass}>
              This studio cannot use a {MIRROR_PHOTO_LABELS[selected.kind].toLowerCase()}{" "}
              photo. Pick a {usable.map((k) => MIRROR_PHOTO_LABELS[k].toLowerCase()).join(" or ")}{" "}
              still, or take one.
            </p>
          ) : null}
          <Button
            type="button"
            disabled={disabled || !canUse}
            onClick={() => queuePhoto(selected)}
          >
            {useLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void removePhoto(selected.id)}
          >
            Remove from this device
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
