import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionRow,
  leadClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { EmptyState } from "@/components/blocks/states";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import {
  createAccessoryLook,
  getAccessoryLook,
  getAccessoryLookMedia,
  getMirrorCatalogue,
  listAccessoryLooks,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AccessoryLook,
  MirrorCatalogueItem,
  MirrorStatus,
  SkinScan,
} from "../../../../../packages/api-types/src/index";
import { ACCESSORY_NO_2D_TO_3D_NOTE } from "../../../../../packages/domain/src/index";

function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const minSide = Math.min(img.width, img.height);
      if (minSide < 400) {
        URL.revokeObjectURL(url);
        reject(new Error("image_too_small"));
        return;
      }
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Could not prepare the photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

type AccMode = "jewellery" | "eyewear" | "nail";

export function MirrorAccessoriesPanel({
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
  const [mode, setMode] = useState<AccMode>("jewellery");
  const [items, setItems] = useState<MirrorCatalogueItem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [looks, setLooks] = useState<AccessoryLook[]>([]);
  const [selected, setSelected] = useState<AccessoryLook | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const pending = useRef<string | null>(null);
  const reusable = scans.find((s) => !s.seeded && s.status === "success");
  const captureOff = busy || !status.youcamConfigured || !online;
  const catKind = mode === "nail" ? "nail_color" : mode;

  const load = useCallback(async () => {
    const [cat, lookRes] = await Promise.all([
      getMirrorCatalogue({ kind: catKind }),
      listAccessoryLooks(),
    ]);
    setItems(cat.items);
    setLooks(lookRes.looks);
    setPicked((cur) => cur ?? cat.items.find((i) => i.tryOnReady)?.id ?? null);
    setSelected(lookRes.looks[0] ?? null);
  }, [catKind]);

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
  }, [selected]);

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
    if (!item.tryOnReady) {
      onError(ACCESSORY_NO_2D_TO_3D_NOTE);
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const imageB64 = file ? await fileToJpegDataUrl(file) : undefined;
      const scanId = mode === "nail" ? undefined : imageB64 ? undefined : reusable?.id;
      if (mode === "nail" && !imageB64) {
        onBusy(false);
        onError("Nail try-on needs a hand photo.");
        return;
      }
      if (mode !== "nail" && !imageB64 && !scanId) {
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
      if (look.status !== "pending") {
        pending.current = null;
        await load();
        onBusy(false);
      }
    } catch (err) {
      onBusy(false);
      onError(friendlyError(err));
    }
  }

  const pickedItem = items.find((i) => i.id === picked);

  return (
    <div className="grid gap-4 border-t border-border pt-6">
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Accessories Studio
      </h2>
      <p className={leadClass}>{ACCESSORY_NO_2D_TO_3D_NOTE}</p>
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
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={cn(
                "min-h-[var(--tap)] w-full rounded-[var(--radius)] border px-3 py-2 text-left text-[length:var(--text-caption)]",
                picked === row.id
                  ? "border-primary bg-muted text-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
              onClick={() => setPicked(row.id)}
            >
              {row.title}
              {row.tryOnReady ? "" : " · 3D not on file"}
              {row.nailColor ? ` · ${row.nailColor}` : ""}
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <EmptyState
          title="No accessories in this catalogue yet"
          body="Retailer 3D assets and frames come through the Business Portal. Nothing is invented from a 2D photo."
        />
      ) : null}
      <input
        ref={photoInput}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={captureOff}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(file);
        }}
      />
      <ActionRow>
        <Button
          type="button"
          disabled={captureOff || !pickedItem}
          onClick={() => photoInput.current?.click()}
        >
          {mode === "nail" ? "Photograph a hand" : "Photograph your face"}
        </Button>
        {mode !== "nail" && reusable ? (
          <Button
            type="button"
            variant="outline"
            disabled={captureOff || !pickedItem}
            onClick={() => void run()}
          >
            Use last skin scan
          </Button>
        ) : null}
      </ActionRow>
      {mode === "nail" ? <SheMatchBanner trigger="mirror_nail" extraTags={["nail"]} /> : null}
      {selected ? (
        <article className={cn(outlinedCardClass, "grid gap-3")}>
          <h3 className="m-0 text-[length:var(--text-sub)]">
            {selected.status === "pending" ? "Working…" : "Latest try-on"}
          </h3>
          {src ? (
            <img
              src={src}
              alt="Accessory try-on result"
              className="w-full rounded-[var(--radius)] border border-border bg-muted"
            />
          ) : (
            <p className={leadClass}>
              {selected.status === "error"
                ? "Try-on could not finish. Try another photo."
                : "Result photo appears when the task finishes."}
            </p>
          )}
        </article>
      ) : looks.length === 0 ? (
        <EmptyState
          title="No accessory try-ons yet"
          body="Pick a piece with a retailer 3D asset, frame, or nail colour, then add a photo."
        />
      ) : null}
    </div>
  );
}
