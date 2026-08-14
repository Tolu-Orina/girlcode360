const KEY = "gc360.sessionOrigin";

export type SessionOrigin = {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "area";
};

export function getSessionOrigin(): SessionOrigin | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionOrigin;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionOrigin(origin: SessionOrigin | null): void {
  try {
    if (!origin) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(origin));
  } catch {
    /* ignore */
  }
}

export function deviceClock(): { weekday: number; hhmm: string } {
  const d = new Date();
  return {
    weekday: d.getDay(),
    hhmm: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function marketplaceQuery(
  extra: Record<string, string | number | boolean | undefined | null> = {},
): string {
  const clock = deviceClock();
  const origin = getSessionOrigin();
  const params = new URLSearchParams();
  params.set("weekday", String(clock.weekday));
  params.set("hhmm", clock.hhmm);
  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lng", String(origin.lng));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || v === "") continue;
    params.set(k, String(v));
  }
  return `?${params.toString()}`;
}
