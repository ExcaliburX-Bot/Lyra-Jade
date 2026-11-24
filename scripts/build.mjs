#!/usr/bin/env node
/* 第 8 步：把 content/articles 里的文章生成静态网站到 dist/
   首页 index.html、每篇 a/<slug>.html、关于页 about.html、订阅源 rss.xml、sitemap.xml、robots.txt、404.html，
   以及给 App 和第三方用的只读内容 API：api/v1/{index,articles,categories}.json、api/v1/articles/<slug>.json */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { CONTENT, DIST, SITE, ROOT } from "./lib/paths.mjs";
import { readJson } from "./lib/store.mjs";
import { sha } from "./lib/text.mjs";
import { renderArticleBody, esc } from "../site/assets/components.js";

const SITE_NAME = "玲珑玉 Lyra-Jade";
const SITE_URL = (process.env.WG_SITE_URL || "https://example.com").replace(/\/$/, "");
/* Cloudflare Web Analytics 的站点令牌（仓库变量 WG_CF_ANALYTICS）；没配就不加统计脚本 */
const CF = (process.env.WG_CF_ANALYTICS || "").trim();
const ANALYTICS = /^[A-Za-z0-9]{16,64}$/.test(CF) ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF}"}'></script>` : "";
const CONTACT = (process.env.WG_CONTACT_EMAIL || "").trim();
const OGIMAGE = `${SITE_URL}/assets/og.png`;
const CAT_NAME = { product: "产品发布", research: "研究解读", deep: "深度", biz: "商业动态", howto: "AI 实操", visual: "商业视觉实战", insight: "洞察", other: "其他" };

const tpl = fs.readFileSync(path.join(SITE, "templates/page.html"), "utf8");
const listing = fs.readFileSync(path.join(SITE, "templates/listing.html"), "utf8");
const page = v => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => ({ ANALYTICS, OGIMAGE, OGTYPE: "website", ...v })[k] ?? "");
const safeJson = x => JSON.stringify(x).replace(/</g, "\\u003c");
const textLen = a => (a.sections || []).flatMap(s => s.blocks.map(b => b.p || (b.list || []).join(""))).join("").length;

/* 排序按「在本站上线的时间」，不按原文日期：晚几天才写的稿子也排在最前面，原文日期另外显示。
   上线时间取这篇文章文件第一次进入仓库的提交时间（部署时要完整历史：deploy.yml 的 fetch-depth: 0）；取不到就退回原文日期 */
const firstCommit = file => {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--format=%cI", "--", file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").filter(Boolean);
    return out.length ? out[out.length - 1] : null;
  } catch { return null; }
};
const bjDay = iso => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
const articles = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter(f => f.endsWith(".json"))
  .map(f => { const a = readJson(path.join(CONTENT, f)); if (a) a._pub = firstCommit(path.join(CONTENT, f)) || `${a.date}T00:00:00+08:00`; return a; })
  .filter(a => a && a.status === "published")
  .sort((a, b) => b._pub.localeCompare(a._pub) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title)) : [];
for (const a of articles) a._day = bjDay(a._pub);

const index = articles.map((a, i) => ({
  id: a.slug, no: a.no ?? articles.length - i, slug: a.slug, date: a._day, src: a.date, cat: a.category, co: a.publisher, title: a.title, summary: a.summary,
  min: a.readMinutes || Math.max(3, Math.ceil(textLen(a) / 450)), verified: !!a.verified, pod: null,
  v: parseInt(sha(a.slug, 4), 16) % 5, h: parseInt(sha(a.slug + "h", 4), 16) % 360
}));
/* 今日精选：最新上线的一篇（人工核对过的优先，但只在最近两天内找） */
const featured = (articles.find(a => a.verified && a._day >= bjDay(new Date(Date.now() - 2 * 864e5).toISOString())) || articles[0])?.slug || null;
const today = new Date().toISOString().slice(0, 10);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "a"), { recursive: true });
fs.cpSync(path.join(SITE, "assets"), path.join(DIST, "assets"), { recursive: true });

