/**
 * P3.6 Accessories Studio + resale labels (FR-130–133, FR-141–143).
 * Jewellery S2S is 2D VTO with a catalogue SKU still (`refImageUrl`). Never invent 3D from a photo.
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
  "Jewellery try-on needs a catalogue SKU still. We do not invent a 3D model from a product photo.";

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
  refImageUrl?: string | null;
  frameId?: string | null;
  nailColor?: string | null;
}): boolean {
  if (item.kind === "jewellery") return Boolean(item.refImageUrl?.trim());
  if (item.kind === "eyewear") return false;
  if (item.kind === "nail_color") {
    return Boolean(item.nailColor && isNailColorHex(item.nailColor));
  }
  return false;
}

/** FR-133 — empty SKU still is a hard stop. Do not invent a model from a random photo. */
export function requireJewellerySkuUrl(refImageUrl: string | null | undefined): string {
  const url = refImageUrl?.trim() ?? "";
  if (!url) throw new Error("ACCESSORY_3D_REQUIRED");
  return url;
}

/** Kept for older 3D-id callers. Empty id is a hard stop. */
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
