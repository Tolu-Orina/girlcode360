/** SheMatch rules + marketplace geo. No LLM. Silent when nothing is in range. */

export const SHEMATCH_MAX_KM = 5;

export type MarketplaceCategory =
  | "beauty"
  | "boutique"
  | "pharmacy"
  | "clinic";

export const MARKETPLACE_CATEGORY_LABEL: Record<MarketplaceCategory, string> = {
  beauty: "Beauty stores",
  boutique: "Boutiques & salons",
  pharmacy: "Pharmacies",
  clinic: "Clinics & hospitals",
};

export type SheMatchModule =
  | "period_tracker"
  | "pcos_manager"
  | "pregnancy"
  | "ttc"
  | "wallet";

export type SheMatchTriggerId =
  | "period_start"
  | "fertile_window"
  | "pregnancy_scan"
  | "pregnancy_emergency"
  | "pcos_acne"
  | "medication_due"
  | "mirror_skin"
  | "mirror_shade"
  | "mirror_nail";

export type SheMatchTrigger = {
  id: SheMatchTriggerId;
  module: SheMatchModule;
  categories: MarketplaceCategory[];
  tags: string[];
  /** Shown in “Why am I seeing this?” — health event, not a diagnosis. */
  why: string;
  bannerHint: string;
};

/** Clinical-advisor table (config). Update here, not in UI. */
export const SHEMATCH_TRIGGERS: SheMatchTrigger[] = [
  {
    id: "period_start",
    module: "period_tracker",
    categories: ["pharmacy", "beauty"],
    tags: ["period_care", "pain_relief", "pharmacy"],
    why: "You logged period flow today.",
    bannerHint: "Period care nearby",
  },
  {
    id: "fertile_window",
    module: "ttc",
    categories: ["pharmacy"],
    tags: ["ovulation", "folic", "pharmacy"],
    why: "Your logged cycles put today in a predicted fertile window.",
    bannerHint: "Fertility supplies nearby",
  },
  {
    id: "pregnancy_scan",
    module: "pregnancy",
    categories: ["clinic"],
    tags: ["obstetric_scan", "maternity"],
    why: "Pregnancy week 18–22 is a common anomaly-scan window.",
    bannerHint: "Scan centres nearby",
  },
  {
    id: "pregnancy_emergency",
    module: "pregnancy",
    categories: ["clinic"],
    tags: ["hospital", "maternity", "emergency"],
    why: "You asked for a nearby hospital or clinic.",
    bannerHint: "Clinics nearby",
  },
  {
    id: "pcos_acne",
    module: "pcos_manager",
    categories: ["beauty", "clinic"],
    tags: ["acne", "dermatology", "skincare"],
    why: "You logged an acne-related symptom.",
    bannerHint: "Skin care nearby",
  },
  {
    id: "medication_due",
    module: "pcos_manager",
    categories: ["pharmacy"],
    tags: ["pharmacy"],
    why: "A medication reminder is due.",
    bannerHint: "Pharmacies nearby",
  },
  {
    id: "mirror_skin",
    module: "period_tracker",
    categories: ["beauty", "pharmacy"],
    tags: ["acne", "oiliness", "texture", "redness", "age_spot", "skincare"],
    why: "A Mirror skin score was clearly elevated on this scan.",
    bannerHint: "Skincare nearby",
  },
  {
    id: "mirror_shade",
    module: "period_tracker",
    categories: ["beauty"],
    tags: ["foundation", "concealer", "beauty"],
    why: "A shade match is ready to shop through SheMatch, not an outbound retailer link.",
    bannerHint: "Beauty stores nearby",
  },
  {
    id: "mirror_nail",
    module: "period_tracker",
    categories: ["boutique", "beauty"],
    tags: ["nail", "salon"],
    why: "You tried a nail colour in Accessories Studio. This is nearby salons, not a diagnosis.",
    bannerHint: "Nail salons nearby",
  },
];

export function sheMatchTrigger(
  id: SheMatchTriggerId,
): SheMatchTrigger | undefined {
  return SHEMATCH_TRIGGERS.find((t) => t.id === id);
}

