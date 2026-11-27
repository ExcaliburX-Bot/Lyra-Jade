/* 文章封面：按这篇的内容生成，不再是五种固定花纹轮流用
   取材顺序：模型给的 cover 字段 → 文中第一张示意零件图 → 文中的柱状图 / 条形图（用真实数值画小柱图）
             → 标题是「A 与 B 合作」时画合作关系图
             → 指标卡的大数字 → 标题里的数字 → 纯排版
   版式：split（左文右图）、number（大数字）、type（纯排版）三种，按有什么材料自动选
   颜色：鲜明风格每篇从 10 种色相里取一种，深浅交替；简约风格统一灰底玉绿（见 coss.css） */
import { glyph, GLYPH_SPEC } from "../../site/assets/components.js";
import { sha } from "./text.mjs";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const HUES = [158, 212, 262, 24, 330, 188, 44, 290, 128, 4];

const figs = a => (a.sections || []).flatMap(s => (s.blocks || []).map(b => b.fig).filter(Boolean));
const okGlyph = g => g && GLYPH_SPEC[g.kind] && GLYPH_SPEC[g.kind].every(k => g[k] != null);

/* 文中第一张示意零件图 */
function firstGlyph(a) {
  for (const f of figs(a)) {
    const gs = [f.glyph, ...(f.items || []).map(x => x?.glyph), ...(f.panels || []).map(x => x?.glyph)];
    const g = gs.find(okGlyph);
    if (g) return g;
  }
  return null;
}

/* 文中的柱状 / 条形图 → 小柱图（最多 4 根，真实数值） */
function chartGlyph(a) {
  for (const f of figs(a)) {
    let items = null;
    if (f.type === "columns") items = f.items;
    if (f.type === "bars") items = (f.groups || []).flatMap(g => g.items || []);
    if (f.type === "pipeline" && f.compare) items = f.compare.items;
    items = (items || []).filter(x => typeof x.value === "number").slice(0, 4);
    if (items.length >= 2) return { kind: "minibars", bare: true, items: items.map((x, i) => ({ label: x.label, value: x.value, display: x.display, tone: ["hi", "def"].includes(x.tone) ? x.tone : i === 0 ? "hi" : "base" })) };
  }
  return null;
}

/* 标题是「A 与 B 合作」→ 一个中心连着合作方 */
function partnerGlyph(a) {
  const t = String(a.title).split(/[：:]/)[0];
  let x, y;
  const zh = t.includes("合作") && t.match(/^(.+?)\s*(?:与|和|携手)\s*(.+)$/);
  if (zh) { x = zh[1]; y = zh[2].replace(/\s*(启动|达成|宣布|开展|战略|合作).*$/, ""); }
  /* 英文版标题：「X and Y partner / team up …」「X partners with Y …」 */
  const en = !zh && (t.match(/^(.+?)\s+(?:and|&)\s+(.+?)\s+(?:partner|team up|launch|sign|strike|form|announce|start)\b/i) || t.match(/^(.+?)\s+(?:partners|teams up|signs a deal)\s+with\s+(.+?)(?:\s+to\b|\s+on\b|,|$)/i));
  if (en) { x = en[1]; y = en[2]; }
  if (!x || !y || !x.trim() || !y.trim()) return null;
  [x, y] = [x.trim(), y.trim()];
  const pub = String(a.publisher || "");
  const center = y.includes(pub) || pub.includes(y) ? y : x, other = center === y ? x : y;
  return { kind: "hub", center: { label: center, tone: "hi" }, nodes: [{ label: other, tone: "def" }] };
}

/* 大数字：cover.big → 第一张指标卡的第一项 → 标题里的第一个数字 */
function bigNumber(a) {
  if (a.cover?.big?.value != null) return a.cover.big;
  const k = figs(a).find(f => f.type === "kpi" && f.items?.length);
  if (k) { const it = k.items[0]; return { value: it.value, unit: it.unit || "", label: it.label }; }
  const m = String(a.title).match(/(\d[\d,.]*)\s*(%|倍|万亿|万|亿|美元|美分|秒|分钟|GB|TB|B|x|trillion|billion|million|M|K|tokens?)?/);
  return m ? { value: m[1], unit: m[2] || "", label: "" } : null;
}

export function coverSpec(a) {
  const [h0, ...rest] = String(a.title).split(/[：:]/);
  const head = a.cover?.headline || h0;
  const hl = a.cover?.highlight || (rest.join("：").split(/[，,；;]/)[0] || "");
  const g = okGlyph(a.cover?.glyph) ? a.cover.glyph : firstGlyph(a) || chartGlyph(a) || partnerGlyph(a);
  const big = bigNumber(a);
  const layout = g ? "split" : big ? "number" : "type";
  const seed = parseInt(sha(a.slug + "hue", 4), 16);   /* 每篇单独取色：同一家公司连发几篇也不会一片同色 */
  return { head, hl, big, glyph: g, layout, hue: HUES[seed % HUES.length], light: parseInt(sha(a.slug, 4), 16) % 3 === 0 };
}

