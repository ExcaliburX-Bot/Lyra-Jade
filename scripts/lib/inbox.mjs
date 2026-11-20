/* 素材收件箱 data/inbox/*.json
   X 监测脚本、Grok Bot（用浏览器抓到的内容）都往这里放文件；每次抓取时并入素材库，然后删除文件。
   每个文件是一个数组，每条：
   { title, url, tier, source, publisher, published?, summary?, text?, via?, weight?, category? } */
import fs from "node:fs";
import path from "node:path";
import { dataFile } from "./store.mjs";
import { normalizeUrl, sha } from "./text.mjs";
import { TIER_WEIGHT } from "./score.mjs";

export const INBOX = () => dataFile("inbox");

export function checkInboxItem(it) {
  const problems = [];
  if (!it || typeof it !== "object") return ["不是对象"];
  if (typeof it.title !== "string" || !it.title.trim()) problems.push("缺 title");
  else if (it.title.length > 300) problems.push("title 超过 300 字符");
  if (!/^https?:\/\//.test(it.url || "")) problems.push("url 必须是 http(s) 链接");
  if (!(it.tier in TIER_WEIGHT)) problems.push(`tier 必须是 ${Object.keys(TIER_WEIGHT).join(" / ")}`);
  if (typeof it.source !== "string" || !it.source) problems.push("缺 source（来自哪个监测组或哪个机器人任务）");
  if (it.published && Number.isNaN(Date.parse(it.published))) problems.push("published 不是合法时间");
  if (it.via && !/^https?:\/\//.test(it.via)) problems.push("via 必须是链接");
  return problems;
}

export function writeInbox(name, list) {
  const dir = INBOX();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name.replace(/[^\w.-]+/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + "\n");
  return file;
}

/* 并入素材库：同一链接只保留一条；X 帖子按帖子链接去重，按它指向的一手链接参与合并 */
export function ingestInbox(items, now = new Date().toISOString()) {
  const dir = INBOX();
  const log = [];
  if (!fs.existsSync(dir)) return log;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    const file = path.join(dir, f);
    let list;
    try { list = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { log.push(`✗ 收件箱 ${f}：不是合法 JSON，已保留待人工处理`); continue; }
    if (!Array.isArray(list)) { log.push(`✗ 收件箱 ${f}：应为数组，已保留待人工处理`); continue; }
    let added = 0, bad = 0;
    for (const it of list) {
      const problems = checkInboxItem(it);
      if (problems.length) { bad++; log.push(`  · 跳过「${String(it?.title || "").slice(0, 40)}」：${problems.join("；")}`); continue; }
      const key = normalizeUrl(it.url), id = sha(it.via ? normalizeUrl(it.via) : key);
      if (items[id]) continue;
      items[id] = {
        id, key, title: it.title.trim(), url: it.url, published: it.published || now, summary: it.summary || "",
        ...(it.text ? { text: it.text } : {}), ...(it.via ? { via: it.via } : {}),
        source: it.source, publisher: it.publisher || it.source, tier: it.tier, weight: it.weight ?? 1,
        category_hint: it.category || null, fetched_at: now
      };
      added++;
    }
    fs.rmSync(file);
    log.push(`✓ 收件箱 ${f}：新增 ${added} 条${bad ? `，${bad} 条格式不对已跳过` : ""}`);
  }
  return log;
}
