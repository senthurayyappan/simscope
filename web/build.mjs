// Builds simscope's browser code into src/simscope/_assets/:
//
//   simscope-player.js   the CDN-free <simscope-player> element + core (IIFE)
//   simscope-app.js/.css the React app shell used by `simscope serve` and
//                        full exports
//   simscope-web.LICENSES.txt
//
//   npm run build
//
// The outputs are committed, and CI rebuilds them and runs
// `git diff --exit-code`, so builds must be byte-reproducible (pinned
// dependencies, no timestamps, no absolute paths in the output).

import { buildApp } from "./build/app.mjs";
import { buildPlayer } from "./build/player.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, "../src/simscope/_assets");
fs.mkdirSync(assets, { recursive: true });

const common = {
  bundle: true,
  minify: true,
  target: "es2022",
  legalComments: "none",
  charset: "utf8",
  logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
};

const ctx = { here, assets, common };
const outputs = [...(await buildPlayer(ctx)), ...(await buildApp(ctx))];

const pkg = (name) => JSON.parse(fs.readFileSync(path.join(here, "node_modules", name, "package.json"), "utf8"));
const licenseOf = (name) => {
  for (const f of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE"]) {
    const p = path.join(here, "node_modules", name, f);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  }
  return `(licence file not found; ${pkg(name).license})`;
};
const notice = ["simscope's browser bundles include the following third-party software.", ""];
// Runtime dependencies, plus Tailwind, whose preflight CSS ships in the app.
const bundled = [...Object.keys(JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).dependencies), "tailwindcss"];
for (const name of bundled) {
  notice.push(`${name} ${pkg(name).version} (${pkg(name).license})`, "", licenseOf(name), "", "=".repeat(72), "");
}
// Exports embed this text in an HTML comment, where "--" is not allowed, so
// separator rules inside licence files become "=" rules.
const text = notice.join("\n").replace(/-{2,}/g, (m) => "=".repeat(m.length));
fs.writeFileSync(path.join(assets, "simscope-web.LICENSES.txt"), text);
fs.rmSync(path.join(assets, "simscope-player.LICENSES.txt"), { force: true });

for (const f of outputs) {
  const bytes = fs.readFileSync(path.join(assets, f));
  console.log(`${f}: ${bytes.length} bytes, ${zlib.gzipSync(bytes, { level: 9 }).length} bytes gzipped`);
}
