/* =========================================================
   图形组件库 + 文章正文渲染
   同一份代码两处用：
   - build.mjs 在 Node 里调用 renderArticleBody() 生成静态 HTML
   - 浏览器里调用 initFigures() 播放动画、绘制 Canvas
   新增图型：在 FIGS 里加一个函数，在 FIGURE_SPEC 里写清必填字段
   ========================================================= */

import { glyph, GLYPHS, GLYPH_SPEC } from "./glyphs.js";
export { GLYPHS, GLYPH_SPEC };

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (v, max) => Math.max(0, Math.min(100, (v / max) * 100)).toFixed(2) + "%";

/* 每种图的必填字段（validate.mjs 用它检查 AI 的输出） */
export const FIGURE_SPEC = {
  kpi: ["items"],
  timeline: ["axis", "lanes"],
  capacity: ["unit", "max", "items"],
  route: ["root", "branches"],
  steps: ["steps"],
  pipeline: ["rows"],
  beforeafter: ["left", "right"],
  bars: ["groups"],
  /* 2026-11 新增 */
  code: ["code"],
  table: ["columns", "rows"],
  cards: ["items"],
  columns: ["items"],
  compare: ["left", "right"],
  quote: ["text", "who", "source_url"],
  /* 示意小图零件（见 glyphs.js） */
  schematic: ["items"],
  storyboard: ["panels"],
  illustration: ["glyph"]
};

/* 颜色语义（全站统一，图的副标题里要说明本图用到的颜色）：
   hi = 这次的变化 / 重点（琥珀色）   def = 默认档（蓝色）   base = 普通   ref = 参照对象（灰）   dim = 不适用 / 没有 */
const TONE = t => ["hi", "def", "base", "ref", "dim", "main", "good", "warn", "bad", "local", "cloud", "laptop", "gray"].includes(t) ? t : "base";

/* 卡片图标：只用这一组，名字以外的一律不画 */
const ICONS = {
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>', video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  audio: '<path d="M3 12h2l2-6 3 12 3-9 2 6 2-3h4"/>', doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2a3.4 3.4 0 0 1-3-1.6M12 6v12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>', robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/>'
};
const icon = n => ICONS[n] ? `<svg class="fic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>` : "";
/* 一行里的 `xxx` 渲染成参数标签 */
const inlineCode = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const fmt = v => typeof v === "number" ? v.toLocaleString("en-US") : esc(v);

