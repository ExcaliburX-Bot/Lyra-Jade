/* 英文版：把一篇中文解读翻成英文（DeepSeek）
   做法：把文章里所有要翻的中文字段拆成带编号的片段，整篇一次交给模型（模型看得到全文上下文，前后用词一致），
   拿回「编号 → 英文」，再填回原来的结构。数字字段（value、max 等）、链接、日期、栏目不经过模型，结构和数值不会被改坏。
   两遍：第一遍翻译改写（开思考），第二遍由「母语编辑」只改不地道的说法。每遍之后都核对数字，对不上就让模型改一次。 */
import fs from "node:fs";
import path from "node:path";
import { PROMPTS } from "./paths.mjs";
import { sha } from "./text.mjs";
import { parseChatStream, repairJson } from "./llm.mjs";

export const TRANSLATE_MODEL = process.env.WG_TRANSLATE_MODEL || "deepseek-v4-pro";

const CJK = /[⺀-鿿　-〿豈-﫿＀-￯]/;
/* 这些字段不翻：标识、链接、日期、颜色、图型名、原文引语（本来就是原文的语言）、代码。
   value、status、role 不在这里：只有写成中文的才会被拆出来（「数千」「未公布价格」、引语卡片的头衔「OpenAI 总裁」），这些要翻 */
const SKIP = new Set(["slug", "category", "date", "url", "source_url", "quote", "tone", "type", "kind",
  "lang", "translated_from", "pipeline", "code", "lines", "max", "min", "from", "to", "select", "id", "icon", "pic", "zh"]);

/* 片段的位置说明，给模型当上下文用 */
function where(p) {
  const s = p.join(".");
  if (s === "title") return "headline";
  if (s === "summary") return "standfirst (lede under the headline)";
  if (s === "ai_summary") return "AI summary box";
  if (p[0] === "brief") return "one-minute brief, bullet";
  if (p[0] === "claims") return p.at(-1) === "as_written" ? "fact list: how the article phrases this number" : "fact list: the fact";
  if (p[0] === "sources") return "sources box";
  if (p[0] === "cover") return `cover image ${p.at(-1)}`;
  if (p[0] === "sections") {
    const n = +p[1] + 1;
    if (p[2] === "h") return `section ${n} heading`;
    if (p.includes("fig")) return `section ${n} figure: ${p.slice(p.indexOf("fig") + 1).filter(x => !/^\d+$/.test(x)).join(" ")}`;
    if (p.includes("list")) return `section ${n} list item`;
    return `section ${n} paragraph`;
  }
  return s;
}

/* 拆片段：所有含中文的字符串（跳过 SKIP 里的字段）。只读，不改文章 */
export function collectSegments(a) {
  const out = [];
  const walk = (o, p) => {
    if (typeof o === "string") { if (CJK.test(o) && !SKIP.has(p.at(-1))) out.push({ id: `s${out.length + 1}`, path: p, where: where(p), text: o }); return; }
    if (Array.isArray(o)) return o.forEach((x, i) => walk(x, [...p, String(i)]));
    if (o && typeof o === "object") for (const k of Object.keys(o)) { if (k !== "pipeline" && (!SKIP.has(k) || typeof o[k] === "object")) walk(o[k], [...p, k]); }
  };
  walk(a, []);
  return out;
}

/* 中文稿的「内容指纹」：中文稿改了就要重翻；只改核对标记、流水线信息不算 */
export function sourceHash(a) {
  const { verified, pipeline, status, no, ...rest } = a;
  for (const k of Object.keys(rest)) if (k.startsWith("_")) delete rest[k];   /* 构建时加的 _pub、_day 不算 */
  return sha(JSON.stringify(rest), 16);
}

