/* 模型输出的小格式问题，在校验前自动修正（不改事实）：
   - 图里该是数值的地方写成了「70.9%」「约 12」这样的文字 → 转成数字 */
const NUMERIC = /^[\s~约≈>+＞]*(-?\d[\d,]*(?:\.\d+)?)\s*(%|分|倍)?\s*$/;
const toNum = v => {
  if (typeof v !== "string") return v;
  const m = v.match(NUMERIC);
  return m ? Number(m[1].replace(/,/g, "")) : v;
};

export function normalizeArticle(a) {
  const fixes = [];
  const fix = (obj, key, where) => {
    if (obj && typeof obj[key] === "string") {
      const n = toNum(obj[key]);
      if (typeof n === "number") { fixes.push(`${where}：「${obj[key]}」→ ${n}`); obj[key] = n; }
    }
  };
  for (const sec of a.sections || []) for (const b of sec.blocks || []) {
    const f = b.fig; if (!f) continue;
    if (f.type === "bars") for (const g of f.groups || []) for (const it of g.items || []) fix(it, "value", `图「${f.title}」的 ${it.label}`);
    if (f.type === "capacity") { fix(f, "max", `图「${f.title}」的 max`); for (const it of [...(f.items || []), ...(f.thresholds || [])]) fix(it, "value", `图「${f.title}」的 ${it.label}`); }
    if (f.type === "pipeline" && f.compare) { fix(f.compare, "max", `图「${f.title}」的 max`); for (const it of f.compare.items || []) fix(it, "value", `图「${f.title}」的 ${it.label}`); }
    if (f.type === "columns") for (const it of f.items || []) fix(it, "value", `图「${f.title}」的 ${it.label}`);
    /* 示意零件写扁了：glyph 写成零件名字符串、参数平铺在外层 → 收拢成 {kind, ...参数} */
    const GLYPH_KEYS = ["count", "select", "rows", "cols", "lanes", "lines", "total", "segments", "layers", "nodes", "center", "turns", "items", "hi", "value", "max", "label", "display", "before", "after", "left", "right", "arrow", "stages", "cells", "title"];
    const lift = (host, where) => {
      if (!host || typeof host.glyph !== "string") return;
      const g = { kind: host.glyph };
      for (const k of GLYPH_KEYS) if (host[k] != null && !(host === f && ["items", "title"].includes(k) && f.type !== "illustration")) { g[k] = host[k]; if (host === f && f.type === "illustration" && k !== "title") delete host[k]; }
      if (host === f && f.type === "illustration") delete g.title;
      host.glyph = g; fixes.push(`${where}：示意零件 ${g.kind} 的参数收拢进 glyph`);
    };
    lift(f, `图「${f.title}」`);
    for (const x of [...(f.items || []), ...(f.panels || [])]) if (x && typeof x.glyph === "string") lift(x, `图「${f.title}」的 ${x.title || x.label || ""}`);
    if (f.type === "timeline") { if (f.axis) { fix(f.axis, "from", "时间轴"); fix(f.axis, "to", "时间轴"); } for (const l of f.lanes || []) for (const s of l.segments || []) { fix(s, "from", l.label); fix(s, "to", l.label); } }
  }
  return fixes;
}

/* 按句子截短（模型精简失败时的兜底）：保留前面的句子，直到不超过 max 字 */
export function trimBySentences(text, max = 300, min = 100) {
  const len = t => [...t.replace(/\s/g, "")].length;
  if (len(text) <= max) return text;
  const parts = text.split(/(?<=[。！？；])/);
  let out = "";
  for (const p of parts) { if (len(out + p) > max) break; out += p; }
  return len(out) >= min ? out.trim() : text;
}
