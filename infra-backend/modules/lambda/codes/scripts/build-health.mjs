import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist-health");
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(root, "src/handlers/health.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(outdir, "health.js"),
});

console.log("Built infra-backend/modules/lambda/codes/dist-health/health.js");
