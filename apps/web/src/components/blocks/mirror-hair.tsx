import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionRow,
  elevatedCardClass,
  leadClass,
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
import { MirrorStage, MirrorStageEmpty, mirrorStudioRowClass } from "@/components/blocks/mirror-stage";
import { useMirrorPhotosOptional } from "@/hooks/use-mirror-photos";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  HairScan,
  MirrorStatus,
  SkinScan,
} from "../../../../../packages/api-types/src/index";
import { HAIR_COLOR_PRESETS, HAIR_CORRELATION_WELLNESS_NOTE, HAIR_STYLE_PRESETS, youcamClientFailCopy } from "../../../../../packages/domain/src/index";
import { ctaLabel } from "@/lib/cta";
import { latestByCreatedAt } from "@/lib/mirror-latest";

function hairFailCopy(reason: string | null | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("face_angle") || r.includes("angle_invalid")) {
    return "YouCam needs a face looking straight at the camera for length. Density is a separate chin-down still — this face photo cannot score density. Sit square, fill the oval, then try again.";
  }
  return youcamClientFailCopy(reason);
}

function kindLabel(row: HairScan): string {
  return row.kind === "tryon" ? "Colour try-on" : "Length scores";
}

export function MirrorHairPanel({
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
  const [mode, setMode] = useState<"analysis" | "tryon">("analysis");
  const [rows, setRows] = useState<HairScan[]>([]);
  const [selected, setSelected] = useState<HairScan | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [rescan, setRescan] = useState(false);
  const [color, setColor] = useState<string>(HAIR_COLOR_PRESETS[0]!.hex);
  const [styleId, setStyleId] = useState<string>(HAIR_STYLE_PRESETS[0]!.id);
  const pending = useRef<string | null>(null);
  const lastQueued = useRef("");
  const photos = useMirrorPhotosOptional();
  const reusable = scans.find((s) => !s.seeded && s.status === "success");
  const captureOff = busy || !status.youcamConfigured || !online;
  const working = selected?.status === "pending";
  const showCamera = rescan || !src;

  const load = useCallback(async () => {
    const res = await listHairScans();
    const sorted = [...res.scans].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    setRows(sorted);
    setSelected(
      sorted.find((row) => row.kind === mode) ?? sorted[0] ?? null,
    );
  }, [mode]);

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
  }, [selected, rescan]);

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
          if (scan.status === "error") {
            onError(hairFailCopy(scan.failReason));
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

  async function run(kind: "analysis" | "tryon", file?: File) {
    onBusy(true);
    onError(null);
    try {
      if (file) setSrc(URL.createObjectURL(file));
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
      setRescan(false);
      if (scan.status !== "pending") {
        pending.current = null;
        await load();
        setSelected(scan);
        onBusy(false);
        if (scan.status === "error") {
          onError(hairFailCopy(scan.failReason));
        }
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

  const analysis =
    selected?.kind === "analysis"
      ? selected
      : latestByCreatedAt(rows.filter((row) => row.kind === "analysis"));
  const insight = analysis?.insight;
  const lengthScore =
    analysis && typeof analysis.scores.hair_length === "number"
      ? analysis.scores.hair_length
      : null;
  const densityScore =
    analysis && typeof analysis.scores.hair_density === "number"
      ? analysis.scores.hair_density
      : null;
  const frizzScore =
    analysis && typeof analysis.scores.hair_frizziness === "number"
      ? analysis.scores.hair_frizziness
      : null;
  const colorPreset = HAIR_COLOR_PRESETS.find((p) => p.hex === color);

  return (
    <div className="grid min-w-0 gap-6">
      <SegmentedTabs
        ariaLabel="Hair Studio modes"
        value={mode}
        onChange={(id) => setMode(id as typeof mode)}
        items={[
          { id: "analysis", label: "Length scores" },
          { id: "tryon", label: "Colour try-on" },
        ]}
      />

      <div className={mirrorStudioRowClass}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {showCamera ? (
            <CameraStillCapture
              chrome="stage"
              disabled={captureOff}
              busy={busy}
              facingMode="user"
              guide="face"
              captureLabel="Take a face photo"
              videoLabel="Live camera for a hair still"
              photoKind="face"
              onFile={(file) => void run(mode, file)}
              onError={onError}
            />
          ) : (
            <MirrorStage
              pending={working}
              pendingLabel={
                mode === "tryon"
                  ? "Trying this colour. Keep this screen open."
                  : "Reading length. Keep this screen open."
              }
              dock={
                <div className="grid gap-4">
                  {selected?.status === "error" ? (
                    <p className={leadClass}>{hairFailCopy(selected.failReason)}</p>
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
                  alt={
                    selected?.kind === "tryon"
                      ? "Hair colour try-on"
                      : "Hair length still"
                  }
                  className="size-full object-cover object-center"
                />
              ) : (
                <MirrorStageEmpty />
              )}
            </MirrorStage>
          )}
        </div>

        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          {tray}
        </div>

        <aside className="grid min-w-0 gap-6 lg:col-start-2 lg:row-start-1">
          {mode === "tryon" ? (
            <article className={cn(elevatedCardClass, "border-0")}>
              <header className="grid gap-1">
                <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                  Colour
                </h2>
                <p className={leadClass}>
                  {colorPreset
                    ? `${colorPreset.label}. Preview only — not a product match.`
                    : "Pick a colour, then a style."}
                </p>
              </header>
              <ul className="m-0 grid list-none grid-cols-6 gap-2 p-0">
                {HAIR_COLOR_PRESETS.map((p) => {
                  const on = color === p.hex;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={p.label}
                        title={p.label}
                        className={cn(
                          "aspect-square w-full min-h-12 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on ? "ring-2 ring-ring" : "",
                        )}
                        style={{ backgroundColor: p.hex }}
                        onClick={() => setColor(p.hex)}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="grid gap-2">
                <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
                  Style
                </p>
                <div className="flex flex-wrap gap-2">
                  {HAIR_STYLE_PRESETS.map((p) => {
                    const on = styleId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        className={cn(
                          "min-h-12 rounded-[var(--radius)] px-4 text-[length:var(--text-caption)] font-semibold",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on
                            ? "bg-muted text-foreground shadow-[var(--shadow-2)]"
                            : "bg-card text-muted-foreground",
                        )}
                        onClick={() => setStyleId(p.id)}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                type="button"
                disabled={captureOff || !reusable}
                onClick={() => void run("tryon")}
              >
                {ctaLabel(busy, "Try on last skin scan")}
              </Button>
              {!reusable ? (
                <p className={leadClass}>
                  Capture a face still, or take a Skin scan first.
                </p>
              ) : null}
            </article>
          ) : (
            <article className={cn(elevatedCardClass, "border-0")}>
              <header className="grid gap-1">
                <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
                  Length
                </h2>
                <p className={leadClass}>
                  A front face still can score length. Density needs chin-down.
                  Frizz needs front, left, and right views.
                </p>
              </header>
              {analysis?.status === "error" ? (
                <p className={leadClass}>{hairFailCopy(analysis.failReason)}</p>
              ) : null}
              {analysis?.status === "pending" ? (
                <p className={leadClass}>Scores will land here when this finishes.</p>
              ) : null}
              {!analysis ? (
                <EmptyState
                  title="No length scores yet"
                  body="Capture a face still, or use your last Skin scan. If a score fails, keep this screen open and try again with a straight-on face."
                />
              ) : (
                <div className="grid gap-3">
                  {analysis.scores.hair_type ? (
                    <p className={leadClass}>
                      Texture aid: {analysis.scores.hair_type}. Not a medical type.
                    </p>
                  ) : null}
                  {lengthScore != null ? (
                    <ScoreBar label="Length" value={lengthScore} />
                  ) : null}
                  {densityScore != null ? (
                    <ScoreBar label="Density (needs chin-down)" value={densityScore} />
                  ) : null}
                  {frizzScore != null ? (
                    <ScoreBar label="Frizz (needs side views)" value={frizzScore} />
                  ) : null}
                </div>
              )}
              {insight ? (
                <div className="grid gap-2 pt-4">
                  <h3 className="m-0 text-[length:var(--text-label)] font-semibold">
                    {insight.title}
                  </h3>
                  <p className="m-0 text-[length:var(--text-body)] text-foreground">
                    {insight.body}
                  </p>
                  <p className={leadClass}>
                    Confidence: {insight.confidence}
                    {insight.patternFound
                      ? " · Pattern in your logs"
                      : " · No PMOS claim yet"}
                  </p>
                </div>
              ) : null}
              <Button
                type="button"
                disabled={captureOff || !reusable}
                onClick={() => void run("analysis")}
              >
                {ctaLabel(busy, "Score last skin scan")}
              </Button>
              <p className={leadClass}>{HAIR_CORRELATION_WELLNESS_NOTE}</p>
            </article>
          )}

          {rows.length > 1 ? (
            <ul
              className="m-0 flex list-none flex-wrap gap-2 p-0"
              aria-label="Earlier hair stills"
            >
              {rows.slice(0, 8).map((row) => {
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
                      {kindLabel(row)}
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
