#!/usr/bin/env node
/* 英文版：把已发布的中文解读翻成英文，写到 content/en/<slug>.json
   用法：node scripts/translate.mjs                 翻译还没有英文版、或中文稿改过的文章（默认最多 6 篇）
         node scripts/translate.mjs --slug a,b      只翻指定的几篇（不管是否已有英文版）
         node scripts/translate.mjs --max 20        这次最多翻几篇
         node scripts/translate.mjs --list          只列出要翻的文章，不调模型
         node scripts/translate.mjs --mock          不调模型，用假译文跑通流程（测试用）
   需要 DEEPSEEK_API_KEY。结果清单写到 --out（默认 data/new-translations.json），开 PR 的脚本读它 */
import fs from "node:fs";
import path from "node:path";
import { CONTENT, CONTENT_EN } from "./lib/paths.mjs";
import { readJson, writeJson, dataFile } from "./lib/store.mjs";
import { loadSourceTexts } from "./lib/archive.mjs";
import { translateArticle, sourceHash, numbersZh } from "./lib/translate.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const only = (arg("--slug", "") || "").split(",").map(s => s.trim()).filter(Boolean);
const max = Number(arg("--max", 6));
const out = arg("--out", dataFile("new-translations.json"));
const mock = args.includes("--mock");

/* 需要翻译的：已发布、且（没有英文版，或英文版是从旧的中文稿翻的） */
export function pending({ slugs = [] } = {}) {
  if (!fs.existsSync(CONTENT)) return [];
  return fs.readdirSync(CONTENT).filter(f => f.endsWith(".json")).map(f => readJson(path.join(CONTENT, f)))
    .filter(a => a && a.status === "published")
    .filter(a => slugs.length ? slugs.includes(a.slug) : readJson(path.join(CONTENT_EN, `${a.slug}.json`))?.translated_from !== sourceHash(a))
    .sort((x, y) => String(y.date).localeCompare(String(x.date)));
}

/* 假译文：把中文换成带编号的英文占位，数字原样保留（测试流程用） */
const mockMap = (stage, segs) => Object.fromEntries(segs.map(s => [s.id, `EN ${s.id} ${numbersZh(s.text).join(" ")}`.trim()]));

async function main() {
  const todo = pending({ slugs: only });
  if (args.includes("--list")) { todo.forEach(a => console.log(`${a.slug}\t${a.title}`)); return; }
  const batch = todo.slice(0, max);
  console.log(`要翻译 ${todo.length} 篇，这次翻 ${batch.length} 篇`);
  const done = [];
  for (const a of batch) {
    console.log(`\n▸ ${a.slug}：${a.title}`);
    try {
      const texts = loadSourceTexts(a);
      const src = texts[a.sources?.main?.url] || Object.values(texts)[0] || "";
      const r = await translateArticle(a, { sourceText: src, mock: mock ? mockMap : null });
      if (!r.article) { console.log(`  ✗ 没通过核对（${r.problems.length} 处），这篇先不发英文版：\n    ${r.problems.slice(0, 5).map(p => `${p.id} ${p.msg}`).join("\n    ")}`); continue; }
      writeJson(path.join(CONTENT_EN, `${a.slug}.json`), r.article);
      console.log(`  ✓ ${r.segments} 段 → ${r.article.title}`);
      done.push({ slug: a.slug, file: `content/en/${a.slug}.json`, title: r.article.title, zh: a.title });
    } catch (e) { console.log(`  ✗ ${e.message}`); }
  }
  writeJson(out, done);
  console.log(`\n完成 ${done.length} / ${batch.length} 篇`);
  if (batch.length && !done.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
