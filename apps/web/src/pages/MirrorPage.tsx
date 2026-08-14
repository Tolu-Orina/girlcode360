import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionRow,
  AppPage,
  leadClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { AskAlenaLink } from "@/components/blocks/ask-alena-link";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { MirrorStudioPanel } from "@/components/blocks/mirror-studio";
import { MirrorHairPanel } from "@/components/blocks/mirror-hair";
import { MirrorAccessoriesPanel } from "@/components/blocks/mirror-accessories";
import { MirrorWardrobePanel } from "@/components/blocks/mirror-wardrobe";
import { ScoreBar } from "@/components/blocks/score-bar";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { FieldSelect } from "@/components/primitives/field";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  ApparelTryOn,
  MirrorCatalogueItem,
  MirrorStatus,
  SkinScan,
  StyleAnalytics,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import {
  ApiError,
  createMirrorScan,
  createMirrorTryOn,
  deleteMirrorScan,
  getMe,
  getMirrorCatalogue,
  getMirrorScan,
  getMirrorScanMedia,
  getMirrorStatus,
  getMirrorTryOn,
  getMirrorTryOnMedia,
  getStyleAnalytics,
  listMirrorScans,
  listMirrorTryOns,
  postMirrorConsent,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import { MIRROR_PROCESSOR_LEAD } from "../lib/consent-copy";
import { elevatedSkinConcerns } from "../../../../packages/domain/src/index";

type Tab = "scan" | "makeup" | "hair" | "wardrobe" | "accessories" | "tryon" | "timeline";
type CatalogueMode = "all" | "maternity" | "pmos";

const SCORE_LABELS: Record<string, string> = {
  acne: "Acne",
  oiliness: "Oiliness",
  redness: "Redness",
  texture: "Texture",
  pore: "Pores",
  wrinkle: "Wrinkles",
  radiance: "Radiance",
  dark_circle: "Dark circles",
  moisture: "Moisture",
  firmness: "Firmness",
  age_spot: "Dark spots",
};

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message === "image_too_small") {
    return "That photo is too small. Use a clearer face-on selfie (at least 480 pixels on the short side).";
  }
  const code = err instanceof ApiError ? err.code : "";
  switch (code) {
    case "image_too_large":
      return "That photo is too large. Use a closer, well-lit shot.";
    case "image_too_small":
      return "That photo is too small. Use a clearer face-on selfie (at least 480 pixels on the short side).";
    case "photo_rejected":
      return "YouCam could not read that photo. Use a well-lit, face-on selfie with hair off the face.";
    case "youcam_unconfigured":
      return "Mirror is not connected yet. Try again later.";
    case "youcam_unavailable":
      return "Skin analysis is temporarily unavailable. Try again in a few minutes.";
    case "youcam_busy":
      return "Too many scans right now. Wait a moment and try again.";
    case "mirror_consent_required":
      return "Allow Mirror photos to continue. Cycle, Alena, and Wallet stay available.";
    case "live_camera_consent_required":
      return "Allow live camera to capture a still. Photo mode stays available.";
    case "scan_required":
      return "Shade match needs a skin scan from the last 30 days.";
    case "reference_required":
      return "Add a reference photo for Get this look.";
    case "hair_color_required":
      return "Pick a hair colour for try-on.";
    case "image_required":
      return "Add a face photo, or take a skin scan first.";
    case "hair_failed":
      return "Hair Studio could not finish. Try again in a few minutes.";
    case "wardrobe_consent_required":
      return "Allow clothing photos to use My Wardrobe. Cycle, Alena, and Wallet stay available.";
    case "wardrobe_category_banned":
      return "Swimwear and lingerie are not catalogued for try-on.";
    case "wardrobe_vto_unsupported":
      return "Try-on needs a top, bottom, one-piece, or outerwear — not shoes or accessories.";
    case "wardrobe_items_required":
      return "Pick at least one catalogued piece.";
    case "wardrobe_failed":
      return "Wardrobe could not finish. Try again in a few minutes.";
    case "accessory_3d_required":
      return "This piece has no retailer 3D asset yet. We do not build 3D from a photo.";
    case "nail_color_required":
      return "Pick a nail colour from the catalogue.";
    case "frame_id_required":
      return "That frame is not try-on ready yet.";
    case "hand_photo_required":
      return "Nail try-on needs a hand photo.";
    case "accessory_failed":
      return "Accessory try-on could not finish. Try again in a few minutes.";
    case "resale_price_invalid":
      return "Enter a price greater than zero.";
    case "resale_already_listed":
      return "That piece already has a listing in review or live.";
    case "resale_failed":
      return "Could not create the resale listing. Try again in a few minutes.";
    case "catalogue_item_invalid":
      return "That look is not available for try-on.";
    case "api_base_url_missing":
      return "API is not configured. Set VITE_API_BASE_URL to use Mirror.";
    default:
      return err instanceof Error ? err.message : "Something went wrong. Try again.";
  }
}

