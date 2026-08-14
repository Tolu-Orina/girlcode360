/**
 * Offline wardrobe capture queue — same IndexedDB outbox pattern as cycle logs.
 * AI tagging and outfit VTO stay network-required (FR-128).
 */
import { createWardrobeItem } from "./api";
import {
  idbDeleteWardrobeDraft,
  idbGetWardrobeDrafts,
  idbPutWardrobeDraft,
  type WardrobeDraft,
} from "./idb";
import { WARDROBE_QUEUE_MAX } from "../../../../packages/domain/src/index";

export async function enqueueWardrobeDraft(
  input: Omit<WardrobeDraft, "id" | "createdAt" | "status">,
): Promise<{ draft: WardrobeDraft | null; full: boolean }> {
  const existing = await idbGetWardrobeDrafts();
  if (existing.length >= WARDROBE_QUEUE_MAX) {
    return { draft: null, full: true };
  }
  const draft: WardrobeDraft = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await idbPutWardrobeDraft(draft);
  void flushWardrobeQueue();
  return { draft, full: false };
}

let flushing = false;

export async function flushWardrobeQueue(): Promise<WardrobeDraft[]> {
  if (flushing) return idbGetWardrobeDrafts();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return idbGetWardrobeDrafts();
  }
  flushing = true;
  try {
    const drafts = await idbGetWardrobeDrafts();
    for (const draft of drafts) {
      await idbPutWardrobeDraft({ ...draft, status: "syncing" });
      try {
        await createWardrobeItem({
          imageB64: draft.imageB64,
          name: draft.name || undefined,
          category: draft.category || undefined,
          colourTags: draft.colourTags,
          sampleHexes: draft.sampleHexes,
          purchasePriceMinor: draft.purchasePriceMinor,
        });
        await idbDeleteWardrobeDraft(draft.id);
      } catch {
        await idbPutWardrobeDraft({
          ...draft,
          status: "error",
          error: "sync_failed",
        });
      }
    }
    return idbGetWardrobeDrafts();
  } finally {
    flushing = false;
  }
}
