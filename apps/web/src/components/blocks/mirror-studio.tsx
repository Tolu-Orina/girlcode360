import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionRow,
  elevatedCardClass,
  leadClass,
} from "@/components/blocks/app-page";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { EmptyState } from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { MakeupFeatureRail, useMakeupLook } from "@/components/blocks/makeup-look-context";
import { Button } from "@/components/ui/button";
import {
  CURRENT_POLICY_VERSION,
  createMakeupLook,
  createShadeMatch,
  getMakeupLook,
  getMakeupLookMedia,
  listMakeupLooks,
  listShadeMatches,
  postConsents,
  saveMakeupLook,
} from "@/lib/api";
import { CameraStillCapture } from "@/components/blocks/camera-still";
import { MirrorStage, MirrorStageEmpty, mirrorStudioRowClass } from "@/components/blocks/mirror-stage";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { PURPOSE_COPY } from "@/lib/consent-copy";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  MakeupLook,
  Market,
  MirrorStatus,
  ShadeMatch,
  SkinScan,
} from "../../../../../packages/api-types/src/index";

function makeupFailCopy(reason: string | null | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (
    r.includes("face") ||
    r.includes("noface") ||
    r.includes("detect") ||
    r.includes("invalidimage")
  ) {
    return "YouCam could not find a clear face in that still. Use a front-facing photo in even light, then press Use again.";
  }
  if (r.includes("filesize") || r.includes("too_large") || r.includes("exceed")) {
    return "That photo is larger than YouCam allows. Take a new face still, then try the look again.";
  }
  if (r.includes("credit") || r.includes("quota")) {
    return "YouCam could not run this look (account quota). Try again in a minute.";
  }
  if (reason) {
    return `YouCam could not finish this look (${reason}). Try another face still.`;
  }
  return "YouCam could not finish this look. Try another face still in even light.";
}

