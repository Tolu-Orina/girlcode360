import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMUNITY_GROUPS,
  anonymisedDisplayName,
  isCommunityGroupId,
  marketingInboxCopy,
  validateCommunityPost,
} from "./community.ts";

describe("community groups (COM-F-01)", () => {
  it("has the four PRD journeys", () => {
    assert.deepEqual(
      COMMUNITY_GROUPS.map((g) => g.id),
      ["ttc_circle", "pcos_warriors", "pregnancy_journey", "period_health"],
    );
    assert.equal(isCommunityGroupId("ttc_circle"), true);
    assert.equal(isCommunityGroupId("invented"), false);
  });

  it("anonymises without using the raw sub", () => {
    const a = anonymisedDisplayName("user-sub-aaa");
    const b = anonymisedDisplayName("user-sub-aaa");
    const c = anonymisedDisplayName("user-sub-bbb");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^Member-[0-9a-f]{6}$/);
    assert.equal(a.includes("user-sub"), false);
  });
});

describe("validateCommunityPost (COM-F-02)", () => {
  it("accepts plain text within 500 characters", () => {
    const ok = validateCommunityPost("  Hello circle, logging helped me prepare.  ");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.body, "Hello circle, logging helped me prepare.");
  });

  it("rejects empty, links, profanity, and over 500", () => {
    assert.equal(validateCommunityPost("   ").ok, false);
    assert.equal(validateCommunityPost("See https://example.com please").ok, false);
    assert.equal(validateCommunityPost("Visit www.spam.test").ok, false);
    assert.equal(validateCommunityPost("this is shit advice").ok, false);
    assert.equal(validateCommunityPost("x".repeat(501)).ok, false);
  });
});

describe("marketingInboxCopy (NTF-F-04)", () => {
  it("never puts health content in the body", () => {
    const listing = marketingInboxCopy("new_listing", "NG");
    const promo = marketingInboxCopy("promo", "UK");
    assert.match(listing.body, /Marketplace|directory/i);
    assert.match(promo.body, /promotional/i);
    assert.equal(/period|ovulat|pregnan|pmos|pcos/i.test(listing.body), false);
    assert.equal(/period|ovulat|pregnan|pmos|pcos/i.test(promo.body), false);
  });
});
