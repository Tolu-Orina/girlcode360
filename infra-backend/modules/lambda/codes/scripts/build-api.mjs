import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist");
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(root, "src/handlers/api.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(outdir, "index.js"),
});

console.log("Built infra-backend/modules/lambda/codes/dist/index.js");
