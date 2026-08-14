/** YouCam SD: short side ≥ 480px, long side ≤ 4096px. */
const MIN_SHORT = 480;
const MAX_LONG = 1600;

export function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const minSide = Math.min(img.width, img.height);
      const maxSide = Math.max(img.width, img.height);
      if (minSide < MIN_SHORT) {
        URL.revokeObjectURL(url);
        reject(new Error("image_too_small"));
        return;
      }
      let scale = Math.min(1, MAX_LONG / maxSide);
      if (minSide * scale < MIN_SHORT) scale = MIN_SHORT / minSide;
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
