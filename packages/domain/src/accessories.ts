/**
 * P3.6 Accessories Studio + resale labels (FR-130–133, FR-141–143).
 * Jewellery try-on requires a retailer 3D asset id. Never invent one from a 2D photo.
 */

export const ACCESSORY_STUDIO_KINDS = [
  "jewellery",
  "eyewear",
  "nail_color",
] as const;

export type AccessoryStudioKind = (typeof ACCESSORY_STUDIO_KINDS)[number];

export const ACCESSORY_JEWELLERY_CATEGORIES = [
  "ring",
  "bracelet",
  "watch",
  "earring",
  "necklace",
] as const;

export type AccessoryJewelleryCategory =
  (typeof ACCESSORY_JEWELLERY_CATEGORIES)[number];

export const RESALE_PEER_LABEL = "from a GirlCode360 member";

export const ACCESSORY_NO_2D_TO_3D_NOTE =
  "Jewellery and watch try-on needs a retailer 3D asset. We do not build 3D models from product photos.";

const NAIL_HEX = /^#[0-9a-fA-F]{6}$/;

export function isAccessoryStudioKind(v: string): v is AccessoryStudioKind {
  return (ACCESSORY_STUDIO_KINDS as readonly string[]).includes(v);
}

export function isAccessoryJewelleryCategory(
  v: string,
): v is AccessoryJewelleryCategory {
  return (ACCESSORY_JEWELLERY_CATEGORIES as readonly string[]).includes(v);
}

export function isNailColorHex(v: string): boolean {
  return NAIL_HEX.test(v.trim());
}

export function accessoryTryOnReady(item: {
  kind: string;
  asset3dId?: string | null;
  frameId?: string | null;
  nailColor?: string | null;
}): boolean {
  if (item.kind === "jewellery") return Boolean(item.asset3dId?.trim());
  if (item.kind === "eyewear") return Boolean(item.frameId?.trim());
  if (item.kind === "nail_color") {
    return Boolean(item.nailColor && isNailColorHex(item.nailColor));
  }
  return false;
}

/** FR-133 — empty 3D id is a hard stop, not a 2D fallback. */
export function requireRetailer3dAsset(asset3dId: string | null | undefined): string {
  const id = asset3dId?.trim() ?? "";
  if (!id) throw new Error("ACCESSORY_3D_REQUIRED");
  return id;
}

export function resaleListingCopy(item: {
  name?: string | null;
  category?: string | null;
  colourTags?: string[];
}): { title: string; details: string } {
  const title = item.name?.trim() || item.category?.replace(/_/g, " ") || "Wardrobe piece";
  const colours = (item.colourTags ?? []).filter(Boolean).join(", ");
  const details = [item.category?.replace(/_/g, " "), colours]
    .filter(Boolean)
    .join(" · ");
  return { title, details };
}
