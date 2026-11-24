#!/usr/bin/env node
/* 每篇文章的分享图：把 build.mjs 写出的卡片（dist/og/_src/*.html）用无头 Chrome 截成 1200×630 的 PNG，放到 dist/og/
   用法：WG_OG=1 node scripts/build.mjs && node scripts/og.mjs
   需要 Chrome（GitHub Actions 的 ubuntu 机器自带）和中文字体（发布工作流里装 fonts-noto-cjk）。
   某张截图失败时用通用分享图顶上，不让整个发布失败 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DIST, SITE } from "./lib/paths.mjs";

const run = promisify(execFile);
const SRC = path.join(DIST, "og/_src"), OUT = path.join(DIST, "og");
const FALLBACK = path.join(SITE, "assets/og.png");

function findChrome() {
  const c = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  return c.find(p => fs.existsSync(p)) || null;
}

async function shot(chrome, html, png) {
  const profile = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || "/tmp", "og-"));
  try {
    await run(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
      `--user-data-dir=${profile}`, "--window-size=1200,630", "--virtual-time-budget=3000", `--screenshot=${png}`, `file://${html}`], { timeout: 60_000 });
    if (!fs.existsSync(png) || fs.statSync(png).size < 2000) throw new Error("截图是空的");
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
}

async function main() {
  if (!fs.existsSync(SRC)) { console.log("没有分享图要生成（构建时没开 WG_OG=1）"); return; }
  const files = fs.readdirSync(SRC).filter(f => f.endsWith(".html"));
  const chrome = findChrome();
  if (!chrome) console.log("::warning::找不到 Chrome，分享图全部用通用图");
  let ok = 0, fail = 0;
  const queue = [...files];
  const worker = async () => {
    for (let f; (f = queue.shift());) {
      const png = path.join(OUT, f.replace(/\.html$/, ".png"));
      try { if (!chrome) throw new Error("没有 Chrome"); await shot(chrome, path.join(SRC, f), png); ok++; }
      catch (e) { fs.copyFileSync(FALLBACK, png); fail++; if (chrome) console.log(`::warning::${f} 截图失败，用通用图：${e.message.slice(0, 120)}`); }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  fs.rmSync(SRC, { recursive: true, force: true });
  console.log(`分享图：生成 ${ok} 张${fail ? `，${fail} 张用通用图` : ""}`);
}

main();
