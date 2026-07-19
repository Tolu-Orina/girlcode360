#!/usr/bin/env node
/**
 * Apply ordered SQL files under infra-backend/migrations to Aurora DSQL.
 *
 * Best practice (AWS):
 * - Run AFTER terraform apply (cluster endpoint must exist in SSM).
 * - Use IAM auth as `admin` for DDL (`dsql:DbConnectAdmin`).
 * - Track applied files in schema_migrations so re-runs are safe.
 * - Skip when DSQL is disabled.
 *
 * Env: TF_VAR_environment | ENVIRONMENT, AWS_DEFAULT_REGION
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");

const environment = process.env.TF_VAR_environment || process.env.ENVIRONMENT;
const region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2";

if (!environment) {
  console.error("TF_VAR_environment or ENVIRONMENT is required");
  process.exit(1);
}

function awsOut(args) {
  return execFileSync("aws", args, { encoding: "utf8" }).trim();
}

const endpoint = awsOut([
  "ssm",
  "get-parameter",
  "--name",
  `/girlcode360/${environment}/backend/dsql_endpoint`,
  "--query",
  "Parameter.Value",
  "--output",
  "text",
]);

if (!endpoint || endpoint === "disabled") {
  console.log(`DSQL disabled for ${environment}; skipping migrations`);
  process.exit(0);
}

const token = awsOut([
  "dsql",
  "generate-db-connect-admin-auth-token",
  "--hostname",
  endpoint,
  "--region",
  region,
]);

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  host: endpoint,
  port: 5432,
  user: "admin",
  password: token,
  database: "postgres",
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 30_000,
});

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await client.query("SELECT id FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.id));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);
    // DSQL: keep DDL and DML in separate transactions
    // https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-ddl.html
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      ran += 1;
    } catch (err) {
      console.error(`failed ${file}:`, err.message);
      throw err;
    }
  }

  console.log(`Migrations complete for ${environment} @ ${endpoint} (${ran} new)`);
} finally {
  await client.end();
}
