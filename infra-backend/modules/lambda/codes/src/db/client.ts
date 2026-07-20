import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

const { Client } = pg;

export function isDsqlEnabled(): boolean {
  const enabled = (process.env.DSQL_ENABLED ?? "").toLowerCase() === "true";
  const endpoint = (process.env.DSQL_ENDPOINT ?? "").trim();
  return (
    enabled &&
    endpoint.length > 0 &&
    endpoint.toLowerCase() !== "disabled"
  );
}

export function dsqlEndpoint(): string {
  return (process.env.DSQL_ENDPOINT ?? "").trim();
}

function dsqlUser(): string {
  return process.env.DSQL_USER?.trim() || "girlcode360_app";
}

function region(): string {
  return (
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "eu-west-2"
  );
}

async function authToken(hostname: string): Promise<string> {
  const signer = new DsqlSigner({ hostname, region: region() });
  return signer.getDbConnectAuthToken();
}

/** Short-lived client per query (Lambda-friendly; IAM token is connection password). */
export async function withClient<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  if (!isDsqlEnabled()) {
    throw new Error("DSQL_DISABLED");
  }
  const host = dsqlEndpoint();
  const password = await authToken(host);
  const client = new Client({
    host,
    port: 5432,
    user: dsqlUser(),
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return withClient((client) => client.query<T>(text, params));
}

/** Smoke check used by health — returns false when DSQL is off or unreachable. */
export async function smokeSelect1(): Promise<boolean> {
  if (!isDsqlEnabled()) return false;
  try {
    const res = await query<{ ok: number }>("SELECT 1 AS ok");
    return res.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function parseJsonArray<T = string>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
