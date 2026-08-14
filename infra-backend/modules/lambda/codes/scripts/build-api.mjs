import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LAMBDA_NAMES } from "./functions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist");
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const entryPoints = Object.fromEntries(
  LAMBDA_NAMES.map((name) => [name, join(root, `src/handlers/${name}.ts`)]),
);

await build({
  entryPoints,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outdir,
  entryNames: "[name]",
  external: ["pg-native"],
  // Replace export object so Lambda gets a real handler function (getter snapshot race).
  footer: {
    js: "module.exports = { handler };",
  },
});

writeFileSync(
  join(outdir, "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2),
);

console.log(
  `Built ${LAMBDA_NAMES.length} Lambda entrypoints in infra-backend/modules/lambda/codes/dist`,
);
