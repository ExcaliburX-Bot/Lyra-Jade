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
  if (!t.includes("合作")) return null;
  const m = t.match(/^(.+?)\s*(?:与|和|携手)\s*(.+)$/);
  if (!m) return null;
  m[2] = m[2].replace(/\s*(启动|达成|宣布|开展|战略|合作).*$/, "");
  if (!m[1].trim() || !m[2].trim()) return null;
  const [x, y] = [m[1].trim(), m[2].trim()];
  const pub = String(a.publisher || "");
  const center = y.includes(pub) || pub.includes(y) ? y : x, other = center === y ? x : y;
  return { kind: "hub", center: { label: center, tone: "hi" }, nodes: [{ label: other, tone: "def" }] };
}

/* 大数字：cover.big → 第一张指标卡的第一项 → 标题里的第一个数字 */
function bigNumber(a) {
  if (a.cover?.big?.value != null) return a.cover.big;
  const k = figs(a).find(f => f.type === "kpi" && f.items?.length);
  if (k) { const it = k.items[0]; return { value: it.value, unit: it.unit || "", label: it.label }; }
  const m = String(a.title).match(/(\d[\d,.]*)\s*(%|倍|万|亿|美元|美分|秒|分钟|B|GB|TB|token)?/);
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
