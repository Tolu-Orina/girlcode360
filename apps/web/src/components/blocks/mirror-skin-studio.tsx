import { useState } from "react";
import { CameraStillCapture } from "@/components/blocks/camera-still";
import { ActionRow, elevatedCardClass, leadClass } from "@/components/blocks/app-page";
import { MirrorStage, MirrorStageEmpty } from "@/components/blocks/mirror-stage";
import { MirrorStill } from "@/components/blocks/mirror-still";
import { ScoreBar } from "@/components/blocks/score-bar";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { EmptyState } from "@/components/blocks/states";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkinScan } from "../../../../../packages/api-types/src/index";

const SCORE_LABELS: Record<string, string> = {
  acne: "Acne",
  oiliness: "Oiliness",
  redness: "Redness",
  texture: "Texture",
  pore: "Pores",
  wrinkle: "Wrinkles",
  radiance: "Radiance",
  dark_circle: "Dark circles",
  dark_circle_v2: "Dark circles",
  moisture: "Moisture",
  firmness: "Firmness",
  age_spot: "Dark spots",
  eye_bag: "Under-eye bags",
  tear_trough: "Tear trough",
  droopy_eyelid: "Eyelid droop",
  droopy_lower_eyelid: "Lower eyelid",
  droopy_upper_eyelid: "Upper eyelid",
  all: "Combined",
  skin_age: "Skin age (estimate)",
  skin_type: "Skin type aid",
};

function phaseLabel(phase: SkinScan["cyclePhaseAtScan"]): string {
  if (!phase) return "";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function MirrorSkinStudio({
  captureOff,
  previewSrc,
  resultSrc,
  maskSrc,
  heldSrc,
  selected,
  onPickFile,
  onConfirmPreview,
  onCancelPreview,
  onError,
}: {
  captureOff: boolean;
  previewSrc: string | null;
  resultSrc: string | null;
  maskSrc: string | null;
  heldSrc: string | null;
  selected: SkinScan | null;
  onPickFile: (file: File) => void;
  onConfirmPreview: () => void;
  onCancelPreview: () => void;
  onError: (message: string) => void;
}) {
  const [rescan, setRescan] = useState(false);
  const pending = selected?.status === "pending";
  const stageSrc = previewSrc ?? resultSrc ?? heldSrc;
  const showCamera = Boolean(rescan || (!previewSrc && !stageSrc));

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid min-w-0 gap-4">
        {previewSrc ? (
          <MirrorStage
            dock={
              <ActionRow>
                <Button type="button" onClick={onConfirmPreview}>
                  Use this photo
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelPreview}>
                  Choose another
                </Button>
              </ActionRow>
            }
          >
            <img
              src={previewSrc}
              alt="Selected photo preview"
              className="size-full object-cover object-[center_18%]"
            />
          </MirrorStage>
        ) : showCamera ? (
          <CameraStillCapture
            chrome="stage"
            disabled={captureOff}
            facingMode="user"
            guide="face"
            captureLabel="Take a face photo"
            videoLabel="Live camera for a skin scan still"
            photoKind="face"
            onFile={(file) => {
              setRescan(false);
              onPickFile(file);
            }}
            onError={onError}
          />
        ) : pending ? (
          <MirrorStage pending pendingLabel="Analysing skin. Keep this screen open.">
            {stageSrc ? (
              <img
                src={stageSrc}
                alt=""
                className="size-full object-cover object-[center_18%]"
              />
            ) : (
              <MirrorStageEmpty />
            )}
          </MirrorStage>
        ) : (
          <MirrorStage
            dock={
              <ActionRow>
                <Button type="button" disabled={captureOff} onClick={() => setRescan(true)}>
                  Scan again
                </Button>
              </ActionRow>
            }
          >
            <img
              src={stageSrc ?? ""}
              alt={selected?.seeded ? "Sample scan" : "Skin scan result"}
              className="size-full object-cover object-[center_18%]"
            />
          </MirrorStage>
        )}
        {maskSrc && resultSrc && !previewSrc ? (
          <details className="group">
            <summary className="cursor-pointer text-[length:var(--text-label)] font-semibold text-primary">
              Show overlay map
            </summary>
            <div className="mt-4">
              <MirrorStill src={maskSrc} alt="Skin overlay map" crop="face" framed />
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function MirrorSkinRail({
  resultSrc,
  selected,
  skinTags,
}: {
  resultSrc: string | null;
  selected: SkinScan | null;
  skinTags: string[];
}) {
  const pending = selected?.status === "pending";
  const scoreEntries = Object.entries(selected?.scores ?? {}).filter(
    ([key, n]) => typeof n === "number" && key !== "all" && key !== "skin_type",
  );
  const insight = selected?.insight;

  return (
    <aside className="grid min-w-0 gap-6">
      {!selected ? (
        <EmptyState
          title="No scans yet"
          body="Take a face photo in even light, hair off the forehead. Scores are a wellness snapshot, not a diagnosis."
        />
      ) : (
        <article className={cn(elevatedCardClass, "border-0")}>
          <header className="grid gap-1">
            <h2 className="m-0 text-[length:var(--text-sub)] text-foreground">
              {selected.seeded ? "Sample scan" : "Latest scan"}
            </h2>
            <p className={leadClass}>
              {formatWhen(selected.createdAt)}
              {selected.cycleDayAtScan != null
                ? ` · Cycle day ${selected.cycleDayAtScan}${
                    selected.cyclePhaseAtScan
                      ? ` · ${phaseLabel(selected.cyclePhaseAtScan)}`
                      : ""
                  }`
                : " · Cycle day appears when you have logs for this date"}
              {selected.overallScore != null
                ? ` · Overall ${selected.overallScore} of 100`
                : ""}
              {typeof selected.scores.skin_age === "number"
                ? ` · Skin age estimate ${selected.scores.skin_age}`
                : ""}
            </p>
          </header>
          {selected.status === "error" ? (
            <p className={leadClass}>
              {selected.insight?.body ??
                "YouCam could not finish this still. Face the camera in even light and capture again."}
            </p>
          ) : null}
          {selected.seeded && !resultSrc ? (
            <p className={leadClass}>
              Sample points have scores only. Take a live scan for a photo.
            </p>
          ) : null}
          {scoreEntries.length ? (
            <div className="grid gap-3">
              {scoreEntries.map(([key, value]) => (
                <ScoreBar
                  key={key}
                  label={SCORE_LABELS[key] ?? key}
                  value={value}
                />
              ))}
            </div>
          ) : pending ? (
            <p className={leadClass}>Scores will land here when the scan finishes.</p>
          ) : null}
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
                  : " · No cycle claim yet"}
              </p>
            </div>
          ) : null}
          {skinTags.length ? (
            <SheMatchBanner trigger="mirror_skin" extraTags={skinTags} />
          ) : null}
        </article>
      )}
      <PredictionDisclaimer message="Mirror scores and cycle overlays are wellness tools, not a diagnosis or medical advice." />
    </aside>
  );
}