export const FIGS = {
  kpi: f => `<div class="kpis">${f.items.map((k, i) => `<div class="kpi" style="--i:${i}"><b>${esc(k.value)}<small>${esc(k.unit || "")}</small></b><span>${esc(k.label)}</span>${k.note ? `<em>${esc(k.note)}</em>` : ""}</div>`).join("")}</div>`,

  timeline: f => {
    const { from, to, ticks, unit } = f.axis, span = to - from; let k = 0;
    const lanes = f.lanes.map(l => `<div class="row2"><div class="lab"><b>${esc(l.label)}</b><span>${esc(l.sub || "")}</span></div>
      <div class="ftrack">${l.segments.map(s => `<div class="tseg t-${esc(l.tone)}" style="left:${pct(s.from - from, span)};width:${pct(s.to - s.from, span)};--i:${k++}">${s.n || ""}</div>`).join("")}</div></div>`).join("");
    const legend = f.lanes.flatMap(l => l.segments.filter(s => s.label)).map(s => `<div><i>${s.n ?? ""}</i><b>${s.from}–${s.to} ${esc(unit)}</b><span>${esc(s.label)}</span></div>`).join("");
    return `<div class="tl">${lanes}<div class="row2"><span></span><div class="ticks">${(ticks || [from, to]).map(x => `<span style="left:${pct(x - from, span)}">${x} ${esc(unit)}</span>`).join("")}</div></div>${legend ? `<div class="tl-legend">${legend}</div>` : ""}</div>`;
  },

  capacity: f => `<div class="cap"><div class="cap-lines">${(f.thresholds || []).map(th => `<div class="cap-line" style="left:${pct(th.value, f.max)}"><span>${esc(th.label)}</span></div>`).join("")}</div>
    ${f.items.map((it, i) => `<div class="row2"><div class="lab"><b>${esc(it.label)}</b><span>${esc(it.sub || "")}</span></div><div class="ftrack"><div class="fill t-${esc(it.tone || "main")}" style="--w:${pct(it.value, f.max)};--i:${i}">${esc(it.display ?? `${it.value} ${f.unit}`)}</div></div></div>${it.calc ? `<div class="row2 calc-row"><span></span><div class="calc">${esc(it.calc)}</div></div>` : ""}`).join("")}</div>`,

  route: f => {
    let k = 0;
    return `<div class="rt-root">${esc(f.root.label)}<small>${esc(f.root.sub || "")}</small></div>
    <svg class="rt-svg" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0V14M25 14H75M25 14V28M75 14V28"/></svg>
    <div class="rt-cols">${f.branches.map(b => `<div class="rt-col ${esc(b.tone)}"><h5>${esc(b.label)}</h5>${b.items.map(x => `<div class="chip2" style="--i:${k++}">${esc(x)}</div>`).join("")}<div class="rt-note">${esc(b.note || "")}</div></div>`).join("")}</div>`;
  },

  steps: f => `<ol class="st-list">${f.steps.map((s, i) => `<li class="st" style="--i:${i}"><i>${i + 1}</i><div><b>${esc(s.name)}<small>${esc(s.tool || "")}</small></b><p>${esc(s.desc || "")}</p></div></li>`).join("")}</ol>`,

  pipeline: f => `${f.rows.map(r => `<div class="pl-row"><div class="pl-head"><b>${esc(r.label)}</b><span>${esc(r.note || "")}</span></div><div class="pl-nodes">${r.nodes.map(n => `<div class="pl-node${n.hi ? " hi" : ""}">${esc(n.label)}</div>`).join(`<span class="pl-arrow"></span>`)}</div></div>`).join("")}
    ${f.compare ? `<div class="pl-cmp"><h6>${esc(f.compare.label)}</h6>${f.compare.items.map((it, i) => `<div class="row2"><div class="lab"><b>${esc(it.label)}</b></div><div class="ftrack"><div class="fill t-${esc(it.tone || "main")}" style="--w:${pct(it.value, f.compare.max)};--i:${i}">${esc(it.display ?? it.value)}</div></div></div>`).join("")}</div>` : ""}`,

  beforeafter: f => `<div class="ba"><div><canvas aria-label="${esc(f.left.label)}"></canvas><div class="ba-lab"><b>${esc(f.left.label)}</b><span data-n>第 1 次采样</span></div></div>
    <div><canvas aria-label="${esc(f.right.label)}"></canvas><div class="ba-lab"><b>${esc(f.right.label)}</b><span>${esc(f.right.note || "")}</span></div></div></div>`,

  bars: f => {
    const all = f.groups.flatMap(g => g.items).filter(x => x.value != null);
    const max = (f.max || Math.max(...all.map(x => x.value))) * 1.08; let k = 0;
    return `<div class="bars">${f.legend ? `<div class="legend">${f.legend.map(l => `<span><i class="t-${esc(l.tone)}"></i>${esc(l.label)}</span>`).join("")}</div>` : ""}
      ${f.groups.map(g => `<div class="bars-g">${esc(g.label)}</div>${g.items.map(it => `<div class="row2"><div class="lab"><b>${esc(it.label)}</b><span>${esc(it.sub || "")}</span></div>` +
      (it.value != null ? `<div class="ftrack"><div class="fill t-${esc(it.tone || "main")}" style="--w:${pct(it.value, max)};--i:${k++}">${esc(it.display ?? Number(it.value).toLocaleString("en-US"))}</div></div>` : `<div class="ftrack unknown"><em>${esc(it.status || "")}</em></div>`) + `</div>` +
      (it.calc ? `<div class="row2 calc-row"><span></span><div class="calc">${esc(it.calc)}</div></div>` : "")).join("")}`).join("")}</div>`;
  },

  /* 代码块：highlight 是要高亮的行号（从 1 数） */
  code: f => {
    const hl = new Set(f.highlight || []);
    const lines = String(f.code).replace(/\n$/, "").split("\n");
    return `<div class="codeblk">${f.lang ? `<span class="code-lang">${esc(f.lang)}</span>` : ""}<pre><code>${lines.map((l, i) => `<span class="cl${hl.has(i + 1) ? " hl" : ""}">${esc(l) || " "}</span>`).join("")}</code></pre></div>`;
  },

  /* 对照表：highlight {col: n} 或 {row: n}（从 0 数，表头那行不算） */
  table: f => {
    const hc = f.highlight?.col, hr = f.highlight?.row;
    return `<div class="tblwrap"><table class="ftbl"><thead><tr>${f.columns.map((c, j) => `<th class="${j === hc ? "hc" : ""}">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${f.rows.map((r, i) => `<tr class="${i === hr ? "hr" : ""}">${r.map((c, j) => `<td class="${j === hc ? "hc" : ""}${j === 0 ? " k" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  },

  /* 卡片网格：每张卡 icon（见 ICONS）、title、desc、tags（参数或关键词，等宽字体） */
  cards: f => `<div class="fcards${f.items.length === 3 ? " c3" : ""}">${f.items.map((c, i) => `<div class="fcard t-${TONE(c.tone)}" style="--i:${i}">${c.glyph ? `<div class="fcard-g">${glyph(c.glyph)}</div>` : icon(c.icon)}<b>${esc(c.title)}</b>${c.desc ? `<p>${esc(c.desc)}</p>` : ""}${c.tags?.length ? `<div class="ftags">${c.tags.map(t => `<code>${esc(t)}</code>`).join("")}</div>` : ""}</div>`).join("")}</div>`,

  /* 竖向柱状图：items [{label, sub, value, display, tone, calc}] */
  columns: f => {
    const max = (f.max || Math.max(...f.items.map(x => x.value || 0))) * 1.12;
    return `<div class="fcols" style="--n:${f.items.length}">${f.items.map((it, i) => `<div class="fcol">
      <div class="fcol-bar-wrap"><div class="fcol-bar t-${TONE(it.tone)}" style="--h:${pct(it.value || 0, max)};--i:${i}"><span>${esc(it.display ?? fmt(it.value))}</span></div></div>
      <div class="fcol-lab"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ""}${it.calc ? `<em>${esc(it.calc)}</em>` : ""}</div></div>`).join("")}</div>`;
  },

  /* 左右两栏对照：每栏 label、sub、items [{label, tag, state: hi/def/dim/base}]；footer 一句结论 */
  compare: f => {
    const col = c => `<div class="fcmp-col"><h5>${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</h5>${c.items.map((it, i) => `<div class="fcmp-it s-${["hi", "def", "dim"].includes(it.state) ? it.state : "base"}" style="--i:${i}"><span>${esc(it.label)}</span>${it.tag ? `<code>${esc(it.tag)}</code>` : ""}</div>`).join("")}</div>`;
    return `<div class="fcmp">${col(f.left)}${f.arrow === false ? "" : `<div class="fcmp-arrow" aria-hidden="true">→</div>`}${col(f.right)}</div>${f.footer ? `<div class="fcmp-foot">${esc(f.footer)}</div>` : ""}`;
  },

  /* 规格示意：左边一张小图，右边标题 + 几行「旋钮」：items [{glyph, title, sub, rows: [{k, v}]}]，v 里用 `参数名` 标参数 */
  schematic: f => `<div class="fsch">${f.items.map((it, i) => `<div class="fsch-it" style="--i:${i}"><div class="fsch-g">${glyph(it.glyph)}</div><div class="fsch-t"><b>${esc(it.title)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ""}${(it.rows || []).length ? `<dl>${it.rows.map(r => `<dt>${esc(r.k)}</dt><dd>${inlineCode(r.v)}</dd>`).join("")}</dl>` : ""}</div></div>`).join("")}</div>`,

  /* 分镜：2–4 格，每格一张小图 + 编号 + 一句话：panels [{glyph, title, text, tone}] */
  storyboard: f => `<div class="fsb" style="--n:${Math.min(f.panels.length, 4)}">${f.panels.slice(0, 4).map((p, i) => `<div class="fsb-p t-${TONE(p.tone)}" style="--i:${i}"><div class="fsb-g">${glyph(p.glyph)}</div><b><i>${i + 1}</i>${esc(p.title)}</b>${p.text ? `<p>${inlineCode(p.text)}</p>` : ""}</div>`).join("")}</div>`,

  /* 单张大示意图：glyph + 可选的图例 legend [{tone, label}] */
  illustration: f => `<div class="fill-g">${glyph(f.glyph)}</div>${f.legend?.length ? `<div class="legend">${f.legend.map(l => `<span><i class="t-${TONE(l.tone)}"></i>${esc(l.label)}</span>`).join("")}</div>` : ""}`,

  /* 官方引语：text 必须逐字来自原文；zh 是中文意思 */
  quote: f => `<blockquote class="fquote"><p class="q-orig">${esc(f.text)}</p>${f.zh ? `<p class="q-zh">${esc(f.zh)}</p>` : ""}<footer><b>${esc(f.who)}</b>${f.role ? ` · ${esc(f.role)}` : ""} · <a href="${esc(f.source_url)}" target="_blank" rel="noopener">出处 ↗</a></footer></blockquote>`
};

export function figure(f) {
  const body = (FIGS[f.type] || (() => ""))(f);
  return `<figure class="fig" data-type="${esc(f.type)}">${f.title ? `<div class="fig-h">${esc(f.title)}</div>` : ""}${f.subtitle ? `<div class="fig-s">${esc(f.subtitle)}</div>` : ""}${body}${f.note ? `<figcaption>${esc(f.note)}</figcaption>` : ""}</figure>`;
}

const num = i => String(i + 1).padStart(2, "0");
function block(b) {
  if (b.p) return `<p class="body">${esc(b.p)}</p>`;
  if (b.list) return `<ul class="body">${b.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (b.fig) return figure(b.fig);
  return "";
}

/* 文章正文：速览、小节目录、各小节（文字 + 图）、来源块 */
export function renderArticleBody(a) {
  const s = a.sources || {};
  return `${a.ai_summary ? `<section class="aisum" aria-label="AI 总结"><div class="aisum-h"><span class="aisum-ic">✦</span>AI 总结<em>${a.verified ? "由 AI 根据原文生成，已人工核对" : "由 AI 根据原文生成，待人工核对"}</em></div><p>${esc(a.ai_summary)}</p></section>` : ""}
    <p class="lede">${esc(a.summary)}</p>
    <div class="brief"><strong>一分钟速览</strong><ul>${(a.brief || []).map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>
    <div class="rtoc">${a.sections.map((x, i) => `<button data-goto="sec${i}">${num(i)} ${esc(x.h)}</button>`).join("")}</div>
    ${a.sections.map((x, i) => `<h2 class="sec" id="sec${i}"><span>${num(i)}</span>${esc(x.h)}</h2>${x.blocks.map(block).join("")}`).join("")}
    <div class="srcbox">
      ${s.main ? `<div><label>来源</label><p>${esc(s.main.title)} · ${esc(s.main.publisher)} · ${esc(s.main.date)} · <a href="${esc(s.main.url)}" target="_blank" rel="noopener">查看主材料 ↗</a></p></div>` : ""}
      ${s.more?.length ? `<div><label>延伸</label><p>${s.more.map(m => `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.label)} ↗</a>`).join(" · ")}</p></div>` : ""}
      ${s.note ? `<div><label>本站说明</label><p>${esc(s.note)}</p></div>` : ""}
    </div>`;
}

/* ---------------- 以下只在浏览器里运行 ---------------- */

function makeScene(W, H) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#3b4352"); g.addColorStop(.62, "#2b313b"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#1f232a"; x.fillRect(0, H * .62, W, H * .38);
  x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.ellipse(W * .5, H * .8, W * .17, H * .05, 0, 0, Math.PI * 2); x.fill();
  const cx = W * .5, cy = H * .52, r = H * .26; g = x.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r);
  g.addColorStop(0, "#fff1c9"); g.addColorStop(.18, "#f2a24a"); g.addColorStop(.7, "#b8641f"); g.addColorStop(1, "#4a2408");
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  return x.getImageData(0, 0, W, H).data;
}

function setupBeforeAfter(fig, rm) {
  const [ca, cb] = fig.querySelectorAll("canvas"), lab = fig.querySelector("[data-n]"), W = 320, H = 200;
  ca.width = cb.width = W; ca.height = cb.height = H;
  const clean = makeScene(W, H), A = ca.getContext("2d"), B = cb.getContext("2d");
  const imB = B.createImageData(W, H); imB.data.set(clean); B.putImageData(imB, 0, 0);
  const imA = A.createImageData(W, H); let n = 1, raf = null, last = 0, hold = 0;
  const draw = n => { const amp = 190 / Math.sqrt(n), d = imA.data; for (let i = 0; i < d.length; i += 4) { const r = (Math.random() - .5) * amp; d[i] = clean[i] + r; d[i + 1] = clean[i + 1] + r * .92; d[i + 2] = clean[i + 2] + r * .85; d[i + 3] = 255; } A.putImageData(imA, 0, 0); lab.textContent = `第 ${n} 次采样`; };
  const frame = t => { raf = requestAnimationFrame(frame); if (t - last < 80) return; last = t; if (n > 40) { if (++hold > 20) { n = 1; hold = 0; } return; } draw(n++); };
  fig._start = () => { if (rm) { draw(4); return; } if (!raf) raf = requestAnimationFrame(frame); };
  fig._stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  draw(1);
}

/* 滚进屏幕才播放；离开就停；「减少动态」时直接显示终态 */
let figIO = null;
export function initFigures(root) {
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!figIO && "IntersectionObserver" in window) figIO = new IntersectionObserver(es => es.forEach(e => { const f = e.target; if (e.isIntersecting) { f.classList.add("in"); f._start && f._start(); } else f._stop && f._stop(); }), { threshold: .25 });
  root.querySelectorAll(".fig").forEach(f => {
    if (f.dataset.type === "beforeafter") setupBeforeAfter(f, rm);
    if (rm || !figIO) { f.classList.add("in"); f._start && f._start(); } else figIO.observe(f);
  });
}