/* 填回去：深拷贝中文稿，按路径换成英文；引语卡片的中文译文去掉（英文版直接看原文） */
export function applySegments(a, segs, map) {
  const b = structuredClone(a);
  for (const s of segs) {
    let o = b;
    for (const k of s.path.slice(0, -1)) o = o[k];
    o[s.path.at(-1)] = map[s.id];
  }
  for (const sec of b.sections || []) for (const bl of sec.blocks || []) if (bl.fig?.type === "quote") delete bl.fig.zh;
  b.lang = "en";
  b.translated_from = sourceHash(a);
  delete b.pipeline;
  return b;
}

/* ---------- 数字核对 ----------
   每个片段里中文写到的数字，英文里都要有（按数值比，100 万 = 1 million = 1M，11 月 = November） */
const ZH_MULT = { "万亿": 1e12, "亿": 1e8, "万": 1e4, "千": 1e3, "百万": 1e6 };
const EN_MULT = { trillion: 1e12, billion: 1e9, million: 1e6, thousand: 1e3, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  hundred: 100, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, half: 0.5, twice: 2, double: 2, triple: 3 };
const key = n => String(+n.toPrecision(9));

export function numbersZh(s) {
  const out = [];
  for (const m of String(s).matchAll(/(\d[\d,]*(?:\.\d+)?)(?:\s*(?:多|余)?\s*(万亿|百万|亿|万|千(?![瓦米克字卡赫焦]))|([KMBT])(?![A-Za-z]))?/g)) {
    /* 「100 多亿」「50 余万」：多 / 余 夹在数字和数量级之间，仍按 100 亿、50 万算 */
    /* 「千」后面跟单位时是单位的一部分（千瓦时、千米、千克），不是数量级 */
    const n = parseFloat(m[1].replace(/,/g, "")) * (m[2] ? ZH_MULT[m[2]] : m[3] ? EN_MULT[m[3].toLowerCase()] : 1);
    if (Number.isFinite(n)) out.push(key(n));
  }
  return out;
}

export function numbersEn(s) {
  const out = new Set();
  const t = String(s);
  for (const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)(?:[\s-]*(trillion|billion|million|thousand)\b|([kKMBT])(?![A-Za-z]))?/g)) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    const mult = m[2] ? EN_MULT[m[2]] : m[3] ? EN_MULT[m[3].toLowerCase()] : 1;
    out.add(key(base * mult)); out.add(key(base));
  }
  for (const m of t.toLowerCase().matchAll(/\b([a-z]+)\b/g)) {
    const w = m[1];
    if (w in WORDS) out.add(key(WORDS[w]));
    const mi = MONTHS.indexOf(w.slice(0, 3));
    if (mi >= 0 && (w.length === 3 || /^(january|february|march|april|may|june|july|august|september|october|november|december|sept)$/.test(w))) out.add(key(mi + 1));
  }
  return out;
}

/* 核对一遍：缺片段、还有中文、数字对不上 → 返回问题清单（按片段） */
export function checkTranslation(segs, map) {
  const problems = [];
  for (const s of segs) {
    const en = map[s.id];
    if (typeof en !== "string" || !en.trim()) { problems.push({ id: s.id, msg: "missing translation" }); continue; }
    if (CJK.test(en)) problems.push({ id: s.id, msg: `still contains Chinese characters or full-width punctuation: ${en.match(new RegExp(CJK.source, "g")).slice(0, 6).join("")}` });
    /* 3,000,000,000,000 这种长串读者没法读：大数用 3 trillion、1.2 billion、1M */
    if (/\d{1,3}(?:,\d{3}){3,}/.test(en) && !/\d{1,3}(?:,\d{3}){3,}/.test(s.text)) problems.push({ id: s.id, msg: "write large numbers the way English readers do (3 trillion, $119.5 billion, 1M), not as long digit strings" });
    const have = numbersEn(en);
    const miss = [...new Set(numbersZh(s.text))].filter(n => !have.has(n));
    if (miss.length) problems.push({ id: s.id, msg: `numbers missing or changed: ${miss.join(", ")} (Chinese: ${s.text.slice(0, 120)})` });
  }
  return problems;
}

