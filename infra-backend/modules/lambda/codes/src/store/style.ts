import { computeStyleAnalytics } from "../../../../../../packages/domain/src/index";
import type { StyleAnalytics } from "../types";
import { peekHairScans } from "./hair";
import { peekSkinScans, wardrobeConsented, mirrorConsented } from "./mirror";
import { listShadeMatchesForExport } from "./studio";
import {
  listWardrobeItemsForExport,
  listWardrobeOutfitsForExport,
} from "./wardrobe";

export async function getStyleAnalytics(sub: string): Promise<StyleAnalytics> {
  const [wardrobeOn, mirrorOn] = await Promise.all([
    wardrobeConsented(sub),
    mirrorConsented(sub),
  ]);
  const items = wardrobeOn ? await listWardrobeItemsForExport(sub) : [];
  const outfits = wardrobeOn ? await listWardrobeOutfitsForExport(sub) : [];
  const skin = mirrorOn ? await peekSkinScans(sub) : [];
  const hair = mirrorOn ? await peekHairScans(sub) : [];
  const shades = mirrorOn ? await listShadeMatchesForExport(sub) : [];
  return computeStyleAnalytics({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      archived: i.archived,
      wornCount: i.wornCount,
      purchasePriceMinor: i.purchasePriceMinor,
    })),
    outfits: outfits.map((o) => ({ itemIds: o.itemIds, wornOn: o.wornOn })),
    skin: skin
      .filter((s) => s.status === "success" && !s.seeded)
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        overallScore: s.overallScore,
      })),
    hair: hair
      .filter((h) => h.status === "success")
      .map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        kind: h.kind,
        hairDensity: h.scores.hair_density ?? null,
      })),
    shades: shades.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      fitzpatrickType: s.fitzpatrickType,
    })),
  });
}
