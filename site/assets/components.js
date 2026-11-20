/* =========================================================
   图形组件库 + 文章正文渲染
   同一份代码两处用：
   - build.mjs 在 Node 里调用 renderArticleBody() 生成静态 HTML
   - 浏览器里调用 initFigures() 播放动画、绘制 Canvas
   新增图型：在 FIGS 里加一个函数，在 FIGURE_SPEC 里写清必填字段
   ========================================================= */

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
  bars: ["groups"]
};

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
    ${f.items.map((it, i) => `<div class="row2"><div class="lab"><b>${esc(it.label)}</b><span>${esc(it.sub || "")}</span></div><div class="ftrack"><div class="fill t-${esc(it.tone || "main")}" style="--w:${pct(it.value, f.max)};--i:${i}">${esc(it.value)} ${esc(f.unit)}</div></div></div>`).join("")}</div>`,

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
      (it.value != null ? `<div class="ftrack"><div class="fill t-${esc(it.tone || "main")}" style="--w:${pct(it.value, max)};--i:${k++}">${Number(it.value).toLocaleString("en-US")}</div></div>` : `<div class="ftrack unknown"><em>${esc(it.status || "")}</em></div>`) + `</div>`).join("")}`).join("")}</div>`;
  }
};

export function figure(f) {
  const body = (FIGS[f.type] || (() => ""))(f);
  return `<figure class="fig" data-type="${esc(f.type)}"><div class="fig-h">${esc(f.title)}</div>${f.subtitle ? `<div class="fig-s">${esc(f.subtitle)}</div>` : ""}${body}${f.note ? `<figcaption>${esc(f.note)}</figcaption>` : ""}</figure>`;
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
  return `<p class="lede">${esc(a.summary)}</p>
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
