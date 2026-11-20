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
