import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let cached: Record<string, string> | null = null;
let loadedAt = 0;
const TTL_MS = 5 * 60 * 1000;

function envName(): string {
  return process.env.ENVIRONMENT ?? "dev";
}

function secretId(): string {
  return process.env.APP_SECRET_ID ?? `girlcode360/${envName()}/app`;
}

export async function appSecrets(): Promise<Record<string, string>> {
  if (cached && Date.now() - loadedAt < TTL_MS) return cached;
  const fromEnv: Record<string, string> = {};
  if (process.env.YOUCAM_API_KEY?.trim()) {
    fromEnv.youcam_api_key = process.env.YOUCAM_API_KEY.trim();
  }
  try {
    const client = new SecretsManagerClient({
      region:
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        "eu-west-2",
    });
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: secretId() }),
    );
    const raw = res.SecretString ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = { ...fromEnv };
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    cached = out;
    loadedAt = Date.now();
    return out;
  } catch (err) {
    if (Object.keys(fromEnv).length) {
      cached = fromEnv;
      loadedAt = Date.now();
      return fromEnv;
    }
    console.error("app secret load failed", err);
    cached = {};
    loadedAt = Date.now();
    return {};
  }
}

export async function youcamApiKey(): Promise<string | null> {
  const s = await appSecrets();
  const key = s.youcam_api_key?.trim();
  return key && key.length > 8 ? key : null;
}

export async function youcamWebhookSecret(): Promise<string | null> {
  const s = await appSecrets();
  const key =
    s.youcam_webhook_secret?.trim() ||
    process.env.YOUCAM_WEBHOOK_SECRET?.trim() ||
    "";
  return key.length > 8 ? key : null;
}

function firstFilled(
  secrets: Record<string, string>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const fromSecret = secrets[key]?.trim();
    if (fromSecret) return fromSecret;
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) return fromEnv;
  }
  return null;
}

/** Packed JSON `internal_purge_key` (or INTERNAL_PURGE_KEY). Env wins if set.
 * Fail closed outside local/dev if the key is missing. */
export async function internalPurgeKey(): Promise<string | null> {
  const s = await appSecrets();
  const key = firstFilled(s, ["INTERNAL_PURGE_KEY", "internal_purge_key"]);
  const env = (process.env.ENVIRONMENT ?? "dev").toLowerCase();
  const local = env === "dev" || env === "local" || env === "unknown";
  if (key) return key;
  if (local) return "dev-purge";
  return null;
}

export async function vapidKeys(): Promise<{
  publicKey: string | null;
  privateKey: string | null;
}> {
  const s = await appSecrets();
  return {
    publicKey: firstFilled(s, ["VAPID_PUBLIC_KEY", "vapid_public_key"]),
    privateKey: firstFilled(s, ["VAPID_PRIVATE_KEY", "vapid_private_key"]),
  };
}

export async function stripeConfig(): Promise<{
  secretKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
}> {
  const s = await appSecrets();
  return {
    secretKey: firstFilled(s, ["STRIPE_SECRET_KEY", "stripe_secret_key"]),
    webhookSecret: firstFilled(s, [
      "STRIPE_WEBHOOK_SECRET",
      "stripe_webhook_secret",
    ]),
    priceId: firstFilled(s, ["STRIPE_PRICE_ID", "stripe_price_id"]),
  };
}

export async function paystackConfig(): Promise<{
  secretKey: string | null;
  planCode: string | null;
  planCodeGhs: string | null;
}> {
  const s = await appSecrets();
  return {
    secretKey: firstFilled(s, ["PAYSTACK_SECRET_KEY", "paystack_secret_key"]),
    planCode: firstFilled(s, ["PAYSTACK_PLAN_CODE", "paystack_plan_code"]),
    planCodeGhs: firstFilled(s, [
      "PAYSTACK_PLAN_CODE_GHS",
      "paystack_plan_code_ghs",
    ]),
  };
}
