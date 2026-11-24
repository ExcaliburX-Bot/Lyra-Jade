#!/usr/bin/env node
/* 阶段 B 自动合并的资格检查。由 automerge.yml 在主分支的代码里运行：
   只把 PR 里的文章当「数据」读出来检查，绝不执行 PR 里的代码。
   用法：node scripts/ci/automerge-check.mjs <PR 编号>     需要 gh 和 GH_TOKEN
         node scripts/ci/automerge-check.mjs --local <pr.json> <文章.json>   测试用
   输出：在 GITHUB_OUTPUT 写 eligible=true|false，并把原因写进步骤摘要 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { validateArticle } from "../lib/validate.mjs";
import { loadSourceTexts } from "../lib/archive.mjs";

const CATEGORIES = (process.env.WG_AUTOMERGE_CATEGORIES || "product").split(",").map(s => s.trim()).filter(Boolean);
/* 两种模式：on＝Grok Bot 初审后打 bot-reviewed 才合并（阶段 B）；direct＝校验通过就直接上线，打 auto-publish */
const MODE = process.env.WG_AUTOMERGE_MODE || "on";
const LABEL = process.env.WG_AUTOMERGE_LABEL || (MODE === "direct" ? "auto-publish" : "bot-reviewed");

/* 纯函数：给定 PR 信息和文章，返回不能自动合并的原因（空数组 = 可以） */
export function automergeProblems(pr, article, { categories = CATEGORIES, label = LABEL, sourceTexts = {}, mode = MODE } = {}) {
  const direct = mode === "direct";
  const p = [];
  if (pr.isCrossRepository) p.push("来自别人 fork 的 PR，不自动合并");
  if (!pr.headRefName?.startsWith("draft/")) p.push(`分支 ${pr.headRefName} 不是写稿流水线开的 draft/ 分支`);
  if (!(pr.labels || []).some(l => l.name === label)) p.push(`没有「${label}」标签`);
  if ((pr.labels || []).some(l => l.name === "需修改")) p.push("带着「需修改」标签");
  const files = pr.files || [];
  if (files.length !== 1) p.push(`改了 ${files.length} 个文件，只允许 1 个`);
  const f = files[0];
  if (f && !/^content\/articles\/[a-z0-9-]+\.json$/.test(f.path)) p.push(`改的不是文章文件：${f.path}`);
  if (pr.fileIsNew !== true) p.push("不是新增文章（改已有文章必须人工合并）");
  if (!article) { p.push("读不出文章 JSON"); return p; }
  /* 直接上线模式不等人工核对、不限栏目，但主材料仍必须是官方或一手 */
  if (!direct && article.verified !== true) p.push("verified 不是 true（初审还没核对完）");
  const tiers = direct ? ["official", "primary"] : ["official"];
  if (!tiers.includes(article.pipeline?.tier)) p.push(`主材料层级是 ${article.pipeline?.tier || "未知"}，不是 ${tiers.join(" 或 ")}`);
  if (!direct && !categories.includes(article.category)) p.push(`栏目 ${article.category} 不在自动合并范围（${categories.join("、")}）`);
  const r = validateArticle(article, { sourceTexts });
  if (r.errors.length) p.push(`校验有 ${r.errors.length} 个必须修改：${r.errors.slice(0, 3).join("；")}`);
  const unarchived = (article.claims || []).filter(c => !sourceTexts[c.source_url]).length;
  if (unarchived) p.push(`${unarchived} 条事实的原文没有存档，无法自动回查`);
  return p;
}

/* 英文版的 PR（translate/ 分支）：只能改 content/en/ 下的译文；译文在翻译时已逐段核对过数字，这里再确认它是英文版、没有残留中文 */
const CJK = /[\u2E80-\u9FFF\u3000-\u303F\uF900-\uFAFF\uFF00-\uFFEF]/;
export function translationProblems(pr, docs, { label = LABEL } = {}) {
  const p = [];
  if (pr.isCrossRepository) p.push("来自别人 fork 的 PR，不自动合并");
  if (!pr.headRefName?.startsWith("translate/")) p.push(`分支 ${pr.headRefName} 不是翻译流水线开的 translate/ 分支`);
  if (!(pr.labels || []).some(l => l.name === label)) p.push(`没有「${label}」标签`);
  if ((pr.labels || []).some(l => l.name === "需修改")) p.push("带着「需修改」标签");
  const files = pr.files || [];
  if (!files.length || files.length > 30) p.push(`改了 ${files.length} 个文件，应为 1–30 篇译文`);
  for (const f of files) {
    if (!/^content\/en\/[a-z0-9-]+\.json$/.test(f.path)) { p.push(`改的不是英文版文件：${f.path}`); continue; }
    const a = docs[f.path];
    if (!a) { p.push(`读不出 ${f.path}`); continue; }
    if (a.lang !== "en" || !a.translated_from) p.push(`${f.path} 不是翻译流水线生成的英文版`);
    const left = [];
    const walk = (o, k) => { if (typeof o === "string") { if (CJK.test(o) && !["quote", "zh"].includes(k)) left.push(o.slice(0, 30)); } else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) walk(v, kk); };
    walk(a, "");
    if (left.length) p.push(`${f.path} 还有 ${left.length} 处中文，例如「${left[0]}」`);
  }
  return p;
}

function gh(args) { return execFileSync("gh", args, { encoding: "utf8" }); }

async function main() {
  const args = process.argv.slice(2);
  let pr, article;
  if (args[0] === "--local") {
    pr = JSON.parse(fs.readFileSync(args[1], "utf8"));
    article = JSON.parse(fs.readFileSync(args[2], "utf8"));
  } else {
    const n = args[0];
    if (!/^\d+$/.test(n || "")) throw new Error("要给 PR 编号");
    pr = JSON.parse(gh(["pr", "view", n, "--json", "headRefName,headRefOid,labels,files,author,isCrossRepository"]));
    const repo = process.env.GITHUB_REPOSITORY;
    if (pr.headRefName?.startsWith("translate/")) {
      const docs = {};
      for (const f of pr.files || []) { try { docs[f.path] = JSON.parse(gh(["api", "-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${f.path}?ref=${pr.headRefOid}`])); } catch {} }
      return report(translationProblems(pr, docs));
    }
    const f = (pr.files || [])[0];
    if (f && /^content\/articles\/[a-z0-9-]+\.json$/.test(f.path)) {
      try { article = JSON.parse(gh(["api", "-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${f.path}?ref=${pr.headRefOid}`])); }
      catch { article = null; }
      /* 主分支上没有这个文件，才算新增 */
      try { gh(["api", `repos/${repo}/contents/${f.path}?ref=${process.env.WG_BASE_REF || "main"}`]); pr.fileIsNew = false; }
      catch { pr.fileIsNew = true; }
    }
  }
  report(automergeProblems(pr, article, { sourceTexts: loadSourceTexts(article) }));
}

function report(problems) {
  const ok = problems.length === 0;
  const md = `### 自动合并检查：${ok ? "✅ 符合条件" : "⏸ 不自动合并，等人工"}\n\n${ok ? "全部条件满足。" : problems.map(x => `- ${x}`).join("\n")}\n`;
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${ok}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
