/* 不依赖第三方库的 RSS 2.0 / Atom 解析，以及「无 RSS 网页」的链接提取 */
import { decodeEntities, stripCdata, htmlToText, normalizeUrl } from "./text.mjs";

function tag(block, name) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(stripCdata(m[1]).trim()) : "";
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map(m => m[1]);
  const pick = links.find(a => /rel=["']alternate["']/i.test(a)) || links.find(a => !/rel=/i.test(a)) || links[0] || "";
  const m = pick.match(/href=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : "";
}

function toIso(d) {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseFeed(xml) {
  const isAtom = /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(xml) || (/<entry\b/i.test(xml) && !/<item\b/i.test(xml));
  const blocks = [...xml.matchAll(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return blocks.map(b => {
    const title = htmlToText(tag(b, "title"));
    const url = isAtom ? atomLink(b) : (tag(b, "link") || tag(b, "guid"));
    const published = toIso(isAtom ? (tag(b, "published") || tag(b, "updated")) : (tag(b, "pubDate") || tag(b, "date") || tag(b, "updated")));
    const summary = htmlToText(isAtom ? (tag(b, "summary") || tag(b, "content")) : (tag(b, "description") || tag(b, "encoded"))).slice(0, 600);
    return { title, url: url.trim(), published, summary };
  }).filter(x => x.title && x.url);
}

/* 没有 RSS 的网页：取出符合规则的文章链接（例如 Anthropic 的 /news/...） */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
const DATE_RES = [
  [new RegExp(`\\b${MON}\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, "i"), m => [m[3], MONTHS[m[1].toLowerCase()], m[2]]],
  [new RegExp(`\\b(\\d{1,2})\\s+${MON},?\\s+(20\\d{2})\\b`, "i"), m => [m[3], MONTHS[m[2].toLowerCase()], m[1]]],
  [/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/, m => [m[1], m[2], m[3]]],
  [/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, m => [m[1], m[2], m[3]]],
  [/\b(20\d{2})[./](\d{1,2})[./](\d{1,2})\b/, m => [m[1], m[2], m[3]]]
];

/* 从一段文字里找出日期：返回 { iso, match }，找不到返回 null */
export function extractDate(text) {
  for (const [re, pick] of DATE_RES) {
    const m = String(text).match(re);
    if (!m) continue;
    const [y, mo, d] = pick(m).map(Number);
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) continue;
    return { iso: new Date(Date.UTC(y, mo - 1, d, 12)).toISOString(), match: m[0] };
  }
  return null;
}

/* 没有 RSS 的列表页：按路径规则提取文章链接。
   标题优先取链接里的 h1–h6；日期从链接文字或紧跟其后的文字里找；导航类的单个词（如 Product、Policy）跳过 */
export function parseLinks(html, { baseUrl, pattern, exclude }) {
  const re = new RegExp(pattern), ex = exclude ? new RegExp(exclude) : null;
  const seen = new Set(), out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href; try { href = new URL(decodeEntities(m[1]), baseUrl).toString(); } catch { continue; }
    const path = new URL(href).pathname;
    if (!re.test(path) || (ex && ex.test(path))) continue;
    const key = normalizeUrl(href);
    if (seen.has(key)) continue;
    const inner = m[2];
    const heading = inner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const text = htmlToText(inner).replace(/\s+/g, " ").trim();
    const after = htmlToText(html.slice(m.index + m[0].length, m.index + m[0].length + 400).split(/<a\b/i)[0]).replace(/\s+/g, " ");
    const date = extractDate(text) || extractDate(after);
    let title = (heading ? htmlToText(heading[1]) : text).replace(/\s+/g, " ").trim();
    if (date && title.includes(date.match)) title = title.replace(date.match, " ").replace(/\s+/g, " ").trim();
    title = title.replace(/^(featured|new|latest|announcement|product|research|news)\s+(?=[A-Z0-9])/i, "").trim();
    if (title.length < 6 || /^[A-Za-z&'-]+$/.test(title)) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 160), url: href, published: date?.iso || null, summary: heading && text !== title ? text.slice(0, 300) : "" });
  }
  return out;
}
