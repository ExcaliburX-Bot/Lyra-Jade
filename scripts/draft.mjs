#!/usr/bin/env node
/* 第 4–6 步：回溯主材料 → AI 写稿和配图 → 自动校验
   用法：node scripts/draft.mjs --top 2           写分数最高、还没写过的 2 个候选
         node scripts/draft.mjs --id <候选ID>      指定一个候选
         node scripts/draft.mjs --top 1 --mock    不联网、不调模型，用样例跑通流程 */
import fs from "node:fs";
import path from "node:path";
import { CONTENT, PROMPTS, ROOT, FIXTURES } from "./lib/paths.mjs";
import { readJson, writeJson, dataFile } from "./lib/store.mjs";
import { htmlToText, sha } from "./lib/text.mjs";
import { writeArticle, DEFAULT_MODEL, PROVIDER } from "./lib/llm.mjs";
import { validateArticle, reportMarkdown } from "./lib/validate.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const mock = args.includes("--mock");
const top = Number(arg("--top", 1));
const only = arg("--id", null);
const minScore = Number(arg("--min-score", 4));

const isXPost = url => /^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(url);

/* 主材料存档。X 帖子打不开网页，用 X 监测时拿到的帖子原文代替 */
async function sourceText(url, postText = null) {
  const file = dataFile(`sources/${sha(url)}.txt`);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  if (isXPost(url)) {
    if (!postText) throw new Error("X 帖子没有原文，无法回溯");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `URL: ${url}\nFETCHED: ${new Date().toISOString()}\nNOTE: X 帖子原文，由 X 监测（Grok X 搜索）返回\n\n${postText}`);
    return postText;
  }
  let html;
  if (mock) html = fs.readFileSync(path.join(FIXTURES, "pages/source.html"), "utf8");
  else {
    const res = await fetch(url, { headers: { "user-agent": "LyraJadeBot/0.1" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`主材料打不开：HTTP ${res.status}`);
    html = await res.text();
  }
  const text = htmlToText(html).slice(0, 60_000);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `URL: ${url}\nFETCHED: ${new Date().toISOString()}\n\n${text}`);
  return text;
}

function slugify(a, c) {
  if (/^[a-z0-9-]{3,80}$/.test(a.slug || "")) return a.slug;
  const last = new URL(c.url).pathname.split("/").filter(Boolean).pop() || "post";
  return (last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post") + "-" + c.id.slice(0, 4);
}

async function main() {
  const system = fs.readFileSync(path.join(PROMPTS, "writer.md"), "utf8");
  const schema = readJson(path.join(ROOT, "schema/article.schema.json"));
  const drafted = readJson(dataFile("drafted.json"), []);
  /* 机器人或编辑标记「不写」的候选（data/skip.json）也跳过；--id 指定时不受影响 */
  const skipped = new Set(readJson(dataFile("skip.json"), []).map(s => s.id));
  let list = readJson(dataFile("candidates.json"), []).filter(c => !drafted.includes(c.id) && (only || !skipped.has(c.id)));
  list = only ? list.filter(c => c.id === only) : list.filter(c => c.score >= minScore).slice(0, top);
  if (!list.length) { console.log("没有需要写的候选"); return; }

  const made = [];
  for (const c of list) {
    console.log(`\n▶ ${c.title}（${c.score} 分）`);
    try {
      /* 主材料必须是一手来源；相关报道里的官方 / 原始材料也一起给模型 */
      const texts = { [c.url]: await sourceText(c.url, c.text) };
      for (const r of c.related.filter(r => ["official", "primary"].includes(r.tier)).slice(0, 2)) {
        try { texts[r.url] = await sourceText(r.url, r.text); } catch (e) { console.log(`  相关材料跳过：${e.message}`); }
      }
      const user = [
        `今天日期：${new Date().toISOString().slice(0, 10)}`,
        `选题：${c.title}`,
        `主材料：${c.url}（${c.publisher}，${c.published}）`,
        c.category_hint ? `栏目建议：${c.category_hint}` : "",
        ...Object.entries(texts).map(([u, t]) => `\n<source url="${u}">\n${t}\n</source>`)
      ].filter(Boolean).join("\n");

      const a = await writeArticle({ system, user, schema, mock });
      a.slug = slugify(a, c);
      /* 不覆盖已有文章：撞名时加候选 ID 后缀 */
      if (fs.existsSync(path.join(CONTENT, `${a.slug}.json`))) a.slug = `${a.slug.slice(0, 70)}-${c.id.slice(0, 6)}`;
      a.date ||= (c.published || new Date().toISOString()).slice(0, 10);
      a.status = "published";        // 合并进 main 即发布；审核在合并请求里完成
      a.verified = false;            // 编辑核对后改成 true，页面才显示「已核对」
      a.publisher ||= c.publisher;
      a.sources ||= {};
      a.sources.main ||= { title: c.title, publisher: c.publisher, date: (c.published || "").slice(0, 10), url: c.url };
      a.pipeline = { origin: mock ? "mock" : "auto", candidate: c.id, tier: c.tier, via: c.via || null, provider: mock ? "mock" : PROVIDER, model: mock ? "mock" : DEFAULT_MODEL, generated_at: new Date().toISOString() };

      const r = validateArticle(a, { sourceTexts: texts });
      const file = path.join(CONTENT, `${a.slug}.json`);
      writeJson(file, a);
      fs.mkdirSync(dataFile("reports"), { recursive: true });
      fs.writeFileSync(dataFile(`reports/${a.slug}.md`), reportMarkdown(a, r));
      drafted.push(c.id);
      made.push({ slug: a.slug, title: a.title, file: path.relative(ROOT, file), errors: r.errors.length, warnings: r.warnings.length });
      console.log(`  已写入 ${path.relative(ROOT, file)}：${r.errors.length} 个必须修改，${r.warnings.length} 个待确认`);
    } catch (e) {
      console.log(`  ✗ 失败：${e.message}`);
    }
  }
  writeJson(dataFile("drafted.json"), drafted);
  writeJson(dataFile("new-drafts.json"), made);
}

main().catch(e => { console.error(e); process.exit(1); });
