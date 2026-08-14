/** YouCam SD: short side ≥ 480px. Makeup transfer long side ≤ 1024. */
const MIN_SHORT = 480;
const DEFAULT_MAX_LONG = 1600;

type JpegOpts = { maxLong?: number; allowUpscale?: boolean };

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
  opts?: JpegOpts,
): string {
  return scaleToJpeg(
    video.videoWidth,
    video.videoHeight,
    (ctx, w, h) => ctx.drawImage(video, 0, 0, w, h),
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
  opts?: JpegOpts,
): File {
  return dataUrlToJpegFile(videoFrameToJpegDataUrl(video, opts));
}
