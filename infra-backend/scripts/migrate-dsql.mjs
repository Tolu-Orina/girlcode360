#!/usr/bin/env node
/**
 * Apply ordered SQL files under infra-backend/migrations to Aurora DSQL,
 * then bootstrap the non-admin app role used by Lambda (IAM auth).
 *
 * Aurora DSQL constraints (AWS docs):
 * - A transaction may contain only ONE DDL statement
 * - DDL and DML cannot share a transaction
 * - Use CREATE INDEX ASYNC (not synchronous CREATE INDEX)
 * - After ASYNC index DDL, wait via sys.wait_for_job / sys.jobs
 *
 * Refs:
 *   https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-ddl.html
 *   https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-create-index-async.html
 *   https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-migration-guide.html
 *   aws-samples/aurora-dsql-samples (one DDL per migration transaction)
 *
 * Env:
 *   TF_VAR_environment | ENVIRONMENT
 *   AWS_DEFAULT_REGION | AWS_REGION
 *   DSQL_USER (optional, default girlcode360_app)
 *   LAMBDA_ROLE_ARN (optional — if unset, read from terraform output)
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
    return execFileSync("terraform", ["output", "-raw", name], {
      encoding: "utf8",
      cwd: infraRoot,
    }).trim();
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

/** Split a SQL file into single statements (DSQL: one DDL per transaction). */
function splitStatements(sql) {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = withoutBlockComments.split(/\r?\n/);
  const cleaned = lines
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");

  const statements = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (ch === "'" && !inDouble) {
      if (inSingle && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === ";" && !inSingle && !inDouble) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/** Prefer CREATE INDEX ASYNC — sync CREATE INDEX is not supported on DSQL. */
function normalizeStatement(stmt) {
  return stmt.replace(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!ASYNC\b)/i,
    (_m, unique) => `CREATE ${unique || ""}INDEX ASYNC `,
  );
}

function isAsyncIndexDdl(stmt) {
  return /^CREATE\s+(UNIQUE\s+)?INDEX\s+ASYNC\b/i.test(stmt);
}

async function waitForJob(client, jobId) {
  if (!jobId) return;
  const id = String(jobId);
  console.log(`  wait for async job ${id}`);

  // job_id is text (base-32 style). wait_for_job is a PROCEDURE (CALL), not SELECT.
  // https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-create-index-async.html
  try {
    await client.query("CALL sys.wait_for_job($1)", [id]);
    console.log(`  job ${id} finished (wait_for_job)`);
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/wait_for_job|procedure|function.*does not exist|syntax|does not exist/i.test(msg)) {
      throw err;
    }
    console.log(`  wait_for_job unavailable (${msg}); polling sys.jobs`);
  }

  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const { rows } = await client.query(
      "SELECT status, details FROM sys.jobs WHERE job_id = $1",
      [id],
    );
    if (rows.length === 0) {
      console.log(`  job ${id} no longer in sys.jobs (treat as done)`);
      return;
    }
    const status = String(rows[0].status || "").toLowerCase();
    if (status === "completed") {
      console.log(`  job ${id} completed`);
      return;
    }
    if (status === "failed") {
      throw new Error(
        `Async index job ${id} failed: ${rows[0].details || "no details"}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for async job ${id}`);
}

function extractJobId(result) {
  if (!result?.rows?.length) return null;
  const row = result.rows[0];
  if (row.job_id != null) return String(row.job_id);
  if (row.job_uuid != null) return String(row.job_uuid);
  // DSQL job ids look like base-32 strings, not RFC UUIDs
  for (const v of Object.values(row)) {
    if (typeof v === "string" && /^[a-z0-9]{20,}$/i.test(v)) return v;
  }
  return null;
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
  // Single DDL — own auto-commit transaction
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
    const statements = splitStatements(sql).map(normalizeStatement);
    console.log(`apply ${file} (${statements.length} statement(s))`);

    try {
      for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
        console.log(`  → ${preview}${stmt.length > 80 ? "…" : ""}`);
        const result = await client.query(stmt);
        if (isAsyncIndexDdl(stmt)) {
          await waitForJob(client, extractJobId(result));
        }
      }
      // DML in its own transaction after all DDL for this file
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      ran += 1;
    } catch (err) {
      console.error(`failed ${file}:`, err.message);
      throw err;
    }
  }

  console.log(`Migrations complete for ${environment} @ ${endpoint} (${ran} new)`);

  // ——— App role bootstrap (idempotent); each DDL/DML alone ———
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
      if (/already|exists|duplicate/i.test(msg)) {
        console.log(`IAM mapping already present (${msg})`);
      } else {
        throw err;
      }
    }
  }

  console.log(`grant table privileges to ${appRole}`);
  // DSQL treats some catalog/schema objects as system entities — GRANT USAGE ON
  // SCHEMA public can fail with "feature not supported on system entity".
  // Prefer per-table grants (AWS sample pattern for app roles).
  try {
    await client.query(`GRANT USAGE ON SCHEMA public TO ${roleIdent}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/system entity|not supported/i.test(msg)) {
      console.log(`  skip GRANT USAGE ON SCHEMA public (${msg})`);
    } else {
      throw err;
    }
  }

  const { rows: tables } = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );
  for (const { tablename } of tables) {
    const tableIdent = quoteIdent(tablename);
    console.log(`  GRANT DML ON ${tablename}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tableIdent} TO ${roleIdent}`,
    );
  }

  try {
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${roleIdent}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/system entity|not supported/i.test(msg)) {
      console.log(`  skip ALTER DEFAULT PRIVILEGES (${msg})`);
    } else {
      throw err;
    }
  }

  console.log(`App role bootstrap complete (${appRole})`);
} finally {
  await client.end();
}