export type GeoPoint = { lat: number; lng: number };

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = deg(b.lat - a.lat);
  const dLng = deg(b.lng - a.lng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg(a.lat)) * Math.cos(deg(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s1)));
}

function deg(n: number): number {
  return (n * Math.PI) / 180;
}

/** Session gazetteer — typed area, not stored server-side as a profile. */
export const AREA_GAZETTEER: Array<GeoPoint & { id: string; label: string; aliases: string[] }> =
  [
    {
      id: "london",
      label: "London",
      aliases: ["london", "uk"],
      lat: 51.5074,
      lng: -0.1278,
    },
    {
      id: "sw7",
      label: "South Kensington (SW7)",
      aliases: ["sw7", "south kensington", "south ken"],
      lat: 51.4945,
      lng: -0.1743,
    },
    {
      id: "ikeja",
      label: "Ikeja, Lagos",
      aliases: ["ikeja", "lagos ikeja"],
      lat: 6.6018,
      lng: 3.3515,
    },
    {
      id: "vi",
      label: "Victoria Island, Lagos",
      aliases: ["victoria island", "vi", "lagos vi"],
      lat: 6.4281,
      lng: 3.4219,
    },
    {
      id: "lagos",
      label: "Lagos",
      aliases: ["lagos"],
      lat: 6.5244,
      lng: 3.3792,
    },
    {
      id: "osu",
      label: "Osu, Accra",
      aliases: ["osu", "accra osu"],
      lat: 5.5554,
      lng: -0.1869,
    },
    {
      id: "airport-city",
      label: "Airport City, Accra",
      aliases: ["airport city", "accra airport"],
      lat: 5.6053,
      lng: -0.1774,
    },
    {
      id: "accra",
      label: "Accra",
      aliases: ["accra"],
      lat: 5.6037,
      lng: -0.187,
    },
  ];

export function resolveArea(query: string): GeoPoint & { label: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const hit = AREA_GAZETTEER.find(
    (a) => a.id === q || a.label.toLowerCase() === q || a.aliases.includes(q),
  );
  if (hit) return { lat: hit.lat, lng: hit.lng, label: hit.label };
  const fuzzy = AREA_GAZETTEER.find(
    (a) =>
      a.label.toLowerCase().includes(q) ||
      a.aliases.some((al) => al.includes(q) || q.includes(al)),
  );
  return fuzzy
    ? { lat: fuzzy.lat, lng: fuzzy.lng, label: fuzzy.label }
    : null;
}

export type OpeningHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  [string, string] | null
>;

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isOpenNow(
  hours: OpeningHours,
  weekday: number,
  hhmm: string,
): boolean {
  const key = DOW[weekday] as keyof OpeningHours;
  const slot = hours[key];
  if (!slot) return false;
  return hhmm >= slot[0] && hhmm < slot[1];
}

