import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionRow,
  elevatedCardClass,
  leadClass,
} from "@/components/blocks/app-page";
import { EmptyState } from "@/components/blocks/states";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import { ctaLabel } from "@/lib/cta";
import {
  createAccessoryLook,
  getAccessoryLook,
  getAccessoryLookMedia,
  getMirrorCatalogue,
  listAccessoryLooks,
} from "@/lib/api";
import { CameraStillCapture } from "@/components/blocks/camera-still";
import {
  MirrorStage,
  MirrorStageEmpty,
  mirrorStudioRowClass,
} from "@/components/blocks/mirror-stage";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  AccessoryLook,
  MirrorCatalogueItem,
  MirrorStatus,
  SkinScan,
} from "../../../../../packages/api-types/src/index";
import { ACCESSORY_NO_2D_TO_3D_NOTE } from "../../../../../packages/domain/src/index";

type AccMode = "jewellery" | "eyewear" | "nail";

function needsHand(item: MirrorCatalogueItem | undefined, mode: AccMode): boolean {
  if (mode === "nail") return true;
  if (mode !== "jewellery" || !item) return false;
  const cat = item.accessoryCategory;
  return cat === "ring" || cat === "bracelet" || cat === "watch";
}

function modeLead(mode: AccMode): string {
  if (mode === "jewellery") return ACCESSORY_NO_2D_TO_3D_NOTE;
  if (mode === "eyewear") {
    return "Frames are in the catalogue. Eyewear try-on is not on this API.";
  }
  return "Photograph a hand in even light. Colour is a preview, not a salon match.";
}

function lookKindLabel(row: AccessoryLook): string {
  if (row.kind === "nail") return "Nails";
  if (row.kind === "eyewear") return "Eyewear";
  return row.accessoryCategory?.replaceAll("_", " ") || "Jewellery";
}

