#!/usr/bin/env node
/* 第 8 步：把 content/articles 里的文章生成静态网站到 dist/
   首页 index.html、每篇 a/<slug>.html、关于页 about.html、订阅源 rss.xml、sitemap.xml、robots.txt、404.html，
   英文版在 en/ 下（en/index.html、en/a/<slug>.html、en/about.html、en/rss.xml），文章来自 content/en（scripts/translate.mjs 生成），
   以及给 App 和第三方用的只读内容 API：api/v1/{index,articles,categories}.json、api/v1/articles/<slug>.json */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { CONTENT, CONTENT_EN, DIST, SITE, ROOT } from "./lib/paths.mjs";
import { readJson } from "./lib/store.mjs";
import { sha } from "./lib/text.mjs";
import { coverHtml, ogCardHtml } from "./lib/cover.mjs";
import { sourceHash } from "./lib/translate.mjs";
import { qrSvg } from "./lib/qr.mjs";
import { topicsOf, topicList } from "./lib/topics.mjs";
import { renderArticleBody, esc } from "../site/assets/components.js";

const SITE_NAME = "玲珑玉 Lyra-Jade";
const SITE_URL = (process.env.WG_SITE_URL || "https://example.com").replace(/\/$/, "");
/* Cloudflare Web Analytics 的站点令牌（仓库变量 WG_CF_ANALYTICS）；没配就不加统计脚本 */
const CF = (process.env.WG_CF_ANALYTICS || "").trim();
const ANALYTICS = /^[A-Za-z0-9]{16,64}$/.test(CF) ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF}"}'></script>` : "";
const CONTACT = (process.env.WG_CONTACT_EMAIL || "").trim();
/* 每篇单独的分享图：WG_OG=1 时构建写出卡片 HTML（dist/og/_src/），再由 scripts/og.mjs 截成 PNG。没开就都用通用图 */
const OG = process.env.WG_OG === "1";
const OGIMAGE = `${SITE_URL}/assets/og.png`;
const CAT_NAME = { product: "产品发布", research: "研究解读", deep: "深度", biz: "商业动态", howto: "AI 实操", visual: "商业视觉实战", insight: "洞察", paper: "论文精读", other: "其他" };
const CAT_NAME_EN = { product: "Launches", research: "Research", deep: "Deep dives", biz: "Business", howto: "How-to", visual: "Visual work", insight: "Insights", paper: "Paper deep dives", other: "Other" };
/* 论文书单（content/papers/library.json）：论文精读页下面的待读清单，精读过的链到文章 */
const LIBRARY = readJson(path.join(ROOT, "content/papers/library.json")) || { areas: [], papers: [] };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const enDate = iso => { const [y, m, d] = String(iso).split("-").map(Number); return `${MON[m - 1]} ${d}, ${y}`; };

/* 页面框架里的固定文案（模板里的 {{U_xxx}}） */
const UI = {
  zh: { sections: "栏目", closeSide: "收起侧栏", openSide: "展开侧栏", rss: "RSS 订阅", rssNote: "新解读发布后自动推送到你的阅读器", brandShort: "玲珑玉",
    search: "搜索", appearance: "外观：深浅色与风格", about: "关于", aboutSite: "关于本站", aiNote: "AI 生成说明", api: "内容 API", toTop: "回到顶部",
    filter: "按栏目筛选", sort: "排列方式", topics: "专题" },
  en: { sections: "Sections", closeSide: "Collapse sidebar", openSide: "Open sidebar", rss: "RSS feed", rssNote: "New explainers land in your reader as soon as they're published", brandShort: "Lyra-Jade",
    search: "Search", appearance: "Appearance: theme and style", about: "About", aboutSite: "About", aiNote: "How we use AI", api: "Content API", toTop: "Back to top",
    filter: "Filter by section", sort: "Sort", topics: "Topics" }
};

const tpl = fs.readFileSync(path.join(SITE, "templates/page.html"), "utf8");
const listingTpl = fs.readFileSync(path.join(SITE, "templates/listing.html"), "utf8");
const fill = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? "");
const safeJson = x => JSON.stringify(x).replace(/</g, "\\u003c");
const textLen = a => (a.sections || []).flatMap(s => s.blocks.map(b => b.p || (b.list || []).join(""))).join("").length;
const wordLen = a => (a.sections || []).flatMap(s => s.blocks.map(b => b.p || (b.list || []).join(" "))).join(" ").split(/\s+/).filter(Boolean).length;

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
for (const a of articles) { a._day = bjDay(a._pub); a._topics = topicsOf(a); }