export function MirrorStudioPanel({
  status,
  scans,
  market,
  online,
  busy,
  onBusy,
  onError,
  onStatus,
  friendlyError,
  tray,
}: {
  status: MirrorStatus;
  scans: SkinScan[];
  market: Market;
  online: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onStatus: () => Promise<void>;
  friendlyError: (err: unknown) => string;
  tray: ReactNode;
}) {
  const { mode, setMode, features, lookSelection } = useMakeupLook();
  const [looks, setLooks] = useState<MakeupLook[]>([]);
  const [selected, setSelected] = useState<MakeupLook | null>(null);
  const [lookSrc, setLookSrc] = useState<string | null>(null);
  const [shade, setShade] = useState<ShadeMatch | null>(null);
  const [rescan, setRescan] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const pendingLook = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const reusable = scans.find((s) => !s.seeded && s.status === "success");

  const load = useCallback(async (keepId?: string) => {
    const [lookRes, shadeRes] = await Promise.all([
      listMakeupLooks(),
      listShadeMatches(),
    ]);
    setLooks(lookRes.looks);
    if (!pendingLook.current) {
      setSelected((cur) => {
        const id = keepId ?? cur?.id;
        if (id) {
          const match = lookRes.looks.find((l) => l.id === id);
          if (match) return match;
        }
        return lookRes.looks[0] ?? null;
      });
    }
    setShade(shadeRes.matches[0] ?? null);
  }, []);

  useEffect(() => {
    void load().catch((err) => onError(friendlyError(err)));
  }, [load, friendlyError, onError]);

  useEffect(() => {
    if (!selected?.hasResultImage) return;
    let cancelled = false;
    (async () => {
      try {
        const media = await getMakeupLookMedia(selected.id);
        if (!cancelled) {
          setLookSrc(`data:${media.contentType};base64,${media.imageB64}`);
        }
      } catch {
        if (!cancelled) setLookSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    const id = pendingLook.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { look } = await getMakeupLook(id);
        if (look.status !== "pending") {
          pendingLook.current = null;
          window.clearInterval(tick);
          await load(look.id);
          setSelected(look);
          onBusy(false);
        }
      } catch (err) {
        pendingLook.current = null;
        window.clearInterval(tick);
        onBusy(false);
        onError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [selected?.id, load, onBusy, onError, friendlyError]);

  async function runLook(
    kind: "live" | "photo" | "transfer",
    body: Parameters<typeof createMakeupLook>[1],
  ) {
    onBusy(true);
    onError(null);
    try {
      const { look } = await createMakeupLook(kind, body);
      pendingLook.current = look.id;
      setSelected(look);
      if (look.status !== "pending") {
        pendingLook.current = null;
        await load(look.id);
        setSelected(look);
        onBusy(false);
      }
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  async function onFaceFile(file: File | undefined, kind: "photo" | "transfer") {
    if (!file) return;
    try {
      setSelected(null);
      setLookSrc(URL.createObjectURL(file));
      setRescan(false);
      const imageB64 = await fileToJpegDataUrl(file, { maxLong: 1024 });
      if (kind === "photo") {
        if (features.length === 0) {
          onError("Turn on at least one makeup feature.");
          return;
        }
        await runLook("photo", {
          imageB64,
          ...lookSelection(),
        });
      } else {
        const ref = refInput.current?.files?.[0];
        if (!ref) {
          onError("Add a reference photo for Get this look.");
          return;
        }
        const referenceB64 = await fileToJpegDataUrl(ref, { maxLong: 1024 });
        await runLook("transfer", {
          imageB64,
          referenceB64,
        });
      }
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  const onFaceFileRef = useRef(onFaceFile);
  onFaceFileRef.current = onFaceFile;

  useEffect(() => {
    const queued = photos?.queued;
    if (!queued || queued.kind !== "face") return;
    if (mode === "transfer" || mode === "shade") return;
    if (queued.token === lastQueued.current) return;
    lastQueued.current = queued.token;
    photos?.consumeQueued(queued.token);
    void onFaceFileRef.current(queued.file, "photo");
  }, [photos, mode]);

  async function grantLiveCamera() {
    onBusy(true);
    onError(null);
    try {
      await postConsents({
        jurisdiction: market,
        policyVersion: CURRENT_POLICY_VERSION,
        items: [
          { purpose: "health_data", granted: true },
          { purpose: "mirror_live_camera", granted: true },
        ],
      });
      await onStatus();
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  async function onShade() {
    onBusy(true);
    onError(null);
    try {
      const { match } = await createShadeMatch({ scanId: reusable?.id });
      setShade(match);
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      onBusy(false);
    }
  }

  useEffect(() => {
    setRescan(false);
  }, [mode]);

  async function onStageFile(file: File) {
    setRescan(false);
    if (mode === "live") {
      try {
        setSelected(null);
        setLookSrc(URL.createObjectURL(file));
        if (features.length === 0) {
          onError("Turn on at least one makeup feature.");
          return;
        }
        const imageB64 = await fileToJpegDataUrl(file, { maxLong: 1024 });
        await runLook("live", { imageB64, ...lookSelection() });
      } catch (err) {
        onError(
          err instanceof Error && err.message === "image_too_small"
            ? "Move closer so your face fills the oval."
            : friendlyError(err),
        );
      }
      return;
    }
    void onFaceFile(file, mode === "transfer" ? "transfer" : "photo");
  }

  const captureOff = busy || !status.youcamConfigured || !online;
  const liveCopy = PURPOSE_COPY.mirror_live_camera;
  const pending = selected?.status === "pending";
  const showCamera =
    mode !== "shade" && (rescan || !lookSrc);
  const needLiveConsent = mode === "live" && !status.liveCameraConsented;

  function lookKindLabel(look: MakeupLook): string {
    if (look.sourceKind === "live") return "Live";
    if (look.sourceKind === "transfer") return "Transferred";
    return "Photo";
  }

  return (
    <div className="grid min-w-0 gap-6">
      <SegmentedTabs
        ariaLabel="Makeup Studio modes"
        value={mode}
        onChange={(id) => setMode(id as typeof mode)}
        items={[
          { id: "photo", label: "Photo" },
          { id: "live", label: "Live" },
          { id: "transfer", label: "Get this look" },
          { id: "shade", label: "Shade match" },
        ]}
      />

      <div className={mirrorStudioRowClass}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {mode === "shade" ? (
            <MirrorStage>
              {lookSrc ? (
                <img
                  src={lookSrc}
                  alt="Makeup try-on"
                  className="size-full object-cover object-center"
                />
              ) : (
                <MirrorStageEmpty label="Shade match uses your latest skin scan, not a new still." />
              )}
            </MirrorStage>
          ) : needLiveConsent ? (
            <MirrorStage
              dock={
                <div className="grid gap-4">
                  <p className={leadClass}>{liveCopy.body}</p>
                  <ActionRow>
                    <Button type="button" disabled={busy} onClick={() => void grantLiveCamera()}>
                      Allow live camera
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMode("photo")}>
                      Use photo mode
                    </Button>
                  </ActionRow>
                </div>
              }
            >
              <MirrorStageEmpty />
            </MirrorStage>
          ) : showCamera ? (
            <div className="grid min-w-0 gap-4">
              {mode === "transfer" ? (
                <>
                  <input
                    ref={refInput}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    disabled={captureOff}
                  />
                  <ActionRow>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={captureOff}
                      onClick={() => refInput.current?.click()}
                    >
                      Choose reference
                    </Button>
                  </ActionRow>
                </>
              ) : null}
              <CameraStillCapture
                chrome="stage"
                disabled={captureOff}
                facingMode="user"
                guide="face"
                captureLabel="Take a face photo"
                videoLabel={
                  mode === "transfer"
                    ? "Live camera for a look-transfer still"
                    : "Live camera for a makeup still"
                }
                photoKind="face"
                onFile={(file) => void onStageFile(file)}
                onError={onError}
              />
            </div>
          ) : (
            <MirrorStage
              pending={pending}
              pendingLabel="Building this look. Keep this screen open."
              dock={
                <div className="grid gap-4">
                  {selected?.status === "error" ? (
                    <p className={leadClass}>{makeupFailCopy(selected.failReason)}</p>
                  ) : null}
                  <ActionRow>
                    <Button type="button" disabled={captureOff} onClick={() => setRescan(true)}>
                      Try another photo
                    </Button>
                  </ActionRow>
                </div>
              }
            >
              {lookSrc ? (
                <img
                  src={lookSrc}
                  alt="Makeup try-on"
                  className="size-full object-cover object-center"
                />
              ) : (
                <MirrorStageEmpty label="Result image is not ready yet." />
              )}
            </MirrorStage>
          )}
        </div>

        <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-1 lg:col-start-3 lg:row-start-1">
          {tray}
        </div>

        <aside className="grid min-w-0 gap-6 max-lg:col-span-2 lg:col-start-2 lg:row-start-1">
          {mode === "shade" ? (
            <article className={cn(elevatedCardClass, "border-0")}>
              <header className="grid gap-1">
                <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                  Shade match
                </h2>
                <p className={leadClass}>
                  Foundation codes from a skin scan in the last 30 days. Confidence
                  is Low, Medium, or High.
                </p>
              </header>
              <ActionRow>
                <Button
                  type="button"
                  disabled={captureOff || !reusable}
                  onClick={() => void onShade()}
                >
                  Match my shade
                </Button>
              </ActionRow>
              {!reusable ? (
                <EmptyState
                  title="Need a recent skin scan"
                  body="Take a face scan in Skin first. Shade match will not invent a tone from a blank history."
                />
              ) : null}
              {shade ? (
                <div className="grid gap-4">
                  <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
                    Shade twins · {shade.overallConfidence} confidence
                  </p>
                  <p className={leadClass}>{shade.wellnessNote}</p>
                  {shade.fitzpatrickType ? (
                    <p className={leadClass}>
                      Matching aid type {shade.fitzpatrickType}. Not a health label.
                    </p>
                  ) : null}
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {shade.twins.map((t) => (
                      <li key={t.catalogueId} className="grid gap-1">
                        <p className="m-0 text-[length:var(--text-body)] text-foreground">
                          {t.brandCode} {t.shadeCode}
                        </p>
                        <p className={leadClass}>
                          {t.boutiqueName} · {t.boutiqueArea} · {t.confidence} match
                        </p>
                      </li>
                    ))}
                  </ul>
                  <SheMatchBanner trigger="mirror_shade" extraTags={["foundation"]} />
                </div>
              ) : null}
            </article>
          ) : mode === "transfer" ? (
            <article className={cn(elevatedCardClass, "border-0")}>
              <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                Get this look
              </h2>
              <p className={leadClass}>
                Add a reference, then capture your face. Approximation only — not
                a product match until you run shade match.
              </p>
            </article>
          ) : (
            <MakeupFeatureRail />
          )}

          {selected && mode !== "shade" ? (
            <article className={cn(elevatedCardClass, "border-0")}>
              <header className="grid gap-1">
                <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                  {lookKindLabel(selected)} look
                  {selected.status === "pending" ? " · Working" : ""}
                  {selected.status === "error" ? " · Could not finish" : ""}
                </h2>
                {selected.status === "error" ? (
                  <p className={leadClass}>{makeupFailCopy(selected.failReason)}</p>
                ) : (
                  <p className={leadClass}>
                    Looks stay private until you save.
                  </p>
                )}
              </header>
              <ActionRow>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || selected.saved}
                  onClick={() =>
                    void saveMakeupLook(selected.id, true).then((res) => {
                      setSelected(res.look);
                      setLooks((cur) =>
                        cur.map((l) => (l.id === res.look.id ? res.look : l)),
                      );
                    })
                  }
                >
                  {selected.saved ? "Saved privately" : "Save look"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode("shade")}>
                  Shop this shade
                </Button>
              </ActionRow>
            </article>
          ) : null}

          {mode !== "shade" && looks.length ? (
            <ul
              className="m-0 flex list-none flex-wrap gap-2 p-0"
              aria-label="Saved makeup looks"
            >
              {looks.map((look) => {
                const on = selected?.id === look.id;
                return (
                  <li key={look.id}>
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
                        setSelected(look);
                      }}
                    >
                      {lookKindLabel(look)}
                      {look.status === "pending" ? " · Working" : ""}
                      {look.status === "error" ? " · Could not finish" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {mode !== "shade" && !looks.length && !showCamera ? (
            <EmptyState
              title="No looks yet"
              body="Photo mode works without live camera. Looks stay private until you save."
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
