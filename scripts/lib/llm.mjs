/* 调用大模型：写稿用「强制工具调用」拿结构化 JSON；X 监测用 Grok 的 X 搜索
   写稿模型由 WG_PROVIDER 决定：xai（默认，需要 XAI_API_KEY）、deepseek（需要 DEEPSEEK_API_KEY）或 anthropic（需要 ANTHROPIC_API_KEY）
   WG_MODEL 可覆盖具体模型 */
import fs from "node:fs";
import path from "node:path";
import { FIXTURES } from "./paths.mjs";

export const PROVIDER = (process.env.WG_PROVIDER || "xai").toLowerCase();
const DEFAULTS = { anthropic: "claude-sonnet-5-5", xai: "grok-4.7", deepseek: "deepseek-v4-pro" };
export const KEY_OF = { xai: "XAI_API_KEY", deepseek: "DEEPSEEK_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
export const DEFAULT_MODEL = process.env.WG_MODEL || DEFAULTS[PROVIDER] || DEFAULTS.xai;
export const XAI_SEARCH_MODEL = process.env.WG_X_MODEL || "grok-4.7";
/* grok-4.7 默认 high 且无法关闭推理；写稿用 medium，够用且快得多。可用 WG_REASONING 改：low / medium / high / xhigh */
export const XAI_REASONING = process.env.WG_REASONING || "medium";

const TOOL = { name: "submit_article", description: "提交写好的解读文章（结构化）" };

/* ---------- 解析：单独导出，方便测试 ---------- */
/* 有的模型会把文章多包一层，比如 {"article": {...}}，或把 JSON 当字符串传：统一拆出来 */
export function unwrapArticle(a, depth = 0) {
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return a; } }
  if (!a || typeof a !== "object" || Array.isArray(a)) return a;
  const isArticle = x => x && typeof x === "object" && (Array.isArray(x.sections) || typeof x.title === "string");
  if (isArticle(a) || depth >= 3) return a;
  for (const v of Object.values(a)) {
    if (!v || (typeof v !== "object" && typeof v !== "string")) continue;
    const u = unwrapArticle(v, depth + 1);
    if (isArticle(u)) return u;
  }
  return a;
}
export function parseAnthropic(json) {
  const call = (json.content || []).find(c => c.type === "tool_use" && c.name === TOOL.name);
  if (!call) throw new Error("模型没有按要求返回文章");
  return unwrapArticle(call.input);
}

export function parseXaiFunctionCall(json) {
  const call = (json.output || []).find(o => o.type === "function_call" && o.name === TOOL.name);
  if (!call) throw new Error("模型没有按要求返回文章");
  try { return unwrapArticle(typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments); }
  catch { throw new Error("模型返回的文章不是合法 JSON"); }
}

/* Responses API：所有输出文字 + 所有引用链接 */
export function xaiTextAndCitations(json) {
  let text = "";
  const urls = new Set();
  for (const o of json.output || []) {
    if (o.type !== "message") continue;
    for (const c of o.content || []) {
      if (c.type !== "output_text") continue;
      text += c.text || "";
      for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) urls.add(a.url);
    }
  }
  for (const c of json.citations || []) {
    const u = typeof c === "string" ? c : c?.url;
    if (u) urls.add(u);
  }
  return { text, citations: [...urls], usage: json.usage?.server_side_tool_usage_details || null };
}

/* ---------- 请求 ---------- */
/* xAI 写稿请求。只给一个函数，用 tool_choice: "required" 强制调用它
   （xAI 的 Responses 接口不接受 {type:"function", function:{name}} 这种写法，2026-11-20 实测返回 422） */
export function xaiWriteRequest({ system, user, schema }) {
  return {
    model: DEFAULT_MODEL,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    tools: [{ type: "function", name: TOOL.name, description: TOOL.description, parameters: schema }],
    tool_choice: "required",
    parallel_tool_calls: false,
    reasoning: { effort: XAI_REASONING },
    stream: true
  };
}

/* 解析 Responses 接口的流式返回（SSE）。优先用 response.completed 里的完整结果；
   没有的话，用逐个完成的输出项拼起来 */
export function parseResponsesStream(raw) {
  let completed = null, failed = null;
  const items = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") continue;
    let ev; try { ev = JSON.parse(data); } catch { continue; }
    if (ev.type === "response.completed" && ev.response) completed = ev.response;
    else if (ev.type === "response.output_item.done" && ev.item) items.push(ev.item);
    else if (ev.type === "response.failed" || ev.type === "error") failed = ev.response?.error?.message || ev.error?.message || ev.message || JSON.stringify(ev).slice(0, 300);
  }
  if (completed && (completed.output || []).length) return completed;
  if (items.length) return { output: items };
  throw new Error(failed ? `xAI 返回错误：${failed}` : "xAI 流式返回里没有找到结果");
}

