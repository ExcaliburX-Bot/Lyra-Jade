#!/usr/bin/env node
/* X 监测：用 Grok API 的 X 搜索，看监测组里的账号最近发了什么，把「宣布了新东西」的帖子放进收件箱
   用法：node scripts/x-watch.mjs                 所有启用的组（需要 XAI_API_KEY）
         node scripts/x-watch.mjs --group x-labs-cn
         node scripts/x-watch.mjs --hours 30       往回看多久，默认 30 小时
         node scripts/x-watch.mjs --mock           读 test/fixtures/xai/<组>.json，不联网
   防编造：只收 Grok 在搜索中真正引用过的帖子链接，且发帖账号必须在本组名单里 */
import fs from "node:fs";
import path from "node:path";
import { X_ACCOUNTS, FIXTURES } from "./lib/paths.mjs";
import { readJson, writeJson, dataFile } from "./lib/store.mjs";
import { xSearch, XAI_SEARCH_MODEL } from "./lib/llm.mjs";
import { writeInbox } from "./lib/inbox.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const mock = args.includes("--mock");
const only = arg("--group", null);
const hours = Number(arg("--hours", 30));

const SYSTEM = `你是 AI 资讯站的线索员。用 x_search 工具查看指定账号在指定日期范围内自己发的帖子，挑出「宣布了具体新东西」的帖子：新模型、新产品或新功能、开源发布、论文或技术报告、价格或配额变化、重要合作。
跳过：回复别人的帖子、转发他人内容、日常闲聊、观点评论、招聘、活动宣传、梗图。

只输出一个 JSON 代码块，不要别的文字：
\`\`\`json
{"posts":[{"handle":"不带 @ 的账号","post_url":"https://x.com/账号/status/数字","posted_at":"ISO 8601 时间","title":"用帖子原文的语言，一句话说清宣布了什么，不超过 100 个字符","text":"帖子原文，逐字照抄，不翻译、不改写、不补充","link":"帖子里指向一手材料（官方博客、论文、代码仓库、模型页）的完整链接；没有就填空字符串"}]}
\`\`\`
最多 15 条。post_url 必须是你这次通过 x_search 实际看到的帖子，不能凭记忆填写。没有符合条件的帖子就输出 {"posts":[]}。`;

const DISCOVER = `\n这组账号是研究者和评论者，不是官方。只收「在介绍一个具体的新发布、并附上了一手链接」的帖子；没有 link 的不要收。`;

export function extractJson(text) {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = block ? block[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return null; }
}

const POST_RE = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/;
const statusId = u => (String(u).match(/\/status\/(\d+)/) || [])[1] || null;

