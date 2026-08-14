import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCESSORY_NO_2D_TO_3D_NOTE,
  RESALE_PEER_LABEL,
  accessoryTryOnReady,
  requireRetailer3dAsset,
  resaleListingCopy,
} from "./accessories.ts";

describe("P3.6 accessories SKU / 3D gate (FR-133)", () => {
  it("blocks jewellery try-on without a catalogue SKU still", () => {
    assert.equal(
      accessoryTryOnReady({ kind: "jewellery", asset3dId: "seed-3d", refImageUrl: null }),
      false,
    );
    assert.throws(() => requireRetailer3dAsset(""), /ACCESSORY_3D_REQUIRED/);
    assert.throws(() => requireRetailer3dAsset("  "), /ACCESSORY_3D_REQUIRED/);
    assert.equal(requireRetailer3dAsset("retailer-asset-9"), "retailer-asset-9");
  });

  it("does not treat a 2D photo as a 3D model, but allows a SKU still URL", () => {
    assert.match(ACCESSORY_NO_2D_TO_3D_NOTE, /do not invent/i);
    assert.equal(
      accessoryTryOnReady({
        kind: "jewellery",
        asset3dId: null,
        nailColor: "#c45c6a",
        frameId: "frame-1",
      }),
      false,
    );
    assert.equal(
      accessoryTryOnReady({
        kind: "jewellery",
        refImageUrl: "https://cdn.example/sku.jpg",
      }),
      true,
    );
  });

  it("allows nail hex; eyewear S2S is not try-on ready", () => {
    assert.equal(
      accessoryTryOnReady({ kind: "nail_color", nailColor: "#c45c6a" }),
      true,
    );
    assert.equal(
      accessoryTryOnReady({ kind: "eyewear", frameId: "frame-22" }),
      false,
    );
  });
});

describe("P3.6 resale peer label (FR-143)", () => {
  it("uses the member label, not a boutique voice", () => {
    assert.equal(RESALE_PEER_LABEL, "from a GirlCode360 member");
    const copy = resaleListingCopy({
      name: "Navy knit",
      category: "top",
      colourTags: ["navy"],
    });
    assert.equal(copy.title, "Navy knit");
    assert.match(copy.details, /navy/);
  });
});