/* 首页 */
fs.writeFileSync(path.join(DIST, "index.html"), page({
  TITLE: `AI 解读 · ${SITE_NAME}`, DESC: "每天从一手来源挑出值得讲的 AI 发布，用文字和动态图讲透。", BASE: "./", BODYCLASS: "", URL: `${SITE_URL}/`,
  MAIN: listing, DATA: safeJson({ articles: index, featured, today })
}));

/* 文章页 */
for (const a of articles) {
  const rel = articles.filter(x => x.slug !== a.slug && x.category === a.category).slice(0, 4);
  const main = `<article class="reader" id="reader">
    <a href="../index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>返回 AI 解读</a>
    <div class="tags"><span class="tag">${esc(CAT_NAME[a.category] || a.category)}</span>${a.verified ? `<span class="verified"><svg class="i"><use href="#i-check"/></svg>人工已核对</span>` : `<a class="muted" href="../about.html#ai">AI 辅助撰写</a>`}</div>
    <h1>${esc(a.title)}</h1>
    <div class="rmeta"><span>${esc(a._day)} 发布</span>${a.date !== a._day ? `<span>原文 ${esc(a.date)}</span>` : ""}<span>约 ${index.find(x => x.slug === a.slug).min} 分钟</span><span>来源 ${esc(a.publisher)}</span></div>
    ${renderArticleBody(a)}
    <aside class="disclose"><svg class="i"><use href="#i-info"/></svg><p>本文由 AI 辅助撰写，依据上方列出的一手来源，关键数字已与原文核对${a.verified ? "，并经编辑通读" : ""}。如有出入，请以原文为准。<a href="../about.html#ai">关于我们的内容</a>${CONTACT ? ` · 发现错误请写信到 <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : ""}</p></aside>
    ${rel.length ? `<div class="rel"><h3>继续读</h3><div class="toc">${rel.map(x => `<a href="${x.slug}.html"><span>${x.date.slice(5)}</span><span>${esc(x.title)}</span><span>${esc(CAT_NAME[x.category] || "")}</span></a>`).join("")}</div></div>` : ""}
  </article>`;
  fs.writeFileSync(path.join(DIST, "a", `${a.slug}.html`), page({
    TITLE: `${esc(a.title)} · ${SITE_NAME}`, DESC: esc(a.summary), BASE: "../", BODYCLASS: "reading", URL: `${SITE_URL}/a/${a.slug}.html`, OGTYPE: "article",
    MAIN: main, DATA: safeJson({ articles: index, featured, today })
  }));
}

/* RSS */
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${SITE_NAME} · AI 解读</title><link>${SITE_URL}/</link><description>每天把最值得看的 AI 新动态讲清楚</description>
${articles.slice(0, 30).map(a => `<item><title>${esc(a.title)}</title><link>${SITE_URL}/a/${a.slug}.html</link><guid>${SITE_URL}/a/${a.slug}.html</guid><pubDate>${new Date(a._pub).toUTCString()}</pubDate><description>${esc(a.summary)}</description></item>`).join("\n")}
</channel></rss>`;
fs.writeFileSync(path.join(DIST, "rss.xml"), rss);

/* 关于页 */
const about = `<article class="reader about" id="reader">
  <a href="index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>返回 AI 解读</a>
  <h1>关于玲珑玉</h1>
  <p class="lede">玲珑玉 Lyra-Jade 每天从厂商官方博客、论文和官方账号里挑出值得讲的 AI 发布，用文字和动态图把它拆开讲透：发生了什么、为什么重要、对谁有用。</p>
  <h2>我们只写有一手来源的事</h2>
  <p class="body">每篇解读的主材料都是官方公告、论文、模型卡或代码仓库，文末列出原文链接。我们不转述二手报道，不追融资传闻，也不替你下「颠覆」「最强」这类结论。</p>
  <h2 id="ai">内容怎么来</h2>
  <p class="body">我们的解读由 AI 辅助撰写，并在每篇文章上明确标注。每篇都以文末列出的一手原文为依据，文中的关键数字会与原文逐条核对，对不上的不发布。</p>
  <p class="body">经编辑逐篇读过的文章会标注「人工已核对」。如果文章和原文有出入，请以原文为准。</p>
  <h2>页面上的标记</h2>
  <ul class="body">
    <li><b>AI 辅助撰写</b>：关键数字已与原文核对。</li>
    <li><b>人工已核对</b>：编辑对照原文通读过。</li>
    <li><b>示意图</b>：图里的例子用来说明结构，不是原文给出的数据；真实数据图会注明来源。</li>
  </ul>
  <h2>订阅与数据</h2>
  <p class="body">用 <a href="rss.xml">RSS</a> 订阅最新解读。全部文章也以 JSON 形式公开在 <a href="api/v1/articles.json">内容 API</a>，供 App 和工具读取。</p>
  ${CONTACT ? `<h2>联系与勘误</h2><p class="body">发现错误或想合作，请写信到 <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>。确认的错误会直接改正，并在文末「本站说明」里注明。</p>` : ""}
</article>`;
fs.writeFileSync(path.join(DIST, "about.html"), page({
  TITLE: `关于 · ${SITE_NAME}`, DESC: "玲珑玉是什么、写什么、怎么保证准确。", BASE: "./", BODYCLASS: "reading", URL: `${SITE_URL}/about.html`,
  MAIN: about, DATA: safeJson({ articles: index, featured, today })
}));