/* 英文版：只收和当前中文稿对得上的译文（中文稿改过、还没重翻的先不显示，免得中英文事实不一致）。
   上线时间、核对状态、编号跟中文稿走 */
const articlesEn = articles.map(zh => {
  const en = readJson(path.join(CONTENT_EN, `${zh.slug}.json`));
  if (!en || en.translated_from !== sourceHash(zh)) return null;
  return { ...en, _pub: zh._pub, _day: zh._day, _topics: zh._topics, verified: zh.verified, status: zh.status, no: zh.no };
}).filter(Boolean);
const hasEn = new Set(articlesEn.map(a => a.slug));

const today = new Date().toISOString().slice(0, 10);
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "a"), { recursive: true });
fs.cpSync(path.join(SITE, "assets"), path.join(DIST, "assets"), { recursive: true });

/* 一种语言一套页面。dir：放在哪个子目录；base：页面到网站根（资源、API）的相对路径由深度决定 */
const LANGS = {
  zh: { lang: "zh", html: "zh-CN", dir: "", list: articles, cat: CAT_NAME, siteDesc: "每天从一手来源挑出值得讲的 AI 发布，用文字和动态图讲透。",
    titleTail: SITE_NAME, home: "AI 解读", altLabel: "EN", altTitle: "English edition", altLang: "en" },
  en: { lang: "en", html: "en", dir: "en/", list: articlesEn, cat: CAT_NAME_EN, siteDesc: "The AI releases worth understanding, explained from primary sources, every day.",
    titleTail: "Lyra-Jade", home: "AI Explained", altLabel: "中文", altTitle: "中文版", altLang: "zh-CN" }
};
const abs = (L, p) => `${SITE_URL}/${L.dir}${p}`.replace(/\/index\.html$/, "/");
/* 同一页面在另一种语言里的地址（相对当前页面）；另一边没有这篇时退回那边的首页 */
function alt(L, depth, page) {
  const up = "../".repeat(depth);
  if (L.lang === "zh") return `${up}en/${page && (!page.startsWith("a/") || hasEn.has(page.slice(2, -5))) ? page : "index.html"}`;
  return `${"../".repeat(depth + 1)}${page || "index.html"}`;
}
function hreflang(page) {
  const zh = `${SITE_URL}/${page}`.replace(/\/index\.html$/, "/");
  const enOk = !page.startsWith("a/") || hasEn.has(page.slice(2, -5));
  return [`<link rel="alternate" hreflang="zh-CN" href="${zh}">`, enOk ? `<link rel="alternate" hreflang="en" href="${SITE_URL}/en/${page}">`.replace(/\/index\.html"/, '/"') : "",
    `<link rel="alternate" hreflang="x-default" href="${zh}">`].filter(Boolean).join("\n");
}

/* 分享：手机上直接调系统分享面板（里面有微信、X 等）；电脑上展开菜单：分享到 X、复制链接、微信扫码 */
function shareHtml(L, a, url, where) {
  const en = L.lang === "en";
  const T = en ? { btn: "Share", x: "Share on X", copy: "Copy link", wx: "Scan with WeChat", wxNote: "Scan with your phone to open it in WeChat, then share", qr: "QR code for this article" }
    : { btn: "分享", x: "分享到 X", copy: "复制链接", wx: "微信扫一扫", wxNote: "用手机微信扫码打开，再转发给朋友或朋友圈", qr: "这篇文章的二维码" };
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(a.title)}&url=${encodeURIComponent(url)}`;
  return `<div class="share share-${where}" data-share data-title="${esc(a.title)}" data-url="${esc(url)}" data-text="${esc(a.summary)}">
      <button class="btn btn-ghost share-btn" data-share-open aria-expanded="false"><svg class="i"><use href="#i-share"/></svg><span>${T.btn}</span></button>
      <div class="share-menu" role="menu">
        <a role="menuitem" href="${esc(xUrl)}" target="_blank" rel="noopener"><b class="share-x">𝕏</b><span>${T.x}</span></a>
        <button role="menuitem" data-share-copy><svg class="i"><use href="#i-link"/></svg><span>${T.copy}</span></button>
        <div class="share-qr"><div class="share-qr-h"><svg class="i"><use href="#i-qr"/></svg><span>${T.wx}</span></div>${qrSvg(url, { label: T.qr })}<p>${T.wxNote}</p></div>
      </div>
    </div>`;
}

function render(L, { page, depth, title, desc, bodyClass = "", main, data, ogType = "website", ogImage = OGIMAGE }) {
  const base = "../".repeat(depth + (L.dir ? 1 : 0)) || "./";
  const home = "../".repeat(depth) || "./";
  const ui = Object.fromEntries(Object.entries(UI[L.lang]).map(([k, v]) => [`U_${k}`, v]));
  const vars = { ...ui, ANALYTICS, OGIMAGE: ogImage, OGTYPE: ogType, HTMLLANG: L.html, LANG: L.lang, BASE: base, HOME: home, TITLE: title, DESC: desc, BODYCLASS: bodyClass,
    URL: abs(L, page), ALTURL: alt(L, depth, page), ALTLABEL: L.lang === "en" || articlesEn.length ? L.altLabel : "", ALTTITLE: L.altTitle, ALTLANG: L.altLang, HREFLANG: hreflang(page), DATA: safeJson(data) };
  const out = path.join(DIST, L.dir, page);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fill(tpl, { ...vars, MAIN: fill(main, vars) }));
}

function buildLang(L) {
  const list = L.list, en = L.lang === "en";
  const index = list.map((a, i) => ({
    id: a.slug, no: a.no ?? list.length - i, slug: a.slug, date: a._day, src: a.date, cat: a.category, co: a.publisher, title: a.title, summary: a.summary,
    min: a.readMinutes || (en ? Math.max(3, Math.ceil(wordLen(a) / 230)) : Math.max(3, Math.ceil(textLen(a) / 450))), verified: !!a.verified, pod: null,
    v: parseInt(sha(a.slug, 4), 16) % 5, h: parseInt(sha(a.slug + "h", 4), 16) % 360,
    cv: coverHtml(a),  /* 按内容生成的封面（见 lib/cover.mjs） */
    tp: a._topics      /* 专题（见 lib/topics.mjs） */
  }));
  const minOf = a => index.find(x => x.slug === a.slug).min;
  /* 今日精选：最新上线的一篇（人工核对过的优先，但只在最近两天内找） */
  const featured = (list.find(a => a.verified && a._day >= bjDay(new Date(Date.now() - 2 * 864e5).toISOString())) || list[0])?.slug || null;
  /* 专题：两种语言用同一组（按中文版定），英文的篇数按英文版算 */
  const topics = topicList(list, L.lang, { keys: TOPIC_KEYS });
  const data = { articles: index, featured, today, topics };

  /* 首页 */
  render(L, { page: "index.html", depth: 0, title: en ? `AI Explained · ${L.titleTail}` : `AI 解读 · ${SITE_NAME}`, desc: L.siteDesc, main: listingTpl, data });

  /* 论文精读页：papers.html，上面是精读过的文章，下面是论文书单 */
  const done = new Map(list.filter(a => a.category === "paper" && a.paper).map(a => [a.paper.arxiv || a.paper.url, a]));
  const libItems = LIBRARY.papers.map(p => ({ ...p, art: done.get(p.arxiv) || done.get(p.url) }));
  const libHtml = `<section class="wrap library" id="library">
    <div class="lib-h"><h2>${en ? "Reading list" : "论文书单"}</h2><p>${en ? `${libItems.length} papers on our list · <b>${libItems.filter(p => p.art).length}</b> explained so far. We work through them one at a time, each explained in depth.` : `共 ${libItems.length} 篇 · 已精读 <b>${libItems.filter(p => p.art).length}</b> 篇。我们一篇一篇讲透，讲完的会出现在上面。`}</p></div>
    ${LIBRARY.areas.map(ar => { const items = libItems.filter(p => p.area === ar.k); if (!items.length) return "";
      items.sort((x, y) => (!!y.art - !!x.art) || (x.year || 0) - (y.year || 0));
      return `<div class="lib-area"><h3>${esc(en ? ar.en : ar.zh)}<small>${items.length}</small></h3><ul>${items.map(p => {
        const name = en ? (p.name_en || p.name) : p.name, sub = p.title && p.title !== name ? p.title : "";
        const meta = [p.org || p.author, p.year].filter(Boolean).join(" · ");
        const extra = p.extra ? `<i class="lib-x" title="${en ? "Added to round out the curriculum" : "站长收藏之外、为体系化学习补充的论文"}">${en ? "added" : "补充"}</i>` : "";
        return `<li id="p-${esc(p.id)}" class="${p.art ? "done" : ""}">${p.art ? `<a href="a/${p.art.slug}.html">` : p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">` : "<div>"}<b>${esc(name)}${extra}</b>${sub ? `<span class="lib-t">${esc(sub)}</span>` : ""}<span class="lib-m">${esc(meta)}</span><em>${p.art ? (en ? "Read the deep dive →" : "已精读 →") : p.url ? (en ? "Coming up · original paper ↗" : "待精读 · 看原文 ↗") : (en ? "Coming up" : "待精读")}</em>${p.art || p.url ? "</a>" : "</div>"}</li>`; }).join("")}</ul></div>`; }).join("")}
  </section>`;
  /* 学习路线：几条按顺序读的主线，每条显示精读进度；书单是全集，路线是推荐的精读顺序 */
  const byId = new Map(libItems.map(p => [p.id, p]));
  const NUM = "一二三四五六七八九十";
  const trackIds = new Set((LIBRARY.tracks || []).flatMap(t => t.ids));
  const tracksHtml = (LIBRARY.tracks || []).length ? `<section class="wrap lpaths" id="paths">
    <div class="lib-h"><h2>${en ? "Learning paths" : "学习路线"}</h2><p>${en ? `${LIBRARY.tracks.length} paths through the field, each read in order · <b>${[...trackIds].filter(id => byId.get(id)?.art).length}</b> of ${trackIds.size} papers explained so far. Deep dives follow these paths; the full reading list is below.` : `${LIBRARY.tracks.length} 条主线，每条按顺序读 · ${trackIds.size} 篇里已精读 <b>${[...trackIds].filter(id => byId.get(id)?.art).length}</b> 篇。精读按主线的顺序写，完整书单在下面。`}</p></div>
    ${LIBRARY.tracks.map((t, ti) => { const items = t.ids.map(id => byId.get(id)).filter(Boolean), n = items.filter(p => p.art).length;
      return `<div class="lpath" id="path-${esc(t.k)}"><div class="tr-h"><span class="tr-n">${en ? `Path ${ti + 1}` : `主线${NUM[ti] || ti + 1}`}</span><h3>${esc(en ? t.en : t.zh)}</h3><small>${en ? `${n} / ${items.length} explained` : `已精读 ${n} / ${items.length}`}</small></div>
        <p>${esc(en ? t.den : t.dzh)}</p><div class="tr-bar"><span style="width:${Math.round(100 * n / items.length)}%"></span></div>
        <ol>${items.map((p, i) => { const name = en ? (p.name_en || p.name) : p.name;
          return `<li class="${p.art ? "done" : ""}"><a href="${p.art ? `a/${p.art.slug}.html` : `#p-${esc(p.id)}`}"><i>${i + 1}</i><b>${esc(name)}</b><small>${esc(String(p.year || ""))}</small></a></li>`; }).join("")}</ol></div>`; }).join("")}
  </section>` : "";
  render(L, { page: "papers.html", depth: 0, title: en ? `Paper deep dives · ${L.titleTail}` : `论文精读 · ${SITE_NAME}`,
    desc: en ? "The AI papers that matter, explained in depth and in plain language." : "把重要的 AI 论文讲透：有深度，也让普通人看得懂。", main: listingTpl + tracksHtml + libHtml, data: { ...data, section: "paper" } });

  /* 专题页：t/<专题>.html，和首页同一个列表模板，只显示这个专题的文章 */
  for (const tp of topics) {
    render(L, { page: `t/${tp.k}.html`, depth: 1, title: en ? `${tp.name} · AI Explained · ${L.titleTail}` : `${tp.name} 专题 · ${SITE_NAME}`,
      desc: en ? `Every Lyra-Jade explainer about ${tp.name} (${tp.sub}), from primary sources.` : `玲珑玉关于 ${tp.name}（${tp.sub}）的全部解读，只用一手来源。`, main: listingTpl, data: { ...data, topic: tp.k } });
  }

  /* 文章页 */
  for (const a of list) {
    const rel = list.filter(x => x.slug !== a.slug && x.category === a.category).slice(0, 4);
    const T = en ? {
      back: "Back to AI Explained", verified: "Checked by an editor", ai: "AI-assisted", pub: `Published ${enDate(a._day)}`, src: a.paper ? `Paper: ${[a.paper.venue, a.paper.year].filter((x, i, l) => x && !(i && String(l[0]).includes(String(x)))).join(" · ")}` : a.date !== a._day ? `Source dated ${enDate(a.date)}` : "",
      min: `${minOf(a)} min read`, from: `Source: ${a.publisher}`, more: "Keep reading",
      disclose: `This explainer was written with AI assistance from the primary sources listed above, then translated and adapted into English by AI. Key figures were checked against the original${a.verified ? " and an editor read it through" : ""}. If anything differs, the original source prevails. <a href="../about.html#ai">How we use AI</a>${CONTACT ? ` · Spotted an error? Email <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : ""}`
    } : {
      back: "返回 AI 解读", verified: "人工已核对", ai: "AI 辅助撰写", pub: `${a._day} 发布`, src: a.paper ? `论文 ${[a.paper.venue, a.paper.year].filter((x, i, l) => x && !(i && String(l[0]).includes(String(x)))).join(" · ")}` : a.date !== a._day ? `原文 ${a.date}` : "",
      min: `约 ${minOf(a)} 分钟`, from: `来源 ${a.publisher}`, more: "继续读",
      disclose: `本文由 AI 辅助撰写，依据上方列出的一手来源，关键数字已与原文核对${a.verified ? "，并经编辑通读" : ""}。如有出入，请以原文为准。<a href="../about.html#ai">关于我们的内容</a>${CONTACT ? ` · 发现错误请写信到 <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : ""}`
    };
    const main = `<article class="reader" id="reader">
    <a href="../index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>${T.back}</a>
    <div class="tags"><span class="tag">${esc(L.cat[a.category] || a.category)}</span>${a._topics.map(k => `<a class="tag tag-tp" href="../t/${k}.html">${esc(topics.find(t => t.k === k)?.name || k)}</a>`).join("")}${a.verified ? `<span class="verified"><svg class="i"><use href="#i-check"/></svg>${T.verified}</span>` : `<a class="muted" href="../about.html#ai">${T.ai}</a>`}</div>
    <h1>${esc(a.title)}</h1>
    <div class="rmeta-row"><div class="rmeta"><span>${esc(T.pub)}</span>${T.src ? `<span>${esc(T.src)}</span>` : ""}<span>${esc(T.min)}</span><span>${esc(T.from)}</span></div>${shareHtml(L, a, abs(L, `a/${a.slug}.html`), "top")}</div>
    ${renderArticleBody(a, { lang: L.lang })}
    <div class="share-end"><p>${en ? "Found this useful? Pass it on." : "觉得有用？转给需要的朋友。"}</p>${shareHtml(L, a, abs(L, `a/${a.slug}.html`), "end")}</div>
    <aside class="disclose"><svg class="i"><use href="#i-info"/></svg><p>${T.disclose}</p></aside>
    ${rel.length ? `<div class="rel"><h3>${T.more}</h3><div class="toc">${rel.map(x => `<a href="${x.slug}.html"><span>${x._day.slice(5)}</span><span>${esc(x.title)}</span><span>${esc(L.cat[x.category] || "")}</span></a>`).join("")}</div></div>` : ""}
  </article>`;
    let ogImage = OGIMAGE;
    if (OG) {
      const name = `${L.dir.replace("/", "-")}${a.slug}`;
      fs.mkdirSync(path.join(DIST, "og/_src"), { recursive: true });
      fs.writeFileSync(path.join(DIST, "og/_src", `${name}.html`), ogCardHtml(a, { lang: L.lang }));
      ogImage = `${SITE_URL}/og/${name}.png`;
    }
    render(L, { page: `a/${a.slug}.html`, depth: 1, title: `${esc(a.title)} · ${L.titleTail}`, desc: esc(a.summary), bodyClass: "reading", ogType: "article", main, data, ogImage });
  }

  /* RSS */
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${en ? "Lyra-Jade · AI Explained" : `${SITE_NAME} · AI 解读`}</title><link>${SITE_URL}/${L.dir}</link><description>${en ? "The AI releases worth understanding, explained from primary sources." : "每天把最值得看的 AI 新动态讲清楚"}</description><language>${L.html}</language>
${list.slice(0, 30).map(a => `<item><title>${esc(a.title)}</title><link>${abs(L, `a/${a.slug}.html`)}</link><guid>${abs(L, `a/${a.slug}.html`)}</guid><pubDate>${new Date(a._pub).toUTCString()}</pubDate><description>${esc(a.summary)}</description></item>`).join("\n")}
</channel></rss>`;
  fs.writeFileSync(path.join(DIST, L.dir, "rss.xml"), rss);

  /* 关于页 */
  const about = en ? `<article class="reader about" id="reader">
  <a href="index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>Back to AI Explained</a>
  <h1>About Lyra-Jade</h1>
  <p class="lede">Every day, Lyra-Jade picks the AI releases worth understanding from vendor blogs, papers and official accounts, and takes them apart in words and interactive figures: what happened, why it matters and who it's for.</p>
  <h2>Primary sources only</h2>
  <p class="body">Every explainer is built on an official announcement, paper, model card or code repository, linked at the end of the article. We don't rewrite secondhand coverage, chase funding rumors or tell you something is "game-changing".</p>
  <h2 id="ai">How we use AI</h2>
  <p class="body">Our explainers are written with AI assistance, and every article says so. Each one is based on the primary sources listed at the end, and its key figures are checked against the original one by one; anything that doesn't match isn't published.</p>
  <p class="body">Lyra-Jade is edited in Chinese first. The English edition is translated and adapted from the Chinese by AI, with every number checked against the Chinese version before it goes live. Articles an editor has read through are marked "Checked by an editor". If an article and its source disagree, the source prevails.</p>
  <h2>Labels you'll see</h2>
  <ul class="body">
    <li><b>AI-assisted</b>: key figures checked against the original.</li>
    <li><b>Checked by an editor</b>: an editor has read it against the original.</li>
    <li><b>Illustrative</b>: the example in the figure shows the structure; it isn't data from the source. Data figures name their source.</li>
  </ul>
  <h2>Subscribe</h2>
  <p class="body">Follow new explainers with <a href="rss.xml">RSS</a>. Prefer Chinese? Read the <a href="../index.html">Chinese edition</a>.</p>
  ${CONTACT ? `<h2>Contact and corrections</h2><p class="body">Spotted an error or want to work with us? Email <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>. Confirmed errors are corrected and noted in the article.</p>` : ""}
</article>` : `<article class="reader about" id="reader">
  <a href="index.html" class="back" data-home><svg class="i"><use href="#i-chev-l"/></svg>返回 AI 解读</a>
  <h1>关于玲珑玉</h1>
  <p class="lede">玲珑玉 Lyra-Jade 每天从厂商官方博客、论文和官方账号里挑出值得讲的 AI 发布，用文字和动态图把它拆开讲透：发生了什么、为什么重要、对谁有用。</p>
  <h2>我们只写有一手来源的事</h2>
  <p class="body">每篇解读的主材料都是官方公告、论文、模型卡或代码仓库，文末列出原文链接。我们不转述二手报道，不追融资传闻，也不替你下「颠覆」「最强」这类结论。</p>
  <h2 id="ai">内容怎么来</h2>
  <p class="body">我们的解读由 AI 辅助撰写，并在每篇文章上明确标注。每篇都以文末列出的一手原文为依据，文中的关键数字会与原文逐条核对，对不上的不发布。</p>
  <p class="body">经编辑逐篇读过的文章会标注「人工已核对」。如果文章和原文有出入，请以原文为准。英文版由 AI 从中文版翻译改写，数字逐条与中文版核对后才上线。</p>
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
  render(L, { page: "about.html", depth: 0, title: en ? "About · Lyra-Jade" : `关于 · ${SITE_NAME}`, desc: en ? "What Lyra-Jade is, what we cover and how we keep it accurate." : "玲珑玉是什么、写什么、怎么保证准确。", bodyClass: "reading", main: about, data });
  return { index, data, topics };
}

const TOPIC_KEYS = topicList(articles, "zh").map(t => t.k);
const zh = buildLang(LANGS.zh);
buildLang(LANGS.en);

/* 404（GitHub Pages 只认根目录这一个） */
const root404 = new URL(SITE_URL + "/").pathname;
fs.writeFileSync(path.join(DIST, "404.html"), fill(tpl, { ...Object.fromEntries(Object.entries(UI.zh).map(([k, v]) => [`U_${k}`, v])), ANALYTICS, OGIMAGE, OGTYPE: "website",
  HTMLLANG: "zh-CN", LANG: "zh", BASE: root404, HOME: root404, TITLE: `找不到这个页面 · ${SITE_NAME}`, DESC: "页面不存在", BODYCLASS: "reading", URL: `${SITE_URL}/404.html`,
  ALTURL: `${root404}en/index.html`, ALTLABEL: articlesEn.length ? "EN" : "", ALTTITLE: "English edition", ALTLANG: "en", HREFLANG: "",
  MAIN: `<article class="reader" id="reader"><h1>找不到这个页面 · Page not found</h1><p class="lede">链接可能写错了，或者文章已经改了地址。The link may be wrong, or the article has moved.</p><p class="body"><a href="${root404}index.html" data-home>回到 AI 解读首页</a> · <a href="${root404}en/index.html">English edition</a></p></article>`,
  DATA: safeJson(zh.data) }));

/* sitemap.xml 和 robots.txt */
const urls = [[`${SITE_URL}/`], [`${SITE_URL}/about.html`], [`${SITE_URL}/papers.html`], [`${SITE_URL}/en/papers.html`], ...articles.map(a => [`${SITE_URL}/a/${a.slug}.html`, a._day]),
  [`${SITE_URL}/en/`], [`${SITE_URL}/en/about.html`], ...articlesEn.map(a => [`${SITE_URL}/en/a/${a.slug}.html`, a._day]),
  ...TOPIC_KEYS.flatMap(k => [[`${SITE_URL}/t/${k}.html`], [`${SITE_URL}/en/t/${k}.html`]])];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `<url><loc>${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

/* 内容 API（只读、静态 JSON）：App 第一版直接读它，不需要服务器。字段变动不兼容时升 v2，v1 保留 */
const index = zh.index;
const API = path.join(DIST, "api/v1");
fs.mkdirSync(path.join(API, "articles"), { recursive: true });
const pub = a => ({ slug: a.slug, url: `${SITE_URL}/a/${a.slug}.html`, api: `${SITE_URL}/api/v1/articles/${a.slug}.json`, published_at: a._pub, date: a.date,
  category: a.category, category_name: CAT_NAME[a.category] || a.category, publisher: a.publisher, title: a.title, summary: a.summary,
  ai_summary: a.ai_summary || null, brief: a.brief || [], verified: !!a.verified, read_minutes: index.find(x => x.slug === a.slug).min,
  source: a.sources?.main?.url || null, topics: a._topics || [] });
/* 对外不暴露流水线内部信息（候选、模型、生成时间等） */
const strip = a => { const { pipeline, status, _pub, _day, _topics, ...rest } = a; return { ...pub(a), ...rest }; };
const generated = new Date().toISOString();
fs.writeFileSync(path.join(API, "articles.json"), JSON.stringify({ version: 1, generated, count: articles.length, articles: articles.map(pub) }));
for (const a of articles) fs.writeFileSync(path.join(API, "articles", `${a.slug}.json`), JSON.stringify({ version: 1, generated, article: strip(a) }));
fs.writeFileSync(path.join(API, "categories.json"), JSON.stringify({ version: 1, generated,
  categories: Object.entries(CAT_NAME).map(([k, name]) => ({ key: k, name, count: articles.filter(a => a.category === k).length })) }));
fs.writeFileSync(path.join(API, "index.json"), JSON.stringify({ version: 1, generated, site: SITE_NAME, url: SITE_URL,
  endpoints: { articles: `${SITE_URL}/api/v1/articles.json`, article: `${SITE_URL}/api/v1/articles/{slug}.json`, categories: `${SITE_URL}/api/v1/categories.json`, rss: `${SITE_URL}/rss.xml` } }));

console.log(`已生成 ${articles.length} 篇文章（英文版 ${articlesEn.length} 篇）→ ${path.relative(process.cwd(), DIST) || DIST}`);
