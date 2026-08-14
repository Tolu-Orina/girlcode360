import {
  accessoryTryOnReady,
  MAKEUP_TRYON_SHADES,
} from "../../../../../../packages/domain/src/index";
import type { MirrorCatalogueItem } from "../types";

/** Curated demo catalogue (MIR-F-04 / F-06 / F-08). Public garment URLs from Perfect Corp samples. */
export const MIRROR_CATALOGUE: MirrorCatalogueItem[] = [
  {
    id: "sk-niacinamide",
    kind: "skincare",
    title: "Niacinamide calming serum",
    subtitle: "For days when oiliness and congestion feel higher",
    tags: ["acne", "oiliness", "pharmacy"],
    boutiqueName: "Bloom Pharmacy",
    boutiqueArea: "Lagos · Ikeja",
    trimester: null,
    pmosFit: true,
  },
  {
    id: "sk-barrier",
    kind: "skincare",
    title: "Barrier-repair moisturiser",
    subtitle: "Gentle support when texture and redness scores rise",
    tags: ["texture", "redness", "moisture"],
    boutiqueName: "Wellness Shelf",
    boutiqueArea: "Accra · Osu",
    trimester: null,
    pmosFit: true,
  },
  {
    id: "sk-spf",
    kind: "skincare",
    title: "Mineral SPF 50",
    subtitle: "Daily shield — especially if dark spots are a concern",
    tags: ["age_spot", "radiance"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: false,
  },
  {
    id: "ap-wrap-dress",
    kind: "apparel",
    title: "Soft wrap dress",
    subtitle: "Easy waist — tagged for second-trimester ease",
    tags: ["full_body", "maternity"],
    garmentCategory: "full_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png",
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    trimester: 2,
    pmosFit: true,
    tryOnPrompt: "ease through the waist, second-trimester comfortable fit",
  },
  {
    id: "ap-knit-set",
    kind: "apparel",
    title: "Relaxed knit set",
    subtitle: "Adaptive fit for PMOS bloating days",
    tags: ["full_body", "pmos"],
    garmentCategory: "full_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png",
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: true,
    tryOnPrompt: "soft stretch, comfortable through the midsection",
  },
  {
    id: "ap-third-tri",
    kind: "apparel",
    title: "Third-trimester lounge dress",
    subtitle: "Room through the bump without cling",
    tags: ["full_body", "maternity"],
    garmentCategory: "full_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png",
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    trimester: 3,
    pmosFit: false,
    tryOnPrompt: "room through the bump, third-trimester lounge fit",
  },
  {
    id: "ap-first-tri",
    kind: "apparel",
    title: "First-trimester shirt dress",
    subtitle: "Soft structure while energy is low",
    tags: ["full_body", "maternity"],
    garmentCategory: "full_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png",
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: 1,
    pmosFit: false,
    tryOnPrompt: "soft structure, first-trimester ease",
  },
  {
    id: "ap-soft-blouse",
    kind: "apparel",
    title: "Soft everyday blouse",
    subtitle: "Mix with a bottom without taking a new photo",
    tags: ["upper_body"],
    garmentCategory: "upper_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_upper_01_5a000d999f.png",
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    trimester: null,
    pmosFit: true,
    tryOnPrompt: "soft drape, comfortable through the chest, not clingy",
  },
  {
    id: "ap-wide-trousers",
    kind: "apparel",
    title: "Wide-leg trousers",
    subtitle: "Ease through the hip — tagged for PMOS comfort days",
    tags: ["lower_body", "pmos"],
    garmentCategory: "lower_body",
    refImageUrl:
      "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_lower_01_5a000d999f.png",
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    trimester: null,
    pmosFit: true,
    tryOnPrompt: "easy waist, wide leg, not tight through the midsection",
  },
];

for (const shade of MAKEUP_TRYON_SHADES) {
  MIRROR_CATALOGUE.push({
    id: shade.id,
    kind: "makeup",
    title: shade.title,
    subtitle: `Stocked by ${shade.boutiqueName}`,
    tags: [shade.category, shade.brandCode, ...(shade.shadeFamily ? [shade.shadeFamily] : [])],
    boutiqueName: shade.boutiqueName,
    boutiqueArea: shade.boutiqueArea,
    trimester: null,
    pmosFit: false,
    brandCode: shade.brandCode,
    shadeCode: shade.shadeCode,
    shadeFamily: shade.shadeFamily,
    makeupCategory: shade.category,
    swatchHex: shade.hex,
  });
}

const ACCESSORY_SEED: Array<{
  id: string;
  kind: "jewellery" | "eyewear" | "nail_color";
  title: string;
  subtitle: string;
  tags: string[];
  boutiqueName: string;
  boutiqueArea: string;
  accessoryCategory?: "ring" | "bracelet" | "watch" | "earring" | "necklace";
  asset3dId?: string | null;
  refImageUrl?: string;
  frameId?: string | null;
  nailColor?: string;
}> = [
  {
    id: "jw-hoop",
    kind: "jewellery",
    title: "Gold hoop earring",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "earring"],
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    accessoryCategory: "earring",
    refImageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-band",
    kind: "jewellery",
    title: "Slim ring",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "ring"],
    boutiqueName: "Maternal Thread",
    boutiqueArea: "Accra · Airport City",
    accessoryCategory: "ring",
    refImageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-bangle",
    kind: "jewellery",
    title: "Everyday bracelet",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "bracelet"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    accessoryCategory: "bracelet",
    refImageUrl:
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-watch",
    kind: "jewellery",
    title: "Slim watch",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "watch"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    accessoryCategory: "watch",
    refImageUrl:
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-pendant",
    kind: "jewellery",
    title: "Fine necklace",
    subtitle: "Catalogue SKU still — 2D try-on, not a generated 3D model",
    tags: ["jewellery", "necklace"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    accessoryCategory: "necklace",
    refImageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "jw-photo-only",
    kind: "jewellery",
    title: "Statement earring (photo only)",
    subtitle: "No SKU still on file — try-on stays off. We do not invent a model.",
    tags: ["jewellery", "earring"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    accessoryCategory: "earring",
  },
  {
    id: "ew-round",
    kind: "eyewear",
    title: "Round frame",
    subtitle: "Eyewear S2S try-on is not on this API key — catalogue only",
    tags: ["eyewear", "optician"],
    boutiqueName: "South Ken Beauty",
    boutiqueArea: "London · SW7",
    frameId: "seed-frame-01",
  },
  {
    id: "nl-rose",
    kind: "nail_color",
    title: "Rose nail",
    subtitle: "Hand-photo try-on. Find a salon nearby through SheMatch.",
    tags: ["nail", "salon"],
    boutiqueName: "Ease Atelier",
    boutiqueArea: "Lagos · Victoria Island",
    nailColor: "#c45c6a",
  },
];

for (const row of ACCESSORY_SEED) {
  MIRROR_CATALOGUE.push({
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    tags: row.tags,
    boutiqueName: row.boutiqueName,
    boutiqueArea: row.boutiqueArea,
    trimester: null,
    pmosFit: false,
    accessoryCategory: row.accessoryCategory,
    asset3dId: row.asset3dId,
    refImageUrl: row.refImageUrl,
    frameId: row.frameId,
    nailColor: row.nailColor,
  });
}

export function catalogueById(id: string): MirrorCatalogueItem | undefined {
  return MIRROR_CATALOGUE.find((i) => i.id === id);
}

const BANNED_GARMENT = /swimwear|swimsuit|lingerie|bikini|underwear|intimate/i;

export function filterCatalogue(opts: {
  kind?: "skincare" | "apparel" | "makeup" | "jewellery" | "eyewear" | "nail_color";
  mode?: "all" | "maternity" | "pmos";
  week?: number | null;
}): MirrorCatalogueItem[] {
  return MIRROR_CATALOGUE.filter((item) => {
    if (BANNED_GARMENT.test(item.title) || item.tags.some((t) => BANNED_GARMENT.test(t))) {
      return false;
    }
    if (
      !opts.kind &&
      (item.kind === "makeup" ||
        item.kind === "jewellery" ||
        item.kind === "eyewear" ||
        item.kind === "nail_color")
    ) {
      return false;
    }
    if (opts.kind && item.kind !== opts.kind) return false;
    if (opts.mode === "pmos") return item.pmosFit;
    if (opts.mode === "maternity") {
      if (item.trimester == null || opts.week == null) return false;
      const tri = opts.week <= 13 ? 1 : opts.week <= 27 ? 2 : 3;
      return item.trimester === tri;
    }
    return true;
  });
}
