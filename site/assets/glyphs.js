/* =========================================================
   示意小图零件（glyph）：模型只给参数，程序画 SVG，保证不画歪
   每个零件都是 (参数) => SVG 字符串；颜色全部走 CSS 类：
     g-ln 线条 · g-bx 方块底色 · g-hi 重点（琥珀）· g-def 默认（蓝）· g-dim 弱化 · g-tx 小字 · g-tx-b 粗字
   新增零件：在 GLYPHS 里加一个函数，在 GLYPH_SPEC 里写清必填参数
   ========================================================= */

const gEsc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const gClamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : a));
const gTone = t => ({ hi: "g-hi", def: "g-def", dim: "g-dim", base: "g-bx" }[t] || "g-bx");
const gSvg = (w, h, body, label) => `<svg class="glyph" viewBox="0 0 ${w} ${h}" style="width:${Math.round(w * 1.3)}px" role="img" aria-label="${gEsc(label || "示意图")}">${body}</svg>`;
const gTxt = (x, y, s, cls = "g-tx", anchor = "middle") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${gEsc(s)}</text>`;
const gCut = (s, n) => { const a = [...String(s ?? "")]; return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join(""); };
/* 估算文字宽度：中日韩字按 11，其他按 6.2（10.5px 字号） */
const gW = s => [...String(s ?? "")].reduce((n, c) => n + (/[\u2E80-\uFFFF]/.test(c) ? 11 : 6.2), 0);
const gInSel = (i, sel) => Array.isArray(sel) && i >= sel[0] && i <= sel[1];

/* 必填参数（validate.mjs 用） */
export const GLYPH_SPEC = {
  pages: ["count"], sheet: [], tracks: ["lanes"], wave: [], frames: ["count"], doc: [],
  context: ["segments"], stack: ["layers"], flow: ["nodes"], hub: ["center", "nodes"], chat: ["turns"],
  window: ["items"], dots: ["total", "hi"], ring: ["value"], area: ["before", "after"], devices: ["left", "right"],
  funnel: ["stages"], clock: ["segments"], matrix: ["rows", "cols", "cells"], minibars: ["items"]
};

export const GLYPHS = {
  /* 一排页面，框出第几页到第几页：{count, select:[起, 止]}（从 1 数） */
  pages: g => {
    const n = gClamp(g.count, 1, 16) | 0, perRow = n > 8 ? Math.ceil(n / 2) : n, rows = Math.ceil(n / perRow);
    const pw = 22, ph = 30, gap = 6, W = perRow * (pw + gap) + 14, H = rows * (ph + gap) + 18;
    let b = "", hi = [];
    for (let i = 0; i < n; i++) {
      const x = 7 + (i % perRow) * (pw + gap), y = 7 + Math.floor(i / perRow) * (ph + gap), on = gInSel(i + 1, g.select);
      b += `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="2" class="${on ? "g-hi" : "g-bx"}"/><path d="M${x + 4} ${y + 8}h${pw - 8}M${x + 4} ${y + 13}h${pw - 8}M${x + 4} ${y + 18}h${pw - 12}" class="g-ln g-thin"/>`;
      if (on) hi.push([x, y]);
    }
    return gSvg(W, H, b, `共 ${n} 页，选中第 ${g.select?.[0] ?? "-"} 到 ${g.select?.[1] ?? "-"} 页`);
  },

  /* 表格格子，框出一块：{rows, cols, select:[r0, c0, r1, c1]}（从 1 数） */
  sheet: g => {
    const R = gClamp(g.rows ?? 7, 2, 14) | 0, C = gClamp(g.cols ?? 9, 2, 14) | 0, cw = 16, ch = 11, W = C * cw + 14, H = R * ch + 14;
    let b = `<rect x="7" y="7" width="${C * cw}" height="${R * ch}" class="g-bx"/>`;
    for (let r = 1; r < R; r++) b += `<path d="M7 ${7 + r * ch}h${C * cw}" class="g-ln g-thin"/>`;
    for (let c = 1; c < C; c++) b += `<path d="M${7 + c * cw} 7v${R * ch}" class="g-ln g-thin"/>`;
    const s = g.select; if (Array.isArray(s) && s.length === 4) {
      const [r0, c0, r1, c1] = s.map(Number);
      b += `<rect x="${7 + (gClamp(c0, 1, C) - 1) * cw}" y="${7 + (gClamp(r0, 1, R) - 1) * ch}" width="${(gClamp(c1, c0, C) - gClamp(c0, 1, C) + 1) * cw}" height="${(gClamp(r1, r0, R) - gClamp(r0, 1, R) + 1) * ch}" class="g-hi g-sel"/>`;
    }
    return gSvg(W, H, b, "表格里选中的一块格子");
  },

  /* 多条时间轨道，框出一段：{lanes:["字幕","画面","声音"], select:[0.4, 0.55]}（0–1） */
  tracks: g => {
    const lanes = (g.lanes || []).slice(0, 5), L = 46, W = 260, lh = 16, H = lanes.length * (lh + 6) + 16, tw = W - L - 8;
    let b = lanes.map((l, i) => gTxt(L - 6, 8 + i * (lh + 6) + lh - 4, gCut(l, 4), "g-tx", "end") + `<rect x="${L}" y="${8 + i * (lh + 6)}" width="${tw}" height="${lh}" rx="3" class="g-bx"/>`).join("");
    const [a, z] = (g.select || [0.4, 0.55]).map(v => gClamp(v, 0, 1));
    b += `<rect x="${L + a * tw}" y="3" width="${Math.max(4, (z - a) * tw)}" height="${H - 8}" rx="4" class="g-hi g-sel"/>`;
    return gSvg(W, H, b, `${lanes.join("、")} 三条轨道里选中的一段`);
  },

  /* 音频波形，框出一截：{select:[0.4, 0.6]} */
  wave: g => {
    const W = 240, H = 70, [a, z] = (g.select || [0.4, 0.6]).map(v => gClamp(v, 0, 1));
    let d = "M8 35"; for (let x = 8; x <= W - 8; x += 3) d += ` L${x} ${35 + Math.sin(x / 7) * 14 * Math.sin(x / 41 + 1) + Math.sin(x / 3.1) * 4}`;
    return gSvg(W, H, `<path d="${d}" class="g-ln"/><rect x="${8 + a * (W - 16)}" y="6" width="${Math.max(6, (z - a) * (W - 16))}" height="${H - 12}" rx="5" class="g-hi g-sel"/>`, "音频波形里选中的一段");
  },

  /* 视频帧条（胶片），选中几帧：{count, select:[起, 止]} */
  frames: g => {
    const n = gClamp(g.count, 2, 12) | 0, fw = 26, W = n * (fw + 4) + 12, H = 50;
    let b = `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="4" class="g-bx"/>`;
    for (let i = 0; i < n; i++) {
      const x = 8 + i * (fw + 4), on = gInSel(i + 1, g.select);
      b += `<rect x="${x}" y="13" width="${fw}" height="24" rx="2" class="${on ? "g-hi" : "g-dim"}"/><circle cx="${x + fw / 2}" cy="8.5" r="1.6" class="g-dot"/><circle cx="${x + fw / 2}" cy="41.5" r="1.6" class="g-dot"/>`;
    }
    return gSvg(W, H, b, `视频 ${n} 帧里选中第 ${g.select?.[0] ?? "-"} 到 ${g.select?.[1] ?? "-"} 帧`);
  },

  /* 一页文字，高亮几行：{lines, select:[起, 止]} */
  doc: g => {
    const n = gClamp(g.lines ?? 9, 3, 14) | 0, W = 130, H = n * 10 + 26;
    let b = `<path d="M10 6h84l26 26v${H - 38}H10z" class="g-bx"/><path d="M94 6v26h26" class="g-ln g-thin"/>`;
    for (let i = 0; i < n; i++) { const y = 22 + i * 10, w = i % 4 === 3 ? 56 : 92, on = gInSel(i + 1, g.select);
      b += on ? `<rect x="15" y="${y - 4}" width="${w + 4}" height="8" rx="2" class="g-hi"/>` : `<path d="M17 ${y}h${w}" class="g-ln g-thin"/>`; }
    return gSvg(W, H, b, "文档里高亮的几行");
  },

  /* 上下文窗口 / token 条：{total, segments:[{size, tone, label}]}，size 是同一单位的数量 */
  context: g => {
    const segs = (g.segments || []).slice(0, 6), total = Math.max(Number(g.total) || 0, segs.reduce((s, x) => s + (Number(x.size) || 0), 0)) || 1;
    const W = 280, x0 = 8, tw = W - 16; let x = x0, b = `<rect x="${x0}" y="10" width="${tw}" height="22" rx="5" class="g-bx g-dashed"/>`;
    segs.forEach(s => { const w = Math.max(2, (Number(s.size) || 0) / total * tw);
      b += `<rect x="${x}" y="10" width="${w}" height="22" rx="4" class="${gTone(s.tone)}"/>` + (s.label && w > 30 ? gTxt(x + w / 2, 48, gCut(s.label, Math.floor(w / 9))) : ""); x += w + 1; });
    return gSvg(W, 56, b, "上下文窗口里各部分占的比例");
  },

  /* 分层架构，从上到下：{layers:[{label, tone}]} */
  stack: g => {
    const ls = (g.layers || []).slice(0, 6), W = 220, lh = 22, H = ls.length * (lh + 5) + 8;
    return gSvg(W, H, ls.map((l, i) => `<rect x="${8 + i * 0}" y="${4 + i * (lh + 5)}" width="${W - 16}" height="${lh}" rx="5" class="${gTone(l.tone)}"/>` + gTxt(W / 2, 4 + i * (lh + 5) + 15, gCut(l.label, 14), l.tone === "hi" ? "g-tx-b" : "g-tx")).join(""), "分层结构");
  },

  /* 几个节点连成一条线：{nodes:[{label, tone}]}（2–4 个） */
  flow: g => {
    const ns = (g.nodes || []).slice(0, 4), n = ns.length || 1, W = 280, nw = (W - 16 - (n - 1) * 18) / n, H = 46;
    return gSvg(W, H, ns.map((s, i) => { const x = 8 + i * (nw + 18);
      return `<rect x="${x}" y="8" width="${nw}" height="30" rx="7" class="${gTone(s.tone)}"/>` + gTxt(x + nw / 2, 27, gCut(s.label, Math.floor(nw / 10)), s.tone === "hi" ? "g-tx-b" : "g-tx") +
        (i < n - 1 ? `<path d="M${x + nw + 3} 23h11m-4-4 4 4-4 4" class="g-ln"/>` : ""); }).join(""), "几个步骤连成一条线");
  },

  /* 一个中心带几个子节点（指挥官和子代理）：{center:{label, tone}, nodes:[{label, tone}]} */
  hub: g => {
    const ns = (g.nodes || []).slice(0, 6), W = 300, H = 160, cx = 150, cy = 80, R = 60;
    let b = "";
    ns.forEach((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ns.length, x = cx + Math.cos(a) * R * 1.45, y = cy + Math.sin(a) * R;
      b += `<path d="M${cx} ${cy}L${x} ${y}" class="g-ln g-thin"/>`; });
    ns.forEach((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ns.length, x = cx + Math.cos(a) * R * 1.45, y = cy + Math.sin(a) * R;
      const pw = Math.min(96, Math.max(44, gW(gCut(s.label, 9)) + 16)); b += `<rect x="${x - pw / 2}" y="${y - 11}" width="${pw}" height="22" rx="11" class="${gTone(s.tone)}"/>` + gTxt(x, y + 4, gCut(s.label, 9)); });
    const cl = gCut(g.center?.label, 12), cr = Math.max(26, gW(cl) / 2 + 9);
    b += `<circle cx="${cx}" cy="${cy}" r="${cr}" class="${gTone(g.center?.tone || "hi")}"/>` + gTxt(cx, cy + 4, cl, "g-tx-b");
    return gSvg(W, H, b, `${g.center?.label || "中心"} 连着 ${ns.length} 个节点`);
  },

  /* 一段对话：{turns:[{role:"user"|"ai"|"tool", text, tone}]}（最多 4 轮） */
  chat: g => {
    const ts = (g.turns || []).slice(0, 4), W = 260; let y = 6, b = "";
    ts.forEach(t => { const right = t.role === "user", w = Math.min(200, 24 + gW((t.role === "tool" ? "⚙ " : "") + gCut(t.text, 18))), x = right ? W - 8 - w : 8;
      const cls = t.tone ? gTone(t.tone) : t.role === "tool" ? "g-dim" : right ? "g-def" : "g-bx";
      b += `<rect x="${x}" y="${y}" width="${w}" height="24" rx="10" class="${cls}"/>` + gTxt(x + 10, y + 16, (t.role === "tool" ? "⚙ " : "") + gCut(t.text, 18), "g-tx", "start"); y += 30; });
    return gSvg(W, y + 2, b, "一段对话");
  },

  /* 软件窗口，列表里某几行是重点：{title, items:[{label, tone}]} */
  window: g => {
    const it = (g.items || []).slice(0, 6), W = 240, H = 34 + it.length * 20 + 6;
    let b = `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="8" class="g-bx"/><path d="M4 24h${W - 8}" class="g-ln g-thin"/><circle cx="16" cy="14" r="3" class="g-dot"/><circle cx="26" cy="14" r="3" class="g-dot"/><circle cx="36" cy="14" r="3" class="g-dot"/>` + gTxt(W / 2, 18, gCut(g.title, 16));
    it.forEach((r, i) => { const y = 30 + i * 20; b += `<rect x="12" y="${y}" width="${W - 24}" height="16" rx="4" class="${r.tone ? gTone(r.tone) : "g-dim"}"/>` + gTxt(20, y + 12, gCut(r.label, 22), r.tone === "hi" ? "g-tx-b" : "g-tx", "start"); });
    return gSvg(W, H, b, `${g.title || "窗口"} 的界面示意`);
  },

  /* 点阵比例（100 个里有几个）：{total, hi, cols, label} */
  dots: g => {
    const total = gClamp(g.total, 1, 200) | 0, hi = gClamp(g.hi, 0, total) | 0, cols = gClamp(g.cols ?? (total > 50 ? 20 : 10), 1, 25) | 0, r = 4.5, gap = 12, rows = Math.ceil(total / cols);
    let b = ""; for (let i = 0; i < total; i++) b += `<circle cx="${10 + (i % cols) * gap}" cy="${10 + Math.floor(i / cols) * gap}" r="${r}" class="${i < hi ? "g-hi-solid" : "g-dim"}"/>`;
    return gSvg(20 + (cols - 1) * gap, 20 + (rows - 1) * gap, b, `${total} 个里有 ${hi} 个`);
  },

  /* 环形百分比：{value, max, label} */
  ring: g => {
    const max = Number(g.max) || 100, v = gClamp(g.value, 0, max), R = 40, C = 2 * Math.PI * R, f = v / max;
    return gSvg(120, 110, `<circle cx="60" cy="52" r="${R}" class="g-ring-bg"/><circle cx="60" cy="52" r="${R}" class="g-ring" stroke-dasharray="${(f * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 52)"/>` +
      gTxt(60, 58, g.display ?? `${v}${max === 100 ? "%" : ""}`, "g-tx-big") + (g.label ? gTxt(60, 106, gCut(g.label, 12)) : ""), `${g.label || ""} ${v}/${max}`);
  },

  /* 面积对比（芯片变小多少）：{before:{label, value}, after:{label, value}} */
  area: g => {
    const a = Math.max(Number(g.before?.value) || 1, 0.01), z = Math.max(Number(g.after?.value) || 1, 0.01), m = Math.max(a, z), S = 84;
    const sa = S * Math.sqrt(a / m), sz = S * Math.sqrt(z / m), W = 230, base = 96;
    return gSvg(W, 122, `<rect x="${20 + (S - sa) / 2}" y="${base - sa}" width="${sa}" height="${sa}" rx="4" class="g-bx"/><rect x="${126 + (S - sz) / 2}" y="${base - sz}" width="${sz}" height="${sz}" rx="4" class="g-hi"/>` +
      gTxt(20 + S / 2, 114, gCut(g.before?.label, 10)) + gTxt(126 + S / 2, 114, gCut(g.after?.label, 10), "g-tx-b") + `<path d="M108 ${base - 30}h12m-4-4 4 4-4 4" class="g-ln"/>`, "面积对比");
  },

  /* 两台设备之间传东西：{left:{kind, label, tone}, right:{kind, label, tone}, arrow}；kind: laptop/phone/server/cloud/chip */
  devices: g => {
    const dev = (d, x) => { const k = d?.kind, c = gTone(d?.tone);
      const shape = k === "phone" ? `<rect x="${x + 22}" y="10" width="36" height="62" rx="7" class="${c}"/>`
        : k === "server" ? `<rect x="${x + 8}" y="10" width="64" height="18" rx="3" class="${c}"/><rect x="${x + 8}" y="32" width="64" height="18" rx="3" class="${c}"/><rect x="${x + 8}" y="54" width="64" height="18" rx="3" class="${c}"/>`
        : k === "cloud" ? `<path d="M${x + 18} 64a16 16 0 0 1 2-32 22 22 0 0 1 42 4 14 14 0 0 1 2 28z" class="${c}"/>`
        : k === "chip" ? `<rect x="${x + 16}" y="14" width="48" height="48" rx="5" class="${c}"/><path d="M${x + 26} 8v6M${x + 40} 8v6M${x + 54} 8v6M${x + 26} 62v6M${x + 40} 62v6M${x + 54} 62v6" class="g-ln"/>`
        : `<rect x="${x + 10}" y="12" width="60" height="42" rx="4" class="${c}"/><path d="M${x + 2} 62h76l-6 8H${x + 8}z" class="${c}"/>`;
      return shape + gTxt(x + 40, 92, gCut(d?.label, 12), d?.tone === "hi" ? "g-tx-b" : "g-tx"); };
    return gSvg(320, 100, dev(g.left, 14) + dev(g.right, 226) + `<path d="M108 40h110m-6-6 6 6-6 6" class="g-ln"/>` + (g.arrow ? gTxt(163, 32, gCut(g.arrow, 12)) : ""), `${g.left?.label || ""} 到 ${g.right?.label || ""}`);
  },

  /* 漏斗：{stages:[{label, value, tone}]}（从多到少） */
  funnel: g => {
    const st = (g.stages || []).slice(0, 5), max = Math.max(...st.map(s => Number(s.value) || 0), 1), W = 260, sh = 22;
    return gSvg(W, st.length * (sh + 4) + 4, st.map((s, i) => { const w = Math.min(W - 8, Math.max(gW(`${gCut(s.label, 10)} ${s.display ?? s.value ?? ""}`) + 20, (Number(s.value) || 0) / max * (W - 16)));
      return `<rect x="${(W - w) / 2}" y="${2 + i * (sh + 4)}" width="${w}" height="${sh}" rx="5" class="${gTone(s.tone)}"/>` + gTxt(W / 2, 2 + i * (sh + 4) + 15, `${gCut(s.label, 10)} ${s.display ?? s.value ?? ""}`, s.tone === "hi" ? "g-tx-b" : "g-tx"); }).join(""), "逐级筛选");
  },

  /* 24 小时时钟带：{segments:[{from, to, tone, label}]}（小时，0–24） */
  clock: g => {
    const W = 280, x0 = 10, tw = W - 20, s = tw / 24;
    let b = `<rect x="${x0}" y="12" width="${tw}" height="20" rx="5" class="g-bx"/>`;
    (g.segments || []).slice(0, 6).forEach(seg => { const a = gClamp(seg.from, 0, 24), z = gClamp(seg.to, a, 24);
      b += `<rect x="${x0 + a * s}" y="12" width="${Math.max(3, (z - a) * s)}" height="20" rx="4" class="${gTone(seg.tone || "hi")}"/>` + (seg.label ? gTxt(x0 + (a + z) / 2 * s, 46, gCut(seg.label, 8)) : ""); });
    [0, 6, 12, 18, 24].forEach(h => b += gTxt(x0 + h * s, 8, `${h}`, "g-tx g-tx-s"));
    return gSvg(W, 52, b, "一天 24 小时里的时段");
  },

  /* 勾选矩阵（谁有哪些权限、哪个型号支持哪些功能）：{rows:[...], cols:[...], cells:[[0/1/2]]}，1 = 有，2 = 重点，0 = 没有 */
  matrix: g => {
    const R = (g.rows || []).slice(0, 7).map(r => gCut(r, 10)), C = (g.cols || []).slice(0, 6).map(c => gCut(c, 10)), rh = 20;
    const L = Math.max(40, ...R.map(gW)) + 12, cw = Math.max(34, ...C.map(gW)) + 10, W = L + C.length * cw + 8, H = 24 + R.length * rh + 4;
    let b = C.map((c, j) => gTxt(L + j * cw + cw / 2, 14, c)).join("");
    R.forEach((r, i) => { const y = 22 + i * rh; b += gTxt(L - 6, y + 13, r, "g-tx", "end");
      C.forEach((c, j) => { const v = g.cells?.[i]?.[j] ?? 0, x = L + j * cw + cw / 2;
        b += v ? `<circle cx="${x}" cy="${y + 9}" r="7" class="${v === 2 ? "g-hi" : "g-def"}"/><path d="M${x - 3} ${y + 9}l2 2 4-4" class="g-ck"/>` : `<circle cx="${x}" cy="${y + 9}" r="7" class="g-dim"/>`; }); });
    return gSvg(W, H, b, "功能或权限矩阵");
  }
};

/* 小柱状图（封面和卡片用）：{items:[{label, value, tone}]}，用真实数值按比例画 */
GLYPHS.minibars = g => {
  /* 封面用（g.bare）：不写标签、画布更小，缩放后数字更大更清楚 */
  const it = (g.items || []).filter(x => Number.isFinite(+x.value)).slice(0, 6), n = it.length || 1, max = Math.max(...it.map(x => +x.value), 1);
  const bare = !!g.bare, W = bare ? 150 : 240, H = bare ? 104 : 130, base = bare ? 100 : 100, top = bare ? 70 : 84;
  const bw = Math.min(bare ? 30 : 44, (W - 16) / n - (bare ? 8 : 12)), gap = (W - 16 - n * bw) / Math.max(1, n);
  return gSvg(W, H, it.map((x, i) => { const h = Math.max(4, +x.value / max * top), X = 8 + gap / 2 + i * (bw + gap);
    return `<rect x="${X}" y="${base - h}" width="${bw}" height="${h}" rx="4" class="${gTone(x.tone || (i === 0 ? "hi" : "base"))}"/>` +
      gTxt(X + bw / 2, base - 6 - h, x.display ?? String(x.value), "g-tx-b") + (bare ? "" : gTxt(X + bw / 2, 116, gCut(x.label, Math.max(3, Math.floor(bw / 7))))); }).join("") +
    `<path d="M4 ${base}h${W - 8}" class="g-ln g-thin"/>`, "几项数值对比");
};

export function glyph(g) {
  if (!g || !GLYPHS[g.kind]) return "";
  try { return GLYPHS[g.kind](g); } catch { return ""; }
}
