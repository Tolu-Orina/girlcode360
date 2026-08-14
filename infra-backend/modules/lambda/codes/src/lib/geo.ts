import type { Market } from "../types";

/** ISO 3166-1 alpha-2 (CloudFront-Viewer-Country) → product market. */
export function marketFromCountry(code: string | undefined): Market | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  if (c === "GB" || c === "UK") return "UK";
  if (c === "NG") return "NG";
  if (c === "GH") return "GH";
  return undefined;
}

export function marketFromTimezone(tz: string | undefined): Market | undefined {
  if (!tz) return undefined;
  if (tz === "Africa/Lagos") return "NG";
  if (tz === "Africa/Accra") return "GH";
  if (tz === "Europe/London") return "UK";
  return undefined;
}
