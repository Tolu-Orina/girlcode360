import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionRow,
  elevatedCardClass,
  leadClass,
} from "@/components/blocks/app-page";
import { EmptyState } from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import {
  createMirrorTryOn,
  getMirrorCatalogue,
  getMirrorTryOn,
  getMirrorTryOnMedia,
  listMirrorTryOns,
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
  ApparelTryOn,
  MirrorCatalogueItem,
  MirrorStatus,
} from "../../../../../packages/api-types/src/index";

type CatalogueMode = "all" | "maternity" | "pmos";

function garmentKind(item: MirrorCatalogueItem): string {
  if (item.garmentCategory === "upper_body") return "Top";
  if (item.garmentCategory === "lower_body") return "Bottom";
  return "Full look";
}

function garmentMeta(item: MirrorCatalogueItem): string {
  const tags = [
    garmentKind(item),
    item.boutiqueName,
    item.pmosFit ? "PMOS" : null,
    item.trimester ? `trimester ${item.trimester}` : null,
  ].filter(Boolean);
  return tags.join(" · ");
}

export function MirrorApparelPanel({
  status,
  online,
  busy,
  onBusy,
  onError,
  friendlyError,
  tray,
  pregnancyOn,
  pmosOn,
  focusItemId,
}: {
  status: MirrorStatus;
  online: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  friendlyError: (err: unknown) => string;
  tray: ReactNode;
  pregnancyOn: boolean;
  pmosOn: boolean;
  focusItemId?: string | null;
}) {
  const [mode, setMode] = useState<CatalogueMode>("all");
  const [items, setItems] = useState<MirrorCatalogueItem[]>([]);
  const [emptyReason, setEmptyReason] = useState<string | undefined>();
  const [picked, setPicked] = useState<string | null>(null);
  const [tryons, setTryons] = useState<ApparelTryOn[]>([]);
  const [selected, setSelected] = useState<ApparelTryOn | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [lastBodyB64, setLastBodyB64] = useState<string | null>(null);
  const [rescan, setRescan] = useState(false);
  const pending = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const captureOff = busy || !status.youcamConfigured || !online;
  const pickedItem = items.find((i) => i.id === picked);
  const working = selected?.status === "pending";
  const showCamera = rescan || !src;

  const loadLooks = useCallback(async () => {
    const { tryons: rows } = await listMirrorTryOns();
    setTryons(rows);
    setSelected((cur) => rows.find((row) => row.id === cur?.id) ?? rows[0] ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getMirrorCatalogue({ kind: "apparel", mode })
      .then((cat) => {
        if (cancelled) return;
        const next = cat.items.filter((row) => row.kind === "apparel");
        setItems(next);
        setEmptyReason(cat.emptyReason);
        setPicked((cur) => next.find((row) => row.id === cur)?.id ?? next[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) onError(friendlyError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, friendlyError, onError]);

  useEffect(() => {
    void loadLooks().catch((err) => onError(friendlyError(err)));
  }, [loadLooks, friendlyError, onError]);

  useEffect(() => {
    if (!focusItemId) return;
    setPicked(focusItemId);
    setMode("all");
  }, [focusItemId]);

  useEffect(() => {
    setRescan(false);
  }, [picked]);

  useEffect(() => {
    if (rescan) return;
    if (selected?.status === "pending") return;
    if (!selected?.hasResultImage) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getMirrorTryOnMedia(selected.id);
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
        const { tryon } = await getMirrorTryOn(id);
        if (tryon.status !== "pending") {
          pending.current = null;
          window.clearInterval(tick);
          await loadLooks();
          setSelected(tryon);
          onBusy(false);
        }
      } catch (err) {
        pending.current = null;
        window.clearInterval(tick);
        onBusy(false);
        onError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [selected?.id, loadLooks, onBusy, onError, friendlyError]);

  async function runTryOn(imageB64: string) {
    if (!picked) {
      onError("Choose a look, then add a full-body photo.");
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const { tryon } = await createMirrorTryOn(imageB64, picked);
      pending.current = tryon.id;
      setSelected(tryon);
      setRescan(false);
      if (tryon.status !== "pending") {
        pending.current = null;
        await loadLooks();
        setSelected(tryon);
        onBusy(false);
      }
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  async function onBodyFile(file: File | undefined) {
    if (!file) return;
    if (!picked) {
      onError("Choose a look, then add a full-body photo.");
      return;
    }
    onBusy(true);
    onError(null);
    try {
      setSrc(URL.createObjectURL(file));
      setRescan(false);
      const imageB64 = await fileToJpegDataUrl(file);
      setLastBodyB64(imageB64);
      await runTryOn(imageB64);
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  const onBodyFileRef = useRef(onBodyFile);
  onBodyFileRef.current = onBodyFile;

  useEffect(() => {
    const queued = photos?.queued;
    if (!queued) return;
    if (queued.token === lastQueued.current) return;
    if (queued.kind !== "body") return;
    lastQueued.current = queued.token;
    photos?.consumeQueued(queued.token);
    void onBodyFileRef.current(queued.file);
  }, [photos]);

  return (
    <div className="grid min-w-0 gap-6">
      <SegmentedTabs
        ariaLabel="Catalogue filter"
        value={mode}
        onChange={(id) => setMode(id as CatalogueMode)}
        items={[
          { id: "all", label: "All looks" },
          { id: "maternity", label: "Maternity" },
          { id: "pmos", label: "PMOS comfort" },
        ]}
      />

      <div className={mirrorStudioRowClass}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {showCamera ? (
            <CameraStillCapture
              chrome="stage"
              disabled={captureOff || !picked}
              facingMode="environment"
              guide="body"
              captureLabel="Take a full-body photo"
              videoLabel="Live camera for a full-body try-on still"
              photoKind="body"
              onFile={(file) => void onBodyFile(file)}
              onError={onError}
            />
          ) : (
            <MirrorStage
              pending={working}
              pendingLabel="Building the try-on. Keep this screen open."
              dock={
                <div className="grid gap-4">
                  {selected?.status === "error" ? (
                    <p className={leadClass}>
                      Try-on could not finish. Try another photo.
                    </p>
                  ) : null}
                  <ActionRow>
                    <Button
                      type="button"
                      disabled={captureOff}
                      onClick={() => setRescan(true)}
                    >
                      Try another photo
                    </Button>
                  </ActionRow>
                </div>
              }
            >
              {src ? (
                <img
                  src={src}
                  alt="Apparel try-on"
                  className="size-full object-cover object-[center_12%]"
                />
              ) : (
                <MirrorStageEmpty label="Stand back in even light, full body in frame" />
              )}
            </MirrorStage>
          )}
        </div>

        <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-1 lg:col-start-3 lg:row-start-1">
          {tray}
        </div>

        <aside className="grid min-w-0 gap-6 max-lg:col-span-2 lg:col-start-2 lg:row-start-1">
          <article className={cn(elevatedCardClass, "border-0")}>
            <header className="grid gap-1">
              <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                Boutique looks
              </h2>
              <p className={leadClass}>
                Pick a look, then a full-body photo. Tops and bottoms can reuse
                the same still. No swimwear in this catalogue.
              </p>
            </header>
            {mode === "maternity" && !pregnancyOn ? (
              <p className={leadClass}>
                Turn on Pregnancy in Account to filter by week. All looks still
                shows every piece.
              </p>
            ) : null}
            {mode === "pmos" && !pmosOn ? (
              <p className={leadClass}>
                PMOS comfort is a demo filter. Enable PMOS Manager if you want
                that module elsewhere.
              </p>
            ) : null}
            {emptyReason === "pregnancy_week_unknown" ? (
              <p className={leadClass}>
                Add a pregnancy start date in Health to match looks to your week.
              </p>
            ) : null}
            {!items.length && emptyReason !== "pregnancy_week_unknown" ? (
              <EmptyState title="No looks in this filter" body="Try All looks." />
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
                        {row.refImageUrl ? (
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
                            {garmentMeta(row)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {lastBodyB64 ? (
              <Button
                type="button"
                disabled={captureOff || !picked}
                onClick={() => void runTryOn(lastBodyB64)}
              >
                Try last photo in this look
              </Button>
            ) : null}
            {!pickedItem ? (
              <p className={leadClass}>Pick a look before you capture.</p>
            ) : null}
          </article>

          {tryons.length > 1 ? (
            <ul
              className="m-0 flex list-none flex-wrap gap-2 p-0"
              aria-label="Earlier apparel try-ons"
            >
              {tryons.slice(0, 8).map((row) => {
                const on = selected?.id === row.id;
                const look = items.find((i) => i.id === row.catalogueItemId);
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
                        if (row.catalogueItemId) setPicked(row.catalogueItemId);
                      }}
                    >
                      {look?.title ?? "Look"}
                      {row.status === "pending" ? " · Working" : ""}
                      {row.status === "error" ? " · Could not finish" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : tryons.length === 0 ? (
            <EmptyState
              title="No try-ons yet"
              body="Pick a look, then add a full-body photo."
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
