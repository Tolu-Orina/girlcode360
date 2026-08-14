import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterOwnerTags,
  fuzzyListingHay,
  GENERIC_PUSH_BODY,
  haversineKm,
  inQuietHours,
  isOpenNow,
  lockScreenSafePush,
  matchSheMatch,
  pushBodyIsLockSafe,
  resolveArea,
  SHEMATCH_MAX_KM,
  sortMarketplaceBrowse,
  validateListingReview,
  type OpeningHours,
  type SheMatchCandidate,
} from "./shematch.ts";

const hours: OpeningHours = {
  mon: ["09:00", "18:00"],
  tue: ["09:00", "18:00"],
  wed: ["09:00", "18:00"],
  thu: ["09:00", "18:00"],
  fri: ["09:00", "18:00"],
  sat: ["10:00", "16:00"],
  sun: null,
};

const bloom: SheMatchCandidate = {
  id: "lst-bloom",
  name: "Bloom Pharmacy",
  category: "pharmacy",
  tags: ["period_care", "pain_relief", "pharmacy"],
  lat: 6.6018,
  lng: 3.3515,
  rating: 4.5,
};

describe("haversineKm", () => {
  it("is ~0 at the same point", () => {
    assert.ok(haversineKm(bloom, bloom) < 0.01);
  });
});

describe("matchSheMatch (SM-F-03)", () => {
  it("returns a listing inside 5 km", () => {
    const hits = matchSheMatch({
      triggerId: "period_start",
      origin: { lat: 6.6018, lng: 3.3515 },
      listings: [bloom],
    });
    assert.equal(hits.length, 1);
    assert.ok(hits[0]!.distanceKm <= SHEMATCH_MAX_KM);
  });

  it("is silent when nothing is within 5 km", () => {
    const hits = matchSheMatch({
      triggerId: "period_start",
      origin: { lat: 51.4945, lng: -0.1743 },
      listings: [bloom],
    });
    assert.equal(hits.length, 0);
  });

  it("does not invent a match for the wrong category", () => {
    const hits = matchSheMatch({
      triggerId: "pregnancy_scan",
      origin: bloom,
      listings: [bloom],
    });
    assert.equal(hits.length, 0);
  });
});

describe("quiet hours (NTF-F-02)", () => {
  it("covers the overnight default window", () => {
    assert.equal(inQuietHours("23:00", "22:00", "07:00"), true);
    assert.equal(inQuietHours("06:59", "22:00", "07:00"), true);
    assert.equal(inQuietHours("07:00", "22:00", "07:00"), false);
    assert.equal(inQuietHours("12:00", "22:00", "07:00"), false);
  });
});

describe("isOpenNow", () => {
  it("uses device weekday + clock", () => {
    assert.equal(isOpenNow(hours, 1, "10:00"), true);
    assert.equal(isOpenNow(hours, 0, "10:00"), false);
    assert.equal(isOpenNow(hours, 6, "12:00"), true);
  });
});

describe("lock-screen push (NTF-F-03)", () => {
  it("keeps a generic body with no health words", () => {
    const payload = lockScreenSafePush();
    assert.equal(payload.body, GENERIC_PUSH_BODY);
    assert.equal(pushBodyIsLockSafe(payload.body), true);
    assert.equal(pushBodyIsLockSafe("Your period starts tomorrow"), false);
  });
});

describe("area gazetteer", () => {
  it("resolves Ikeja without storing a profile", () => {
    const a = resolveArea("Ikeja");
    assert.ok(a);
    assert.ok(Math.abs(a!.lat - 6.6018) < 0.01);
  });
});

describe("sortMarketplaceBrowse (MKT-F-07)", () => {
  it("puts sponsored listings first with organic still present", () => {
    const rows = sortMarketplaceBrowse([
      { name: "Near organic", sponsored: false, distanceKm: 0.2 },
      { name: "Far sponsored", sponsored: true, distanceKm: 4 },
    ]);
    assert.equal(rows[0]!.name, "Far sponsored");
    assert.equal(rows[1]!.name, "Near organic");
  });
});

describe("validateListingReview (MKT-F-05)", () => {
  it("requires 20 characters and blocks links", () => {
    assert.equal(validateListingReview({ stars: 5, body: "too short" }).ok, false);
    const ok = validateListingReview({
      stars: 4,
      body: "Quiet staff and clear opening hours when I visited last week.",
    });
    assert.equal(ok.ok, true);
    assert.equal(
      validateListingReview({
        stars: 3,
        body: "See more at https://example.com for this clinic visit notes.",
      }).ok,
      false,
    );
  });
});

describe("filterOwnerTags (SM-F-05)", () => {
  it("keeps SheMatch tags and drops unknown labels", () => {
    const tags = filterOwnerTags(["Acne", "invented_tag", "maternity"]);
    assert.deepEqual(tags, ["acne", "maternity"]);
  });
});

describe("fuzzy listing search", () => {
  it("matches a near-miss pharmacy spelling", () => {
    assert.equal(fuzzyListingHay("pharmcy", "Bloom Pharmacy Ikeja"), true);
    assert.equal(fuzzyListingHay("zzz", "Bloom Pharmacy"), false);
  });
});
