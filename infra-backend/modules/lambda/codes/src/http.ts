import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { internalPurgeKey } from "./lib/secrets";

export { pathOf, schedulerKind, under } from "./routing";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization,Content-Type,Idempotency-Key,idempotency-key,x-internal-key,X-Internal-Key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export function mapYoucamErr(err: unknown): APIGatewayProxyResult | null {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "IMAGE_TOO_LARGE") return json(413, { error: "image_too_large" });
  if (msg === "IMAGE_TOO_SMALL") return json(400, { error: "image_too_small" });
  if (msg === "CATALOGUE_ITEM_INVALID") {
    return json(400, { error: "catalogue_item_invalid" });
  }
  if (msg === "STUDIO_SCAN_REQUIRED") return json(400, { error: "scan_required" });
  if (msg === "STUDIO_SHADE_PENDING") return json(202, { error: "shade_still_running" });
  if (msg === "STUDIO_FACE_REQUIRED") return json(400, { error: "image_required" });
  if (msg === "STUDIO_REFERENCE_REQUIRED") {
    return json(400, { error: "reference_required" });
  }
  if (msg === "YOUCAM_HAIR_COLOR_REQUIRED") {
    return json(400, { error: "hair_color_required" });
  }
  if (msg === "YOUCAM_3D_ASSET_REQUIRED" || msg === "ACCESSORY_3D_REQUIRED") {
    return json(400, { error: "accessory_3d_required" });
  }
  if (msg === "YOUCAM_NAIL_COLOR_REQUIRED") {
    return json(400, { error: "nail_color_required" });
  }
  if (msg === "YOUCAM_FRAME_ID_REQUIRED") {
    return json(400, { error: "frame_id_required" });
  }
  if (msg === "YOUCAM_ACCESSORY_CATEGORY_INVALID") {
    return json(400, { error: "accessory_category_invalid" });
  }
  if (msg === "STUDIO_HAND_REQUIRED") {
    return json(400, { error: "hand_photo_required" });
  }
  if (msg === "RESALE_PRICE_INVALID") {
    return json(400, { error: "resale_price_invalid" });
  }
  if (msg === "RESALE_ALREADY_LISTED") {
    return json(409, { error: "resale_already_listed" });
  }
  if (msg === "WARDROBE_CATEGORY_BANNED") {
    return json(400, { error: "wardrobe_category_banned" });
  }
  if (msg === "WARDROBE_ITEMS_REQUIRED") {
    return json(400, { error: "wardrobe_items_required" });
  }
  if (msg === "WARDROBE_ITEM_NOT_FOUND") {
    return json(404, { error: "wardrobe_item_not_found" });
  }
  if (msg === "WARDROBE_OUTFIT_NOT_FOUND") {
    return json(404, { error: "wardrobe_outfit_not_found" });
  }
  if (msg === "WARDROBE_VTO_UNSUPPORTED") {
    return json(400, { error: "wardrobe_vto_unsupported" });
  }
  if (msg === "WARDROBE_CLIMATE_INVALID") {
    return json(400, { error: "wardrobe_climate_invalid" });
  }
  if (msg === "WARDROBE_DATE_INVALID") {
    return json(400, { error: "wardrobe_date_invalid" });
  }
  if (msg === "WARDROBE_IMAGE_MISSING") {
    return json(400, { error: "wardrobe_image_missing" });
  }
  if (msg === "YOUCAM_UNCONFIGURED") return json(503, { error: "youcam_unconfigured" });
  if (msg === "YOUCAM_RATE_LIMIT") return json(429, { error: "youcam_busy" });
  if (msg.startsWith("YOUCAM_")) return json(503, { error: "youcam_unavailable" });
  return null;
}

export function claims(event: APIGatewayProxyEvent): {
  sub: string;
  email?: string;
} | null {
  const c = event.requestContext.authorizer?.claims as
    | Record<string, string>
    | undefined;
  if (c?.sub) return { sub: c.sub, email: c.email };

  const auth = event.headers?.Authorization ?? event.headers?.authorization;
  if (auth?.startsWith("Bearer dev.")) {
    try {
      const payload = JSON.parse(
        Buffer.from(auth.slice("Bearer dev.".length), "base64url").toString(
          "utf8",
        ),
      ) as { sub: string; email?: string };
      if (payload.sub) return payload;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function parseBody<T>(event: APIGatewayProxyEvent): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw) as T;
}

export function header(
  event: APIGatewayProxyEvent,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === lower && v) return v;
  }
  return undefined;
}

export async function internalAuthorized(
  event: APIGatewayProxyEvent,
): Promise<boolean> {
  const presented =
    header(event, "x-internal-key") ?? header(event, "X-Internal-Key");
  const expected = await internalPurgeKey();
  return Boolean(presented) && presented === expected;
}
