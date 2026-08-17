/** User-facing copy for YouCam task / photo errors. Wellness only. */

export function youcamErrorCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const nested =
    rec.data && typeof rec.data === "object"
      ? (rec.data as Record<string, unknown>)
      : rec;
  const raw = nested.error ?? nested.error_code ?? nested.message ?? rec.error;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

export function youcamClientFailCopy(reason: string | null | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("face_angle") || r.includes("angle_invalid")) {
    return "YouCam needs a face looking straight at the camera. Sit square to the lens, fill the oval, then try again.";
  }
  if (
    r.includes("noface") ||
    r.includes("no_face") ||
    r.includes("face_not") ||
    r.includes("detect") ||
    r.includes("invalidimage") ||
    r.includes("quality")
  ) {
    return "YouCam could not find a clear face. Face the camera in even light, hair off the forehead, then try again.";
  }
  if (reason) {
    return "That still could not be analysed. Try another front-facing photo in even light.";
  }
  return "That still could not be analysed. Try again in even light.";
}
