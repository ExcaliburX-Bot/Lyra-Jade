import crypto from "node:crypto";

export const sha = (s, n = 12) => crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, n);

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
export function decodeEntities(s) {
  return String(s ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(code) ? String.fromCodePoint(code) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function stripCdata(s) { return String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); }

/* 网页 → 纯文本：去掉脚本、样式、导航，保留段落换行 */
export function htmlToText(html) {
  return decodeEntities(String(html ?? "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/* 去掉跟踪参数和锚点，统一结尾斜杠，用来去重 */
export function normalizeUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    [...x.searchParams.keys()].forEach(k => { if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(k)) x.searchParams.delete(k); });
    x.hostname = x.hostname.replace(/^www\./, "");
    let s = x.toString();
    if (s.endsWith("/") && x.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch { return String(u || "").trim(); }
}

/* 标题相似度：字符二元组的 Jaccard，中英文都适用 */
export function grams(s) {
  const t = String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const g = new Set();
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}
export function similarity(a, b) {
  return gramSimilarity(grams(a), grams(b));
}

export function gramSimilarity(A, B) {
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/* 数字规范化：去掉千位逗号和空格，便于在原文里查找 */
/* 比对用的规范化：去千位逗号和空白、统一大小写；弯引号、长短破折号、全角符号统一成普通写法
   （原文常用 Zapier’s，模型引用时常写成 Zapier's，这不算改写） */
export const normNum = s => String(s)
  .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
  .replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u2026/g, "...")
  .replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/[\s\u00A0\u3000]+/g, "").toLowerCase();
