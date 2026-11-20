#!/usr/bin/env node
/* 给维护机器人（Grok Bot）用的小工具。所有命令只读，或只写 data/inbox/，不改文章和代码。
   node scripts/bot.mjs status                    当前状况：候选、源健康、收件箱、用量
   node scripts/bot.mjs inbox-add --title T --url U --tier official --publisher P [--published ISO] [--summary S] [--category product] [--source bot:browser]
   node scripts/bot.mjs source-test --url U [--type rss|page] [--pattern 正则]     试抓一个源，看能解析出什么
   node scripts/bot.mjs source-test --id <sources.json 里的 id>
   node scripts/bot.mjs skip <候选ID> --reason "为什么不写"   标记不写，定时写稿会跳过它
   node scripts/bot.mjs weekly [--days 7]         周报（Markdown），可以直接贴进 GitHub Issue */
import fs from "node:fs";
import path from "node:path";
import { SOURCES, X_ACCOUNTS, CONTENT } from "./lib/paths.mjs";
import { readJson, dataFile } from "./lib/store.mjs";
import { parseFeed, parseLinks } from "./lib/feed.mjs";
import { checkInboxItem, writeInbox, INBOX } from "./lib/inbox.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const arg = (k, d = null) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const DAY = 864e5;

function health(now = Date.now()) {
  const state = readJson(dataFile("state.json"), {});
  const rows = [];
  const add = (id, name, enabled) => {
    const s = state[id] || {};
    const ok = s.lastOk ? Date.parse(s.lastOk) : 0;
    const err = s.lastError ? Date.parse(s.lastError.slice(0, 24)) : 0;
    let status = "正常";
    if (!enabled) status = "停用";
    else if (!ok && !err) status = "还没跑过";
    else if (err > ok) status = `失败：${s.lastError.slice(25, 120)}`;
    else if (!s.lastNew || now - Date.parse(s.lastNew) > 30 * DAY) status = "30 天没有新内容";
    rows.push({ id, name, status, lastNew: s.lastNew?.slice(0, 10) || "—" });
  };
  for (const s of readJson(SOURCES, [])) add(s.id, s.name, s.enabled !== false);
  for (const g of readJson(X_ACCOUNTS, [])) add(`x:${g.id}`, g.name, g.enabled !== false);
  return rows;
}

function articles() {
  if (!fs.existsSync(CONTENT)) return [];
  return fs.readdirSync(CONTENT).filter(f => f.endsWith(".json")).map(f => readJson(path.join(CONTENT, f))).filter(Boolean);
}

function usageSum(days, now = Date.now()) {
  const u = readJson(dataFile("usage.json"), {});
  let posts = 0;
  for (const [d, v] of Object.entries(u)) if (now - Date.parse(d) < days * DAY) posts += v.x_posts_fetched || 0;
  return posts;
}

const table = (head, rows) => `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n` + rows.map(r => `| ${r.map(c => String(c).replace(/\|/g, "/")).join(" | ")} |`).join("\n");

function status() {
  const cands = readJson(dataFile("candidates.json"), []);
  const drafted = new Set([...readJson(dataFile("drafted.json"), []), ...readJson(dataFile("skip.json"), []).map(s => s.id)]);
  const open = cands.filter(c => !drafted.has(c.id)).slice(0, 12);
  const h = health();
  const bad = h.filter(r => !["正常", "停用"].includes(r.status));
  const inbox = fs.existsSync(INBOX()) ? fs.readdirSync(INBOX()).filter(f => f.endsWith(".json")).length : 0;
  console.log(`# 玲珑玉状态（${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC）\n`);
  console.log(`## 待写候选（前 ${open.length} 个，没写过的）\n`);
  console.log(open.length ? table(["ID", "分数", "层级", "标题", "发布方", "相关"], open.map(c => [c.id, c.score, c.tier, `[${c.title.slice(0, 70)}](${c.url})`, c.publisher, c.related.length])) : "没有。");
  console.log(`\n## 需要处理的源（${bad.length} 个）\n`);
  console.log(bad.length ? table(["ID", "名称", "状态", "最近有新内容"], bad.map(r => [r.id, r.name, r.status, r.lastNew])) : "全部正常。");
  console.log(`\n## 其他\n\n- 收件箱里待并入的文件：${inbox} 个（下次「抓取」时并入）\n- 近 7 天 X 搜索抓取帖子：${usageSum(7)} 条\n- 已发布文章：${articles().filter(a => a.status === "published").length} 篇`);
}

