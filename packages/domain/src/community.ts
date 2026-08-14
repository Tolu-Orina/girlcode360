/** Phase 2.3 — peer groups, post rules, in-app marketing copy, first-run tour. */

export const COMMUNITY_GROUP_IDS = [
  "ttc_circle",
  "pcos_warriors",
  "pregnancy_journey",
  "period_health",
] as const;

export type CommunityGroupId = (typeof COMMUNITY_GROUP_IDS)[number];

export type CommunityGroup = {
  id: CommunityGroupId;
  name: string;
  /** Wellness copy — not a diagnosis. */
  body: string;
};

export const COMMUNITY_GROUPS: CommunityGroup[] = [
  {
    id: "ttc_circle",
    name: "TTC Circle",
    body: "Peer support while trying to conceive. Wellness talk only. Not medical advice.",
  },
  {
    id: "pcos_warriors",
    name: "PCOS Warriors",
    body: "Peer support for people managing PMOS-related wellness. Joining is not a diagnosis.",
  },
  {
    id: "pregnancy_journey",
    name: "Pregnancy Journey",
    body: "Peer support during pregnancy. Seek urgent care from local emergency services if you are worried.",
  },
  {
    id: "period_health",
    name: "Period Health",
    body: "Peer support around periods and cycle logging. Predictions stay estimates.",
  },
];

export const COMMUNITY_POST_MAX = 500;

const POST_URL = /https?:\/\/|www\./i;
const POST_PROFANITY = /\b(fuck|shit|cunt|nigger|rape)\b/i;

export function isCommunityGroupId(v: string): v is CommunityGroupId {
  return (COMMUNITY_GROUP_IDS as readonly string[]).includes(v);
}

export function communityGroupById(id: string): CommunityGroup | undefined {
  return COMMUNITY_GROUPS.find((g) => g.id === id);
}

/** Stable anonymised handle. Not a chosen display name (FR-076 stays later). */
export function anonymisedDisplayName(sub: string): string {
  let h = 2166136261;
  for (let i = 0; i < sub.length; i += 1) {
    h ^= sub.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
  return `Member-${hex}`;
}

export function validateCommunityPost(raw: string):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  const body = raw.trim().replace(/\s+/g, " ");
  if (!body) return { ok: false, error: "post_empty" };
  if (body.length > COMMUNITY_POST_MAX) return { ok: false, error: "post_too_long" };
  if (POST_URL.test(body)) return { ok: false, error: "links_not_allowed" };
  if (POST_PROFANITY.test(body)) return { ok: false, error: "profanity" };
  return { ok: true, body };
}

export type InAppKind = "new_listing" | "promo";

export function marketingInboxCopy(
  kind: InAppKind,
  market: "UK" | "NG" | "GH",
): { title: string; body: string } {
  if (kind === "promo") {
    return {
      title: "Partner offer",
      body: "A promotional offer from a business partner is in Marketplace. Open the app to view it. This is not a health reminder.",
    };
  }
  return {
    title: "New listing in your market",
    body: `A new listing is live in the ${market} directory. Open Marketplace to see what's nearby. Confirm before you travel. We do not store your GPS for this notice.`,
  };
}

export type TourStep = { id: string; title: string; body: string };

export const ONBOARDING_TOUR: TourStep[] = [
  {
    id: "cycle",
    title: "Cycle",
    body: "Log days on the calendar. Predictions need two logged periods and are estimates, not a diagnosis.",
  },
  {
    id: "health",
    title: "Health",
    body: "PMOS, pregnancy, TTC, and Wallet stay off until you opt in. You can change this in Account.",
  },
  {
    id: "marketplace",
    title: "Marketplace",
    body: "Pharmacies, clinics, and beauty nearby. Seeded directory plus moderated listings. Confirm before you travel.",
  },
  {
    id: "alena",
    title: "Alena",
    body: "Ask for wellness guidance. Alena does not diagnose or replace a clinician.",
  },
  {
    id: "community",
    title: "Community",
    body: "Optional peer groups. Text only, 500 characters, no links, moderated. Names are anonymised. Leave any time.",
  },
];

export const PAGE_TIPS: Record<string, { title: string; body: string }> = {
  cycle: {
    title: "Tap a day to log",
    body: "Flow, mood, and symptoms save for that date. Predictions appear after two periods.",
  },
  health: {
    title: "Modules you choose",
    body: "Only the tabs you enabled in Account show here. Education is wellness copy, not a diagnosis.",
  },
  marketplace: {
    title: "Nearby, not GPS stored",
    body: "Distance uses this session's area. Paid rows say Sponsored. Confirm hours before you travel.",
  },
  alena: {
    title: "Two modes",
    body: "Anonymous keeps logs out of the prompt. Context mode only uses what you allow.",
  },
  community: {
    title: "Opt in, text only",
    body: "Join a journey group when you want. Posts wait for moderation. Report is on every post.",
  },
};
