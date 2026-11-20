#!/usr/bin/env node
/* 校验 content/articles 里的文章（合并请求的检查会跑这个）
   用法：node scripts/validate.mjs [文件...]，不传文件就检查全部；有 errors 时退出码为 1 */
import fs from "node:fs";
import path from "node:path";
import { CONTENT } from "./lib/paths.mjs";
import { readJson } from "./lib/store.mjs";
import { loadSourceTexts } from "./lib/archive.mjs";
import { validateArticle, reportMarkdown } from "./lib/validate.mjs";

const files = process.argv.slice(2).filter(f => f.endsWith(".json"));
const list = files.length ? files : fs.readdirSync(CONTENT).filter(f => f.endsWith(".json")).map(f => path.join(CONTENT, f));

let failed = 0; const out = [];
for (const f of list) {
  if (!fs.existsSync(f)) continue;
  const a = readJson(f);
  if (!a) { out.push(`### ${f}\n\nJSON 格式错误，无法解析\n`); failed++; continue; }
  const r = validateArticle(a, { sourceTexts: loadSourceTexts(a) });
  if (r.errors.length) failed++;
  out.push(reportMarkdown(a, r));
}
const md = out.join("\n");
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(failed ? 1 : 0);