/* 文字多的零件（流程、合作、分层）缩到封面上字会太小：改用封面专用的大字块 */
const lab = x => esc(typeof x === "string" ? x : x?.label);
const tone = x => (x?.tone === "hi" ? " hi" : x?.tone === "def" ? " def" : "");
function chipArt(g) {
  if (g.kind === "hub" && (g.nodes || []).length === 1)
    return `<div class="cpair"><span class="cchip hi">${lab(g.center)}</span><i>×</i><span class="cchip def">${lab(g.nodes[0])}</span></div>`;
  if (g.kind === "hub")
    return `<div class="chub"><span class="cchip hi">${lab(g.center)}</span><div>${g.nodes.slice(0, 4).map(n => `<span class="cchip${tone(n)}">${lab(n)}</span>`).join("")}</div></div>`;
  if (g.kind === "flow")
    return `<ol class="cflow">${g.nodes.slice(0, 4).map((n, i) => `<li class="cchip${tone(n)}"><b>${i + 1}</b>${lab(n)}</li>`).join("")}</ol>`;
  if (g.kind === "stack")
    return `<div class="cstack">${g.layers.slice(0, 4).map(n => `<span class="cchip${tone(n)}">${lab(n)}</span>`).join("")}</div>`;
  return null;
}

export function coverHtml(a) {
  const c = coverSpec(a);
  const kicker = `<div class="ck">${esc(a.publisher)}</div>`;
  const title = `<div class="ch"><span class="ch-h">${esc(c.head)}</span>${c.hl ? `<b class="ch-b">${esc(c.hl)}</b>` : ""}</div>`;
  const big = c.big ? `<div class="cbig2"><span>${esc(c.big.value)}</span><small>${esc(c.big.unit || "")}</small>${c.big.label ? `<em>${esc(c.big.label)}</em>` : ""}</div>` : "";
  let inner;
  if (c.layout === "split") inner = `<div class="cv-l">${kicker}${title}</div><div class="cv-r">${chipArt(c.glyph) || glyph(c.glyph)}</div>`;
  else if (c.layout === "number") inner = `<div class="cv-l">${kicker}${title}</div><div class="cv-r cv-num">${big}</div>`;
  else inner = `<div class="cv-l cv-wide">${kicker}${title}</div>`;
  return { html: inner, layout: c.layout, hue: c.hue, light: c.light };
}

/* 封面配色（和 site/assets/app.js 里的 cover() 一致）：分享图在构建时用 */
export function coverColors(hue, light) {
  return {
    bg: light ? `linear-gradient(160deg,hsl(${hue} 45% 97%),hsl(${hue} 32% 90%))` : `linear-gradient(150deg,hsl(${hue} 38% 14%),hsl(${(hue + 28) % 360} 42% 7%))`,
    acc: light ? `hsl(${hue} 70% 38%)` : `hsl(${hue} 85% 68%)`,
    glow: `hsl(${hue} 80% ${light ? 82 : 38}% / .5)`
  };
}

/* 分享图（1200×630）的 HTML：用文章封面放大，底部加站名。scripts/og.mjs 用无头 Chrome 截成 PNG */
export function ogCardHtml(a, { lang = "zh", css = "../../assets/site.css" } = {}) {
  const cv = coverHtml(a), c = coverColors(cv.hue, cv.light);
  const brand = lang === "en" ? "Lyra-Jade · AI Explained" : "玲珑玉 Lyra-Jade · AI 解读";
  const tag = lang === "en" ? "The best of AI, made clear." : "AI 精华，讲到你懂。";
  return `<!DOCTYPE html><html lang="${lang === "en" ? "en" : "zh-CN"}" class="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">
<style>
html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden;background:#111;display:block}
body,.cover{font-family:"Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.og{position:fixed;left:0;top:0;width:1200px;height:630px;z-index:10}
.og .cover{width:1200px;height:630px;aspect-ratio:auto;border:0;border-radius:0;font-size:31px;padding:66px 72px 120px;box-sizing:border-box}
.og .cover.cv .ch{font-size:1.6em;line-height:1.22}
.og .cover.cv .ch-h{-webkit-line-clamp:3}
.og .cv-r{flex-basis:38%}
.og .cbig2 span{font-size:3.6em}
.og-foot{position:absolute;left:72px;right:72px;bottom:44px;display:flex;align-items:center;justify-content:space-between;font-size:22px;font-weight:600;color:${cv.light ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.72)"}}
.og-foot b{display:flex;align-items:center;gap:12px}
.og-foot img{width:44px;height:44px;display:block}
.og-foot span{font-weight:500;opacity:.8}
</style></head><body><div class="og"><div class="cover cv cv-${cv.layout}${cv.light ? " light" : ""}" style="--cbg:${c.bg};--cacc:${c.acc};--cglow:${c.glow}">${cv.html}</div>
<div class="og-foot"><b><img src="${css.replace(/site\.css$/, "brand/lyra-jade-emblem-160.webp")}" alt="">${brand}</b><span>${tag}</span></div></div></body></html>`;
}
