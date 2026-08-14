import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  pollTask,
  resetYoucamForTests,
  startAccessoryTryOn,
  startEyewearTryOn,
  startHairAnalysis,
  startHairTryOn,
  startMakeupTransfer,
  startMakeupVto,
  startSkinAnalysis,
  startNailTryOn,
  startShadeFinder,
  startClothTryOn,
  youcamCircuitOpen,
} from "./youcam.ts";

process.env.YOUCAM_API_KEY = "test-youcam-key-xxxxxxxx";
process.env.YOUCAM_API_SERVER = "https://yce-api-01.makeupar.com";

type FetchCall = { url: string; method: string; body: unknown };

const calls: FetchCall[] = [];
let mode: "ok" | "429" | "error" = "ok";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  let body: unknown = null;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  const method = (init?.method ?? "GET").toUpperCase();
  calls.push({ url, method, body });

  if (mode === "429") return jsonResponse(429, { error: "rate" });
  if (mode === "error") return jsonResponse(500, { error: "upstream" });

  if (method === "POST" && url.includes("/s2s/v2.0/task/")) {
    const cap = url.split("/task/")[1] ?? "unknown";
    return jsonResponse(200, { data: { task_id: `task-${cap}` } });
  }
  if (method === "GET" && url.includes("/s2s/v2.0/task/")) {
    return jsonResponse(200, {
      data: {
        task_status: "success",
        url: "https://cdn.example/result.jpg",
        fitzpatrick_type: "IV",
      },
    });
  }
  return jsonResponse(404, {});
}

beforeEach(() => {
  calls.length = 0;
  mode = "ok";
  resetYoucamForTests();
  globalThis.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  resetYoucamForTests();
});

