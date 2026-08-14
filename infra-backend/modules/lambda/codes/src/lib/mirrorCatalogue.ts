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

export function catalogueById(id: string): MirrorCatalogueItem | undefined {
  return MIRROR_CATALOGUE.find((i) => i.id === id);
}

const BANNED_GARMENT = /swimwear|lingerie|bikini|underwear|intimate/i;

export function filterCatalogue(opts: {
  kind?: "skincare" | "apparel";
  mode?: "all" | "maternity" | "pmos";
  week?: number | null;
}): MirrorCatalogueItem[] {
  return MIRROR_CATALOGUE.filter((item) => {
    if (BANNED_GARMENT.test(item.title) || item.tags.some((t) => BANNED_GARMENT.test(t))) {
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
