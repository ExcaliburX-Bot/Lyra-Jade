/* 发布前的自动检查：格式、图的数据、数字能不能在原文里找到、措辞
   errors 必须清零才能合并；warnings 交给编辑判断 */
import { FIGURE_SPEC } from "../../site/assets/components.js";
import { normNum } from "./text.mjs";
/* 「500,000+」「约 30%」这类：比对时去掉前后的修饰符 */
const numCore = v => normNum(v).replace(/^(约|超过|逾|近|~|≈|>|＞|\+)+/, "").replace(/(\+|以上|左右|多)+$/, "");

const CATEGORIES = ["product", "research", "deep", "biz", "howto", "visual", "insight", "other"];
const HYPE = ["革命性", "炸裂", "颠覆", "史诗级", "遥遥领先", "王炸", "吊打", "震撼发布", "杀疯了", "天花板", "很炫", "碾压", "封神", "秒杀"];
const TITLE_RANK = /第一|最强|最好|最佳|榜首|冠军|SOTA|No\.?\s?1|#1/i;
const SCHEMATIC = ["timeline", "route", "steps", "pipeline", "beforeafter"];

/* 日期类事实：原文常写「November 20, 2026」或「Today」，模型统一写成 2026-11-20。
   返回 true＝原文里有同一天的其他写法；"relative"＝原文是 Today/Yesterday 且换算后和发布日一致；false＝找不到 */
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
export function dateCheck(value, hay, pubDates = []) {
  const m = String(value).trim().match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]], full = MONTHS[mo - 1], short = full.slice(0, 3), p2 = n => String(n).padStart(2, "0");
  const variants = [`${full} ${d}, ${y}`, `${short} ${d}, ${y}`, `${short}. ${d}, ${y}`, `${d} ${full} ${y}`, `${d} ${short} ${y}`,
    `${y}年${mo}月${d}日`, `${y}/${p2(mo)}/${p2(d)}`, `${y}/${mo}/${d}`, `${mo}/${d}/${y}`, `${y}-${p2(mo)}-${p2(d)}`];
  if (variants.some(v => hay.includes(normNum(v)))) return true;
  const iso = `${y}-${p2(mo)}-${p2(d)}`, shift = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const pubs = pubDates.filter(Boolean);
  if (/today|今天|今日/.test(hay) && pubs.includes(iso)) return "relative";
  if (/yesterday|昨天|昨日/.test(hay) && pubs.some(p => shift(p, -1) === iso)) return "relative";
  return false;
}

