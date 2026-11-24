/* 专题：按 AI 厂商 / 模型家族把文章归类（Claude、OpenAI、Gemini、Grok……）
   每篇自动判断：看发布方和标题（不看正文，免得正文里顺带提一句竞品就被归进去）。一篇可以属于几个专题。
   自动判断不准时，在文章 JSON 里写 "topics": ["openai", "microsoft"] 覆盖。
   新增专题：在 TOPICS 里加一行，排在前面的在页面上也排在前面（同样篇数时） */
export const TOPICS = [
  { k: "claude", core: true, zh: "Claude", en: "Claude", sub: { zh: "Anthropic", en: "Anthropic" }, re: /Anthropic|Claude/i },
  { k: "openai", core: true, zh: "OpenAI", en: "OpenAI", sub: { zh: "ChatGPT · GPT · Codex", en: "ChatGPT · GPT · Codex" }, re: /OpenAI|ChatGPT|\bGPT-|Codex|\bSora\b/i },
  { k: "gemini", core: true, zh: "Gemini", en: "Gemini", sub: { zh: "Google · DeepMind", en: "Google · DeepMind" }, re: /Google|DeepMind|Gemini|\bGenie\b|\bVeo\b|谷歌/i },
  { k: "grok", core: true, zh: "Grok", en: "Grok", sub: { zh: "xAI", en: "xAI" }, re: /\bxAI\b|Grok/i },
  { k: "microsoft", zh: "微软", en: "Microsoft", sub: { zh: "Copilot · MAI", en: "Copilot · MAI" }, re: /Microsoft|微软|Copilot|\bMAI\b/i },
  { k: "meta", zh: "Meta", en: "Meta", sub: { zh: "Llama", en: "Llama" }, re: /\bMeta\b|Llama/ },
  { k: "nvidia", zh: "NVIDIA", en: "NVIDIA", sub: { zh: "英伟达", en: "GPUs · RTX" }, re: /NVIDIA|英伟达|\bRTX\b/i },
  { k: "deepseek", zh: "DeepSeek", en: "DeepSeek", sub: { zh: "深度求索", en: "DeepSeek" }, re: /DeepSeek|深度求索/i },
  { k: "qwen", zh: "通义千问", en: "Qwen", sub: { zh: "阿里巴巴", en: "Alibaba" }, re: /Qwen|通义|阿里巴巴|Alibaba/i },
  { k: "mistral", zh: "Mistral", en: "Mistral", sub: { zh: "Mistral AI", en: "Mistral AI" }, re: /Mistral/i },
  { k: "apple", zh: "Apple", en: "Apple", sub: { zh: "Apple Intelligence", en: "Apple Intelligence" }, re: /\bApple\b|苹果/i },
  { k: "amazon", zh: "Amazon", en: "Amazon", sub: { zh: "AWS · Nova", en: "AWS · Nova" }, re: /Amazon|\bAWS\b|亚马逊/i }
];
const KEYS = new Set(TOPICS.map(t => t.k));

export function topicsOf(a) {
  if (Array.isArray(a.topics) && a.topics.length) return a.topics.filter(k => KEYS.has(k));
  if (a.category === "paper") return [];   /* 论文精读按论文讲，不按「谁家发的」归进厂商专题；需要时手动写 topics */
  const hay = `${a.publisher || ""} ${a.title || ""}`;
  return TOPICS.filter(t => t.re.test(hay)).map(t => t.k);
}

/* 页面上显示的专题：四大家（core）固定在前、按固定顺序，即使暂时没有文章；其余有文章的按篇数排在后面 */
export function topicList(articles, lang = "zh", { keys = null } = {}) {
  const n = k => articles.filter(a => (a._topics || topicsOf(a)).includes(k)).length;
  const all = TOPICS.map((t, i) => ({ k: t.k, name: t[lang] || t.zh, sub: t.sub[lang] || t.sub.zh, n: n(t.k), core: !!t.core, i }));
  const show = keys ? all.filter(t => keys.includes(t.k)) : all.filter(t => t.core || t.n > 0);
  return show.sort((a, b) => (b.core - a.core) || (a.core ? a.i - b.i : b.n - a.n || a.i - b.i)).map(({ i, core, ...t }) => t);
}