async function resolveLink(link) {
  if (!link || !/^https?:\/\//.test(link)) return null;
  let u;
  try { u = new URL(link); } catch { return null; }
  if (/(^|\.)(x|twitter)\.com$/.test(u.hostname)) return null;
  if (u.hostname === "t.co") {
    if (mock) return null;
    try {
      const res = await fetch(link, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
      return /(^|\.)(x|twitter)\.com$/.test(new URL(res.url).hostname) ? null : res.url;
    } catch { return null; }
  }
  return u.href;
}

/* 把模型的回答变成收件箱条目；返回 { items, dropped: [原因] } */
export async function postsToItems(group, answer, citations, now = new Date()) {
  const allowedHandles = new Set(group.handles.map(h => h.toLowerCase()));
  const cited = new Set(citations.map(statusId).filter(Boolean));
  const items = [], dropped = [];
  const posts = Array.isArray(answer?.posts) ? answer.posts.slice(0, 15) : null;
  if (!posts) return { items, dropped: ["回答里没有 posts 数组"] };
  for (const p of posts) {
    const m = String(p.post_url || "").match(POST_RE);
    if (!m) { dropped.push(`链接格式不对：${p.post_url}`); continue; }
    const id = m[2];
    const handle = (m[1] === "i" ? String(p.handle || "") : m[1]).replace(/^@/, "");
    if (!cited.has(id)) { dropped.push(`没有出现在搜索引用里（可能是编的）：${p.post_url}`); continue; }
    if (!allowedHandles.has(handle.toLowerCase())) { dropped.push(`不是本组账号 @${handle}：${p.post_url}`); continue; }
    if (!p.title || typeof p.title !== "string") { dropped.push(`缺标题：${p.post_url}`); continue; }
    const link = await resolveLink(p.link);
    if (group.mode === "discover" && !link) { dropped.push(`发现类帖子没有一手链接：${p.post_url}`); continue; }
    const postUrl = `https://x.com/${handle}/status/${id}`;
    const published = Number.isNaN(Date.parse(p.posted_at)) ? now.toISOString() : new Date(p.posted_at).toISOString();
    const text = typeof p.text === "string" && p.text.trim() ? p.text.trim() : p.title;
    items.push({
      title: p.title.trim().slice(0, 300), url: link || postUrl, via: postUrl, published,
      summary: text.slice(0, 300), text, source: group.id, publisher: `@${handle}`,
      tier: group.tier, weight: group.weight ?? 1, ...(group.category ? { category: group.category } : {})
    });
  }
  return { items, dropped };
}

async function main() {
  const groups = readJson(X_ACCOUNTS, []).filter(g => (only ? g.id === only : g.enabled !== false));
  if (!groups.length) { console.log("没有要监测的组"); return; }
  if (!mock && !process.env.XAI_API_KEY) { console.log("没有设置 XAI_API_KEY，跳过 X 监测"); return; }

  const state = readJson(dataFile("state.json"), {});
  const usage = readJson(dataFile("usage.json"), {});
  const now = new Date(), nowIso = now.toISOString();
  const day = d => d.toISOString().slice(0, 10);
  const fromDate = day(new Date(now - hours * 3600e3)), toDate = day(new Date(+now + 864e5));

  for (const g of groups) {
    const key = `x:${g.id}`;
    try {
      let mockFile = null;
      if (mock) {
        mockFile = path.join(FIXTURES, "xai", `${g.id}.json`);
        if (!fs.existsSync(mockFile)) { console.log(`· ${g.name}：没有样例，跳过`); continue; }
      }
      const user = `账号：${g.handles.map(h => "@" + h).join("、")}\n日期：${fromDate} 到 ${toDate}（UTC，不含结束日）${g.mode === "discover" ? DISCOVER : ""}`;
      const r = await xSearch({ system: SYSTEM, user, handles: g.handles, fromDate, toDate, mockFile });
      const { items, dropped } = await postsToItems(g, extractJson(r.text), r.citations, now);
      if (items.length) writeInbox(`x-${nowIso.replace(/[:.]/g, "")}-${g.id}`, items);

      const u = (usage[day(now)] ||= {});
      u.x_search_calls = (u.x_search_calls || 0) + (r.usage?.x_search_calls || 0);
      u.x_posts_fetched = (u.x_posts_fetched || 0) + (r.usage?.x_posts_fetched || 0);
      u.x_users_fetched = (u.x_users_fetched || 0) + (r.usage?.x_users_fetched || 0);

      state[key] = { ...state[key], lastOk: nowIso, ...(items.length ? { lastNew: nowIso } : {}), lastDropped: dropped.length };
      console.log(`✓ ${g.name}：收 ${items.length} 条，丢弃 ${dropped.length} 条（引用 ${r.citations.length} 个，抓取帖子 ${r.usage?.x_posts_fetched ?? "?"} 条）`);
      for (const d of dropped) console.log(`    · 丢弃：${d}`);
    } catch (e) {
      state[key] = { ...state[key], lastError: `${nowIso} ${e.message}` };
      console.log(`✗ ${g.name}：${e.message}`);
    }
  }
  writeJson(dataFile("state.json"), state);
  writeJson(dataFile("usage.json"), usage);
  console.log(`\n模型 ${mock ? "mock" : XAI_SEARCH_MODEL}；今日 X 搜索累计抓取帖子 ${usage[day(now)]?.x_posts_fetched ?? 0} 条（按 xAI 价目约每千条 5 美元）`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
