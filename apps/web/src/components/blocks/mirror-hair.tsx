import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionRow,
  leadClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { EmptyState } from "@/components/blocks/states";
import { ScoreBar } from "@/components/blocks/score-bar";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import {
  createHairAnalysis,
  createHairTryOn,
  getHairScan,
  getHairScanMedia,
  listHairScans,
} from "@/lib/api";
import { CameraStillCapture } from "@/components/blocks/camera-still";
import { MirrorStill } from "@/components/blocks/mirror-still";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  HairScan,
  MirrorStatus,
  SkinScan,
} from "../../../../../packages/api-types/src/index";
import {
  HAIR_COLOR_PRESETS,
  HAIR_CORRELATION_WELLNESS_NOTE,
  HAIR_STYLE_PRESETS,
} from "../../../../../packages/domain/src/index";

function hairFailCopy(reason: string | null | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("face_angle") || r.includes("angle_invalid")) {
    return "YouCam needs a face looking straight at the camera for length. Density is a separate chin-down still — this face photo cannot score density.";
  }
  if (r.includes("face") || r.includes("noface") || r.includes("detect")) {
    return "YouCam could not read a clear face. Use a front-facing still in even light, hair down.";
  }
  if (reason) {
    return `YouCam could not finish hair scores (${reason}). Try another front-facing still.`;
  }
  return "YouCam could not finish hair scores. Try another front-facing still in even light.";
}

