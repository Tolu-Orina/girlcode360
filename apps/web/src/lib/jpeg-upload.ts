/** YouCam SD: short side ≥ 480px. Makeup transfer long side ≤ 1024. */
const MIN_SHORT = 480;
const DEFAULT_MAX_LONG = 1600;

type JpegOpts = { maxLong?: number };

function scaleToJpeg(
  srcW: number,
  srcH: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxLong: number,
): string {
  const minSide = Math.min(srcW, srcH);
  const maxSide = Math.max(srcW, srcH);
  if (minSide < MIN_SHORT) {
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
  return canvas.toDataURL("image/jpeg", 0.82);
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

export function videoFrameToJpegDataUrl(
  video: HTMLVideoElement,
  opts?: JpegOpts,
): string {
  return scaleToJpeg(
    video.videoWidth,
    video.videoHeight,
    (ctx, w, h) => ctx.drawImage(video, 0, 0, w, h),
    opts?.maxLong ?? DEFAULT_MAX_LONG,
  );
}