/* ---------- 调模型 ---------- */
export function translatorPrompt() { return fs.readFileSync(path.join(PROMPTS, "translator.md"), "utf8"); }

/* 长文分批翻译：每批不超过这么多个中文字符。每一批都带着全文（中文）和前面已经翻好的英文，保证上下文和用词一致 */
export const BATCH_CHARS = Number(process.env.WG_TRANSLATE_BATCH || 6000);
export function batches(segs, max = BATCH_CHARS) {
  const out = [[]]; let n = 0;
  for (const s of segs) { if (n + s.text.length > max && out.at(-1).length) { out.push([]); n = 0; } out.at(-1).push(s); n += s.text.length; }
  return out.filter(b => b.length);
}

export function translateUser(a, segs, sourceText = "", { only = segs, done = {} } = {}) {
  const whole = only.length < segs.length;
  const lines = (whole ? only : segs).map(s => `${s.id} [${s.where}]\n${s.text}`).join("\n\n");
  const ctx = whole ? `## The whole article in Chinese, for context (do NOT translate this part)\n\n${segs.map(s => `${s.id} ${s.text}`).join("\n")}\n\n` +
    (Object.keys(done).length ? `## Already translated (keep the same terms, names and tone)\n\n${Object.entries(done).map(([k, v]) => `${k} ${v}`).join("\n")}\n\n` : "") : "";
  const src = sourceText ? `\n\n## Primary source (English original, for terminology and official names only — do not copy its sentences)\n\n${sourceText.slice(0, 20000)}` : "";
  return `Article: ${a.title}\nPublisher: ${a.publisher}\nSection: ${a.category}\nSource: ${a.sources?.main?.title || ""} (${a.sources?.main?.url || ""})\n\n${ctx}## Segments to translate now (in reading order)\n\n${lines}${src}\n\nReturn one JSON object mapping every segment id (${only[0]?.id}…${only.at(-1)?.id}, ${only.length} in total) to its English text.`;
}

export function polishUser(a, segs, map, { done = {} } = {}) {
  const lines = segs.map(s => `${s.id} [${s.where}]\nZH: ${s.text}\nEN: ${map[s.id]}`).join("\n\n");
  const ctx = Object.keys(done).length ? `## Earlier parts of the article, already final (keep terms consistent; do not return these)\n\n${Object.entries(done).map(([k, v]) => `${k} ${v}`).join("\n")}\n\n` : "";
  return `Article: ${a.title}\n\n${ctx}${lines}\n\nReturn one JSON object mapping every segment id above to the final English text (${segs.length} in total). Keep a segment unchanged if it already reads well.`;
}

export function fixUser(segs, map, problems) {
  const byId = Object.fromEntries(segs.map(s => [s.id, s]));
  return problems.map(p => `${p.id} [${byId[p.id]?.where}]\nZH: ${byId[p.id]?.text}\nEN: ${map[p.id] ?? ""}\nPROBLEM: ${p.msg}`).join("\n\n") +
    `\n\nFix only these segments and keep the rest of each sentence natural. Every number in the Chinese must appear in the English with the same value, written the way an English tech publication would: digits plus a word or suffix for large magnitudes (3 trillion, 3-trillion-parameter, $119.5 billion, 1M tokens), never long strings of zeros (万 = 10,000, 亿 = 100 million, 万亿 = trillion). Remove all Chinese characters and full-width punctuation (use “ ” for quotes). Return a JSON object mapping only these ids to the corrected English.`;
}

export function parseMap(content) {
  const block = String(content).match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = block ? block[1] : String(content).slice(String(content).indexOf("{"), String(content).lastIndexOf("}") + 1);
  let o; try { o = JSON.parse(raw); } catch { try { o = JSON.parse(repairJson(raw)); } catch (e) { throw new Error(`翻译结果不是合法 JSON（${e.message.slice(0, 100)}）`); } }
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("翻译结果不是「编号 → 英文」的对象");
  if (o.segments && typeof o.segments === "object") o = o.segments;
  return o;
}

