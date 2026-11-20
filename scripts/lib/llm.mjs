/* 调用大模型：写稿用「强制工具调用」拿结构化 JSON；X 监测用 Grok 的 X 搜索
   写稿模型由 WG_PROVIDER 决定：anthropic（默认，需要 ANTHROPIC_API_KEY）或 xai（需要 XAI_API_KEY）
   WG_MODEL 可覆盖具体模型 */
import fs from "node:fs";
import path from "node:path";
import { FIXTURES } from "./paths.mjs";

export const PROVIDER = (process.env.WG_PROVIDER || "anthropic").toLowerCase();
const DEFAULTS = { anthropic: "claude-sonnet-5-5", xai: "grok-4.7" };
export const DEFAULT_MODEL = process.env.WG_MODEL || DEFAULTS[PROVIDER] || DEFAULTS.anthropic;
export const XAI_SEARCH_MODEL = process.env.WG_X_MODEL || "grok-4.7";

const TOOL = { name: "submit_article", description: "提交写好的解读文章（结构化）" };

/* ---------- 解析：单独导出，方便测试 ---------- */
export function parseAnthropic(json) {
  const call = (json.content || []).find(c => c.type === "tool_use" && c.name === TOOL.name);
  if (!call) throw new Error("模型没有按要求返回文章");
  return call.input;
}

export function parseXaiFunctionCall(json) {
  const call = (json.output || []).find(o => o.type === "function_call" && o.name === TOOL.name);
  if (!call) throw new Error("模型没有按要求返回文章");
  try { return typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments; }
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
  if (mock) return JSON.parse(fs.readFileSync(path.join(FIXTURES, "llm-article.json"), "utf8"));

  if (PROVIDER === "xai") {
    const json = await post("https://api.x.ai/v1/responses", { authorization: `Bearer ${needKey("XAI_API_KEY")}` }, {
      model: DEFAULT_MODEL,
      input: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "function", name: TOOL.name, description: TOOL.description, parameters: schema }],
      tool_choice: { type: "function", function: { name: TOOL.name } },
      parallel_tool_calls: false
    }, "xAI 接口");
    return parseXaiFunctionCall(json);
  }

  if (PROVIDER !== "anthropic") throw new Error(`不认识的 WG_PROVIDER：${PROVIDER}（可选 anthropic、xai）`);
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
