import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schedulerKind, under } from "./routing.ts";

describe("path prefix matching", () => {
  it("matches a prefix and its children only", () => {
    assert.equal(under("/v1/mirror", "/v1/mirror"), true);
    assert.equal(under("/v1/mirror/scans", "/v1/mirror"), true);
    assert.equal(under("/v1/mirror-studio/makeup", "/v1/mirror"), false);
    assert.equal(under("/v1/wallet/share/abc", "/v1/wallet/share"), true);
    assert.equal(under("/v1/wallet/docs", "/v1/wallet/share"), false);
  });
});

describe("schedulerKind", () => {
  it("only reads girlcode360.scheduler payloads", () => {
    assert.equal(
      schedulerKind({
        source: "girlcode360.scheduler",
        detail: { kind: "purge" },
      }),
      "purge",
    );
    assert.equal(
      schedulerKind({ httpMethod: "GET", path: "/v1/health" }),
      undefined,
    );
  });
});
