/* 把同一件事的多条素材合并成「事件」，再给事件打分，分高的进候选清单 */
import { grams, gramSimilarity, sha } from "./text.mjs";

export const TIER_WEIGHT = { official: 3, primary: 2.5, eval: 1.5, discovery: 1, media: 0.8 };
const BOOST = /(launch|introduc|release|announc|open[- ]?sourc|now available|发布|推出|开源|上线|模型|model|agent)/i;
const DAMP = /(hiring|webinar|customer story|case study|podcast recap|招聘|活动报名|客户案例)/i;

/* 合并成事件：两条素材链接相同，或时间相近且标题相似，就算同一件事；有传递性（A~B、B~C 则 A、B、C 一起）。
   用并查集做，结果和素材的先后顺序无关 */
export function cluster(items, { threshold = 0.55, windowHours = 72 } = {}) {
  const list = [...items].sort((a, b) => (b.published || b.fetched_at).localeCompare(a.published || a.fetched_at));
  const t = list.map(it => Date.parse(it.published || it.fetched_at));
  const g = list.map(it => grams(it.title));
  const parent = list.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const byKey = new Map();
  list.forEach((it, i) => { if (byKey.has(it.key)) union(byKey.get(it.key), i); else byKey.set(it.key, i); });
  const win = windowHours * 3600e3;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length && t[i] - t[j] < win; j++)
      if (find(i) !== find(j) && gramSimilarity(g[i], g[j]) >= threshold) union(i, j);
  const groups = new Map();
  list.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
  return [...groups.values()].map(evItems => ({ t: Date.parse(evItems[0].published || evItems[0].fetched_at), title: evItems[0].title, items: evItems }));
}

export function scoreEvent(ev, now = Date.now()) {
  const best = ev.items.reduce((a, b) => (TIER_WEIGHT[b.tier] ?? 1) * (b.weight ?? 1) > (TIER_WEIGHT[a.tier] ?? 1) * (a.weight ?? 1) ? b : a);
  const sources = new Set(ev.items.map(x => x.source)).size;
  const ageH = (now - ev.t) / 3600e3;
  let s = (TIER_WEIGHT[best.tier] ?? 1) * (best.weight ?? 1);
  s += 0.6 * Math.log2(1 + sources);
  s += ageH < 12 ? 1.5 : ageH < 24 ? 1 : ageH < 72 ? 0.5 : 0;
  if (BOOST.test(ev.title)) s += 0.8;
  if (DAMP.test(ev.title)) s -= 1.5;
  return Math.round(s * 100) / 100;
}

/* 候选：每个事件选「信源层级最高」的那条当主材料 */
export function toCandidates(items, now = Date.now()) {
  return cluster(items).map(ev => {
    /* 层级高的优先；同层级时，直接抓到的一手页面优先于 X 帖子转述，再按先发布 */
    const main = [...ev.items].sort((a, b) =>
      ((TIER_WEIGHT[b.tier] ?? 1) - (TIER_WEIGHT[a.tier] ?? 1)) || ((a.via ? 1 : 0) - (b.via ? 1 : 0)) ||
      (a.published || a.fetched_at).localeCompare(b.published || b.fetched_at))[0];
    return {
      id: sha(main.key, 10),
      title: main.title,
      url: main.url,
      publisher: main.publisher,
      tier: main.tier,
      published: main.published || main.fetched_at,
      /* 只有 X 帖子、没有任何直接抓到的一手页面：材料通常太薄，打 7.5 折 */
      score: Math.round(scoreEvent(ev, now) * (/^https:\/\/(x|twitter)\.com\//.test(main.url) && ev.items.every(i => i.via) ? 0.75 : 1) * 10) / 10,
      category_hint: main.category_hint || null,
      ...(main.text ? { text: main.text } : {}),
      ...(main.via ? { via: main.via } : {}),
      ...(main.discovered_by ? { discovered_by: main.discovered_by } : {}),
      related: ev.items.filter(x => x !== main).map(x => ({ title: x.title, url: x.url, publisher: x.publisher, tier: x.tier, ...(x.text ? { text: x.text } : {}) }))
    };
  }).sort((a, b) => b.score - a.score);
}
