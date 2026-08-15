import { useEffect, useRef, useState } from "react";
import { ActionRow, leadClass, outlinedCardClass } from "@/components/blocks/app-page";
import { MirrorStage, MirrorStageEmpty, mirrorStageBoxClass, mirrorStageWrapClass } from "@/components/blocks/mirror-stage";
import { FieldSelect } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import {
  cameraVideoConstraints,
  guideCropFromElements,
  isFrontCameraLabel,
  listVideoCameras,
  videoFrameToJpegFile,
} from "@/lib/jpeg-upload";
import type { MirrorPhotoKind } from "@/lib/mirror-photos";
import { cn } from "@/lib/utils";

type Phase = "idle" | "starting" | "live" | "blocked";

const CAMERA_STORE = "gc360.cameraDeviceId";

function cameraUnavailableMessage(): string {
  if (typeof window === "undefined") return "Camera is not available.";
  if (!window.isSecureContext) {
    return "Camera needs HTTPS or localhost. Choose a photo from your library instead.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser has no camera API. Choose a photo from your library instead.";
  }
  return "Camera is blocked. Allow it in the browser, or choose a photo from your library.";
}

function storedCameraId(): string | undefined {
  try {
    return sessionStorage.getItem(CAMERA_STORE) || undefined;
  } catch {
    return undefined;
  }
}

function rememberCameraId(id: string) {
  try {
    sessionStorage.setItem(CAMERA_STORE, id);
  } catch {
    /* ignore */
  }
}