async function chat({ system, user, thinking }, tries = 2) {
  const k = process.env.DEEPSEEK_API_KEY;
  if (!k) throw new Error("缺少 DEEPSEEK_API_KEY");
  const started = Date.now();
  const body = { model: TRANSLATE_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(thinking ? { reasoning_effort: "high" } : { thinking: { type: "disabled" } }), max_tokens: 32768, stream: true, stream_options: { include_usage: true } };
  let raw;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${k}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(20 * 60_000) });
    if (!res.ok) { const e = new Error(`DeepSeek 接口返回 ${res.status}：${(await res.text()).slice(0, 300)}`); e.status = res.status; throw e; }
    raw = await res.text();
  } catch (e) {
    /* 连接中断（terminated、超时、5xx）重试一次；4xx 是请求本身的问题，不重试 */
    if (tries > 1 && !(e.status >= 400 && e.status < 500)) { console.log(`  连接出错（${e.message.slice(0, 80)}），30 秒后重试`); await new Promise(r => setTimeout(r, 30_000)); return chat({ system, user, thinking }, tries - 1); }
    throw e;
  }
  const out = parseChatStream(raw);
  if (out.finish === "length") throw new Error("翻译输出被截断");
  console.log(`  DeepSeek ${Math.round((Date.now() - started) / 1000)} 秒${out.usage ? `，输入 ${out.usage.prompt_tokens} / 输出 ${out.usage.completion_tokens} token` : ""}`);
  return parseMap(out.content);
}

/* 整篇翻译。mock：测试用，传入 (阶段, 片段) => 编号到英文的对象 */
export async function translateArticle(a, { sourceText = "", polish = process.env.WG_TRANSLATE_POLISH !== "0", mock = null } = {}) {
  const segs = collectSegments(a);
  const call = mock ? async (stage, user) => mock(stage, segs, user) : async (stage, user) => {
    const sys = translatorPrompt();
    if (stage === "translate") return chat({ system: sys, user, thinking: true });
    if (stage === "polish") return chat({ system: `${sys}\n\n# This pass: native-speaker edit\n\nYou are now the second editor. The draft below was translated from Chinese. Read it as a native English tech reader would and rewrite anything that sounds translated: Chinese word order, stiff nominalizations, filler, calques, inconsistent terms, headline case. Keep every fact, number, name and hedge exactly. Do not add information.`, user, thinking: false });
    return chat({ system: sys, user, thinking: false });
  };
  const fixUp = async (map, label) => {
    let problems = checkTranslation(segs, map);
    if (problems.length) {
      console.log(`  ${label}后有 ${problems.length} 处要改，让模型修一次`);
      Object.assign(map, await call("fix", fixUser(segs, map, problems)));
      problems = checkTranslation(segs, map);
    }
    return problems;
  };
  const parts = batches(segs);
  if (parts.length > 1) console.log(`  长文：分 ${parts.length} 批翻译`);
  let map = {};
  for (const part of parts) Object.assign(map, await call("translate", translateUser(a, segs, sourceText, parts.length > 1 ? { only: part, done: map } : {})));
  let problems = await fixUp(map, "翻译");
  if (polish && !problems.length) {
    const polished = { ...map };
    for (const [i, part] of parts.entries()) {
      const done = Object.fromEntries(parts.slice(0, i).flat().map(s => [s.id, polished[s.id]]));
      Object.assign(polished, await call("polish", polishUser(a, part, map, { done })));
    }
    const p2 = await fixUp(polished, "润色");
    if (!p2.length) map = polished; else console.log(`  润色版有 ${p2.length} 处数字对不上，保留第一遍译文`);
  }
  return { article: problems.length ? null : applySegments(a, segs, map), problems, segments: segs.length };
}
