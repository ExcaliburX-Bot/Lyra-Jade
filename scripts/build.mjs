#!/usr/bin/env node
/* 第 8 步：把 content/articles 里的文章生成静态网站到 dist/
   首页 index.html、每篇 a/<slug>.html、订阅源 rss.xml */
import fs from "node:fs";
import path from "node:path";
import { CONTENT, DIST, SITE } from "./lib/paths.mjs";
import { readJson } from "./lib/store.mjs";
import { sha } from "./lib/text.mjs";
import { renderArticleBody, esc } from "../site/assets/components.js";

const SITE_NAME = "WeiGuang.AI";
const SITE_URL = (process.env.WG_SITE_URL || "https://example.com").replace(/\/$/, "");
const CAT_NAME = { product: "产品发布", research: "研究解读", deep: "深度", biz: "商业动态", howto: "AI 实操", visual: "商业视觉实战", insight: "洞察", other: "其他" };

const tpl = fs.readFileSync(path.join(SITE, "templates/page.html"), "utf8");
const listing = fs.readFileSync(path.join(SITE, "templates/listing.html"), "utf8");
const page = v => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? "");
const safeJson = x => JSON.stringify(x).replace(/</g, "\\u003c");
const textLen = a => (a.sections || []).flatMap(s => s.blocks.map(b => b.p || (b.list || []).join(""))).join("").length;

const articles = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter(f => f.endsWith(".json"))
  .map(f => readJson(path.join(CONTENT, f))).filter(a => a && a.status === "published")
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)) : [];

const index = articles.map((a, i) => ({
  id: a.slug, no: a.no ?? articles.length - i, slug: a.slug, date: a.date, cat: a.category, co: a.publisher, title: a.title, summary: a.summary,
  min: a.readMinutes || Math.max(3, Math.ceil(textLen(a) / 450)), verified: !!a.verified, pod: null,
  v: parseInt(sha(a.slug, 4), 16) % 5, h: parseInt(sha(a.slug + "h", 4), 16) % 360
}));
const featured = (articles.find(a => a.verified) || articles[0])?.slug || null;
const today = new Date().toISOString().slice(0, 10);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "a"), { recursive: true });
fs.cpSync(path.join(SITE, "assets"), path.join(DIST, "assets"), { recursive: true });

/* 首页 */
fs.writeFileSync(path.join(DIST, "index.html"), page({
  TITLE: `AI 解读 · ${SITE_NAME}`, DESC: "每天把最值得看的 AI 新动态讲清楚。", BASE: "./", BODYCLASS: "",
  MAIN: listing, DATA: safeJson({ articles: index, featured, today })
}));

/* 文章页 */
for (const a of articles) {
  const rel = articles.filter(x => x.slug !== a.slug && x.category === a.category).slice(0, 4);
  const main = `<article class="reader" id="reader">
    <a href="../index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>返回 AI 解读</a>
    <div class="tags"><span class="tag">${esc(CAT_NAME[a.category] || a.category)}</span>${a.verified ? `<span class="verified"><svg class="i"><use href="#i-check"/></svg>已核对</span>` : `<span class="muted">待核对</span>`}</div>
    <h1>${esc(a.title)}</h1>
    <div class="rmeta"><span>${esc(a.date)}</span><span>约 ${index.find(x => x.slug === a.slug).min} 分钟</span><span>来源 ${esc(a.publisher)}</span></div>
    ${renderArticleBody(a)}
    ${rel.length ? `<div class="rel"><h3>继续读</h3><div class="toc">${rel.map(x => `<a href="${x.slug}.html"><span>${x.date.slice(5)}</span><span>${esc(x.title)}</span><span>${esc(CAT_NAME[x.category] || "")}</span></a>`).join("")}</div></div>` : ""}
  </article>`;
  fs.writeFileSync(path.join(DIST, "a", `${a.slug}.html`), page({
    TITLE: `${esc(a.title)} · ${SITE_NAME}`, DESC: esc(a.summary), BASE: "../", BODYCLASS: "reading",
    MAIN: main, DATA: safeJson({ articles: index, featured, today })
  }));
}

/* RSS */
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${SITE_NAME} · AI 解读</title><link>${SITE_URL}/</link><description>每天把最值得看的 AI 新动态讲清楚</description>
${articles.slice(0, 30).map(a => `<item><title>${esc(a.title)}</title><link>${SITE_URL}/a/${a.slug}.html</link><guid>${SITE_URL}/a/${a.slug}.html</guid><pubDate>${new Date(a.date + "T08:00:00Z").toUTCString()}</pubDate><description>${esc(a.summary)}</description></item>`).join("\n")}
</channel></rss>`;
fs.writeFileSync(path.join(DIST, "rss.xml"), rss);

console.log(`已生成 ${articles.length} 篇文章 → ${path.relative(process.cwd(), DIST) || DIST}`);