/** Quiet hours may wrap midnight (default 22:00–07:00). */
export function inQuietHours(
  hhmm: string,
  start: string,
  end: string,
): boolean {
  if (start === end) return false;
  if (start < end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
}

export const GENERIC_PUSH_TITLE = "GirlCode360";
export const GENERIC_PUSH_BODY = "You have a note in GirlCode360";

const HEALTHY_LOCK_WORDS =
  /period|ovulat|pregnan|fertile|medication|pcos|pmos|symptom|clinic|hospital/i;

export function lockScreenSafePush(): { title: string; body: string } {
  return { title: GENERIC_PUSH_TITLE, body: GENERIC_PUSH_BODY };
}

export function pushBodyIsLockSafe(body: string): boolean {
  return !HEALTHY_LOCK_WORDS.test(body);
}

export type SheMatchCandidate = {
  id: string;
  name: string;
  category: MarketplaceCategory;
  tags: string[];
  lat: number;
  lng: number;
  rating: number;
  sponsored?: boolean;
  catalogueItemId?: string | null;
};

export type SheMatchMatch = SheMatchCandidate & {
  distanceKm: number;
  triggerId: SheMatchTriggerId;
  why: string;
};

export function matchSheMatch(opts: {
  triggerId: SheMatchTriggerId;
  origin: GeoPoint;
  listings: SheMatchCandidate[];
  extraTags?: string[];
  maxKm?: number;
}): SheMatchMatch[] {
  const trigger = sheMatchTrigger(opts.triggerId);
  if (!trigger) return [];
  const maxKm = opts.maxKm ?? SHEMATCH_MAX_KM;
  const wantTags = new Set(
    [...trigger.tags, ...(opts.extraTags ?? [])].map((t) => t.toLowerCase()),
  );
  const out: SheMatchMatch[] = [];
  for (const listing of opts.listings) {
    if (!trigger.categories.includes(listing.category)) continue;
    const tags = listing.tags.map((t) => t.toLowerCase());
    const tagHit =
      !wantTags.size || tags.some((t) => wantTags.has(t));
    if (!tagHit) continue;
    const distanceKm = haversineKm(opts.origin, listing);
    if (distanceKm > maxKm) continue;
    out.push({
      ...listing,
      distanceKm,
      triggerId: trigger.id,
      why: trigger.why,
    });
  }
  out.sort((a, b) => {
    if (a.sponsored && !b.sponsored) return 1;
    if (!a.sponsored && b.sponsored) return -1;
    const tagScore = (m: SheMatchMatch) =>
      m.tags.filter((t) => wantTags.has(t.toLowerCase())).length;
    const dt = tagScore(b) - tagScore(a);
    if (dt) return dt;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.distanceKm - b.distanceKm;
  });
  return out;
}

/** Tags a business may self-declare for SheMatch / Mirror (SM-F-05). */
export const BUSINESS_HEALTH_TAGS = [
  ...new Set([
    ...SHEMATCH_TRIGGERS.flatMap((t) => t.tags),
    "maternity",
    "pmos",
    "boutique",
    "jewellery",
    "eyewear",
    "optician",
  ]),
].sort();

export function filterOwnerTags(tags: string[]): string[] {
  const allow = new Set(BUSINESS_HEALTH_TAGS.map((t) => t.toLowerCase()));
  return [
    ...new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => allow.has(t)),
    ),
  ];
}

/** FR-061: sponsored rows first in category browse, then distance. SheMatch stays organic-first. */
export function sortMarketplaceBrowse<
  T extends { sponsored?: boolean; distanceKm: number | null; name: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.sponsored && !b.sponsored) return -1;
    if (!a.sponsored && b.sponsored) return 1;
    if (a.distanceKm != null && b.distanceKm != null) {
      const d = a.distanceKm - b.distanceKm;
      if (d) return d;
    }
    return a.name.localeCompare(b.name);
  });
}

const REVIEW_URL = /https?:\/\/|www\./i;
const REVIEW_PROFANITY = /\b(fuck|shit|cunt|nigger|rape)\b/i;

export function validateListingReview(opts: {
  stars: number;
  body: string;
}): { ok: true; body: string; stars: number } | { ok: false; error: string } {
  const stars = Math.round(opts.stars);
  if (stars < 1 || stars > 5) return { ok: false, error: "stars_1_to_5" };
  const body = opts.body.trim().replace(/\s+/g, " ");
  if (body.length < 20) return { ok: false, error: "review_too_short" };
  if (body.length > 2000) return { ok: false, error: "review_too_long" };
  if (REVIEW_URL.test(body)) return { ok: false, error: "links_not_allowed" };
  if (REVIEW_PROFANITY.test(body)) return { ok: false, error: "profanity" };
  return { ok: true, body, stars };
}

export function fuzzyListingHay(q: string, hay: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const h = hay.toLowerCase();
  if (h.includes(needle)) return true;
  if (needle.length < 4) return false;
  let i = 0;
  for (const ch of h) {
    if (ch === needle[i]) i += 1;
    if (i >= needle.length) return true;
  }
  return false;
}