/* 404 */
fs.writeFileSync(path.join(DIST, "404.html"), page({
  TITLE: `找不到这个页面 · ${SITE_NAME}`, DESC: "页面不存在", BASE: `${new URL(SITE_URL + "/").pathname}`, BODYCLASS: "reading", URL: `${SITE_URL}/404.html`,
  MAIN: `<article class="reader" id="reader"><h1>找不到这个页面</h1><p class="lede">链接可能写错了，或者文章已经改了地址。</p><p class="body"><a href="${new URL(SITE_URL + "/").pathname}index.html" data-home>回到 AI 解读首页</a></p></article>`,
  DATA: safeJson({ articles: index, featured, today })
}));

/* sitemap.xml 和 robots.txt */
const urls = [`${SITE_URL}/`, `${SITE_URL}/about.html`, ...articles.map(a => `${SITE_URL}/a/${a.slug}.html`)];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `<url><loc>${u}</loc>${i > 1 ? `<lastmod>${articles[i - 2]._day}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

/* 内容 API（只读、静态 JSON）：App 第一版直接读它，不需要服务器。字段变动不兼容时升 v2，v1 保留 */
const API = path.join(DIST, "api/v1");
fs.mkdirSync(path.join(API, "articles"), { recursive: true });
const pub = a => ({ slug: a.slug, url: `${SITE_URL}/a/${a.slug}.html`, api: `${SITE_URL}/api/v1/articles/${a.slug}.json`, published_at: a._pub, date: a.date,
  category: a.category, category_name: CAT_NAME[a.category] || a.category, publisher: a.publisher, title: a.title, summary: a.summary,
  ai_summary: a.ai_summary || null, brief: a.brief || [], verified: !!a.verified, read_minutes: index.find(x => x.slug === a.slug).min,
  source: a.sources?.main?.url || null });
/* 对外不暴露流水线内部信息（候选、模型、生成时间等） */
const strip = a => { const { pipeline, status, _pub, _day, ...rest } = a; return { ...pub(a), ...rest }; };
const generated = new Date().toISOString();
fs.writeFileSync(path.join(API, "articles.json"), JSON.stringify({ version: 1, generated, count: articles.length, articles: articles.map(pub) }));
for (const a of articles) fs.writeFileSync(path.join(API, "articles", `${a.slug}.json`), JSON.stringify({ version: 1, generated, article: strip(a) }));
fs.writeFileSync(path.join(API, "categories.json"), JSON.stringify({ version: 1, generated,
  categories: Object.entries(CAT_NAME).map(([k, name]) => ({ key: k, name, count: articles.filter(a => a.category === k).length })) }));
fs.writeFileSync(path.join(API, "index.json"), JSON.stringify({ version: 1, generated, site: SITE_NAME, url: SITE_URL,
  endpoints: { articles: `${SITE_URL}/api/v1/articles.json`, article: `${SITE_URL}/api/v1/articles/{slug}.json`, categories: `${SITE_URL}/api/v1/categories.json`, rss: `${SITE_URL}/rss.xml` } }));

console.log(`已生成 ${articles.length} 篇文章 → ${path.relative(process.cwd(), DIST) || DIST}`);
