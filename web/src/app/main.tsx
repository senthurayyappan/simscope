// Entry of the React app shell (simscope serve, full exports). Boots from the
// `#simscope-boot` block (viewer v3 contracts §6).

import { createRoot } from "react-dom/client";

import { App } from "./App";
import { createApi, readBoot } from "@/lib/api";
import { coreReady, startLoop } from "@/lib/core";
import * as runtime from "@/lib/runtime";
import { applyThemeClass, useApp } from "@/lib/store";

import "./app.css";

function fatal(root: HTMLElement, message: string) {
  root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText =
    "display:flex;height:100%;align-items:center;justify-content:center;font:13px ui-sans-serif,system-ui;color:#888;padding:24px;text-align:center";
  box.textContent = message;
  root.appendChild(box);
}

/** Sets the theme class before first paint so canvases read the right tokens. */
function applyInitialTheme() {
  applyThemeClass(useApp.getState().resolvedTheme);
}

async function boot() {
  const root = document.getElementById("app");
  if (!root) return;
  if (!coreReady) {
    fatal(root, "simscope: the player core is incomplete (Clock, Player, PackSource and HttpSource are required).");
    return;
  }
  applyInitialTheme();
  try {
    const boot = readBoot();
    const api = await createApi(boot);
    startLoop();
    // `?debug` exposes the store for scripted checks (Playwright flows, screenshots).
    if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { __simscope: useApp, __runtime: runtime });
    void useApp.getState().init(api, { runs: boot.runs, layout: boot.layout, arrange: boot.arrange });
    createRoot(root).render(<App />);
  } catch (e) {
    fatal(root, `simscope could not start: ${(e as Error).message}`);
  }
}

void boot();
