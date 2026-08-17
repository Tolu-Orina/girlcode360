import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionRow,
  AppPage,
  elevatedCardClass,
  leadClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { AskAlenaLink } from "@/components/blocks/ask-alena-link";
import { MirrorStudioPanel } from "@/components/blocks/mirror-studio";
import { MirrorHairPanel } from "@/components/blocks/mirror-hair";
import { MirrorAccessoriesPanel } from "@/components/blocks/mirror-accessories";
import { MirrorApparelPanel } from "@/components/blocks/mirror-apparel";
import { MirrorTimelinePanel } from "@/components/blocks/mirror-timeline";
import { MirrorWardrobePanel, BoutiqueSamplesCard } from "@/components/blocks/mirror-wardrobe";
import { MirrorConsentGate } from "@/components/blocks/mirror-consent-gate";
import { MirrorSkinRail, MirrorSkinStudio } from "@/components/blocks/mirror-skin-studio";
import { mirrorStudioRowClass } from "@/components/blocks/mirror-stage";
import {
  MirrorStudioNav,
  type MirrorTab,
} from "@/components/blocks/mirror-studio-nav";
import { MakeupLookProvider } from "@/components/blocks/makeup-look-context";
import { MirrorPhotoTray } from "@/components/blocks/mirror-photo-tray";
import { MirrorStill } from "@/components/blocks/mirror-still";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useOnline } from "@/hooks/use-online";
import { MirrorPhotosProvider, useMirrorPhotos } from "@/hooks/use-mirror-photos";
import { fileToJpegDataUrl } from "@/lib/jpeg-upload";
import { cn } from "@/lib/utils";
import type {
  MirrorCatalogueItem,
  MirrorStatus,
  SkinScan,
  HealthModule,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import {
  ApiError,
  createMirrorScan,
  deleteMirrorScan,
  getMe,
  getMirrorCatalogue,
  getMirrorScan,
  getMirrorScanMedia,
  getMirrorStatus,
  listMirrorScans,
  patchModules,
  postMirrorConsent,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import { MIRROR_PROCESSOR_LEAD } from "../lib/consent-copy";
import { ctaLabel } from "../lib/cta";
import { latestLiveScan } from "../lib/mirror-latest";
import { elevatedSkinConcerns } from "../../../../packages/domain/src/index";

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
    case "face_angle_invalid":
      return "YouCam needs a face looking straight at the camera. Sit square to the lens, fill the oval, then try again.";
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
      return "This piece has no catalogue SKU still. We do not invent a 3D model from a photo.";
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

export function MirrorPage() {
  return (
    <MirrorPhotosProvider>
      <MirrorPageView />
    </MirrorPhotosProvider>
  );
}

function MirrorPageView() {
  const [tab, setTab] = useState<MirrorTab>("scan");
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

  const [catalogue, setCatalogue] = useState<MirrorCatalogueItem[]>([]);
  const [pickedItem, setPickedItem] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [compareSrc, setCompareSrc] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });

  const pendingScan = useRef<string | null>(null);
  const lastQueued = useRef("");
  const { queued, consumeQueued } = useMirrorPhotos();
  const online = useOnline();
  const [preview, setPreview] = useState<{
    kind: "face" | "body";
    src: string;
    file: File;
  } | null>(null);
  const [heldFaceSrc, setHeldFaceSrc] = useState<string | null>(null);

  const pregnancyOn = profile?.modules.includes("pregnancy") ?? false;
  const pmosOn = profile?.modules.includes("pcos_manager") ?? false;
  const mirrorOn = profile?.modules.includes("mirror") ?? true;

  const loadStatus = useCallback(async () => {
    if (!apiBaseUrl) return null;
    const [st, me] = await Promise.all([getMirrorStatus(), getMe()]);
    setStatus(st);
    setProfile(me);
    return st;
  }, []);

  const loadWorkspace = useCallback(async () => {
    const scanRes = await listMirrorScans();
    setScans(scanRes.scans);
    setSelected(latestLiveScan(scanRes.scans));
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
    if (!status?.consented || !apiBaseUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const cat = await getMirrorCatalogue({ kind: "apparel" });
        if (cancelled) return;
        setCatalogue(cat.items);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status?.consented]);

  useEffect(() => {
    if (!selected) {
      setResultSrc(null);
      setMaskSrc(null);
      return;
    }
    const kind = selected.hasResultImage
      ? "result"
      : selected.hasSourceImage
        ? "source"
        : null;
    if (!kind) {
      setMaskSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await getMirrorScanMedia(selected.id, kind);
        if (cancelled) return;
        setResultSrc(`data:${result.contentType};base64,${result.imageB64}`);
        if (kind === "result" && selected.hasMask) {
          const mask = await getMirrorScanMedia(selected.id, "mask");
          if (!cancelled) {
            setMaskSrc(`data:${mask.contentType};base64,${mask.imageB64}`);
          }
        } else {
          setMaskSrc(null);
        }
      } catch {
        if (!cancelled) setMaskSrc(null);
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
          if (scan.status === "error") {
            setError(
              scan.insight?.body ??
                "YouCam could not finish this still. Face the camera in even light and try again.",
            );
          }
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

  async function enableMirror() {
    setBusy(true);
    setError(null);
    try {
      const base = profile?.modules ?? (["period_tracker"] as HealthModule[]);
      const modules: HealthModule[] = base.includes("mirror")
        ? base
        : ["mirror", ...base];
      setProfile(await patchModules({ modules }));
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

  const pickPreview = useCallback((kind: "face" | "body", file: File | undefined) => {
    if (!file) return;
    const src = URL.createObjectURL(file);
    setPreview({ kind, src, file });
    if (kind === "face") setHeldFaceSrc(src);
  }, []);

  useEffect(() => {
    if (!queued || queued.token === lastQueued.current) return;
    if (queued.kind === "face" && (tab === "scan" || tab === "timeline")) {
      lastQueued.current = queued.token;
      consumeQueued(queued.token);
      if (tab === "timeline") setTab("scan");
      pickPreview("face", queued.file);
    }
  }, [queued, tab, consumeQueued, pickPreview]);

  async function confirmPreview() {
    if (!preview) return;
    const { kind, file, src } = preview;
    if (kind === "face") setHeldFaceSrc(src);
    else URL.revokeObjectURL(src);
    setPreview(null);
    if (kind === "face") await onFaceFile(file);
  }

  async function onDeleteScan(id: string) {
    if (!window.confirm("Remove this scan from your timeline?")) return;
    setBusy(true);
    try {
      await deleteMirrorScan(id);
      const { scans: next } = await listMirrorScans();
      setScans(next);
      setSelected(latestLiveScan(next));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const skinTags = elevatedSkinConcerns(selected?.scores ?? {});
  const apparel = catalogue.filter((i) => i.kind === "apparel");

  if (loading) {
    return (
      <AppPage aria-busy="true">
        <PageHeader
          eyebrow="Mirror"
          title="Skin and style"
          lead="Loading Mirror…"
        />
        <SkeletonBlock className="aspect-[4/5] h-auto w-full max-w-md rounded-[var(--radius-sheet)]" />
        <SkeletonBlock className="h-32" />
      </AppPage>
    );
  }

  if (!mirrorOn) {
    return (
      <AppPage>
        <PageHeader
          eyebrow="Mirror"
          title="Your studio"
          lead="Mirror is off. Turn it on to use skin, makeup, hair, and wardrobe."
        />
        {error ? <ErrorBanner message={error} /> : null}
        <EmptyState
          title="Mirror is off"
          body="Turn it on here or in Account. Cycle, Alena, and Wallet stay as you left them."
          action={
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={busy || !apiBaseUrl} onClick={() => void enableMirror()}>
                {ctaLabel(busy, "Turn Mirror on")}
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/account">Open Account</Link>
              </Button>
            </div>
          }
        />
      </AppPage>
    );
  }

  if (!status?.consented) {
    const market = profile?.market ?? "UK";
    return (
      <AppPage className="lg:max-w-[var(--shell-max)]">
        <MirrorConsentGate
          processorLead={MIRROR_PROCESSOR_LEAD[market]}
          busy={busy}
          blocked={!apiBaseUrl || !online}
          error={error}
          onAllow={() => void onConsent(true)}
          onSkip={() => void onConsent(false)}
        />
      </AppPage>
    );
  }

  const captureOff = busy || !status.youcamConfigured || !online;
  const photoTray = (
    <MirrorPhotoTray
      preferredKind={
        tab === "tryon" ? "body" : tab === "wardrobe" ? "garment" : "face"
      }
      acceptedKinds={
        tab === "tryon"
          ? ["body"]
          : tab === "wardrobe"
            ? ["garment", "body"]
            : tab === "accessories"
              ? ["face", "hand"]
              : ["face"]
      }
      useLabel={
        tab === "tryon"
          ? "Use for apparel try-on"
          : tab === "makeup"
            ? "Use for this makeup look"
            : tab === "hair"
              ? "Use for Hair Studio"
              : tab === "wardrobe"
                ? "Use in Wardrobe"
                : tab === "accessories"
                  ? "Use for accessories"
                  : "Use for skin scan"
      }
      disabled={!status.youcamConfigured || !online}
      busy={busy}
    />
  );

  return (
    <AppPage className="lg:max-w-[var(--shell-max)] lg:gap-8">
      <MakeupLookProvider>
      <div className="grid min-w-0 gap-6">
      <div className="grid min-w-0 gap-4">
        <p className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-caption)] font-bold tracking-wide text-primary uppercase">
          Mirror
        </p>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-8">
          <h1 className="m-0 text-[length:var(--text-page)] text-primary max-lg:text-[28px]">
            Your studio
          </h1>
          <MirrorStudioNav value={tab} onChange={setTab} />
        </div>
        <p className="m-0 text-[length:var(--text-body)] leading-normal text-muted-foreground">
          One photo for skin, makeup, hair, and try-on.
        </p>
        <AskAlenaLink from="mirror" brief />
      </div>

      {!online ? (
        <OfflineBanner message="You are offline. Capture is paused. Past scans stay on this page." />
      ) : null}

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

        {tab === "scan" ? (
        <div className={mirrorStudioRowClass}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <MirrorSkinStudio
          captureOff={captureOff}
          previewSrc={preview?.kind === "face" ? preview.src : null}
          resultSrc={resultSrc}
          maskSrc={maskSrc}
          heldSrc={heldFaceSrc}
          selected={selected}
          onPickFile={(file) => pickPreview("face", file)}
          onConfirmPreview={() => void confirmPreview()}
          onCancelPreview={() => {
            if (preview) {
              if (preview.src !== heldFaceSrc) URL.revokeObjectURL(preview.src);
              setPreview(null);
            }
          }}
          onError={(msg) => setError(msg)}
          busy={busy}
        />
        </div>
        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
        {photoTray}
        </div>
        <div className="min-w-0 max-lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <MirrorSkinRail
          resultSrc={resultSrc}
          selected={selected}
          skinTags={skinTags}
        />
        </div>
        </div>
      ) : tab === "makeup" && status ? (
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
          tray={photoTray}
        />
      ) : tab === "hair" && status ? (
        <MirrorHairPanel
          status={status}
          scans={scans}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          friendlyError={friendlyError}
          tray={photoTray}
        />
      ) : tab === "wardrobe" && status ? (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,1.2fr)_minmax(14rem,18rem)]">
          <div className="grid min-w-0 gap-6">
            {preview?.kind === "body" ? (
              <div className={cn(elevatedCardClass)}>
                <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                  Check this photo
                </h2>
                <MirrorStill
                  src={preview.src}
                  alt="Selected photo preview"
                  crop="body"
                />
                <ActionRow>
                  <Button type="button" onClick={() => void confirmPreview()}>
                    {ctaLabel(busy, "Use this photo")}
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
          </div>
          <BoutiqueSamplesCard
            samples={apparel}
            onOpenApparel={(itemId) => {
              setPickedItem(itemId);
              setTab("tryon");
            }}
          />
          {photoTray}
        </div>
      ) : tab === "accessories" && status ? (
        <MirrorAccessoriesPanel
          status={status}
          scans={scans}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          friendlyError={friendlyError}
          tray={photoTray}
        />
      ) : tab === "tryon" ? (
        <MirrorApparelPanel
          status={status}
          online={online}
          busy={busy}
          onBusy={setBusy}
          onError={(msg) => setError(msg)}
          friendlyError={friendlyError}
          tray={photoTray}
          pregnancyOn={pregnancyOn}
          pmosOn={pmosOn}
          focusItemId={pickedItem}
        />
      ) : (
        <MirrorTimelinePanel
          scans={scans}
          selected={selected}
          onSelectScan={setSelected}
          onDeleteScan={(id) => void onDeleteScan(id)}
          busy={busy}
          market={profile?.market ?? "UK"}
          compareSrc={compareSrc}
          compareA={compareA}
          compareB={compareB}
          onCompareA={setCompareA}
          onCompareB={setCompareB}
        />
      )}
      </div>
      </MakeupLookProvider>
    </AppPage>
  );
}
