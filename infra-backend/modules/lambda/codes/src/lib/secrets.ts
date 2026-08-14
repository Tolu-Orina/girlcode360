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
