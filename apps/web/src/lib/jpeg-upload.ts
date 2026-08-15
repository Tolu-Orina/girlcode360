/** YouCam SD: short side ≥ 480px. Makeup transfer long side ≤ 1024. */
const MIN_SHORT = 480;
const DEFAULT_MAX_LONG = 1600;

type JpegOpts = { maxLong?: number; allowUpscale?: boolean };

/** Map a CSS `object-fit: cover` preview region back onto the video frame. */
export type GuideCrop = {
  boxW: number;
  boxH: number;
  destX: number;
  destY: number;
  destW: number;
  destH: number;
  /** CSS object-position X as 0–1. `center` → 0.5 */
  objectPositionX?: number;
  /** CSS object-position Y as 0–1. `18%` → 0.18 */
  objectPositionY?: number;
  /** Grow the dest rect before mapping (0.08 = 8% hair/chin pad). */
  pad?: number;
};

export function coverMappedSourceRect(
  videoW: number,
  videoH: number,
  crop: GuideCrop,
): { sx: number; sy: number; sw: number; sh: number } {
  const posX = crop.objectPositionX ?? 0.5;
  const posY = crop.objectPositionY ?? 0.18;
  const pad = crop.pad ?? 0;
  const scale = Math.max(crop.boxW / videoW, crop.boxH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  const offX = (crop.boxW - dispW) * posX;
  const offY = (crop.boxH - dispH) * posY;

  let destX = crop.destX - crop.destW * pad;
  let destY = crop.destY - crop.destH * pad;
  let destW = crop.destW * (1 + 2 * pad);
  let destH = crop.destH * (1 + 2 * pad);

  let sx = (destX - offX) / scale;
  let sy = (destY - offY) / scale;
  let sw = destW / scale;
  let sh = destH / scale;

  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > videoW) sw = videoW - sx;
  if (sy + sh > videoH) sh = videoH - sy;

  return {
    sx: Math.max(0, sx),
    sy: Math.max(0, sy),
    sw: Math.max(1, sw),
    sh: Math.max(1, sh),
  };
}

export function guideCropFromElements(
  box: HTMLElement,
  oval: HTMLElement,
  opts?: Pick<GuideCrop, "objectPositionX" | "objectPositionY" | "pad">,
): GuideCrop {
  const br = box.getBoundingClientRect();
  const or = oval.getBoundingClientRect();
  return {
    boxW: Math.max(1, br.width),
    boxH: Math.max(1, br.height),
    destX: or.left - br.left,
    destY: or.top - br.top,
    destW: Math.max(1, or.width),
    destH: Math.max(1, or.height),
    objectPositionX: opts?.objectPositionX ?? 0.5,
    objectPositionY: opts?.objectPositionY ?? 0.18,
    pad: opts?.pad ?? 0.08,
  };
}

function scaleToJpeg(
  srcW: number,
  srcH: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxLong: number,
  allowUpscale = false,
): string {
  const minSide = Math.min(srcW, srcH);
  const maxSide = Math.max(srcW, srcH);
  if (srcW < 2 || srcH < 2) {
    throw new Error("image_too_small");
  }
  if (!allowUpscale && minSide < MIN_SHORT) {
    throw new Error("image_too_small");
  }
  let scale = Math.min(1, maxLong / maxSide);
  if (minSide * scale < MIN_SHORT) scale = MIN_SHORT / minSide;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo");
  draw(ctx, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function fileToJpegDataUrl(file: File, opts?: JpegOpts): Promise<string> {
  const maxLong = opts?.maxLong ?? DEFAULT_MAX_LONG;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const dataUrl = scaleToJpeg(
          img.width,
          img.height,
          (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
          maxLong,
          opts?.allowUpscale,
        );
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

export function cameraVideoConstraints(
  facingMode: "user" | "environment",
  deviceId?: string,
): MediaTrackConstraints {
  if (deviceId) {
    return {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

export function isFrontCameraLabel(label: string): boolean {
  const t = label.toLowerCase();
  if (/\b(back|rear|environment|world)\b/.test(t)) return false;
  if (/\b(front|user|face|webcam|integrated|facing you)\b/.test(t)) return true;
  return true;
}

export async function listVideoCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput" && d.deviceId);
}

export function videoFrameToJpegDataUrl(
  video: HTMLVideoElement,
  opts?: JpegOpts & { guideCrop?: GuideCrop },
): string {
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;
  const crop = opts?.guideCrop;
  if (!crop) {
    return scaleToJpeg(
      videoW,
      videoH,
      (ctx, w, h) => ctx.drawImage(video, 0, 0, w, h),
      opts?.maxLong ?? DEFAULT_MAX_LONG,
      opts?.allowUpscale ?? true,
    );
  }
  const { sx, sy, sw, sh } = coverMappedSourceRect(videoW, videoH, crop);
  return scaleToJpeg(
    sw,
    sh,
    (ctx, w, h) => ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h),
    opts?.maxLong ?? DEFAULT_MAX_LONG,
    opts?.allowUpscale ?? true,
  );
}

export function dataUrlToJpegFile(
  dataUrl: string,
  filename = "capture.jpg",
): File {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: "image/jpeg" });
}

export function videoFrameToJpegFile(
  video: HTMLVideoElement,
  opts?: JpegOpts & { guideCrop?: GuideCrop },
): File {
  return dataUrlToJpegFile(videoFrameToJpegDataUrl(video, opts));
}