describe("P3.1 YouCam studio handlers (mocked)", () => {
  it("Skin: SD dst_actions only", async () => {
    const id = await startSkinAnalysis("face-1");
    assert.equal(id, "task-skin-analysis");
    const body = calls[0]!.body as Record<string, unknown>;
    const actions = body.dst_actions as string[];
    assert.ok(actions.includes("dark_circle_v2"));
    assert.ok(!actions.includes("dark_circle"));
    assert.ok(actions.includes("droopy_upper_eyelid"));
    assert.ok(!actions.includes("droopy_eyelid"));
  });

  it("Makeup photo: makeup-vto effects payload", async () => {
    const id = await startMakeupVto({ srcFileId: "face-1" });
    assert.equal(id, "task-makeup-vto");
    const posted = calls.find((c) => c.method === "POST");
    assert.ok(posted?.url.endsWith("/s2s/v2.0/task/makeup-vto"));
    const body = posted!.body as Record<string, unknown>;
    assert.equal(body.src_file_id, "face-1");
    assert.equal(body.version, "1.0");
    assert.ok(Array.isArray(body.effects));
    assert.ok(
      (body.effects as { category: string }[]).some((e) => e.category === "lip_color"),
    );
  });

  it("Makeup transfer: mu-transfer needs ref_file_id", async () => {
    const id = await startMakeupTransfer({
      srcFileId: "face-1",
      referenceFileId: "look-1",
    });
    assert.equal(id, "task-mu-transfer");
    const posted = calls.find((c) => c.method === "POST");
    assert.ok(posted?.url.endsWith("/s2s/v2.0/task/mu-transfer"));
    const body = posted!.body as Record<string, unknown>;
    assert.equal(body.src_file_id, "face-1");
    assert.equal(body.ref_file_id, "look-1");
  });

  it("Wardrobe: apparel-tryon uses garment file id, not a new endpoint", async () => {
    const id = await startClothTryOn({
      srcFileId: "body-1",
      refFileId: "wardrobe-garment-1",
      garmentCategory: "upper_body",
    });
    assert.equal(id, "task-cloth-v3");
    const posted = calls.find((c) => c.method === "POST");
    assert.ok(posted?.url.endsWith("/s2s/v2.0/task/cloth-v3"));
    const body = posted!.body as Record<string, unknown>;
    assert.equal(body.src_file_id, "body-1");
    assert.equal(body.ref_file_id, "wardrobe-garment-1");
    assert.equal(body.garment_category, "upper_body");
    assert.equal(body.ref_file_url, undefined);
  });

  it("Hair: analysis and try-on are independent tasks", async () => {
    const analysis = await startHairAnalysis("face-1");
    const tryon = await startHairTryOn({ srcFileId: "face-1", hairColor: "#2b1b17" });
    assert.equal(analysis, "task-hair-length-detection");
    assert.equal(tryon, "task-hair-tryon");
    const posts = calls.filter((c) => c.method === "POST");
    assert.ok(posts[0]?.url.endsWith("/task/hair-length-detection"));
    assert.equal((posts[0]!.body as Record<string, unknown>).src_file_id, "face-1");
    assert.equal((posts[0]!.body as Record<string, unknown>).dst_actions, undefined);
    assert.ok(posts[1]?.url.endsWith("/task/hair-tryon"));
    assert.equal((posts[1]!.body as Record<string, unknown>).hair_color, "#2b1b17");
    await assert.rejects(
      () => startHairTryOn({ srcFileId: "face-1", hairColor: "  " }),
      /YOUCAM_HAIR_COLOR_REQUIRED/,
    );
  });

  it("Shade Finder: shade_match + fitzpatrick_type", async () => {
    const id = await startShadeFinder({
      srcFileId: "scan-file",
      brandFilter: ["seed-a"],
    });
    assert.equal(id, "task-shade-finder");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.deepEqual(body.dst_actions, ["shade_match", "fitzpatrick_type"]);
    assert.deepEqual(body.brand_filter, ["seed-a"]);
    const polled = await pollTask("shade-finder", id);
    assert.equal(polled.status, "success");
    assert.equal(polled.data.fitzpatrick_type, "IV");
    assert.equal(polled.resultUrl, "https://cdn.example/result.jpg");
  });

  it("Nail: nail-vto", async () => {
    const id = await startNailTryOn({ srcFileId: "hand-1", nailColor: "#c45c6a" });
    assert.equal(id, "task-nail-vto");
    assert.equal((calls[0]!.body as Record<string, unknown>).nail_color, "#c45c6a");
  });

  it("Jewellery: 2d-vto needs a SKU still URL (no invented 3D)", async () => {
    await assert.rejects(
      () =>
        startAccessoryTryOn({
          srcFileId: "face-1",
          accessoryCategory: "earring",
          refFileUrl: "",
        }),
      /YOUCAM_3D_ASSET_REQUIRED/,
    );
    assert.equal(calls.length, 0);
    const id = await startAccessoryTryOn({
      srcFileId: "face-1",
      accessoryCategory: "earring",
      refFileUrl: "https://cdn.example/hoop.jpg",
    });
    assert.equal(id, "task-2d-vto/earring");
    const posted = calls.find((c) => c.method === "POST");
    assert.ok(posted?.url.endsWith("/s2s/v2.0/task/2d-vto/earring"));
    const body = posted!.body as Record<string, unknown>;
    assert.deepEqual(body.ref_file_urls, ["https://cdn.example/hoop.jpg"]);
    assert.deepEqual(body.source_info, { name: "face-1" });
    assert.equal(body.asset_3d_id, undefined);
  });

  it("Eyewear S2S is unavailable", async () => {
    await assert.rejects(
      () => startEyewearTryOn({ srcFileId: "face-1", frameId: "frame-22" }),
      /YOUCAM_EYEWEAR_UNAVAILABLE/,
    );
    assert.equal(calls.length, 0);
  });

  it("429 opens the shared circuit after consecutive failures", async () => {
    mode = "429";
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(() => startMakeupVto({ srcFileId: "x" }), /YOUCAM_RATE_LIMIT/);
    }
    assert.equal(youcamCircuitOpen(), true);
    mode = "ok";
    await assert.rejects(() => startShadeFinder({ srcFileId: "x" }), /YOUCAM_UNAVAILABLE/);
  });

  it("HTTP error path does not leak as success", async () => {
    mode = "error";
    await assert.rejects(() => startNailTryOn({ srcFileId: "h", nailColor: "#000" }), /YOUCAM_HTTP_500/);
  });
});
