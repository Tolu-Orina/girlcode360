#!/usr/bin/env node
/**
 * Apply ordered SQL files under infra-backend/migrations to Aurora DSQL,
 * then bootstrap the non-admin app role used by Lambda (IAM auth).
 *
 * Best practice (AWS):
 * - Run AFTER terraform apply (cluster endpoint must exist in SSM).
 * - Use IAM auth as `admin` for DDL (`dsql:DbConnectAdmin`).
 * - Track applied files in schema_migrations so re-runs are safe.
 * - Skip when DSQL is disabled.
 * - Create `girlcode360_app` (or DSQL_USER), AWS IAM GRANT to Lambda role,
 *   then GRANT table privileges.
 *
 * Env:
 *   TF_VAR_environment | ENVIRONMENT
 *   AWS_DEFAULT_REGION | AWS_REGION
 *   DSQL_USER (optional, default girlcode360_app)
 *   LAMBDA_ROLE_ARN (optional — if unset, read from terraform output)
 *
 * Docs:
 *   https://docs.aws.amazon.com/aurora-dsql/latest/userguide/using-database-and-iam-roles.html
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");
const infraRoot = path.join(__dirname, "..");

const environment = process.env.TF_VAR_environment || process.env.ENVIRONMENT;
const region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2";
const appRole = (process.env.DSQL_USER || "girlcode360_app").trim();

if (!environment) {
  console.error("TF_VAR_environment or ENVIRONMENT is required");
  process.exit(1);
}

function awsOut(args) {
  return execFileSync("aws", args, { encoding: "utf8" }).trim();
}

function tfOut(name) {
  try {
    return execFileSync(
      "terraform",
      ["output", "-raw", name],
      { encoding: "utf8", cwd: infraRoot },
    ).trim();
  } catch {
    return "";
  }
}

function quoteIdent(ident) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Unsafe SQL identifier: ${ident}`);
  }
  return `"${ident.replace(/"/g, '""')}"`;
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

  // ——— App role bootstrap (idempotent) ———
  const roleIdent = quoteIdent(appRole);
  const { rows: roleRows } = await client.query(
    "SELECT 1 AS ok FROM pg_roles WHERE rolname = $1",
    [appRole],
  );
  if (roleRows.length === 0) {
    console.log(`create role ${appRole}`);
    await client.query(`CREATE ROLE ${roleIdent} WITH LOGIN`);
  } else {
    console.log(`role ${appRole} already exists`);
  }

  const lambdaRoleArn =
    (process.env.LAMBDA_ROLE_ARN || "").trim() || tfOut("lambda_role_arn");

  if (!lambdaRoleArn) {
    console.warn(
      "LAMBDA_ROLE_ARN / terraform output lambda_role_arn missing — skipping AWS IAM GRANT",
    );
  } else if (!/^arn:aws:iam::\d+:role\/[\w+=,.@-]+$/.test(lambdaRoleArn)) {
    throw new Error(`Refusing IAM GRANT — unexpected role ARN: ${lambdaRoleArn}`);
  } else {
    console.log(`AWS IAM GRANT ${appRole} TO ${lambdaRoleArn}`);
    try {
      await client.query(
        `AWS IAM GRANT ${roleIdent} TO '${lambdaRoleArn.replace(/'/g, "''")}'`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Re-runs may already have the mapping
      if (/already|exists|duplicate/i.test(msg)) {
        console.log(`IAM mapping already present (${msg})`);
      } else {
        throw err;
      }
    }
  }

  console.log(`grant table privileges to ${appRole}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${roleIdent}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleIdent}`,
  );
  // Future tables created by admin migrations
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${roleIdent}`,
  );

  console.log(`App role bootstrap complete (${appRole})`);
} finally {
  await client.end();
}