function TrendRow({
  label,
  points,
}: {
  label: string;
  points: { id: string; when: string; value: number }[];
}) {
  if (points.length < 2) return null;
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[length:var(--text-label)] text-foreground">
        {label} over time
      </p>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] items-end gap-1 p-0">
        {points.map((p) => (
          <li key={p.id} className="grid justify-items-center gap-1">
            <span
              className="flex h-12 w-full items-end overflow-hidden rounded-sm bg-muted"
              title={`${Math.round(p.value)} of 100`}
            >
              <span
                className="block w-full bg-primary"
                style={{ height: `${Math.min(100, Math.max(0, p.value))}%` }}
              />
            </span>
            <span className="text-center text-[length:var(--text-caption)] text-muted-foreground">
              {formatWhen(p.when)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function phaseLabel(phase: SkinScan["cyclePhaseAtScan"]): string {
  if (!phase) return "No cycle day";
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

export function MirrorPage() {
  const [tab, setTab] = useState<Tab>("scan");
  const [status, setStatus] = useState<MirrorStatus | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);

  const [scans, setScans] = useState<SkinScan[]>([]);
  const [selected, setSelected] = useState<SkinScan | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [maskSrc, setMaskSrc] = useState<string | null>(null);

  const [tryons, setTryons] = useState<ApparelTryOn[]>([]);
  const [catalogue, setCatalogue] = useState<MirrorCatalogueItem[]>([]);
  const [catalogueMode, setCatalogueMode] = useState<CatalogueMode>("all");
  const [emptyReason, setEmptyReason] = useState<string | undefined>();
  const [pickedItem, setPickedItem] = useState<string | null>(null);
  const [tryonResult, setTryonResult] = useState<string | null>(null);
  const [activeTryOn, setActiveTryOn] = useState<ApparelTryOn | null>(null);
  const [lastBodyB64, setLastBodyB64] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [compareSrc, setCompareSrc] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });
  const [style, setStyle] = useState<StyleAnalytics | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const pendingScan = useRef<string | null>(null);
  const pendingTryOn = useRef<string | null>(null);
  const faceInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const [preview, setPreview] = useState<{
    kind: "face" | "body";
    src: string;
    file: File;
  } | null>(null);

  const pregnancyOn = profile?.modules.includes("pregnancy") ?? false;
  const pmosOn = profile?.modules.includes("pcos_manager") ?? false;

  const loadStatus = useCallback(async () => {
    if (!apiBaseUrl) return null;
    const [st, me] = await Promise.all([getMirrorStatus(), getMe()]);
    setStatus(st);
    setProfile(me);
    return st;
  }, []);

  const loadWorkspace = useCallback(async () => {
    const [scanRes, tryRes] = await Promise.all([
      listMirrorScans(),
      listMirrorTryOns(),
    ]);
    setScans(scanRes.scans);
    setTryons(tryRes.tryons);
    const latest =
      [...scanRes.scans].reverse().find((s) => !s.seeded) ??
      scanRes.scans[scanRes.scans.length - 1] ??
      null;
    setSelected(latest);
    if (scanRes.scans.length >= 2) {
      setCompareA((cur) => cur ?? scanRes.scans[0]!.id);
      setCompareB((cur) => cur ?? scanRes.scans[scanRes.scans.length - 1]!.id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!apiBaseUrl) {
          setError(friendlyError(new ApiError(0, "api_base_url_missing")));
          return;
        }
        const st = await loadStatus();
        if (cancelled) return;
        if (st?.consented) await loadWorkspace();
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus, loadWorkspace]);

  useEffect(() => {
    if (tab !== "timeline" || !apiBaseUrl) return;
    let cancelled = false;
    setStyleReady(false);
    (async () => {
      try {
        const { analytics } = await getStyleAnalytics();
        if (!cancelled) setStyle(analytics);
      } catch {
        if (!cancelled) setStyle(null);
      } finally {
        if (!cancelled) setStyleReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (!status?.consented || !apiBaseUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const cat = await getMirrorCatalogue({ mode: catalogueMode });
        if (cancelled) return;
        setCatalogue(cat.items);
        setEmptyReason(cat.emptyReason);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogueMode, status?.consented]);

  useEffect(() => {
    if (!selected?.hasResultImage) {
      setResultSrc(null);
      setMaskSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await getMirrorScanMedia(selected.id, "result");
        if (cancelled) return;
        setResultSrc(`data:${result.contentType};base64,${result.imageB64}`);
        if (selected.hasMask) {
          const mask = await getMirrorScanMedia(selected.id, "mask");
          if (!cancelled) {
            setMaskSrc(`data:${mask.contentType};base64,${mask.imageB64}`);
          }
        } else {
          setMaskSrc(null);
        }
      } catch {
        if (!cancelled) {
          setResultSrc(null);
          setMaskSrc(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const load = async (id: string | null) => {
        if (!id) return null;
        const scan = scans.find((s) => s.id === id);
        if (!scan?.hasResultImage) return null;
        try {
          const media = await getMirrorScanMedia(id, "result");
          return `data:${media.contentType};base64,${media.imageB64}`;
        } catch {
          return null;
        }
      };
      const [a, b] = await Promise.all([load(compareA), load(compareB)]);
      if (!cancelled) setCompareSrc({ a, b });
    })();
    return () => {
      cancelled = true;
    };
  }, [compareA, compareB, scans]);

  useEffect(() => {
    const id = pendingScan.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { scan } = await getMirrorScan(id);
        if (scan.status !== "pending") {
          pendingScan.current = null;
          setPollNote(null);
          window.clearInterval(tick);
          const { scans: next } = await listMirrorScans();
          setScans(next);
          setSelected(scan);
          setBusy(false);
        }
      } catch (err) {
        pendingScan.current = null;
        setPollNote(null);
        window.clearInterval(tick);
        setBusy(false);
        setError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [pollNote]);

  useEffect(() => {
    const id = pendingTryOn.current;
    if (!id) return;
    const tick = window.setInterval(async () => {
      try {
        const { tryon } = await getMirrorTryOn(id);
        if (tryon.status !== "pending") {
          pendingTryOn.current = null;
          setPollNote(null);
          window.clearInterval(tick);
          const { tryons: next } = await listMirrorTryOns();
          setTryons(next);
          setActiveTryOn(tryon);
          if (tryon.hasResultImage) {
            const media = await getMirrorTryOnMedia(tryon.id);
            setTryonResult(`data:${media.contentType};base64,${media.imageB64}`);
          }
          setBusy(false);
        }
      } catch (err) {
        pendingTryOn.current = null;
        setPollNote(null);
        window.clearInterval(tick);
        setBusy(false);
        setError(friendlyError(err));
      }
    }, 2000);
    return () => window.clearInterval(tick);
  }, [pollNote]);

  async function onConsent(granted: boolean) {
    setBusy(true);
    setError(null);
    try {
      const st = await postMirrorConsent(granted);
      setStatus(st);
      if (granted) await loadWorkspace();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFaceFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPollNote("Preparing your photo…");
    try {
      const imageB64 = await fileToJpegDataUrl(file);
      setPollNote("Analysing skin. This can take a short while.");
      const { scan } = await createMirrorScan(imageB64);
      setSelected(scan);
      if (scan.status === "pending") {
        pendingScan.current = scan.id;
        setPollNote("Still analysing. Keep this screen open.");
      } else {
        setPollNote(null);
        const { scans: next } = await listMirrorScans();
        setScans(next);
        setBusy(false);
      }
    } catch (err) {
      setPollNote(null);
      setBusy(false);
      setError(friendlyError(err));
    }
  }

  async function runTryOn(imageB64: string) {
    if (!pickedItem) {
      setError("Choose a look, then add a full-body photo.");
      return;
    }
    setBusy(true);
    setError(null);
    setPollNote("Building the try-on. This can take a short while.");
    try {
      const { tryon } = await createMirrorTryOn(imageB64, pickedItem);
      setActiveTryOn(tryon);
      if (tryon.status === "pending") {
        pendingTryOn.current = tryon.id;
        setPollNote("Still rendering. Keep this screen open.");
      } else {
        setPollNote(null);
        if (tryon.hasResultImage) {
          const media = await getMirrorTryOnMedia(tryon.id);
          setTryonResult(`data:${media.contentType};base64,${media.imageB64}`);
        }
        const { tryons: next } = await listMirrorTryOns();
        setTryons(next);
        setBusy(false);
      }
    } catch (err) {
      setPollNote(null);
      setBusy(false);
      setError(friendlyError(err));
    }
  }

  async function onBodyFile(file: File | undefined) {
    if (!file || !pickedItem) {
      setError("Choose a look, then add a full-body photo.");
      return;
    }
    setBusy(true);
    setError(null);
    setPollNote("Preparing your photo…");
    try {
      const imageB64 = await fileToJpegDataUrl(file);
      setLastBodyB64(imageB64);
      await runTryOn(imageB64);
    } catch (err) {
      setPollNote(null);
      setBusy(false);
      setError(friendlyError(err));
    }
  }

  function pickPreview(kind: "face" | "body", file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview.src);
    setPreview({ kind, src: URL.createObjectURL(file), file });
  }

  async function confirmPreview() {
    if (!preview) return;
    const { kind, file, src } = preview;
    URL.revokeObjectURL(src);
    setPreview(null);
    if (kind === "face") await onFaceFile(file);
    else await onBodyFile(file);
  }

  async function onDeleteScan(id: string) {
    if (!window.confirm("Remove this scan from your timeline?")) return;
    setBusy(true);
    try {
      await deleteMirrorScan(id);
      const { scans: next } = await listMirrorScans();
      setScans(next);
      setSelected(next[next.length - 1] ?? null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const liveScans = scans.filter((s) => !s.seeded);
  const insight = selected?.insight ?? scans.find((s) => s.insight)?.insight;
  const skinTags = elevatedSkinConcerns(selected?.scores ?? {});
  const apparel = catalogue.filter((i) => i.kind === "apparel");
  const scoreEntries = Object.entries(selected?.scores ?? {}).filter(
    ([, n]) => typeof n === "number",
  );

  if (loading) {
    return (
      <AppPage aria-busy="true">
        <PageHeader
          eyebrow="Mirror"
          title="Skin and style"
          lead="Loading Mirror…"
        />
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-64" />
      </AppPage>
    );
  }

  if (!status?.consented) {
    const market = profile?.market ?? "UK";
    return (
      <AppPage>
        <PageHeader
          eyebrow="Mirror"
          title="Photos for skin scores and try-on"
          lead="A face photo for skin scores; a full-body photo for apparel try-on. Photos stay out of Alena. You can say no and still use Cycle, Health, Alena, and Wallet."
        />
        <p className={leadClass}>{MIRROR_PROCESSOR_LEAD[market]}</p>
        {error ? <ErrorBanner message={error} /> : null}
        <ActionRow>
          <Button
            type="button"
            disabled={busy || !apiBaseUrl || !online}
            onClick={() => void onConsent(true)}
          >
            Allow Mirror photos
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void onConsent(false)}
          >
            Not now
          </Button>
        </ActionRow>
        <p className={leadClass}>
          You can change this later in{" "}
          <Link to="/app/account" className="font-semibold text-primary">
            Account
          </Link>
          .
        </p>
      </AppPage>
    );
  }

  const captureOff = busy || !status.youcamConfigured || !online;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Mirror"
        title="Skin and style"
        lead="Scores are wellness snapshots from YouCam, shown with your cycle logs. Not a diagnosis."
      />
      <AskAlenaLink from="mirror" />

      {!online ? (
        <OfflineBanner message="You are offline. Capture is paused. Past scans stay on this page." />
      ) : null}

      <SegmentedTabs
        ariaLabel="Mirror sections"
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: "scan", label: "Skin scan" },
          { id: "makeup", label: "Makeup" },
          { id: "hair", label: "Hair" },
          { id: "wardrobe", label: "Wardrobe" },
          { id: "accessories", label: "Accessories" },
          { id: "tryon", label: "Try-on" },
          { id: "timeline", label: "Timeline" },
        ]}
      />

      {error ? (
        <ErrorBanner message={error} onRetry={() => void loadWorkspace()} />
      ) : null}

      <p className="m-0 min-h-5 text-[length:var(--text-caption)] text-muted-foreground" aria-live="polite">
        {pollNote ?? (busy ? "Working…" : "")}
      </p>

      {!status.youcamConfigured || !status.youcamAvailable ? (
        <p className={leadClass} role="status">
          Live analysis is paused right now. Your timeline still shows past
          scans.
        </p>
      ) : null}

      {preview ? (
        <div className={cn(outlinedCardClass, "grid gap-4")}>
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            Check this photo
          </h2>
          <img
            src={preview.src}
            alt="Selected photo preview"
            className="w-full rounded-[var(--radius)] border border-border"
          />
          <ActionRow>
            <Button type="button" onClick={() => void confirmPreview()}>
              Use this photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                URL.revokeObjectURL(preview.src);
                setPreview(null);
              }}
            >
              Choose another
            </Button>
          </ActionRow>
        </div>
      ) : null}

      {tab === "scan" ? (
        <div className="grid gap-4 border-t border-border pt-6">
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            New skin scan
          </h2>
          <p className={leadClass}>
            Use even light, face the camera, and keep hair off your forehead.
          </p>
          <input
            ref={faceInput}
            id="mirror-face"
            className="sr-only"
            type="file"
            accept="image/*"
            capture="user"
            disabled={captureOff}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              pickPreview("face", file);
            }}
          />
          <ActionRow>
            <Button
              type="button"
              disabled={captureOff}
              onClick={() => faceInput.current?.click()}
            >
              Take a face photo
            </Button>
          </ActionRow>

          {selected ? (
            <article className={cn(outlinedCardClass, "grid gap-4")}>
              <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                {selected.seeded ? "Sample scan" : "Latest scan"} ·{" "}
                {formatWhen(selected.createdAt)}
              </h3>
              <p className={leadClass}>
                Cycle day {selected.cycleDayAtScan ?? "—"} ·{" "}
                {phaseLabel(selected.cyclePhaseAtScan)}
                {selected.overallScore != null
                  ? ` · Overall ${selected.overallScore} of 100`
                  : ""}
                {selected.status === "pending" ? " · Analysing" : ""}
                {selected.status === "error" ? " · Could not finish" : ""}
              </p>
              {resultSrc ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <img
                    src={resultSrc}
                    alt="Skin scan result"
                    className="w-full rounded-[var(--radius)] border border-border bg-muted"
                  />
                  {maskSrc ? (
                    <img
                      src={maskSrc}
                      alt="Skin overlay map"
                      className="w-full rounded-[var(--radius)] border border-border bg-muted"
                    />
                  ) : null}
                </div>
              ) : selected.hasResultImage ? (
                <p className={leadClass}>Loading result image…</p>
              ) : selected.seeded ? (
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
              ) : null}
              {insight ? (
                <div className="grid gap-2 border-t border-border pt-4">
                  <h3 className="m-0 text-[length:var(--text-sub)]">{insight.title}</h3>
                  <p className="m-0 text-[length:var(--text-body)]">{insight.body}</p>
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
          ) : (
            <EmptyState
              title="No scans yet"
              body="Take a face photo to start."
            />
          )}
        </div>
      ) : null}

      {tab === "makeup" && status ? (
        <MirrorStudioPanel
          status={status}
          scans={scans}
          market={profile?.market ?? "UK"}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          onStatus={async () => {
            await loadStatus();
          }}
          friendlyError={friendlyError}
        />
      ) : null}

      {tab === "hair" && status ? (
        <MirrorHairPanel
          status={status}
          scans={scans}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          friendlyError={friendlyError}
        />
      ) : null}

      {tab === "wardrobe" && status ? (
        <MirrorWardrobePanel
          status={status}
          market={profile?.market ?? "UK"}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          onStatus={async () => {
            await loadStatus();
          }}
          friendlyError={friendlyError}
        />
      ) : null}

      {tab === "accessories" && status ? (
        <MirrorAccessoriesPanel
          status={status}
          scans={scans}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          friendlyError={friendlyError}
        />
      ) : null}

      {tab === "tryon" ? (
        <div className="grid gap-4 border-t border-border pt-6">
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            Apparel try-on
          </h2>
          <p className={leadClass}>
            Choose a look, then upload a full-body photo in similar lighting.
            Mix a top and bottom with the same photo — no swimwear in this
            catalogue.
          </p>
          <SegmentedTabs
            ariaLabel="Catalogue filter"
            value={catalogueMode}
            onChange={(id) => setCatalogueMode(id as CatalogueMode)}
            items={[
              { id: "all", label: "All looks" },
              { id: "maternity", label: "Maternity" },
              { id: "pmos", label: "PMOS comfort" },
            ]}
          />
          {catalogueMode === "maternity" && !pregnancyOn ? (
            <p className={leadClass}>
              Turn on the Pregnancy module in Account to filter by week. Nothing
              is hidden from All looks.
            </p>
          ) : null}
          {catalogueMode === "pmos" && !pmosOn ? (
            <p className={leadClass}>
              PMOS comfort tags are a demo filter. Enable PMOS Manager if you
              want that module elsewhere in the app.
            </p>
          ) : null}
          {emptyReason === "pregnancy_week_unknown" ? (
            <p className={leadClass}>
              Add a pregnancy start date in Health to match looks to your week.
            </p>
          ) : null}
          {!apparel.length && emptyReason !== "pregnancy_week_unknown" ? (
            <EmptyState
              title="No looks in this filter"
              body="Try All looks."
            />
          ) : null}
          <ul className="m-0 grid list-none gap-3 p-0">
            {apparel.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    outlinedCardClass,
                    "grid min-h-[var(--tap)] w-full gap-1 text-left",
                    pickedItem === item.id && "border-primary bg-muted",
                  )}
                  onClick={() => setPickedItem(item.id)}
                >
                  <strong className="text-foreground">{item.title}</strong>
                  <span className="text-[length:var(--text-label)] text-muted-foreground">
                    {item.garmentCategory === "upper_body"
                      ? "Top · "
                      : item.garmentCategory === "lower_body"
                        ? "Bottom · "
                        : ""}
                    {item.subtitle} · {item.boutiqueName}, {item.boutiqueArea}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <input
            ref={bodyInput}
            id="mirror-body"
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={captureOff || !pickedItem}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              pickPreview("body", file);
            }}
          />
          <ActionRow>
            <Button
              type="button"
              disabled={captureOff || !pickedItem}
              onClick={() => bodyInput.current?.click()}
            >
              Take a full-body photo
            </Button>
            {lastBodyB64 ? (
              <Button
                type="button"
                variant="outline"
                disabled={captureOff || !pickedItem || busy}
                onClick={() => void runTryOn(lastBodyB64)}
              >
                Use last photo
              </Button>
            ) : null}
          </ActionRow>
          {tryonResult ? (
            <img
              src={tryonResult}
              alt="Apparel try-on result"
              className="w-full rounded-[var(--radius)] border border-border"
            />
          ) : activeTryOn?.status === "error" ? (
            <ErrorBanner message="Try-on could not finish. Try another photo." />
          ) : null}
          {tryons.length ? (
            <p className={leadClass}>
              {tryons.length} saved try-on{tryons.length === 1 ? "" : "s"} in this
              account.
            </p>
          ) : (
            <EmptyState title="No try-ons yet" body="Pick a look, then add a full-body photo." />
          )}
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="grid gap-4 border-t border-border pt-6">
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            Progress timeline
          </h2>
          <p className={leadClass}>
            Sample points fill a thin history. Live scans are marked as yours.
            Cycle claims need two live scans in different phases. Wardrobe
            utilisation uses pieces you already catalogued — no extra consent.
          </p>
          {style ? (
            <div className={cn(outlinedCardClass, "grid gap-4")}>
              <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                Style over {style.windowDays} days
              </h3>
              {style.utilisationPct != null ? (
                <ScoreBar
                  label="Closet utilisation"
                  value={style.utilisationPct}
                />
              ) : (
                <p className={leadClass}>
                  Catalogue clothing in My Wardrobe to see how much of the closet
                  you wore in this window.
                </p>
              )}
              <p className={leadClass}>
                {style.itemsWornInWindow} of {style.itemsCatalogued} pieces worn
                in this window. Cost per wear is price ÷ times worn. Missing
                prices show wear count only.
              </p>
              {style.costPerWear.length ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {style.costPerWear.slice(0, 8).map((row) => (
                    <li
                      key={row.itemId}
                      className="text-[length:var(--text-label)] text-foreground"
                    >
                      {row.name || "Piece"} · worn {row.wornCount}
                      {row.costPerWearMinor != null
                        ? ` · ${(row.costPerWearMinor / 100).toFixed(2)} per wear`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <TrendRow
                label="Skin overall"
                points={style.skinTrend
                  .filter((p) => typeof p.value === "number")
                  .map((p) => ({
                    id: p.id,
                    when: p.createdAt,
                    value: p.value as number,
                  }))}
              />
              <TrendRow
                label="Hair density"
                points={style.hairTrend
                  .filter((p) => typeof p.value === "number")
                  .map((p) => ({
                    id: p.id,
                    when: p.createdAt,
                    value: p.value as number,
                  }))}
              />
              {style.shadeHistory.length ? (
                <div className="grid gap-2">
                  <p className="m-0 text-[length:var(--text-label)] text-foreground">
                    Shade matches
                  </p>
                  <ol className="m-0 grid list-none gap-1 p-0">
                    {style.shadeHistory.map((p) => (
                      <li
                        key={p.id}
                        className="text-[length:var(--text-caption)] text-muted-foreground"
                      >
                        {formatWhen(p.createdAt)} · {p.label}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className={leadClass}>
                  Shade history appears after a Shade Finder match. Hair density
                  uses Hair Studio analysis, not try-on.
                </p>
              )}
            </div>
          ) : !styleReady && apiBaseUrl ? (
            <SkeletonBlock className="h-24" />
          ) : apiBaseUrl ? (
            <EmptyState
              title="Style series not loaded"
              body="Connect and open this tab again. No extra consent is required for these numbers."
            />
          ) : null}
          {!scans.length ? (
            <EmptyState
              title="No timeline yet"
              body="Take a skin scan to add the first point."
            />
          ) : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {scans.map((scan) => (
                <li key={scan.id} className="grid grid-cols-[1fr_auto] items-start gap-2">
                  <button
                    type="button"
                    className={cn(
                      outlinedCardClass,
                      "grid gap-1 text-left",
                      selected?.id === scan.id && "border-primary",
                    )}
                    onClick={() => setSelected(scan)}
                  >
                    <strong>
                      {formatWhen(scan.createdAt)} · {phaseLabel(scan.cyclePhaseAtScan)}
                    </strong>
                    <span className="text-[length:var(--text-label)] text-muted-foreground">
                      {scan.seeded ? "Sample" : "Your scan"}
                      {scan.overallScore != null
                        ? ` · overall ${scan.overallScore} of 100`
                        : ""}
                      {scan.status === "pending" ? " · analysing" : ""}
                    </span>
                  </button>
                  {!scan.seeded ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onDeleteScan(scan.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {scans.length >= 2 ? (
            <div className={cn(outlinedCardClass, "grid gap-4")}>
              <h3 className="m-0 text-[length:var(--text-sub)] text-foreground">
                Compare two dates
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[length:var(--text-label)] text-muted-foreground">
                    Earlier
                  </span>
                  <FieldSelect
                    value={compareA ?? ""}
                    onChange={(e) => setCompareA(e.target.value || null)}
                  >
                    {scans.map((scan) => (
                      <option key={scan.id} value={scan.id}>
                        {formatWhen(scan.createdAt)} · {phaseLabel(scan.cyclePhaseAtScan)}
                      </option>
                    ))}
                  </FieldSelect>
                </label>
                <label className="grid gap-1">
                  <span className="text-[length:var(--text-label)] text-muted-foreground">
                    Later
                  </span>
                  <FieldSelect
                    value={compareB ?? ""}
                    onChange={(e) => setCompareB(e.target.value || null)}
                  >
                    {scans.map((scan) => (
                      <option key={scan.id} value={scan.id}>
                        {formatWhen(scan.createdAt)} · {phaseLabel(scan.cyclePhaseAtScan)}
                      </option>
                    ))}
                  </FieldSelect>
                </label>
              </div>
              {(() => {
                const a = scans.find((s) => s.id === compareA);
                const b = scans.find((s) => s.id === compareB);
                if (!a || !b || a.id === b.id) {
                  return (
                    <p className={leadClass}>Pick two different dates to compare.</p>
                  );
                }
                const keys = ["acne", "oiliness", "redness", "texture"] as const;
                return (
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <p className="m-0 text-[length:var(--text-label)]">
                          {formatWhen(a.createdAt)} · {phaseLabel(a.cyclePhaseAtScan)}
                        </p>
                        {compareSrc.a ? (
                          <img
                            src={compareSrc.a}
                            alt={`Scan from ${formatWhen(a.createdAt)}`}
                            className="w-full rounded-[var(--radius)] border border-border bg-muted"
                          />
                        ) : (
                          <p className={leadClass}>
                            {a.seeded
                              ? "Sample point — scores only."
                              : "No result photo for this date."}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <p className="m-0 text-[length:var(--text-label)]">
                          {formatWhen(b.createdAt)} · {phaseLabel(b.cyclePhaseAtScan)}
                        </p>
                        {compareSrc.b ? (
                          <img
                            src={compareSrc.b}
                            alt={`Scan from ${formatWhen(b.createdAt)}`}
                            className="w-full rounded-[var(--radius)] border border-border bg-muted"
                          />
                        ) : (
                          <p className={leadClass}>
                            {b.seeded
                              ? "Sample point — scores only."
                              : "No result photo for this date."}
                          </p>
                        )}
                      </div>
                    </div>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {keys.map((key) => {
                        const av = a.scores[key];
                        const bv = b.scores[key];
                        if (av == null && bv == null) return null;
                        return (
                          <li key={key} className="text-[length:var(--text-label)]">
                            {SCORE_LABELS[key] ?? key}: {av ?? "—"} → {bv ?? "—"}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
              <TrendRow
                label="Acne"
                points={scans
                  .filter((s) => typeof s.scores.acne === "number")
                  .map((s) => ({
                    id: s.id,
                    when: s.createdAt,
                    value: s.scores.acne,
                  }))}
              />
              <TrendRow
                label="Oiliness"
                points={scans
                  .filter((s) => typeof s.scores.oiliness === "number")
                  .map((s) => ({
                    id: s.id,
                    when: s.createdAt,
                    value: s.scores.oiliness,
                  }))}
              />
              <TrendRow
                label="Redness"
                points={scans
                  .filter((s) => typeof s.scores.redness === "number")
                  .map((s) => ({
                    id: s.id,
                    when: s.createdAt,
                    value: s.scores.redness,
                  }))}
              />
            </div>
          ) : null}
          {liveScans.length < 2 ? (
            <p className={leadClass}>
              {liveScans.length === 0
                ? "Take two scans in different cycle phases to look for a pattern."
                : "One live scan so far. Scan again in another phase before we look for a cycle pattern."}
            </p>
          ) : null}
        </div>
      ) : null}

      <PredictionDisclaimer message="Mirror scores and cycle overlays are wellness tools, not a diagnosis or medical advice." />
    </AppPage>
  );
}