async function postStream(url, headers, body, label, timeoutMs) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${label} 返回 ${res.status}：${(await res.text()).slice(0, 400)}`);
  return parseResponsesStream(await res.text());
}

async function post(url, headers, body, label) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
  if (!res.ok) throw new Error(`${label} 返回 ${res.status}：${(await res.text()).slice(0, 400)}`);
  return res.json();
}

function needKey(name) {
  const k = process.env[name];
  if (!k) throw new Error(`缺少 ${name}：在 GitHub 仓库的 Settings → Secrets 里添加，或本地用 --mock 试跑`);
  return k;
}

export async function writeArticle({ system, user, schema, mock = false }) {
  if (mock) return JSON.parse(fs.readFileSync(process.env.WG_MOCK_ARTICLE || path.join(FIXTURES, "llm-article.json"), "utf8"));

  if (PROVIDER === "xai") {
    const started = Date.now();
    const json = await postStream("https://api.x.ai/v1/responses", { authorization: `Bearer ${needKey("XAI_API_KEY")}` }, xaiWriteRequest({ system, user, schema }), "xAI 接口", 25 * 60_000);
    console.log(`  Grok 用时 ${Math.round((Date.now() - started) / 1000)} 秒（推理强度 ${XAI_REASONING}）`);
    return parseXaiFunctionCall(json);
  }

  if (PROVIDER === "deepseek") {
    const started = Date.now();
    const body = deepseekWriteRequest({ system, user, schema });
    const res = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${needKey("DEEPSEEK_API_KEY")}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25 * 60_000) });
    if (!res.ok) throw new Error(`DeepSeek 接口返回 ${res.status}：${(await res.text()).slice(0, 400)}`);
    const out = parseChatStream(await res.text());
    console.log(`  DeepSeek 用时 ${Math.round((Date.now() - started) / 1000)} 秒（${DEFAULT_MODEL}，思考 ${DEEPSEEK_REASONING}${out.usage ? `，输入 ${out.usage.prompt_tokens} / 输出 ${out.usage.completion_tokens} token` : ""}）`);
    return parseDeepseekArticle(out);
  }

  if (PROVIDER !== "anthropic") throw new Error(`不认识的 WG_PROVIDER：${PROVIDER}（可选 xai、deepseek、anthropic）`);
  const json = await post("https://api.anthropic.com/v1/messages", { "x-api-key": needKey("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" }, {
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    tools: [{ name: TOOL.name, description: TOOL.description, input_schema: schema }],
    tool_choice: { type: "tool", name: TOOL.name }
  }, "Anthropic 接口");
  return parseAnthropic(json);
}

/* X 搜索：限定账号和日期，让 Grok 在 X 上找帖子，返回文字和它真正看过的帖子链接 */
export async function xSearch({ system, user, handles, fromDate, toDate, mockFile = null }) {
  if (mockFile) return xaiTextAndCitations(JSON.parse(fs.readFileSync(mockFile, "utf8")));
  const json = await post("https://api.x.ai/v1/responses", { authorization: `Bearer ${needKey("XAI_API_KEY")}` }, {
    model: XAI_SEARCH_MODEL,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    tools: [{ type: "x_search", allowed_x_handles: handles.slice(0, 20), from_date: fromDate, to_date: toDate }]
  }, "xAI X 搜索");
  return xaiTextAndCitations(json);
}

/* ---------- 按链接读一条 X 帖子（含作者自己的整串）---------- */
export const X_POST_RE = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/;

/* 帖子 ID 里带着发帖时间（雪花 ID），用来把搜索限定在发帖前后几天 */
export function xPostDate(id) {
  return new Date(Number((BigInt(id) >> 22n) + 1288834974657n));
}

export function xPostRequest(url) {
  const m = String(url).match(X_POST_RE);
  if (!m) throw new Error(`不是 X 帖子链接：${url}`);
  const [, handle, id] = m, t = xPostDate(id), day = d => d.toISOString().slice(0, 10);
  return {
    handle, id,
    fromDate: day(new Date(+t - 864e5)), toDate: day(new Date(+t + 2 * 864e5)),
    system: "你是转录员。用 x_search 找到用户给的这条 X 帖子，逐字输出帖子正文。如果作者本人在同一串里接着发了后续帖子（thread），按顺序把作者自己的后续帖子也逐字输出，每条之间空一行。不翻译、不总结、不改写；不要输出别人的回复。找不到这条帖子时只输出 NOT_FOUND。",
    user: url
  };
}

export async function xPost(url, { mockFile = null } = {}) {
  const q = xPostRequest(url);
  const r = await xSearch({ system: q.system, user: q.user, handles: [q.handle], fromDate: q.fromDate, toDate: q.toDate, mockFile });
  const text = r.text.trim();
  if (!text || /^NOT_FOUND/.test(text)) throw new Error("X 搜索没有找到这条帖子");
  if (!r.citations.some(c => String(c).includes(`/status/${q.id}`))) throw new Error("X 搜索的引用里没有这条帖子，不能当原文");
  return text;
}

/* ---------- DeepSeek（OpenAI 兼容的 /chat/completions）----------
   DeepSeek 在思考模式下不支持强制调用某个函数（返回 400），所以：开着思考时只给一个函数、tool_choice 用 auto，
   提示里要求必须调用；模型若直接输出 JSON 也接受。WG_REASONING=none 时关掉思考、强制调用函数。 */
const DS_EFFORT = { low: "low", medium: "high", high: "high", xhigh: "max", max: "max", none: "none" };
export const DEEPSEEK_REASONING = DS_EFFORT[(process.env.WG_REASONING || "high").toLowerCase()] || "high";

export function deepseekWriteRequest({ system, user, schema }) {
  const thinking = DEEPSEEK_REASONING !== "none";
  return {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: `${system}\n\n写完后必须调用 submit_article 工具提交整篇文章（参数就是文章 JSON），不要把文章写在回复正文里。` },
      { role: "user", content: user }
    ],
    tools: [{ type: "function", function: { name: TOOL.name, description: TOOL.description, parameters: schema } }],
    tool_choice: thinking ? "auto" : { type: "function", function: { name: TOOL.name } },
    ...(thinking ? { reasoning_effort: DEEPSEEK_REASONING } : { thinking: { type: "disabled" } }),
    max_tokens: 65536,
    stream: true,
    stream_options: { include_usage: true }
  };
}

/* 拼起流式返回：正文、函数参数（分片到达）、用量 */
export function parseChatStream(raw) {
  let content = "", finish = null, usage = null, err = null;
  const calls = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let ev; try { ev = JSON.parse(data); } catch { continue; }
    if (ev.error) err = ev.error.message || JSON.stringify(ev.error);
    if (ev.usage) usage = ev.usage;
    for (const ch of ev.choices || []) {
      const d = ch.delta || {};
      if (d.content) content += d.content;
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? 0;
        calls[i] ||= { name: "", arguments: "" };
        if (tc.function?.name) calls[i].name = tc.function.name;
        if (tc.function?.arguments) calls[i].arguments += tc.function.arguments;
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    }
  }
  if (err) throw new Error(`DeepSeek 返回错误：${err}`);
  return { content, calls: calls.filter(Boolean), finish, usage };
}

/* 宽松修复模型输出的 JSON：字符串里的裸换行 / 制表符转义、去掉 } 或 ] 前多余的逗号。只在严格解析失败时用 */
export function repairJson(t) {
  let out = "", inStr = false, esc = false;
  for (const ch of String(t)) {
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === "\\") { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function parseDeepseekArticle({ content, calls, finish }) {
  if (finish === "length") throw new Error("DeepSeek 输出被截断（达到 max_tokens），文章不完整");
  const call = calls.find(c => c.name === TOOL.name);
  let lastErr = "";
  const tryParse = t => { try { return JSON.parse(t); } catch (e) { lastErr = e.message; try { return JSON.parse(repairJson(t)); } catch (e2) { lastErr = e2.message; return null; } } };
  if (call) {
    const a = unwrapArticle(tryParse(call.arguments));
    if (!a) throw new Error(`DeepSeek 返回的文章参数不是合法 JSON（${lastErr.slice(0, 120)}）`);
    return a;
  }
  /* 没调用函数、直接在正文里给了 JSON：取 ```json 代码块或第一个完整对象 */
  const block = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const a = unwrapArticle(tryParse(block ? block[1] : content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)));
  if (a && a.sections && a.title) return a;
  throw new Error("DeepSeek 没有按要求提交文章");
}

