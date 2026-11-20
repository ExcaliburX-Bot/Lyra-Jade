#!/usr/bin/env node
/* 第 1–3 步：抓取数据源 → 存入素材库 → 去重打分，生成候选清单
   用法：node scripts/fetch.mjs            真实抓取（同时并入 data/inbox/ 里的素材）
         node scripts/fetch.mjs --fixtures 读 test/fixtures 里的样例，不联网 */
import fs from "node:fs";
import path from "node:path";
import { SOURCES, FIXTURES } from "./lib/paths.mjs";
import { readJson, writeJson, dataFile } from "./lib/store.mjs";
import { parseFeed, parseLinks } from "./lib/feed.mjs";
import { normalizeUrl, sha } from "./lib/text.mjs";
import { toCandidates } from "./lib/score.mjs";
import { ingestInbox } from "./lib/inbox.mjs";

const args = process.argv.slice(2);
const useFixtures = args.includes("--fixtures");
const KEEP_DAYS = 14;
const UA = "LyraJadeBot/0.1 (+https://github.com/ExcaliburX-Bot/Lyra-Jade; content curation)";

async function load(src, state) {
  if (useFixtures) {
    const f = path.join(FIXTURES, "feeds", `${src.id}.${src.type === "page" ? "html" : "xml"}`);
    return fs.existsSync(f) ? { body: fs.readFileSync(f, "utf8") } : { skipped: true };
  }
  const headers = { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/html;q=0.8" };
  const st = state[src.id] || {};
  if (st.etag) headers["if-none-match"] = st.etag;
  if (st.lastModified) headers["if-modified-since"] = st.lastModified;
  const res = await fetch(src.url, { headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { body: await res.text(), etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
}

async function main() {
  const sources = readJson(SOURCES, []).filter(s => s.enabled !== false);
  const items = readJson(dataFile("items.json"), {});
  const state = readJson(dataFile("state.json"), {});
  const now = new Date().toISOString();
  const log = [];

  for (const src of sources) {
    try {
      const r = await load(src, state);
      if (r.skipped) { log.push(`· ${src.name}：没有样例，跳过`); continue; }
      if (r.notModified) { log.push(`· ${src.name}：没有更新`); continue; }
      const parsed = src.type === "page" ? parseLinks(r.body, { baseUrl: src.url, pattern: src.pattern, exclude: src.exclude }) : parseFeed(r.body);
      /* 列表页第一次抓：页面上原有的、看不出日期的文章都是旧的，只登记不进候选 */
      const firstPageRun = src.type === "page" && !state[src.id]?.lastOk && !useFixtures;
      let fresh = 0, baseline = 0;
      /* 列表页按「见过的链接」去重：没有日期的文章过了 14 天被清出素材库后，不会因为还挂在页面上又被当成新的 */
      const seenKeys = new Set(state[src.id]?.seen || []);
      const tooOld = useFixtures ? 0 : Date.now() - KEEP_DAYS * 864e5;
      for (const p of parsed.slice(0, src.limit || 30)) {
        if (src.include && !new RegExp(src.include, "i").test(p.title + " " + p.summary)) continue;
        if (p.published && Date.parse(p.published) < tooOld) continue;   /* 超过 14 天的旧文章不进素材库 */
        const key = normalizeUrl(p.url), id = sha(key);
        if (items[id] || seenKeys.has(key)) { seenKeys.add(key); continue; }
        seenKeys.add(key);
        if (firstPageRun && !p.published) { baseline++; continue; }
        items[id] = { id, key, ...p, source: src.id, publisher: src.publisher || src.name, tier: src.tier, weight: src.weight ?? 1, category_hint: src.category || null, fetched_at: now };
        fresh++;
      }
      state[src.id] = { ...state[src.id], etag: r.etag || null, lastModified: r.lastModified || null, lastOk: now, ...(fresh ? { lastNew: now } : {}),
        ...(src.type === "page" ? { seen: [...seenKeys].slice(-500) } : {}) };
      log.push(`✓ ${src.name}：解析 ${parsed.length} 条，新增 ${fresh} 条${baseline ? `，${baseline} 条是首次抓取时页面上已有、看不出日期的旧文章，只登记不进候选` : ""}`);
    } catch (e) {
      state[src.id] = { ...state[src.id], lastError: `${now} ${e.message}` };
      log.push(`✗ ${src.name}：${e.message}`);
    }
  }

  /* X 监测和 Grok Bot 放进收件箱的素材 */
  log.push(...ingestInbox(items, now));

  /* 只保留最近 14 天 */
  const cutoff = useFixtures ? 0 : Date.now() - KEEP_DAYS * 864e5;
  for (const [id, it] of Object.entries(items)) if (Date.parse(it.published || it.fetched_at) < cutoff) delete items[id];

  const drafted = new Set([...readJson(dataFile("drafted.json"), []), ...readJson(dataFile("skip.json"), []).map(s => s.id)]);
  const candidates = toCandidates(Object.values(items)).filter(c => !drafted.has(c.id)).slice(0, 40);

  /* 超过 30 天没有新内容的源，提醒检查地址是否失效 */
  const stale = sources.filter(s => state[s.id]?.lastOk && (!state[s.id].lastNew || Date.now() - Date.parse(state[s.id].lastNew) > 30 * 864e5)).map(s => s.name);

  writeJson(dataFile("items.json"), items);
  writeJson(dataFile("state.json"), state);
  writeJson(dataFile("candidates.json"), candidates);
  fs.writeFileSync(dataFile("candidates.md"),
    `# 候选清单（${now.slice(0, 16).replace("T", " ")} UTC）\n\n| 分数 | 标题 | 发布方 | 层级 | 相关报道 |\n| --- | --- | --- | --- | --- |\n` +
    candidates.map(c => `| ${c.score} | [${c.title.replace(/\|/g, "/")}](${c.url}) | ${c.publisher} | ${c.tier} | ${c.related.length} |`).join("\n") +
    (stale.length ? `\n\n**超过 30 天没有新内容的源**：${stale.join("、")}\n` : "\n"));

  console.log(log.join("\n"));
  console.log(`\n素材库 ${Object.keys(items).length} 条，候选 ${candidates.length} 个，最高分：${candidates[0]?.title || "无"}`);
}

main().catch(e => { console.error(e); process.exit(1); });