function inboxAdd() {
  const it = {
    title: arg("--title"), url: arg("--url"), tier: arg("--tier"), publisher: arg("--publisher"),
    source: arg("--source", "bot:browser"), published: arg("--published", new Date().toISOString()),
    ...(arg("--summary") ? { summary: arg("--summary") } : {}), ...(arg("--category") ? { category: arg("--category") } : {})
  };
  const problems = checkInboxItem(it);
  if (problems.length) { console.error(`没有写入：${problems.join("；")}`); process.exit(1); }
  const file = writeInbox(`bot-${new Date().toISOString().replace(/[:.]/g, "")}`, [it]);
  console.log(`已写入 ${path.relative(process.cwd(), file)}。用 bash scripts/ci/commit-data.sh "bot: 收件箱" 推送到 data 分支。`);
}

async function sourceTest() {
  let src;
  if (arg("--id")) {
    src = readJson(SOURCES, []).find(s => s.id === arg("--id"));
    if (!src) { console.error(`sources.json 里没有 ${arg("--id")}`); process.exit(1); }
  } else src = { url: arg("--url"), type: arg("--type", "rss"), pattern: arg("--pattern") };
  if (!/^https?:\/\//.test(src.url || "")) { console.error("要给 --url 或 --id"); process.exit(1); }
  const res = await fetch(src.url, { headers: { "user-agent": "LyraJadeBot/0.1 (source check)" }, signal: AbortSignal.timeout(20_000) });
  console.log(`HTTP ${res.status} ${res.headers.get("content-type") || ""}`);
  if (!res.ok) process.exit(1);
  const body = await res.text();
  const items = src.type === "page" ? parseLinks(body, { baseUrl: src.url, pattern: src.pattern }) : parseFeed(body);
  console.log(`解析出 ${items.length} 条${src.type === "page" && !src.pattern ? "（page 类型最好给 --pattern，否则会抓到导航链接）" : ""}`);
  for (const i of items.slice(0, 10)) console.log(`- ${i.published?.slice(0, 10) || "无日期"}  ${i.title.slice(0, 80)}\n  ${i.url}`);
  if (!items.length) process.exit(2);
}

function weekly() {
  const days = Number(arg("--days", 7)), now = Date.now();
  const since = new Date(now - days * DAY).toISOString().slice(0, 10);
  const pub = articles().filter(a => a.status === "published" && a.date >= since).sort((a, b) => b.date.localeCompare(a.date));
  const h = health();
  const bad = h.filter(r => !["正常", "停用"].includes(r.status));
  const byCat = {};
  for (const a of pub) byCat[a.category] = (byCat[a.category] || 0) + 1;
  console.log(`# 玲珑玉周报：${since} 至 ${new Date(now).toISOString().slice(0, 10)}\n`);
  console.log(`## 发布\n\n共 ${pub.length} 篇，其中已核对 ${pub.filter(a => a.verified).length} 篇。按栏目：${Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join("、") || "无"}。\n`);
  if (pub.length) console.log(table(["日期", "标题", "主材料层级", "写稿模型"], pub.map(a => [a.date, a.title, a.pipeline?.tier || "—", a.pipeline?.model || "—"])) + "\n");
  const skips = readJson(dataFile("skip.json"), []).filter(x => Date.parse(x.at) > now - days * DAY);
  console.log(`## 标记不写的候选（${skips.length} 个）\n`);
  if (skips.length) console.log(table(["标题", "原因"], skips.map(x => [x.title, x.reason])) + "\n");
  console.log(`## 数据源\n\n启用 ${h.filter(r => r.status !== "停用").length} 个，需要处理 ${bad.length} 个。\n`);
  if (bad.length) console.log(table(["ID", "名称", "状态"], bad.map(r => [r.id, r.name, r.status])) + "\n");
  console.log(`## 用量\n\n- X 搜索抓取帖子：${usageSum(days, now)} 条（xAI 价目约每千条 5 美元，另加 token 费）\n`);
  console.log(`## 需要人决定的事\n\n（机器人在这里列出：被退回的稿子有什么共同问题、建议改写作规则的地方、建议新增或停用的源。）`);
}

function skip() {
  const id = rest[0], reason = arg("--reason");
  const cands = readJson(dataFile("candidates.json"), []);
  if (!cands.some(c => c.id === id)) { console.error(`候选清单里没有 ${id}`); process.exit(1); }
  if (!reason) { console.error("要写 --reason，方便周报复盘"); process.exit(1); }
  const list = readJson(dataFile("skip.json"), []).filter(s => s.id !== id);
  list.push({ id, reason, title: cands.find(c => c.id === id).title, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(dataFile("skip.json")), { recursive: true });
  fs.writeFileSync(dataFile("skip.json"), JSON.stringify(list.slice(-500), null, 2) + "\n");
  console.log(`已标记不写：${id}。用 bash scripts/ci/commit-data.sh "bot: 跳过候选" 推送。`);
}

const commands = { status, skip, "inbox-add": inboxAdd, "source-test": sourceTest, weekly };
if (!commands[cmd]) { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 8).join("\n")); process.exit(cmd ? 1 : 0); }
await commands[cmd]();
