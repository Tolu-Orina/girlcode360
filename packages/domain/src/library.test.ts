import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  articleDueForReview,
  libraryArticleById,
  libraryArticles,
  stripReportLinks,
} from "./library.ts";

describe("articleDueForReview (FR-071)", () => {
  const now = new Date("2026-08-13T12:00:00Z");

  it("keeps a review from June 2026 current", () => {
    assert.equal(articleDueForReview("2026-06-01", now), false);
  });

  it("flags a review older than 24 months", () => {
    assert.equal(articleDueForReview("2023-01-01", now), true);
  });
});

describe("libraryArticles", () => {
  it("filters UK market without duplicating a second corpus", () => {
    const uk = libraryArticles("UK");
    assert.ok(uk.some((a) => a.id === "pcos-nhs-uk"));
    assert.ok(uk.every((a) => a.markets.includes("UK")));
    assert.ok(uk.every((a) => a.reviewedAt));
    assert.equal(
      uk.find((a) => a.id === "pcos-nhs-uk")?.outdated,
      false,
    );
  });

  it("does not serve Ghana-only articles to Nigeria", () => {
    const ng = libraryArticles("NG", "pcos");
    assert.equal(
      ng.some((a) => a.id === "pcos-ghs-gh"),
      false,
    );
    assert.ok(ng.some((a) => a.id === "pcos-nutrition-ng"));
  });

  it("looks up a known id for reporting", () => {
    assert.ok(libraryArticleById("privacy-your-data"));
    assert.equal(libraryArticleById("no-such"), undefined);
  });
});

describe("stripReportLinks", () => {
  it("removes URLs from report details", () => {
    const out = stripReportLinks("see https://evil.example/x please");
    assert.doesNotMatch(out, /https?:/);
    assert.match(out, /link removed/);
  });
});
