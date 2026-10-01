// Builds the React app shell (JS + Tailwind CSS). Owned by the app-shell
// work; see ../build.mjs for shared settings.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Geist (OFL-1.1), latin subset, one variable-weight woff2 inlined as a data
// URL so `file://` exports need no font request (UI guidelines T2). The file
// is generated and committed, like the other build outputs.
function writeFontCss(here) {
  const woff2 = fs.readFileSync(path.join(here, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"));
  const css =
    `@font-face{font-family:"Geist Variable";font-style:normal;font-display:swap;font-weight:100 900;` +
    `src:url(data:font/woff2;base64,${woff2.toString("base64")}) format("woff2");` +
    `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n`;
  const out = path.join(here, "src/app/font.css");
  if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== css) fs.writeFileSync(out, css);
}

export async function buildApp({ here, assets, common }) {
  writeFontCss(here);
  await build({
    ...common,
    entryPoints: [path.join(here, "src/app/main.tsx")],
    outfile: path.join(assets, "simscope-app.js"),
    format: "iife",
    jsx: "automatic",
    loader: { ".css": "empty" },
    alias: { "@": path.join(here, "src/app"), "@core": path.join(here, "src/core") },
  });
  execFileSync(
    process.execPath,
    [path.join(here, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", path.join(here, "src/app/app.css"),
      "-o", path.join(assets, "simscope-app.css"), "--minify"],
    { cwd: here, stdio: ["ignore", "ignore", "inherit"] },
  );
  return ["simscope-app.js", "simscope-app.css"];
}