export function MirrorHairPanel({
  status,
  scans,
  online,
  busy,
  onBusy,
  onError,
  friendlyError,
}: {
  status: MirrorStatus;
  scans: SkinScan[];
  online: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  friendlyError: (err: unknown) => string;
}) {
  const [mode, setMode] = useState<"analysis" | "tryon">("analysis");
  const [rows, setRows] = useState<HairScan[]>([]);
  const [selected, setSelected] = useState<HairScan | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [color, setColor] = useState<string>(HAIR_COLOR_PRESETS[0]!.hex);
  const [styleId, setStyleId] = useState<string>(HAIR_STYLE_PRESETS[0]!.id);
  const pending = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const reusable = scans.find((s) => !s.seeded && s.status === "success");
  const captureOff = busy || !status.youcamConfigured || !online;

  const load = useCallback(async () => {
    const res = await listHairScans();
    setRows(res.scans);
    setSelected(res.scans[0] ?? null);
  }, []);

  useEffect(() => {
    void load().catch((err) => onError(friendlyError(err)));
  }, [load, friendlyError, onError]);

  useEffect(() => {
    if (!selected?.hasResultImage) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getHairScanMedia(selected.id);
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
  }, [selected]);

  useEffect(() => {
    const id = pending.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { scan } = await getHairScan(id);
        if (scan.status !== "pending") {
          pending.current = null;
          window.clearInterval(tick);
          await load();
          setSelected(scan);
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
  }, [selected?.id, load, onBusy, onError, friendlyError]);

  async function run(kind: "analysis" | "tryon", file?: File) {
    onBusy(true);
    onError(null);
    try {
      const imageB64 = file ? await fileToJpegDataUrl(file) : undefined;
      const scanId = imageB64 ? undefined : reusable?.id;
      if (!imageB64 && !scanId) {
        onBusy(false);
        onError("Add a face photo, or take a skin scan first.");
        return;
      }
      const scan =
        kind === "analysis"
          ? (
              await createHairAnalysis({
                imageB64,
                scanId,
              })
            ).scan
          : (
              await createHairTryOn({
                imageB64,
                scanId,
                hairColor: color,
                hairstyleId: styleId,
              })
            ).scan;
      pending.current = scan.id;
      setSelected(scan);
      if (scan.status !== "pending") {
        pending.current = null;
        await load();
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
    if (!queued || queued.kind !== "face") return;
    if (queued.token === lastQueued.current) return;
    lastQueued.current = queued.token;
    photos?.consumeQueued(queued.token);
    void runRef.current(mode, queued.file);
  }, [photos, mode]);

  const insight = selected?.kind === "analysis" ? selected.insight : rows.find((r) => r.kind === "analysis")?.insight;

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Hair Studio
      </h2>
      <p className={leadClass}>{HAIR_CORRELATION_WELLNESS_NOTE}</p>
      <p className={leadClass}>
        Hair scores from a face still report length. Density needs a chin-down
        still (about 45°). Frizz needs front, left, and right views.
      </p>
      <SegmentedTabs
        ariaLabel="Hair Studio modes"
        value={mode}
        onChange={(id) => setMode(id as typeof mode)}
        items={[
          { id: "analysis", label: "Hair scores" },
          { id: "tryon", label: "Colour try-on" },
        ]}
      />

      <p className={leadClass}>
        {reusable
          ? "Uses your latest skin scan when it is under 30 days old, or a new face photo."
          : "Take a skin scan first, or take a face photo here."}
      </p>

      {mode === "tryon" ? (
        <div className="grid gap-3">
          <p className="m-0 text-[length:var(--text-label)] text-foreground">Colour</p>
          <div className="flex flex-wrap gap-2">
            {HAIR_COLOR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "min-h-[var(--tap)] min-w-[var(--tap)] rounded-[var(--radius)] border px-3 text-[length:var(--text-caption)]",
                  color === p.hex
                    ? "border-primary bg-muted text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
                onClick={() => setColor(p.hex)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="m-0 text-[length:var(--text-label)] text-foreground">Style</p>
          <div className="flex flex-wrap gap-2">
            {HAIR_STYLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "min-h-[var(--tap)] rounded-[var(--radius)] border px-3 text-[length:var(--text-caption)]",
                  styleId === p.id
                    ? "border-primary bg-muted text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
                onClick={() => setStyleId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ActionRow>
        <Button
          type="button"
          disabled={captureOff || !reusable}
          onClick={() => void run(mode)}
        >
          {mode === "analysis" ? "Run hair scores" : "Try this colour"}
        </Button>
      </ActionRow>
      <CameraStillCapture
        disabled={captureOff}
        facingMode="user"
        guide="face"
        captureLabel="Take a face photo"
        videoLabel="Live camera for a hair still"
        photoKind="face"
        onFile={(file) => void run(mode, file)}
        onError={onError}
      />

      {selected ? (
        <article className={cn(outlinedCardClass, "grid gap-4")}>
          <h3 className="m-0 text-[length:var(--text-sub)]">
            {selected.kind === "tryon" ? "Colour try-on" : "Hair scores"}
            {selected.status === "pending" ? " · Working" : ""}
            {selected.status === "error" ? " · Could not finish" : ""}
          </h3>
          {selected.status === "error" ? (
            <p className={leadClass}>{hairFailCopy(selected.failReason)}</p>
          ) : null}
          {src ? (
            <MirrorStill
              src={src}
              alt={selected.kind === "tryon" ? "Hair colour try-on" : "Hair scores"}
              crop="face"
            />
          ) : null}
          {selected.kind === "analysis" ? (
            <div className="grid gap-3">
              {selected.scores.hair_type ? (
                <p className={leadClass}>
                  Texture aid: {selected.scores.hair_type}. Not a medical type.
                </p>
              ) : null}
              {typeof selected.scores.hair_density === "number" ? (
                <ScoreBar label="Density" value={selected.scores.hair_density} />
              ) : null}
              {typeof selected.scores.hair_frizziness === "number" ? (
                <ScoreBar label="Frizz" value={selected.scores.hair_frizziness} />
              ) : null}
              {typeof selected.scores.hair_length === "number" ? (
                <ScoreBar label="Length" value={selected.scores.hair_length} />
              ) : null}
            </div>
          ) : null}
          {insight ? (
            <div className="grid gap-2 border-t border-border pt-4">
              <h3 className="m-0 text-[length:var(--text-sub)]">{insight.title}</h3>
              <p className="m-0 text-[length:var(--text-body)]">{insight.body}</p>
              <p className={leadClass}>
                Confidence: {insight.confidence}
                {insight.patternFound ? " · Pattern in your logs" : " · No PMOS claim yet"}
              </p>
            </div>
          ) : null}
        </article>
      ) : (
        <EmptyState
          title="No hair scans yet"
          body="Run hair scores from a face photo. Colour try-on is a preview, not a product match."
        />
      )}

      {rows.length > 1 ? (
        <div className="grid gap-2">
          <h3 className="m-0 text-[length:var(--text-sub)]">Earlier scans</h3>
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.slice(0, 8).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={cn(
                    "min-h-[var(--tap)] w-full rounded-[var(--radius)] border px-3 py-2 text-left text-[length:var(--text-caption)]",
                    selected?.id === row.id
                      ? "border-primary bg-muted text-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                  onClick={() => setSelected(row)}
                >
                  {row.kind === "tryon" ? "Colour try-on" : "Hair scores"} ·{" "}
                  {new Date(row.createdAt).toLocaleDateString()}
                  {row.status === "pending" ? " · Working" : ""}
                  {row.status === "error" ? " · Could not finish" : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
