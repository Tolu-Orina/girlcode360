/**
 * FR-028 copy lint — fail if banned diagnostic phrases appear in app/docs copy.
 * Run: node scripts/copy-lint.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "../..");
const DENY = [
  "you have pcos",
  "you are pregnant",
  "diagnosed with",
  "this confirms",
  "this diagnoses",
  "you have been diagnosed",
];

const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css"]);
const SKIP = new Set(["node_modules", "dist", ".git"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(extname(name))) out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, "src")),
  ...walk(join(ROOT, "../../packages/domain/src")),
  ...walk(join(ROOT, "../../packages/api-types/src")),
];

const hits = [];
for (const file of files) {
  // Allow the denylist definition itself and this script.
  if (file.endsWith("copy-lint.mjs")) continue;
  if (file.includes(`${join("domain", "src")}`) && file.endsWith("index.ts")) {
    // domain index defines DIAGNOSIS_DENYLIST — skip phrase list lines only via check below
  }
  const text = readFileSync(file, "utf8");
  const lower = text.toLowerCase();
  for (const phrase of DENY) {
    if (!lower.includes(phrase)) continue;
    // Allow explicit denylist array entries and lint tool docs.
    if (
      file.endsWith("index.ts") &&
      (text.includes("DIAGNOSIS_DENYLIST") || text.includes("findDeniedPhrases"))
    ) {
      continue;
    }
    if (file.endsWith("copy-lint.mjs")) continue;
    hits.push({ file, phrase });
  }
}

if (hits.length) {
  console.error("Copy lint failed (FR-028):");
  for (const h of hits) console.error(`  ${h.phrase}  ←  ${h.file}`);
  process.exit(1);
}

console.log(`Copy lint OK (${files.length} files scanned).`);