/* ---------- AI 总结超长时，让写稿的同一家模型精简一次（只缩短，不改事实）---------- */
export async function shortenText({ text, max = 280, mock = false }) {
  const { trimBySentences } = await import("./normalize.mjs");
  if (mock) return trimBySentences(text, max);
  const system = `把用户给的这段中文摘要压缩到 ${max} 字以内（按字符数算，标点也算）。只删减和合并，不改任何数字、名称和事实，不加新内容。只输出压缩后的摘要本身。`;
  if (PROVIDER === "deepseek") {
    const json = await post("https://api.deepseek.com/chat/completions", { authorization: `Bearer ${needKey("DEEPSEEK_API_KEY")}` },
      { model: DEFAULT_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: text }], thinking: { type: "disabled" }, max_tokens: 1024, stream: false }, "DeepSeek 精简");
    return (json.choices?.[0]?.message?.content || "").trim();
  }
  if (PROVIDER === "xai") {
    const json = await post("https://api.x.ai/v1/responses", { authorization: `Bearer ${needKey("XAI_API_KEY")}` },
      { model: DEFAULT_MODEL, input: [{ role: "system", content: system }, { role: "user", content: text }], reasoning: { effort: "low" } }, "xAI 精简");
    return xaiTextAndCitations(json).text.trim();
  }
  const json = await post("https://api.anthropic.com/v1/messages", { "x-api-key": needKey("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" },
    { model: DEFAULT_MODEL, max_tokens: 1024, system, messages: [{ role: "user", content: text }] }, "Anthropic 精简");
  return (json.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
}
