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
export function parseLinks(html, { baseUrl, pattern }) {
  const re = new RegExp(pattern);
  const seen = new Set(), out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href; try { href = new URL(decodeEntities(m[1]), baseUrl).toString(); } catch { continue; }
    const path = new URL(href).pathname;
    if (!re.test(path)) continue;
    const key = normalizeUrl(href);
    const title = htmlToText(m[2]).replace(/\s+/g, " ").trim();
    if (seen.has(key) || title.length < 6) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 200), url: href, published: null, summary: "" });
  }
  return out;
}
