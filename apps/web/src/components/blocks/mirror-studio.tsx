import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionRow,
  leadClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { EmptyState } from "@/components/blocks/states";
import { FieldSelect } from "@/components/primitives/field";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { useMakeupLook } from "@/components/blocks/makeup-look-context";
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
import { MirrorStill } from "@/components/blocks/mirror-still";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { PURPOSE_COPY } from "@/lib/consent-copy";
import { cameraVideoConstraints, fileToJpegDataUrl, listVideoCameras, videoFrameToJpegDataUrl } from "@/lib/jpeg-upload";
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
}) {
  const { mode, setMode, features, lookSelection } = useMakeupLook();
  const [looks, setLooks] = useState<MakeupLook[]>([]);
  const [selected, setSelected] = useState<MakeupLook | null>(null);
  const [lookSrc, setLookSrc] = useState<string | null>(null);
  const [shade, setShade] = useState<ShadeMatch | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  useEffect(() => {
    if (mode !== "live" || !status.liveCameraConsented) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraVideoConstraints("user", deviceId),
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const used = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (used && used !== deviceId) setDeviceId(used);
        const list = await listVideoCameras();
        if (!cancelled) setCameras(list);
        setCameraError(null);
      } catch {
        setCameraError(
          "Camera is not available. Use photo mode — same look, one still.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- deviceId via switchLiveCamera
  }, [mode, status.liveCameraConsented]);

  async function switchLiveCamera(id: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraVideoConstraints("user", id),
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setDeviceId(id);
      setCameraError(null);
    } catch {
      setCameraError("Could not switch camera. The other camera may be in use.");
    }
  }

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

  async function captureLive() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 480 || video.videoHeight < 480) {
      onError("Hold still in even light until your face fills the guide.");
      return;
    }
    try {
      const imageB64 = videoFrameToJpegDataUrl(video, { maxLong: 1024 });
      if (features.length === 0) {
        onError("Turn on at least one makeup feature.");
        return;
      }
      await runLook("live", { imageB64, ...lookSelection() });
    } catch (err) {
      onError(
        err instanceof Error && err.message === "image_too_small"
          ? "Move closer so your face fills the guide."
          : friendlyError(err),
      );
    }
  }

  async function onFaceFile(file: File | undefined, kind: "photo" | "transfer") {
    if (!file) return;
    try {
      setSelected(null);
      setLookSrc(URL.createObjectURL(file));
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

  const captureOff = busy || !status.youcamConfigured || !online;
  const liveCopy = PURPOSE_COPY.mirror_live_camera;

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Makeup Studio
      </h2>
      <p className={leadClass}>
        Try on foundation, brows, blush, eyeshadow, and lashes in shades
        stocked at SheMatch boutiques. Live preview stays on this device.
      </p>
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

      <p className={leadClass}>
        Choose a saved face photo on the right, then press Use for this makeup
        look.
      </p>

      {mode === "live" ? (
        <div className={cn(outlinedCardClass, "grid gap-4")}>
          {!status.liveCameraConsented ? (
            <>
              <h3 className="m-0 text-[length:var(--text-sub)]">{liveCopy.title}</h3>
              <p className={leadClass}>{liveCopy.body}</p>
              <ActionRow>
                <Button type="button" disabled={busy} onClick={() => void grantLiveCamera()}>
                  Allow live camera
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode("photo")}>
                  Use photo mode
                </Button>
              </ActionRow>
            </>
          ) : (
            <>
              <p className={leadClass}>
                Centre your face in the oval. Tracking is on-device. Capture
                sends one still — not a video stream.
              </p>
              {cameraError ? <p className={leadClass}>{cameraError}</p> : null}
              <div className="relative w-full overflow-hidden rounded-[var(--radius)] border border-border bg-muted max-lg:aspect-[4/5] lg:mx-auto lg:max-w-[280px]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="block aspect-[4/5] h-auto w-full object-cover object-[center_18%] lg:aspect-[3/4]"
                />
                <div
                  className="pointer-events-none absolute inset-4 rounded-[50%] border-2 border-primary/70"
                  aria-hidden
                />
              </div>
              {cameras.length > 1 ? (
                <label className="grid gap-2">
                  <span className="text-[length:var(--text-label)] text-foreground">
                    Camera
                  </span>
                  <FieldSelect
                    aria-label="Choose camera"
                    value={deviceId ?? ""}
                    onChange={(e) => void switchLiveCamera(e.target.value)}
                  >
                    {cameras.map((cam, i) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </FieldSelect>
                </label>
              ) : null}
              <ActionRow>
                <Button
                  type="button"
                  disabled={captureOff || Boolean(cameraError)}
                  onClick={() => void captureLive()}
                >
                  Capture look
                </Button>
                {cameras.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const i = cameras.findIndex((c) => c.deviceId === deviceId);
                      const next = cameras[(i + 1 + cameras.length) % cameras.length];
                      if (next) void switchLiveCamera(next.deviceId);
                    }}
                  >
                    Switch camera
                  </Button>
                ) : null}
              </ActionRow>
            </>
          )}
        </div>
      ) : null}

      {mode === "photo" ? (
        <div className="grid gap-4">
          <p className={leadClass}>
            Pick a saved face photo on the right, then press Use for this makeup
            look. That file is the one that runs — not an older skin scan.
          </p>
          <CameraStillCapture
            disabled={captureOff}
            facingMode="user"
            guide="face"
            captureLabel="Take a face photo"
            videoLabel="Live camera for a makeup still"
            photoKind="face"
            onFile={(file) => void onFaceFile(file, "photo")}
            onError={onError}
          />
        </div>
      ) : null}

      {mode === "transfer" ? (
        <div className="grid gap-4">
          <p className={leadClass}>
            Add a reference look from your library, then take a face photo.
            Approximation only — not a product match until you run shade match.
          </p>
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
          <CameraStillCapture
            disabled={captureOff}
            facingMode="user"
            guide="face"
            captureLabel="Take a face photo"
            videoLabel="Live camera for a look-transfer still"
            photoKind="face"
            onFile={(file) => void onFaceFile(file, "transfer")}
            onError={onError}
          />
        </div>
      ) : null}

      {mode === "shade" ? (
        <div className="grid gap-4">
          <p className={leadClass}>
            Matches foundation codes from your latest skin scan (last 30 days)
            to stocked retailer shades. Confidence is Low, Medium, or High —
            same honesty as HealthLens.
          </p>
          <ActionRow>
            <Button type="button" disabled={captureOff || !reusable} onClick={() => void onShade()}>
              Match my shade
            </Button>
          </ActionRow>
          {!reusable ? (
            <EmptyState
              title="Need a recent skin scan"
              body="Take a face scan on the Skin scan tab. Shade match will not invent a tone from a blank history."
            />
          ) : null}
          {shade ? (
            <article className={cn(outlinedCardClass, "grid gap-4")}>
              <h3 className="m-0 text-[length:var(--text-sub)]">
                Shade twins · {shade.overallConfidence} confidence
              </h3>
              <p className={leadClass}>{shade.wellnessNote}</p>
              {shade.fitzpatrickType ? (
                <p className={leadClass}>
                  Matching aid type {shade.fitzpatrickType}. Not a health label.
                </p>
              ) : null}
              <ul className="m-0 grid list-none gap-3 p-0">
                {shade.twins.map((t) => (
                  <li
                    key={t.catalogueId}
                    className="grid gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0"
                  >
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
            </article>
          ) : null}
        </div>
      ) : null}

      {selected && mode !== "shade" ? (
        <article className={cn(outlinedCardClass, "grid gap-4")}>
          <h3 className="m-0 text-[length:var(--text-sub)]">
            {selected.sourceKind === "live"
              ? "Live capture"
              : selected.sourceKind === "transfer"
                ? "Transferred look"
                : "Photo look"}
            {selected.status === "pending" ? " · Working" : ""}
            {selected.status === "error" ? " · Could not finish" : ""}
          </h3>
          {selected.status === "error" ? (
            <p className={leadClass}>
              {makeupFailCopy(selected.failReason)}
            </p>
          ) : null}
          {lookSrc ? (
            <MirrorStill src={lookSrc} alt="Makeup try-on result" crop="face" />
          ) : selected.hasResultImage ? (
            <p className={leadClass}>Loading result…</p>
          ) : (
            <p className={leadClass}>Result image is not ready yet.</p>
          )}
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

      {mode !== "shade" && !looks.length ? (
        <EmptyState
          title="No looks yet"
          body="Photo mode works without live camera. Looks stay private until you save."
        />
      ) : null}
    </div>
  );
}
