import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { AskAlenaWearLink } from "@/components/blocks/ask-alena-link";
import {
  ActionRow,
  elevatedCardClass,
  leadClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import {
  EmptyState,
  SuccessBanner,
} from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import {
  CURRENT_POLICY_VERSION,
  createWardrobeOutfit,
  createWardrobeOutfitTryOn,
  createWardrobePackingList,
  createResaleListing,
  getWardrobeItemMedia,
  getWardrobeOutfit,
  getWardrobeOutfitMedia,
  listWardrobeItems,
  listWardrobeOutfits,
  markWardrobeOutfitWorn,
  patchWardrobeItem,
  postConsents,
  suggestWardrobeOutfit,
} from "@/lib/api";
import { CameraStillCapture } from "@/components/blocks/camera-still";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { PURPOSE_COPY } from "@/lib/consent-copy";
import {
  enqueueWardrobeDraft,
  flushWardrobeQueue,
} from "@/lib/wardrobe-queue";
import { idbGetWardrobeDrafts, type WardrobeDraft } from "@/lib/idb";
import { cn } from "@/lib/utils";
import type {
  Market,
  MirrorCatalogueItem,
  MirrorStatus,
  WardrobeItem,
  WardrobeOutfit,
  WardrobePackingList,
} from "../../../../../packages/api-types/src/index";
import {
  WARDROBE_CATEGORIES,
  WARDROBE_CLIMATES,
  WARDROBE_QUEUE_MAX,
  WARDROBE_TAG_NOTE,
  climateFromMarket,
  suggestWardrobeTags,
} from "../../../../../packages/domain/src/index";

function fileToJpeg(
  file: File,
): Promise<{ dataUrl: string; hexes: string[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const minSide = Math.min(img.width, img.height);
      if (minSide < 400) {
        URL.revokeObjectURL(url);
        reject(new Error("image_too_small"));
        return;
      }
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Could not prepare the photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const hexes: string[] = [];
      const spots = [
        [0.5, 0.5],
        [0.3, 0.3],
        [0.7, 0.7],
      ] as const;
      for (const [px, py] of spots) {
        const x = Math.min(canvas.width - 1, Math.round(canvas.width * px));
        const y = Math.min(canvas.height - 1, Math.round(canvas.height * py));
        const d = ctx.getImageData(x, y, 1, 1).data;
        hexes.push(
          `#${[d[0]!, d[1]!, d[2]!]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("")}`,
        );
      }
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        hexes,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Piece";
  return value.replaceAll("_", " ");
}

function ClosetThumb({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getWardrobeItemMedia(id)
      .then((media) => {
        if (!cancelled) {
          setSrc(`data:${media.contentType};base64,${media.imageB64}`);
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!src) {
    return <div className="aspect-[4/5] w-full bg-muted" aria-hidden />;
  }
  return (
    <img src={src} alt={alt} className="aspect-[4/5] w-full object-cover" />
  );
}

export function BoutiqueSamplesCard({
  samples,
  onOpenApparel,
}: {
  samples: MirrorCatalogueItem[];
  onOpenApparel?: (itemId: string) => void;
}) {
  if (!samples.length) return null;
  return (
    <section className={elevatedCardClass}>
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Boutique samples
      </h2>
      <p className={leadClass}>
        Starter looks from the boutique. Try them on in Apparel. They are not
        added to your closet.
      </p>
      <ul className="m-0 grid list-none gap-3 p-0">
        {samples.map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3"
          >
            {item.refImageUrl ? (
              <img
                src={item.refImageUrl}
                alt=""
                className="size-[4.5rem] rounded-[var(--radius)] bg-muted object-cover"
              />
            ) : (
              <div className="size-[4.5rem] rounded-[var(--radius)] bg-muted" />
            )}
            <div className="grid min-w-0 gap-0.5">
              <strong className="truncate text-[length:var(--text-sub)] text-foreground">
                {item.title}
              </strong>
              <span className="truncate text-[length:var(--text-caption)] text-muted-foreground">
                {item.boutiqueName}
                {item.pmosFit ? " · PMOS" : ""}
                {item.trimester ? ` · trimester ${item.trimester}` : ""}
              </span>
            </div>
            {onOpenApparel ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenApparel(item.id)}
              >
                Try on
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MirrorWardrobePanel({
  status,
  market,
  online,
  busy,
  onBusy,
  onError,
  onStatus,
  friendlyError,
}: {
  status: MirrorStatus;
  market: Market;
  online: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onStatus: () => Promise<void>;
  friendlyError: (err: unknown) => string;
}) {
  const [mode, setMode] = useState<"closet" | "outfit" | "pack">("closet");
  const [capturing, setCapturing] = useState(false);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [drafts, setDrafts] = useState<WardrobeDraft[]>([]);
  const [outfits, setOutfits] = useState<WardrobeOutfit[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [selected, setSelected] = useState<WardrobeItem | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [trySrc, setTrySrc] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<WardrobeOutfit | null>(null);
  const [pack, setPack] = useState<WardrobePackingList | null>(null);
  const [nights, setNights] = useState(4);
  const [priceMinor, setPriceMinor] = useState("");
  const [resaleNote, setResaleNote] = useState<string | null>(null);
  const [climate, setClimate] = useState<(typeof WARDROBE_CLIMATES)[number]>(
    () => climateFromMarket(market),
  );
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const pendingOutfit = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const copy = PURPOSE_COPY.wardrobe;
  const captureOff = busy;

  const load = useCallback(async () => {
    setDrafts(await idbGetWardrobeDrafts());
    if (!status.wardrobeConsented) return;
    try {
      const [itemRes, outfitRes] = await Promise.all([
        listWardrobeItems(),
        listWardrobeOutfits(),
      ]);
      setItems(itemRes.items);
      setOutfits(outfitRes.outfits);
      setSelected(
        (cur) =>
          itemRes.items.find((row) => row.id === cur?.id) ??
          itemRes.items[0] ??
          null,
      );
      setOutfit(
        (cur) =>
          outfitRes.outfits.find((row) => row.id === cur?.id) ??
          outfitRes.outfits[0] ??
          null,
      );
    } catch (err) {
      if (!online) return;
      onError(friendlyError(err));
    }
  }, [status.wardrobeConsented, online, friendlyError, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!online) return;
    void flushWardrobeQueue().then(() => void load());
  }, [online, load]);

  useEffect(() => {
    if (!selected?.hasImage || !status.wardrobeConsented) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getWardrobeItemMedia(selected.id);
        if (!cancelled) {
          setSrc(`data:${media.contentType};base64,${media.imageB64}`);
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, status.wardrobeConsented]);

  useEffect(() => {
    if (!outfit?.hasResultImage) {
      setTrySrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getWardrobeOutfitMedia(outfit.id);
        if (!cancelled) {
          setTrySrc(`data:${media.contentType};base64,${media.imageB64}`);
        }
      } catch {
        if (!cancelled) setTrySrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outfit]);

  useEffect(() => {
    const id = pendingOutfit.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { outfit: next } = await getWardrobeOutfit(id);
        if (next.status !== "pending") {
          pendingOutfit.current = null;
          window.clearInterval(tick);
          await load();
          setOutfit(next);
          onBusy(false);
        }
      } catch (err) {
        pendingOutfit.current = null;
        window.clearInterval(tick);
        onBusy(false);
        onError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [outfit?.id, load, onBusy, onError, friendlyError]);

  async function grantWardrobe() {
    onBusy(true);
    onError(null);
    try {
      await postConsents({
        jurisdiction: market,
        policyVersion: CURRENT_POLICY_VERSION,
        items: [
          { purpose: "health_data", granted: true },
          { purpose: "wardrobe", granted: true },
        ],
      });
      await onStatus();
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function onGarment(file: File | undefined) {
    if (!file) return;
    onBusy(true);
    onError(null);
    try {
      const { dataUrl, hexes } = await fileToJpeg(file);
      const suggested = suggestWardrobeTags({
        sampleHexes: hexes,
        label: category || name,
      });
      if (suggested.banned) {
        onError("Swimwear and lingerie are not catalogued for try-on.");
        return;
      }
      const queued = await enqueueWardrobeDraft({
        imageB64: dataUrl,
        name,
        category: category || suggested.category || "",
        colourTags: suggested.colourTags,
        sampleHexes: hexes,
        purchasePriceMinor: null,
      });
      if (queued.full) {
        onError(
          `This device can hold ${WARDROBE_QUEUE_MAX} unsent photos. Sync when you are online, then add more.`,
        );
        return;
      }
      setDrafts(await idbGetWardrobeDrafts());
      if (online) await load();
      setCapturing(false);
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function saveTags() {
    if (!selected) return;
    onBusy(true);
    onError(null);
    try {
      const { item } = await patchWardrobeItem(selected.id, {
        name: name || selected.name,
        category: category || selected.category || undefined,
        colourTags: selected.colourTags,
      });
      setSelected(item);
      await load();
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function saveOutfit() {
    if (!picked.length) {
      onError("Pick at least one catalogued piece.");
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const { outfit: next } = await createWardrobeOutfit({ itemIds: picked });
      setOutfit(next);
      setMode("outfit");
      await load();
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function onBody(file: File | undefined) {
    if (!file || !outfit) return;
    onBusy(true);
    onError(null);
    try {
      const { dataUrl } = await fileToJpeg(file);
      const { outfit: next } = await createWardrobeOutfitTryOn(outfit.id, {
        imageB64: dataUrl,
      });
      pendingOutfit.current = next.id;
      setOutfit(next);
      if (next.status !== "pending") {
        pendingOutfit.current = null;
        onBusy(false);
      }
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  const onGarmentRef = useRef(onGarment);
  const onBodyRef = useRef(onBody);
  onGarmentRef.current = onGarment;
  onBodyRef.current = onBody;

  useEffect(() => {
    const queued = photos?.queued;
    if (!queued) return;
    if (queued.token === lastQueued.current) return;
    lastQueued.current = queued.token;
    photos?.consumeQueued(queued.token);
    if (queued.kind === "garment") void onGarmentRef.current(queued.file);
    if (queued.kind === "body") void onBodyRef.current(queued.file);
  }, [photos]);

  async function onSuggestToday() {
    onBusy(true);
    onError(null);
    try {
      const { suggestion, outfit: next } = await suggestWardrobeOutfit({
        climate,
      });
      if (next) {
        setOutfit(next);
        setPicked(next.itemIds);
        const { outfits: rows } = await listWardrobeOutfits();
        setOutfits(rows);
      } else {
        onError(
          suggestion.enoughItems
            ? suggestion.notes[0] ?? "Could not save an outfit."
            : "Catalogue a top and bottom (or a one-piece) first. This is not a shopping list.",
        );
      }
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function onResale() {
    if (!selected) return;
    const price = Math.round(Number(priceMinor) * 100);
    onBusy(true);
    onError(null);
    try {
      const { listing, message } = await createResaleListing({
        wardrobeItemId: selected.id,
        priceMinor: price,
      });
      setPriceMinor("");
      setResaleNote(`${listing.peerLabel}. ${message}`);
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function onPack() {
    onBusy(true);
    onError(null);
    try {
      const { list } = await createWardrobePackingList({ nights, climate });
      setPack(list);
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  const closetCard = !status.wardrobeConsented ? (
    <section className={elevatedCardClass}>
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Your closet
      </h2>
      <p className={leadClass}>{copy.body}</p>
      <ActionRow>
        <Button type="button" disabled={busy} onClick={() => void grantWardrobe()}>
          Allow clothing photos
        </Button>
      </ActionRow>
    </section>
  ) : (
    <section className={elevatedCardClass}>
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Your closet
      </h2>
      <p className={leadClass}>
        Photograph pieces you already own. Boutique samples stay in the card
        below — they are not added here.
      </p>
      {!online ? (
        <p className={leadClass} role="status">
          You can photograph pieces offline. Tagging and try-on wait until you
          reconnect. Queue {drafts.length} of {WARDROBE_QUEUE_MAX}.
        </p>
      ) : drafts.length ? (
        <p className={leadClass} role="status">
          {drafts.length} photo{drafts.length === 1 ? "" : "s"} waiting to sync.
        </p>
      ) : null}

      <SegmentedTabs
        ariaLabel="Wardrobe sections"
        value={mode}
        onChange={(id) => setMode(id as typeof mode)}
        items={[
          { id: "closet", label: "Your closet" },
          { id: "outfit", label: "Outfits" },
          { id: "pack", label: "Packing list" },
        ]}
      />

      {mode === "closet" ? (
        <>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
            <li>
              <button
                type="button"
                className="grid aspect-[4/5] w-full place-content-center gap-2 rounded-[var(--radius)] bg-muted px-3 text-center text-foreground"
                onClick={() => setCapturing((open) => !open)}
              >
                <Camera className="mx-auto size-6" aria-hidden />
                <span className="text-[length:var(--text-sub)] font-semibold">
                  Photograph piece
                </span>
              </button>
            </li>
            {drafts.map((draft) => (
              <li key={draft.id} className="grid gap-2">
                <div className="overflow-hidden rounded-[var(--radius)] bg-muted">
                  <img
                    src={draft.imageB64}
                    alt=""
                    className="aspect-[4/5] w-full object-cover opacity-80"
                  />
                </div>
                <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                  Waiting to sync
                </p>
              </li>
            ))}
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={cn(
                    "grid w-full gap-2 overflow-hidden rounded-[var(--radius)] bg-muted text-left",
                    selected?.id === row.id && "ring-2 ring-primary",
                  )}
                  onClick={() => {
                    setSelected(row);
                    setName(row.name ?? "");
                    setCategory(row.category ?? "");
                    setCapturing(false);
                  }}
                >
                  <ClosetThumb
                    id={row.id}
                    alt={row.name || categoryLabel(row.category)}
                  />
                  <span className="grid gap-0.5 px-2 pb-2">
                    <strong className="truncate text-[length:var(--text-sub)] text-foreground">
                      {row.name || categoryLabel(row.category)}
                    </strong>
                    <span className="truncate text-[length:var(--text-caption)] text-muted-foreground">
                      {categoryLabel(row.category)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.length === 0 && drafts.length === 0 ? (
            <p className={leadClass}>
              No pieces yet. Photograph a garment on a plain surface.
            </p>
          ) : null}

          {capturing ? (
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-[length:var(--text-label)]">
                  Name (optional)
                </span>
                <input
                  className="min-h-[var(--tap)] rounded-[var(--radius)] border border-border bg-card px-3 text-[length:var(--text-body)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[length:var(--text-label)]">Category</span>
                <select
                  className="min-h-[var(--tap)] rounded-[var(--radius)] border border-border bg-card px-3 text-[length:var(--text-body)]"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Suggest from photo</option>
                  {WARDROBE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <CameraStillCapture
                disabled={captureOff}
                facingMode="environment"
                guide="none"
                captureLabel="Photograph a piece"
                videoLabel="Live camera for a wardrobe still"
                photoKind="garment"
                onFile={(file) => void onGarment(file)}
                onError={onError}
              />
            </div>
          ) : null}

          {selected && online ? (
            <ActionRow>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void saveTags()}
              >
                Save tag corrections
              </Button>
            </ActionRow>
          ) : null}

          {selected ? (
            <article className="grid gap-3">
              <h3 className="m-0 text-[length:var(--text-sub)]">
                {selected.name || "Catalogued piece"}
              </h3>
              {src ? (
                <img
                  src={src}
                  alt=""
                  className="w-full rounded-[var(--radius)] bg-muted"
                />
              ) : null}
              <p className={leadClass}>
                {categoryLabel(selected.category)}
                {selected.colourTags.length
                  ? ` · ${selected.colourTags.join(", ")}`
                  : ""}
                {selected.suggestedCategory &&
                selected.suggestedCategory !== selected.category
                  ? ` · suggested ${categoryLabel(selected.suggestedCategory)}`
                  : ""}
              </p>
              <p className={leadClass}>{WARDROBE_TAG_NOTE}</p>
              <label className="grid gap-2">
                <span className="text-[length:var(--text-label)]">
                  List for resale (major units)
                </span>
                <input
                  className="min-h-[var(--tap)] rounded-[var(--radius)] border border-border bg-card px-3"
                  inputMode="decimal"
                  value={priceMinor}
                  onChange={(e) => setPriceMinor(e.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !online}
                onClick={() => void onResale()}
              >
                List this piece
              </Button>
              {resaleNote ? <SuccessBanner message={resaleNote} /> : null}
              <p className={leadClass}>
                Listings go to the existing moderation queue first. Live rows
                are labelled from a GirlCode360 member.{" "}
                <Link
                  to="/app/marketplace"
                  className="font-semibold text-primary"
                >
                  Marketplace
                </Link>
              </p>
            </article>
          ) : null}
        </>
      ) : null}

      {mode === "outfit" ? (
        <>
          <p className={leadClass}>
            Save an outfit from your closet, then try one garment on your body
            photo — the same 15-second Apparel try-on as boutique looks. No
            swimwear or lingerie. Outfit for today uses pieces you already
            catalogued. Climate is a session or market default, not live weather.
          </p>
          <ActionRow>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !online}
              onClick={() => void onSuggestToday()}
            >
              Outfit for today
            </Button>
          </ActionRow>
          <ul className="m-0 grid list-none gap-2 p-0">
            {items.map((row) => {
              const on = picked.includes(row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "min-h-[var(--tap)] w-full rounded-[var(--radius)] border px-3 py-2 text-left text-[length:var(--text-caption)]",
                      on
                        ? "border-primary bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    onClick={() =>
                      setPicked((cur) =>
                        on ? cur.filter((id) => id !== row.id) : [...cur, row.id],
                      )
                    }
                  >
                    {on ? "Selected · " : ""}
                    {row.name || row.category || "Piece"}
                  </button>
                </li>
              );
            })}
          </ul>
          <ActionRow>
            <Button type="button" disabled={busy || !online} onClick={() => void saveOutfit()}>
              Save outfit
            </Button>
          </ActionRow>
          <CameraStillCapture
            disabled={busy || !online || !outfit}
            facingMode="environment"
            guide="body"
            captureLabel="Try on with a body photo"
            videoLabel="Live camera for a wardrobe body still"
            photoKind="body"
            onFile={(file) => void onBody(file)}
            onError={onError}
          />
          {outfits.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {outfits.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "min-h-[var(--tap)] w-full rounded-[var(--radius)] border px-3 py-2 text-left text-[length:var(--text-caption)]",
                      outfit?.id === row.id
                        ? "border-primary bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    onClick={() => setOutfit(row)}
                  >
                    Outfit · {row.itemIds.length} pieces
                    {row.status === "pending" ? " · Working" : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {outfit ? (
            <article className={cn(outlinedCardClass, "grid gap-3")}>
              <h3 className="m-0 text-[length:var(--text-sub)]">
                Outfit
                {outfit.status === "pending" ? " · Working" : ""}
                {outfit.status === "error" ? " · Could not finish" : ""}
              </h3>
              {trySrc ? (
                <img
                  src={trySrc}
                  alt="Wardrobe outfit try-on"
                  className="w-full rounded-[var(--radius)] border border-border bg-muted"
                />
              ) : null}
              {online ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void markWardrobeOutfitWorn(
                      outfit.id,
                      new Date().toISOString().slice(0, 10),
                    ).then(({ outfit: next }) => setOutfit(next))
                  }
                >
                  Mark worn today
                </Button>
              ) : null}
            </article>
          ) : (
            <EmptyState
              title="No outfits yet"
              body="Select pieces from your closet. Try-on needs a connection and Mirror photo consent for the body shot."
            />
          )}
        </>
      ) : null}

      {mode === "pack" ? (
        <>
          <p className={leadClass}>
            Capsule from pieces you already catalogued. Not a shop list. Climate
            is what you pick here, or a market default — not a live weather feed.
            Daily wear questions also live in{" "}
            <AskAlenaWearLink />
            .
          </p>
          <label className="grid gap-2">
            <span className="text-[length:var(--text-label)]">Nights</span>
            <input
              type="number"
              min={1}
              max={21}
              className="min-h-[var(--tap)] rounded-[var(--radius)] border border-border bg-card px-3"
              value={nights}
              onChange={(e) => setNights(Number(e.target.value) || 1)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[length:var(--text-label)]">Climate</span>
            <select
              className="min-h-[var(--tap)] rounded-[var(--radius)] border border-border bg-card px-3"
              value={climate}
              onChange={(e) =>
                setClimate(e.target.value as (typeof WARDROBE_CLIMATES)[number])
              }
            >
              {WARDROBE_CLIMATES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <ActionRow>
            <Button type="button" disabled={busy || !online} onClick={() => void onPack()}>
              Build packing list
            </Button>
          </ActionRow>
          {pack ? (
            <article className={cn(outlinedCardClass, "grid gap-3")}>
              <h3 className="m-0 text-[length:var(--text-sub)]">
                {pack.enoughItems ? "Capsule from your closet" : "Not enough pieces yet"}
              </h3>
              <ul className="m-0 grid list-none gap-2 p-0">
                {pack.itemIds.map((id) => {
                  const row = items.find((i) => i.id === id);
                  return (
                    <li key={id} className="text-[length:var(--text-body)]">
                      {row?.name || row?.category || id}
                    </li>
                  );
                })}
              </ul>
              {pack.notes.map((n) => (
                <p key={n} className={leadClass}>
                  {n}
                </p>
              ))}
            </article>
          ) : (
            <EmptyState
              title="No packing list yet"
              body="Catalogue a few tops and bottoms, then pick trip length and climate."
            />
          )}
        </>
      ) : null}
    </section>
  );

  return closetCard;
}