export function validateArticle(a, { sourceTexts = {} } = {}) {
  const errors = [], warnings = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };

  need(/^[a-z0-9-]{3,80}$/.test(a.slug || ""), "slug 只能用小写字母、数字和连字符");
  need(/^\d{4}-\d{2}-\d{2}$/.test(a.date || ""), "date 格式应为 YYYY-MM-DD");
  need(CATEGORIES.includes(a.category), `category 必须是 ${CATEGORIES.join(" / ")} 之一`);
  need(a.title && a.title.length <= 60, "标题必填，且不超过 60 字");
  if (a.title && TITLE_RANK.test(a.title)) warnings.push(`标题里有排名或最高级说法「${a.title.match(TITLE_RANK)[0]}」：排名写进正文并注明出处，标题写发生了什么`);
  need(a.summary && a.summary.length <= 160, "导语必填，且不超过 160 字");
  const aiLen = [...String(a.ai_summary || "").replace(/\s/g, "")].length;
  need(aiLen >= 100 && aiLen <= 300, `AI 总结（ai_summary）要 100–300 字，现在 ${aiLen} 字`);
  need(Array.isArray(a.brief) && a.brief.length >= 2 && a.brief.length <= 4, "一分钟速览要 2–4 条");
  need(Array.isArray(a.sections) && a.sections.length >= 3, "至少 3 个小节");
  need(a.sources?.main?.url, "来源块必须有主材料链接");
  need(Array.isArray(a.claims) && a.claims.length > 0, "事实清单不能为空：正文里的数字要列进 claims");

  /* 图 */
  let figCount = 0;
  (a.sections || []).forEach((sec, si) => (sec.blocks || []).forEach((b, bi) => {
    if (!b.fig) return;
    figCount++;
    const f = b.fig, where = `第 ${si + 1} 节第 ${bi + 1} 块的图`;
    if (!FIGURE_SPEC[f.type]) { errors.push(`${where}：不认识的图型 ${f.type}`); return; }
    FIGURE_SPEC[f.type].forEach(k => need(f[k] != null, `${where}（${f.type}）缺少字段 ${k}`));
    need(f.title, `${where} 缺少标题`);
    if (!f.subtitle) warnings.push(`${where} 没有副标题（应写明「示意图」或单位）`);
    if (SCHEMATIC.includes(f.type) && f.subtitle && !f.subtitle.includes("示意")) warnings.push(`${where} 是示意类图型，副标题里应写「示意」`);
    if (f.type === "capacity") (f.items || []).forEach(it => need(typeof it.value === "number" && it.value >= 0 && it.value <= f.max, `${where}：${it.label} 的数值不在 0 到 max 之间`));
    if (f.type === "bars") (f.groups || []).flatMap(g => g.items || []).forEach(it => need(typeof it.value === "number" || it.status, `${where}：${it.label} 既没有数值也没有状态说明`));
    if (f.type === "timeline") (f.lanes || []).flatMap(l => l.segments || []).forEach(s => need(s.from < s.to && s.from >= f.axis.from && s.to <= f.axis.to, `${where}：时间段 ${s.from}–${s.to} 超出坐标轴`));
    if (f.type === "columns") (f.items || []).forEach(it => need(typeof it.value === "number" && it.value >= 0, `${where}：${it.label} 的数值要是非负数字`));
    if (f.type === "table") (f.rows || []).forEach((r, i) => need(Array.isArray(r) && r.length === (f.columns || []).length, `${where}：第 ${i + 1} 行的格数和表头对不上`));
    if (f.type === "cards") need((f.items || []).length >= 2 && f.items.length <= 6, `${where}：卡片要 2–6 张`);
    if (f.type === "quote") {
      /* 引语必须逐字出自原文：编造或改写的引语直接拦下 */
      const src = sourceTexts[f.source_url];
      if (!src) warnings.push(`${where}：引语的出处没有存档，无法核对，需人工确认`);
      else need(normNum(src).includes(normNum(f.text)), `${where}：引语在原文里找不到，必须逐字复制原文`);
      if ([...String(f.text || "")].length > 320) warnings.push(`${where}：引语太长，控制在两三句以内`);
    }
    if (f.type === "code") {
      const inSource = Object.values(sourceTexts).some(t => normNum(t).includes(normNum(String(f.code || "").split("\n").find(l => l.trim().length > 12) || "\u0000")));
      if (!inSource && f.subtitle && !f.subtitle.includes("示意")) warnings.push(`${where}：代码不是原文里的，副标题要写「示意」`);
    }
  }));
  if (figCount === 0) warnings.push("全文没有图：确认这篇确实不需要配图");
  if (figCount > 7) warnings.push(`图有 ${figCount} 张，偏多`);

  /* 事实清单：数字回查原文 */
  (a.claims || []).forEach((c, i) => {
    need(c.value != null && c.source_url, `事实 #${i + 1} 缺少 value 或 source_url`);
    const text = sourceTexts[c.source_url];
    if (!text) { warnings.push(`事实 #${i + 1}「${c.text}」的原文没有存档，无法自动回查，需人工核对`); return; }
    const hay = normNum(text);
    if (!hay.includes(normNum(c.value)) && !hay.includes(numCore(c.value))) {
      const d = dateCheck(c.value, hay, [a.date, a.sources?.main?.date]);
      if (d === "relative") warnings.push(`事实 #${i + 1}「${c.text}」：原文写的是相对日期（如 Today），已按发布日换算为 ${c.value}，请确认`);
      else if (!d) errors.push(`事实 #${i + 1}「${c.text}」：数值 ${c.value} 在原文里找不到`);
    }
    if (c.quote && !hay.includes(normNum(c.quote))) warnings.push(`事实 #${i + 1} 的引文和原文对不上，可能是改写过`);
  });

  /* 正文里出现、却不在事实清单里的数字 */
  const claimed = new Set((a.claims || []).flatMap(c => [c.value, c.as_written].filter(Boolean).flatMap(v => [normNum(v), numCore(v)])));
  const bodyText = [a.ai_summary, a.summary, ...(a.brief || []), ...(a.sections || []).flatMap(s => s.blocks.map(b => b.p || (b.list || []).join(" ")))].filter(Boolean).join(" ");
  const nums = [...new Set((bodyText.match(/\d[\d,.]*\s?(%|GB|TB|美元|亿|万|倍|核|fps|W)/g) || []).map(normNum))];
  const orphan = nums.filter(n => ![...claimed].some(c => c.includes(n) || n.includes(c)));
  if (orphan.length) warnings.push(`正文里这些数字没有列进事实清单：${orphan.slice(0, 12).join("、")}`);

  /* 措辞 */
  const all = JSON.stringify(a);
  HYPE.forEach(w => { if (all.includes(w)) warnings.push(`出现夸张用词「${w}」`); });

  return { errors, warnings };
}

export function reportMarkdown(a, r) {
  const li = xs => xs.length ? xs.map(x => `- ${x}`).join("\n") : "- 无";
  return `### 自动校验：${a.title}\n\n**必须修改（${r.errors.length}）**\n${li(r.errors)}\n\n**请人工确认（${r.warnings.length}）**\n${li(r.warnings)}\n`;
}