export function MirrorAccessoriesPanel({
  status,
  scans,
  online,
  busy,
  onBusy,
  onError,
  friendlyError,
  tray,
}: {
  status: MirrorStatus;
  scans: SkinScan[];
  online: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  friendlyError: (err: unknown) => string;
  tray: ReactNode;
}) {
  const [mode, setMode] = useState<AccMode>("jewellery");
  const [items, setItems] = useState<MirrorCatalogueItem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [looks, setLooks] = useState<AccessoryLook[]>([]);
  const [selected, setSelected] = useState<AccessoryLook | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [rescan, setRescan] = useState(false);
  const pending = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const reusable = scans.find((s) => !s.seeded && s.status === "success");
  const captureOff = busy || !status.youcamConfigured || !online;
  const catKind = mode === "nail" ? "nail_color" : mode;
  const pickedItem = items.find((i) => i.id === picked);
  const handShot = needsHand(pickedItem, mode);
  const canTryOn = Boolean(pickedItem?.tryOnReady) && mode !== "eyewear";
  const working = selected?.status === "pending";
  const showCamera = rescan || !src;
  const modeLooks = looks.filter((row) => row.kind === mode);

  const load = useCallback(async () => {
    const [cat, lookRes] = await Promise.all([
      getMirrorCatalogue({ kind: catKind }),
      listAccessoryLooks(),
    ]);
    setItems(cat.items);
    setLooks(lookRes.looks);
    setPicked(
      (cur) =>
        cat.items.find((i) => i.id === cur)?.id ??
        cat.items.find((i) => i.tryOnReady)?.id ??
        cat.items[0]?.id ??
        null,
    );
    setSelected((cur) => {
      const same = lookRes.looks.find((row) => row.id === cur?.id);
      if (same) return same;
      return lookRes.looks.find((row) => row.kind === mode) ?? lookRes.looks[0] ?? null;
    });
  }, [catKind, mode]);

  useEffect(() => {
    void load().catch((err) => onError(friendlyError(err)));
  }, [load, friendlyError, onError]);

  useEffect(() => {
    setRescan(false);
  }, [mode]);

  useEffect(() => {
    if (rescan) return;
    if (selected?.status === "pending") return;
    if (!selected?.hasResultImage) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getAccessoryLookMedia(selected.id);
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
  }, [selected, rescan]);

  useEffect(() => {
    const id = pending.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { look } = await getAccessoryLook(id);
        if (look.status !== "pending") {
          pending.current = null;
          window.clearInterval(tick);
          await load();
          setSelected(look);
          onBusy(false);
          if (look.status === "error") {
            onError(
              "Try-on could not finish. Use another still in even light, then try again.",
            );
          }
        }
      } catch (err) {
        pending.current = null;
        window.clearInterval(tick);
        onBusy(false);
        onError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [selected?.id, load, onBusy, onError, friendlyError]);

  async function run(file?: File) {
    const item = items.find((i) => i.id === picked);
    if (!item) {
      onError("Pick a catalogue piece first.");
      return;
    }
    if (!item.tryOnReady || mode === "eyewear") {
      onError(
        mode === "eyewear"
          ? "Eyewear try-on is not on this API. Browse the frames only."
          : ACCESSORY_NO_2D_TO_3D_NOTE,
      );
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const imageB64 = file ? await fileToJpegDataUrl(file) : undefined;
      const scanId =
        mode === "nail" || handShot
          ? undefined
          : imageB64
            ? undefined
            : reusable?.id;
      if ((mode === "nail" || handShot) && !imageB64) {
        onBusy(false);
        onError(
          mode === "nail"
            ? "Nail try-on needs a hand photo."
            : "This piece needs a hand or wrist photo.",
        );
        return;
      }
      if (mode !== "nail" && !handShot && !imageB64 && !scanId) {
        onBusy(false);
        onError("Add a face photo, or take a skin scan first.");
        return;
      }
      const { look } = await createAccessoryLook(mode, {
        catalogueItemId: item.id,
        imageB64,
        scanId,
      });
      pending.current = look.id;
      setSelected(look);
      setRescan(false);
      if (look.status !== "pending") {
        pending.current = null;
        await load();
        setSelected(look);
        onBusy(false);
      }
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const queued = photos?.queued;
    if (!queued) return;
    if (queued.token === lastQueued.current) return;
    const want = handShot ? "hand" : "face";
    if (queued.kind !== want) return;
    lastQueued.current = queued.token;
    photos?.consumeQueued(queued.token);
    void runRef.current(queued.file);
  }, [photos, handShot]);

  return (
    <div className="grid min-w-0 gap-6">
      <SegmentedTabs
        ariaLabel="Accessory type"
        value={mode}
        onChange={(id) => {
          setMode(id as AccMode);
          setPicked(null);
        }}
        items={[
          { id: "jewellery", label: "Jewellery" },
          { id: "eyewear", label: "Eyewear" },
          { id: "nail", label: "Nails" },
        ]}
      />

      <div className={mirrorStudioRowClass}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {showCamera ? (
            <CameraStillCapture
              chrome="stage"
              disabled={captureOff || !canTryOn}
              busy={busy}
              facingMode={handShot ? "environment" : "user"}
              guide={handShot ? "none" : "face"}
              captureLabel={
                handShot
                  ? mode === "nail"
                    ? "Photograph a hand"
                    : "Photograph a hand or wrist"
                  : "Take a face photo"
              }
              videoLabel={
                handShot
                  ? "Live camera for a hand still"
                  : "Live camera for an accessory still"
              }
              photoKind={handShot ? "hand" : "face"}
              onFile={(file) => void run(file)}
              onError={onError}
            />
          ) : (
            <MirrorStage
              pending={working}
              pendingLabel="Trying this piece. Keep this screen open."
              dock={
                <div className="grid gap-4">
                  {selected?.status === "error" ? (
                    <p className={leadClass}>
                      Try-on could not finish. Use another still in even light, then try again.
                    </p>
                  ) : null}
                  <ActionRow>
                    <Button
                      type="button"
                      disabled={captureOff}
                      onClick={() => setRescan(true)}
                    >
                      {ctaLabel(busy, "Try another photo")}
                    </Button>
                  </ActionRow>
                </div>
              }
            >
              {src ? (
                <img
                  src={src}
                  alt="Accessory try-on"
                  className="size-full object-cover object-center"
                />
              ) : (
                <MirrorStageEmpty
                  label={
                    handShot
                      ? "Show a hand in even light"
                      : "Face the camera in even light"
                  }
                />
              )}
            </MirrorStage>
          )}
        </div>

        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          {tray}
        </div>

        <aside className="grid min-w-0 gap-6 lg:col-start-2 lg:row-start-1">
          <article className={cn(elevatedCardClass, "border-0")}>
            <header className="grid gap-1">
              <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                {mode === "jewellery"
                  ? "Pieces"
                  : mode === "eyewear"
                    ? "Frames"
                    : "Colours"}
              </h2>
              <p className={leadClass}>{modeLead(mode)}</p>
            </header>

            {items.length === 0 ? (
              <EmptyState
                title="Nothing in this catalogue yet"
                body="Jewellery needs a SKU still. Eyewear stays catalogue-only. Nails need a colour hex."
              />
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {items.map((row) => {
                  const on = picked === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        className={cn(
                          "grid w-full grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius)] p-2 text-left",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on
                            ? "bg-muted text-foreground shadow-[var(--shadow-2)]"
                            : "bg-card text-muted-foreground",
                        )}
                        onClick={() => setPicked(row.id)}
                      >
                        {row.nailColor ? (
                          <span
                            className="size-14 rounded-[var(--radius)]"
                            style={{ backgroundColor: row.nailColor }}
                            aria-hidden
                          />
                        ) : row.refImageUrl ? (
                          <img
                            src={row.refImageUrl}
                            alt=""
                            className="size-14 rounded-[var(--radius)] bg-muted object-cover"
                          />
                        ) : (
                          <span className="size-14 rounded-[var(--radius)] bg-muted" />
                        )}
                        <span className="grid min-w-0 gap-0.5">
                          <strong className="truncate text-[length:var(--text-sub)] text-foreground">
                            {row.title}
                          </strong>
                          <span className="truncate text-[length:var(--text-caption)]">
                            {row.boutiqueName}
                            {row.tryOnReady
                              ? ""
                              : mode === "eyewear"
                                ? " · catalogue only"
                                : " · no SKU still"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {mode !== "eyewear" && !handShot ? (
              <Button
                type="button"
                disabled={captureOff || !canTryOn || !reusable}
                onClick={() => void run()}
              >
                {ctaLabel(busy, "Try on last skin scan")}
              </Button>
            ) : null}
            {mode !== "eyewear" && !handShot && !reusable ? (
              <p className={leadClass}>
                Capture a face still, or take a Skin scan first.
              </p>
            ) : null}
            {mode === "eyewear" ? (
              <p className={leadClass}>
                Pick a frame to remember it. Capture stays off until eyewear
                try-on is on the API.
              </p>
            ) : null}
            {mode === "nail" ? (
              <SheMatchBanner trigger="mirror_nail" extraTags={["nail"]} />
            ) : null}
          </article>

          {modeLooks.length > 1 ? (
            <ul
              className="m-0 flex list-none flex-wrap gap-2 p-0"
              aria-label="Earlier accessory try-ons"
            >
              {modeLooks.slice(0, 8).map((row) => {
                const on = selected?.id === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "min-h-12 rounded-[var(--radius)] px-4 text-[length:var(--text-caption)] font-semibold",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on
                          ? "bg-muted text-foreground shadow-[var(--shadow-2)]"
                          : "bg-card text-muted-foreground",
                      )}
                      onClick={() => {
                        setRescan(false);
                        setSelected(row);
                      }}
                    >
                      {lookKindLabel(row)}
                      {row.status === "pending" ? " · Working" : ""}
                      {row.status === "error" ? " · Could not finish" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