export function CameraStillCapture({
  disabled,
  facingMode,
  guide,
  captureLabel,
  libraryLabel = "Choose from library",
  videoLabel,
  photoKind,
  chrome = "stack",
  onFile,
  onError,
}: {
  disabled?: boolean;
  facingMode: "user" | "environment";
  guide: "face" | "body" | "none";
  captureLabel: string;
  libraryLabel?: string;
  videoLabel: string;
  photoKind?: MirrorPhotoKind;
  chrome?: "stack" | "stage";
  onFile: (file: File) => void;
  onError: (message: string) => void;
}) {
  const photos = useMirrorPhotosOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const ovalRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [ready, setReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(storedCameraId);
  const [mirror, setMirror] = useState(facingMode === "user");

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopStream(), []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (phase !== "live" && phase !== "starting") return;
    video.srcObject = stream;
    const markReady = () => {
      if (video.videoWidth >= 2 && video.videoHeight >= 2) setReady(true);
    };
    video.addEventListener("loadedmetadata", markReady);
    void video.play().catch(() => undefined);
    markReady();
    return () => video.removeEventListener("loadedmetadata", markReady);
  }, [phase]);

  async function refreshCameras(currentId?: string) {
    const list = await listVideoCameras();
    setCameras(list);
    const id = currentId ?? list[0]?.deviceId;
    if (!id) return;
    const cam = list.find((c) => c.deviceId === id);
    setMirror(cam ? isFrontCameraLabel(cam.label) : facingMode === "user");
  }

  async function openStream(nextId?: string) {
    setReady(false);
    stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: cameraVideoConstraints(facingMode, nextId),
      audio: false,
    });
    streamRef.current = stream;
    const used = stream.getVideoTracks()[0]?.getSettings().deviceId ?? nextId;
    if (used) {
      setDeviceId(used);
      rememberCameraId(used);
    }
    await refreshCameras(used);
    setPhase("live");
  }

  async function startCamera() {
    if (disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setPhase("blocked");
      onError(cameraUnavailableMessage());
      return;
    }
    setPhase("starting");
    try {
      await openStream(deviceId);
    } catch {
      try {
        await openStream(undefined);
      } catch {
        stopStream();
        setPhase("blocked");
        onError(cameraUnavailableMessage());
      }
    }
  }

  async function selectCamera(id: string) {
    setPhase("starting");
    try {
      await openStream(id);
    } catch {
      onError("Could not switch camera. The other camera may be in use.");
      setPhase("live");
    }
  }

  function cancelCamera() {
    stopStream();
    setReady(false);
    setPhase("idle");
  }

  function emitFile(file: File) {
    if (photoKind) void photos?.addPhoto(file, photoKind);
    onFile(file);
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      onError("Wait until the camera picture appears, then capture.");
      return;
    }
    try {
      const box = previewRef.current;
      const oval = ovalRef.current;
      const file = videoFrameToJpegFile(video, {
        maxLong: facingMode === "user" ? 1024 : 1600,
        allowUpscale: true,
        guideCrop:
          guide === "face" && box && oval
            ? guideCropFromElements(box, oval, {
                objectPositionY: 0.18,
                pad: 0.08,
              })
            : undefined,
      });
      stopStream();
      setReady(false);
      setPhase("idle");
      emitFile(file);
    } catch {
      onError("Could not capture that frame. Try again, or choose from your library.");
    }
  }

  function pickLibrary(file: File | undefined) {
    if (!file) return;
    stopStream();
    setReady(false);
    setPhase("idle");
    emitFile(file);
  }

  const live = phase === "live" || phase === "starting";
  const libraryInput = (
    <input
      ref={fileRef}
      className="sr-only"
      type="file"
      accept="image/*"
      disabled={disabled}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        pickLibrary(file);
      }}
    />
  );

  const dock = live ? (
    <ActionRow>
      <Button
        type="button"
        disabled={disabled || phase !== "live" || !ready}
        onClick={() => void snap()}
      >
        Capture
      </Button>
      {cameras.length > 1 ? (
        <Button
          type="button"
          variant="outline"
          disabled={phase !== "live"}
          onClick={() => {
            const i = cameras.findIndex((c) => c.deviceId === deviceId);
            const next = cameras[(i + 1 + cameras.length) % cameras.length];
            if (next) void selectCamera(next.deviceId);
          }}
        >
          Switch camera
        </Button>
      ) : null}
      <Button type="button" variant="outline" onClick={cancelCamera}>
        Cancel
      </Button>
    </ActionRow>
  ) : (
    <ActionRow>
      <Button type="button" disabled={disabled} onClick={() => void startCamera()}>
        {captureLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        {libraryLabel}
      </Button>
    </ActionRow>
  );

  const faceHint =
    guide === "face"
      ? "Move closer until your face fills the oval, then capture."
      : null;

  const video = (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-label={videoLabel}
      className={cn(
        "block size-full bg-muted object-cover",
        guide === "face" ? "object-[center_18%]" : "object-[center_12%]",
        mirror && "-scale-x-100",
      )}
    />
  );

  const livePreview = (
    <div ref={previewRef} className="relative size-full">
      {video}
      {guide === "face" ? (
        <div
          ref={ovalRef}
          className="pointer-events-none absolute inset-4 rounded-[50%] border border-primary/50"
          aria-hidden
        />
      ) : null}
      {phase === "starting" ? (
        <p className="absolute inset-0 grid place-items-center bg-card/70 text-[length:var(--text-body)] text-foreground">
          Starting camera…
        </p>
      ) : null}
    </div>
  );

  if (chrome === "stage") {
    return (
      <div className={cn(mirrorStageWrapClass)}>
        <MirrorStage
          dock={
            <>
              {faceHint ? <p className={leadClass}>{faceHint}</p> : null}
              {live && cameras.length > 1 ? (
                <label className="grid gap-2">
                  <span className="text-[length:var(--text-label)] text-foreground">
                    Camera
                  </span>
                  <FieldSelect
                    aria-label="Choose camera"
                    value={deviceId ?? ""}
                    onChange={(e) => void selectCamera(e.target.value)}
                  >
                    {cameras.map((cam, i) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </FieldSelect>
                </label>
              ) : null}
              {dock}
            </>
          }
        >
          {live ? (
            livePreview
          ) : (
            <MirrorStageEmpty
              label={
                guide === "face"
                  ? "Move closer until your face fills the oval, then capture one still."
                  : guide === "body"
                    ? "Stand in even light so your full outfit is in frame."
                    : "Hold the piece in even light, then capture one still."
              }
            />
          )}
        </MirrorStage>
        {libraryInput}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {live ? (
        <div className={cn(outlinedCardClass, "grid gap-4")}>
          <p className={leadClass}>
            {guide === "face"
              ? faceHint
              : guide === "body"
                ? "Stand in even light so your full outfit is in frame, then capture one still."
                : "Hold the piece in even light, then capture one still."}
          </p>
          <div className={mirrorStageBoxClass}>
            {livePreview}
          </div>
          {cameras.length > 1 ? (
            <label className="grid gap-2">
              <span className="text-[length:var(--text-label)] text-foreground">
                Camera
              </span>
              <FieldSelect
                aria-label="Choose camera"
                value={deviceId ?? ""}
                onChange={(e) => void selectCamera(e.target.value)}
              >
                {cameras.map((cam, i) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </FieldSelect>
            </label>
          ) : null}
          {dock}
        </div>
      ) : (
        dock
      )}
      {libraryInput}
    </div>
  );
}
